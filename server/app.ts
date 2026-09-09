import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from './db.js';
import { createSeedState } from './seed.js';
import { createPortfolioState } from './portfolio-seed.js';
import { createShowcaseState } from './showcase-seed.js';
import { seedConfiguration, type SeedProfile } from './seed-config.js';
import { HttpError, audit, authorize, checkVersion, collection, createRecord, day, delivery, getRecord, id, latestStreamChange, patchRecord, period, pmo, reportDraft, requireThat, schemas, sourceVersions, streamConfirmed, textField, touch, transition, validateReferences } from './domain.js';
import { aiAvailable, draftReport, extractNotes } from './ai.js';
import { exportCsv, exportWorkbook, importFingerprint, previewImport } from './imports.js';
import type { HubState, ImportPreview, Member, Report, Submission } from '../shared/types.js';

export type AppOptions = { dataDir?: string; seedProfile?: SeedProfile; state?: HubState; testMode?: boolean; now?: () => Date; databaseUrl?: string; logger?: boolean };
export async function createApp(options: AppOptions = {}) {
  const now = () => (options.now?.() ?? new Date()).toISOString();
  requireThat((process.env.APP_MODE ?? 'demo') === 'demo', 'Corporate identity is not configured. Non-demo mode is disabled.', 503);
  const configuration = seedConfiguration(options);
  const initialState = options.state ?? (configuration.seedProfile === 'showcase' ? createShowcaseState(new Date(now())) : configuration.seedProfile === 'demo' ? createSeedState(new Date(now())) : createPortfolioState(new Date(now())));
  const store = await Store.open({ dataDir: configuration.dataDir, databaseUrl: options.testMode ? options.databaseUrl : options.databaseUrl ?? process.env.DATABASE_URL, initialState });
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 8 * 1024 * 1024 });
  await app.register(cookie);
  const sessions = new Map<string, { userId: string; expires: number }>();
  const previews = new Map<string, { preview: ImportPreview; userId: string; expires: number }>();
  const aiRequests = new Map<string, number[]>();
  const sessionCookie = configuration.seedProfile === 'showcase' ? 'pmo_showcase_session' : 'pmo_demo_session';

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    const host = request.headers.host ?? '';
    const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
    requireThat(['localhost', '127.0.0.1', '::1'].includes(hostname), 'This local preview is restricted to localhost.', 403);
    const origin = request.headers.origin;
    if (origin) {
      let parsed: URL;
      try { parsed = new URL(origin); } catch { throw new HttpError(403, 'Invalid request origin.'); }
      requireThat(parsed.host === host && ['http:', 'https:'].includes(parsed.protocol), 'Cross-origin requests are not allowed.', 403);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) requireThat(request.headers['content-type']?.includes('application/json'), 'Send JSON with Content-Type application/json.', 415);
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: error.issues.map(i => `${i.path.join('.') || 'Input'}: ${i.message}`).join('; ') });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.message });
    const status = typeof (error as any).statusCode === 'number' ? (error as any).statusCode : 500;
    request.log.error(error);
    return reply.code(status).send({ error: status < 500 && error instanceof Error ? error.message : 'Unable to complete the request. No partial changes were saved.' });
  });
  app.addHook('onClose', async () => { sessions.clear(); previews.clear(); await store.close(); });

  function current(request: FastifyRequest, state: HubState): Member {
    const token = request.cookies[sessionCookie], session = token ? sessions.get(token) : undefined;
    requireThat(session && session.expires > Date.now(), 'Open the hub to start a local demo session.', 401);
    const member = state.members.find(m => m.id === session.userId);
    requireThat(member, 'Demo persona is unavailable.', 401);
    return member;
  }
  function setSession(reply: any, userId: string) {
    const token = randomUUID(); sessions.set(token, { userId, expires: Date.now() + 12 * 60 * 60 * 1000 });
    reply.setCookie(sessionCookie, token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 12 * 60 * 60 });
    return userId;
  }
  function aiLimit(user: Member) {
    const recent = (aiRequests.get(user.id) ?? []).filter(t => t > Date.now() - 60000);
    requireThat(recent.length < 3, 'Please wait a minute before requesting another AI draft.', 429);
    recent.push(Date.now()); aiRequests.set(user.id, recent);
  }
  const mutate = <T>(request: FastifyRequest, callback: (state: HubState, user: Member, timestamp: string) => T | Promise<T>) => store.mutate(state => callback(state, current(request, state), now()));

  app.get('/api/bootstrap', async (request, reply) => {
    const state = await store.read();
    let userId: string;
    try { userId = current(request, state).id; } catch { const member = state.members.find(m => m.id === 'pmo-nadia') ?? state.members.find(m => m.role === 'pmo'); requireThat(member, 'The demo needs a PMO persona.', 500); userId = setSession(reply, member.id); }
    return { state, currentUserId: userId, aiAvailable: aiAvailable(), demoMode: true, now: now() };
  });
  app.post('/api/demo/persona', async (request, reply) => {
    const state = await store.read(); current(request, state);
    const { userId } = z.object({ userId: z.string() }).parse(request.body);
    requireThat(state.members.some(m => m.id === userId), 'Unknown local preview role.');
    if (request.cookies[sessionCookie]) sessions.delete(request.cookies[sessionCookie]);
    return { currentUserId: setSession(reply, userId) };
  });
  app.post('/api/items', request => mutate(request, (state, user, stamp) => createRecord(state, user, 'items', request.body, stamp)));
  app.post<{ Params: { collection: string } }>('/api/records/:collection', request => mutate(request, (state, user, stamp) => createRecord(state, user, collection(request.params.collection), request.body, stamp)));
  app.patch<{ Params: { collection: string; id: string } }>('/api/records/:collection/:id', request => mutate(request, (state, user, stamp) => patchRecord(state, user, collection(request.params.collection), request.params.id, request.body, stamp)));
  app.post<{ Params: { id: string } }>('/api/items/:id/transition', request => mutate(request, (state, user, stamp) => transition(state, user, request.params.id, request.body, stamp)));

  app.post<{ Params: { id: string } }>('/api/items/:id/escalate', request => mutate(request, (state, user, stamp) => {
    const item = getRecord(state.items, request.params.id);
    authorize(state, user, 'items', item);
    const input = z.object({
      version: z.number().int().positive(), title: z.string().trim().min(1).max(240),
      decisionNeeded: textField.refine(Boolean, 'Describe the decision or help needed.'),
      ownerId: z.string().trim().min(1).max(150), dueDate: day,
      priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
      milestoneIds: z.array(z.string().trim().min(1).max(150)).max(50).refine(values => new Set(values).size === values.length, 'Choose each milestone once.').default([]),
    }).strict().parse(request.body);
    checkVersion(item, input.version);
    requireThat(item.stage !== 'Closed', 'Reopen closed work before raising an escalation.', 409);
    const owner = state.members.find(member => member.id === input.ownerId);
    requireThat(owner && owner.role !== 'executive', 'Choose an existing delivery team member to own the escalation.');
    const escalatedSnapshot = (value: unknown) => Boolean(value && typeof value === 'object' && 'status' in value && value.status === 'escalated');
    const raisedRegisterIds = new Set(state.events.filter(event => event.entityType === 'registers' && (
      event.action === 'escalated' || escalatedSnapshot(event.before) || escalatedSnapshot(event.after)
    )).map(event => event.entityId));
    const previous = state.registers.find(register => register.status !== 'resolved' && register.relatedItemIds.includes(item.id) && (
      register.status === 'escalated' || raisedRegisterIds.has(register.id)
    ));
    requireThat(!previous, 'Open existing escalation before creating another for this work item.', 409);
    // Item authority is sufficient here, including an assigned owner without
    // broad workstream membership. No persistent permissions are added.
    const register = {
      ...schemas.registers.parse({
        type: 'issue', title: input.title, detail: input.decisionNeeded, nextAction: input.decisionNeeded,
        workstreamId: item.workstreamId, relatedItemIds: [item.id], milestoneIds: input.milestoneIds,
        ownerId: input.ownerId, dueDate: input.dueDate, priority: input.priority,
        probability: 'Medium', status: 'escalated', mitigation: '', impact: '', clientVisible: false, clientSummary: '',
      }),
      id: id(), version: 1, updatedAt: stamp,
    };
    validateReferences(state, 'registers', register);
    const before = structuredClone(item);
    state.registers.push(register); touch(item, stamp);
    audit(state, user, 'registers', register.id, 'escalated', input.decisionNeeded, null, register, stamp);
    audit(state, user, 'items', item.id, 'escalated', `Raised escalation: ${register.title} (register ${register.id}).`, before, item, stamp);
    return { register, item };
  }));

  app.post<{ Params: { id: string } }>('/api/items/:id/tests', request => mutate(request, (state, user, stamp) => {
    delivery(user);
    const input = z.object({ result: z.enum(['pass', 'fail']), blocking: z.boolean().default(false), notes: textField.refine(Boolean, 'Include test findings.'), evidence: textField.refine(Boolean, 'Include test evidence.'), stage: z.string().optional(), cycle: z.number().int().positive().optional(), version: z.number().int().positive().optional() }).parse(request.body);
    const item = getRecord(state.items, request.params.id);
    if (input.version !== undefined) checkVersion(item, input.version);
    requireThat(input.cycle === undefined || input.cycle === item.cycle, 'This test belongs to an earlier delivery cycle. Review the current item before recording a result.', 409);
    const testing = ['UAT', 'Production verification', 'Review'].includes(item.stage);
    requireThat(input.result === 'fail' || testing, 'Passing checks must be recorded in UAT, production verification, or review.');
    requireThat(item.stage !== 'Backlog', 'Start work before recording a test finding.');
    requireThat(!input.stage || input.stage === item.stage, 'This item has moved since the test form was opened.', 409);
    const before = structuredClone(item);
    const test = { id: id(), itemId: item.id, cycle: item.cycle, stage: item.stage, result: input.result, blocking: input.result === 'fail' && input.blocking, notes: input.notes, evidence: input.evidence, authorId: user.id, createdAt: stamp };
    state.tests.push(test);
    if (input.result === 'fail' && input.blocking && !testing) {
      item.stage = item.kind === 'software' ? 'Development' : 'In progress';
      item.cycle += 1; delete item.closedAt;
      item.blocked = true; item.blockedSince ||= stamp;
      item.blockReason = `Blocking verification failure: ${input.notes}`;
      item.nextAction = 'Resolve the failed check, clear the blocker, and repeat the delivery checks.';
    }
    touch(item, stamp);
    audit(state, user, 'tests', test.id, 'test_recorded', `${item.title}: ${input.result}${test.blocking ? ' (blocking)' : ''}`, null, test, stamp);
    audit(state, user, 'items', item.id, item.cycle !== before.cycle ? 'reopened_by_failure' : 'evidence_added', `Recorded ${input.result} in ${test.stage}`, before, item, stamp);
    return test;
  }));
  app.post<{ Params: { id: string } }>('/api/test-results/:id/resolve', request => mutate(request, (state, user, stamp) => {
    delivery(user);
    const { notes } = z.object({ notes: textField.refine(Boolean, 'Describe how the failure was resolved.') }).parse(request.body);
    const test = state.tests.find(t => t.id === request.params.id);
    requireThat(test, 'Test result not found.', 404); requireThat(test.result === 'fail' && !test.resolvedAt, 'This failure is already resolved or is not a failure.', 409);
    const before = structuredClone(test);
    Object.assign(test, { resolvedAt: stamp, resolvedBy: user.id, resolution: notes });
    const item = getRecord(state.items, test.itemId); touch(item, stamp);
    audit(state, user, 'tests', test.id, 'failure_resolved', notes, before, test, stamp);
    return test;
  }));
  app.post<{ Params: { id: string } }>('/api/items/:id/client-response', request => mutate(request, (state, user, stamp) => {
    delivery(user);
    const input = z.object({ version: z.number().int(), decision: z.enum(['accepted', 'rejected']), notes: textField.refine(Boolean, 'Record the client response.'), evidence: textField.refine(Boolean, 'Reference the client response evidence.'), currentOwnerId: z.string().optional() }).parse(request.body);
    const item = getRecord(state.items, request.params.id); checkVersion(item, input.version);
    if (input.currentOwnerId) requireThat(state.members.some(m => m.id === input.currentOwnerId && m.role !== 'executive'), 'Choose a delivery team member.');
    requireThat(item.kind === 'software' && item.stage === 'Awaiting client acceptance', 'Client acceptance follows production verification.');
    if (input.decision === 'accepted') {
      requireThat(!item.blocked, 'Resolve the item blocker before recording acceptance.');
      requireThat(!state.tests.some(t => t.itemId === item.id && t.result === 'fail' && t.blocking && !t.resolvedAt), 'Resolve blocking failures before client acceptance.');
    }
    const before = structuredClone(item);
    if (input.decision === 'accepted') { item.stage = 'Closed'; item.closedAt = stamp; }
    else { item.stage = 'Development'; item.cycle += 1; delete item.closedAt; item.nextAction = input.notes; item.currentOwnerId = input.currentOwnerId ?? item.ownerId; }
    touch(item, stamp);
    audit(state, user, 'items', item.id, `client_${input.decision}`, `${input.notes}\nEvidence: ${input.evidence}`, before, item, stamp);
    return item;
  }));
  app.post<{ Params: { id: string } }>('/api/items/:id/reopen', request => mutate(request, (state, user, stamp) => {
    const input = z.object({ version: z.number().int(), reason: textField.refine(Boolean, 'Provide a reopening reason.'), currentOwnerId: z.string().optional() }).parse(request.body);
    const item = getRecord(state.items, request.params.id); delivery(user); checkVersion(item, input.version);
    requireThat(item.stage !== 'Backlog', 'Backlog work has not started and cannot be reopened.');
    if (input.currentOwnerId) requireThat(state.members.some(m => m.id === input.currentOwnerId && m.role !== 'executive'), 'Choose a delivery team member.');
    const before = structuredClone(item); item.stage = item.kind === 'software' ? 'Development' : 'In progress'; item.cycle += 1; delete item.closedAt;
    item.currentOwnerId = input.currentOwnerId ?? item.currentOwnerId; item.nextAction = input.reason; touch(item, stamp);
    audit(state, user, 'items', item.id, 'reopened', input.reason, before, item, stamp);
    return item;
  }));

  app.post('/api/submissions', request => mutate(request, (state, user, stamp) => {
    const input = z.object({ workstreamId: z.string(), completed: textField, next: textField, changes: textField, blockers: textField, health: z.enum(['green', 'amber', 'red', 'unknown']), sourceUpdatedAt: z.string().optional() }).parse(request.body);
    const workstream = getRecord(state.workstreams, input.workstreamId); authorize(state, user, 'workstreams', workstream);
    const openedSourceUpdatedAt = latestStreamChange(state, workstream.id);
    requireThat(input.sourceUpdatedAt === undefined || input.sourceUpdatedAt === openedSourceUpdatedAt, 'This workstream changed while the confirmation was open. Review the latest details.', 409);
    if (workstream.health !== input.health) { const prior = structuredClone(workstream); workstream.health = input.health; touch(workstream, stamp); audit(state, user, 'workstreams', workstream.id, 'health_confirmed', 'Health updated during weekly confirmation', prior, workstream, stamp); }
    const sourceUpdatedAt = latestStreamChange(state, workstream.id);
    const periodEnd = period(new Date(stamp), state.settings.timezone, state.settings.cutoffHour).end;
    let submission = state.submissions.find(s => s.workstreamId === input.workstreamId && s.periodEnd === periodEnd);
    const before = submission ? structuredClone(submission) : null;
    const fields = { workstreamId: input.workstreamId, completed: input.completed, next: input.next, changes: input.changes, blockers: input.blockers, health: input.health, confirmedBy: user.id, confirmedAt: stamp, sourceUpdatedAt };
    if (submission) { Object.assign(submission, fields); touch(submission, stamp); }
    else { submission = { ...fields, id: id(), periodEnd, version: 1, updatedAt: stamp }; state.submissions.push(submission); }
    audit(state, user, 'submissions', submission.id, 'confirmed', `Confirmed ${workstream.name} for ${periodEnd}`, before, submission, stamp);
    return submission;
  }));
  app.post('/api/reports', request => mutate(request, (state, user, stamp) => {
    const { audience, supersedesId } = z.object({ audience: z.enum(['internal', 'client']), supersedesId: z.string().optional() }).parse(request.body);
    const report = reportDraft(state, user, audience, stamp, supersedesId); state.reports.push(report);
    audit(state, user, 'reports', report.id, 'draft_created', report.title, null, report, stamp);
    return report;
  }));
  app.post<{ Params: { id: string } }>('/api/reports/:id/approve', request => mutate(request, (state, user, stamp) => {
    requireThat(user.canApproveReports, 'An authorized report approver is required.', 403);
    const { version, incompleteReason } = z.object({ version: z.number().int(), incompleteReason: textField.optional() }).parse(request.body);
    const report = getRecord(state.reports, request.params.id); checkVersion(report, version);
    requireThat(report.status === 'draft', 'This report is already approved.', 409);
    const latest = sourceVersions(state);
    requireThat(Object.keys(latest).length === Object.keys(report.sourceVersions).length && Object.entries(latest).every(([key, value]) => report.sourceVersions[key] === value), 'Source records changed since this draft. Create and review a fresh draft before approval.', 409);
    const missing = report.supersedesId
      ? getRecord(state.reports, report.supersedesId).body.workstreams.filter(w => !w.confirmed)
      : state.workstreams.filter(w => !streamConfirmed(state, w.id, report.periodEnd));
    requireThat(!missing.length || incompleteReason?.trim(), 'Some workstreams are unconfirmed or stale. Confirm them or provide a reason to approve an incomplete brief.');
    const before = structuredClone(report); report.status = 'approved'; report.approvedAt = stamp; report.approvedBy = user.id;
    if (missing.length) report.incompleteReason = incompleteReason;
    touch(report, stamp);
    audit(state, user, 'reports', report.id, 'approved', incompleteReason || 'Approved reviewed snapshot', before, report, stamp);
    return report;
  }));
  app.get<{ Params: { id: string } }>('/api/reports/:id/presentation', async request => {
    const state = await store.read(); current(request, state);
    const report = getRecord(state.reports, request.params.id);
    requireThat(report.status === 'approved', 'Only an approved report has a presentation.', 409);
    // Explicit allowlist: no live source records, audit entries, source versions,
    // user contact details, or internal annotations can enter this view.
    return { id: report.id, title: report.title, audience: report.audience, periodStart: report.periodStart, periodEnd: report.periodEnd, asOf: report.asOf, approvedAt: report.approvedAt, status: report.status, body: report.body, ...(state.settings.demoScenario === 'consulting-lifecycle' ? { demoScenario: state.settings.demoScenario } : {}) };
  });
  app.patch('/api/settings', request => mutate(request, (state, user, stamp) => {
    pmo(user);
    const schema = z.object({ projectName: z.string().trim().min(1).max(150), phaseName: z.string().trim().min(1).max(150), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Use a valid IANA timezone.'), submissionHour: z.number().int().min(0).max(23), cutoffHour: z.number().int().min(0).max(23), blockedEscalationDays: z.number().int().min(1).max(30), workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7) });
    const { expectedVersion, ...fields } = z.object({ expectedVersion: z.number().int().positive() }).passthrough().parse(request.body);
    const changes = schema.partial().strict().parse(fields); const before = structuredClone(state.settings);
    const currentVersion = state.settings.version ?? 1;
    requireThat(expectedVersion === currentVersion, 'Project settings changed. Refresh and review the latest settings before saving.', 409);
    Object.assign(state.settings, changes); requireThat(state.settings.submissionHour <= state.settings.cutoffHour, 'Submission time must be at or before cutoff.');
    state.settings.version = currentVersion + 1;
    audit(state, user, 'settings', 'project', 'updated', 'Updated project cadence', before, state.settings, stamp);
    return state.settings;
  }));

  app.post('/api/import/preview', async request => {
    const state = await store.read(), user = current(request, state); pmo(user);
    const body = z.object({ filename: z.string().max(200), content: z.string(), mapping: z.record(z.string(), z.string()).optional() }).parse(request.body);
    const preview = await previewImport(state, body.filename, body.content, body.mapping, now());
    for (const [key, value] of previews) if (value.expires < Date.now()) previews.delete(key);
    requireThat(previews.size < 50, 'Too many pending imports. Wait for an older preview to expire.', 429);
    previews.set(preview.id, { preview, userId: user.id, expires: Date.now() + 30 * 60000 });
    return preview;
  });
  app.post('/api/import/commit', request => mutate(request, (state, user, stamp) => {
    pmo(user); const { previewId } = z.object({ previewId: z.string() }).parse(request.body);
    const entry = previews.get(previewId); requireThat(entry && entry.userId === user.id && entry.expires > Date.now(), 'Import preview expired. Preview the file again.', 409);
    const created = []; let skipped = 0;
    for (const row of entry.preview.rows) {
      const fingerprint = importFingerprint(previewId, row.line);
      if (row.errors.length || row.duplicate || state.items.some(i => i.importedFrom === fingerprint || i.workstreamId === row.item.workstreamId && i.title.toLowerCase() === row.item.title?.toLowerCase())) { skipped++; continue; }
      const item = createRecord(state, user, 'items', row.item, stamp);
      item.importedFrom = fingerprint;
      item.stage = row.item.stage ?? 'Backlog';
      // Historical stage is provenance supplied by the importer, not a new
      // client acceptance. No test, acceptance event, or closedAt is fabricated.
      audit(state, user, 'items', item.id, 'imported', `Imported row ${row.line}; original stage: ${item.stage}. Historical evidence has not been verified.`, null, item, stamp);
      created.push(item);
    }
    return { importedCount: created.length, skippedCount: skipped, items: created };
  }));
  app.get<{ Querystring: { format?: string } }>('/api/export', async (request, reply) => {
    const state = await store.read(); pmo(current(request, state));
    if (request.query.format === 'csv') return reply.header('Content-Disposition', 'attachment; filename="phase-two-backlog.csv"').type('text/csv; charset=utf-8').send(exportCsv(state));
    requireThat(!request.query.format || request.query.format === 'xlsx', 'Choose CSV or XLSX export.');
    return reply.header('Content-Disposition', 'attachment; filename="phase-two-hub.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await exportWorkbook(state));
  });
  app.post('/api/ai/report', async request => {
    const state = await store.read(), user = current(request, state); pmo(user); aiLimit(user);
    const { reportId } = z.object({ reportId: z.string() }).parse(request.body);
    return draftReport(state, getRecord(state.reports, reportId));
  });
  app.post('/api/ai/extract', async request => {
    const state = await store.read(), user = current(request, state); delivery(user); aiLimit(user);
    const { notes } = z.object({ notes: textField.refine(Boolean, 'Add meeting notes first.') }).parse(request.body);
    return extractNotes(state, notes);
  });
  app.post<{ Params: { id: string } }>('/api/meetings/:id/capture', request => mutate(request, (state, user, stamp) => {
    delivery(user);
    const input = z.object({ version: z.number().int(), workstreamId: z.string(), proposal: z.object({ type: z.enum(['action', 'issue', 'decision']), title: z.string().trim().min(1).max(240), detail: textField, ownerId: z.string().min(1), dueDate: z.string().min(1), sourceQuote: textField.optional() }) }).parse(request.body);
    const meeting = getRecord(state.meetings, request.params.id); checkVersion(meeting, input.version);
    requireThat(!input.proposal.sourceQuote || meeting.notes.includes(input.proposal.sourceQuote), 'The source quotation is no longer present in the saved meeting notes.');
    const before = structuredClone(meeting);
    const proposal = input.proposal;
    const existing = proposal.type === 'action'
      ? state.items.find(i => meeting.linkedItemIds.includes(i.id) && i.title === proposal.title && i.description === proposal.detail && i.ownerId === proposal.ownerId && i.dueDate === proposal.dueDate && i.workstreamId === input.workstreamId)
      : state.registers.find(r => meeting.linkedRegisterIds.includes(r.id) && r.type === proposal.type && r.title === proposal.title && r.detail === proposal.detail && r.ownerId === proposal.ownerId && r.dueDate === proposal.dueDate && r.workstreamId === input.workstreamId);
    requireThat(!existing, 'This reviewed proposal is already linked to the meeting.', 409);
    const record = proposal.type === 'action'
      ? createRecord(state, user, 'items', { title: proposal.title, description: proposal.detail, kind: 'general', category: 'action', workstreamId: input.workstreamId, ownerId: proposal.ownerId, currentOwnerId: proposal.ownerId, dueDate: proposal.dueDate, baselineDate: proposal.dueDate, nextAction: proposal.detail }, stamp)
      : createRecord(state, user, 'registers', { type: proposal.type, title: proposal.title, detail: proposal.detail, workstreamId: input.workstreamId, ownerId: proposal.ownerId, dueDate: proposal.dueDate, nextAction: proposal.detail }, stamp);
    if (proposal.type === 'action') meeting.linkedItemIds.push(record.id); else meeting.linkedRegisterIds.push(record.id);
    touch(meeting, stamp);
    audit(state, user, 'meetings', meeting.id, 'proposal_captured', `Captured reviewed ${proposal.type}: ${proposal.title}${proposal.sourceQuote ? `\nSource: ${proposal.sourceQuote}` : ''}`, before, meeting, stamp);
    return { meeting, record };
  }));
  return app;
}
