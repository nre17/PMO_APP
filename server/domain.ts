import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { GENERAL_STAGES, LIFECYCLE_PHASES, SOFTWARE_STAGES, type HubState, type Member, type WorkItem, type Versioned, type Report, type ReportBody, type Stage } from '../shared/types.js';
import { confirmationState, dateInTimezone, latestWorkstreamChange, recordAttention, reportingPeriod, shiftDate } from '../shared/reporting.js';

export class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export function requireThat(condition: unknown, message: string, code = 400): asserts condition { if (!condition) throw new HttpError(code, message); }
export const id = () => randomUUID();
export const textField = z.string().trim().max(12000);
const title = z.string().trim().min(1).max(240);
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const date = new Date(v); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v; }, 'Invalid date');
const health = z.enum(['green', 'amber', 'red', 'unknown']);
const priority = z.enum(['Low', 'Medium', 'High', 'Critical']);
const link = z.string().trim().url().max(2000).refine(v => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS evidence link');
const links = z.array(link).max(30);
const optionalPhase = z.enum(LIFECYCLE_PHASES).nullish().transform(value => value ?? undefined);
const optionalPriority = priority.nullish().transform(value => value ?? undefined);
const unassignedMember = z.string().trim().max(150);
export const itemSchema = z.object({
  title, description: textField, workstreamId: title, deliverableId: z.string().optional(),
  kind: z.enum(['software', 'general']), category: z.enum(['feature', 'bug', 'data', 'evaluation', 'action', 'research']),
  priority: priority.or(z.literal('Not set')), ownerId: z.string().trim().max(150), currentOwnerId: z.string().trim().max(150), baselineDate: day.or(z.literal('')), dueDate: day.or(z.literal('')), acceptanceCriteria: textField,
  evidenceLinks: links, blocked: z.boolean(), blockReason: textField, nextAction: textField,
  clientSummary: textField, clientVisible: z.boolean(), tags: z.array(z.string().max(40)).max(20),
});
const workstreamSchema = z.object({ name: title, shortName: title, description: textField, leadId: unassignedMember, health, statusNote: textField, clientSummary: textField, color: z.string().max(40), lifecyclePhase: optionalPhase, priority: optionalPriority, scope: textField.optional(), nextGate: textField.optional(), gateDate: day.or(z.literal('')).optional(), group: z.string().trim().max(100).optional(), groups: z.array(z.string().trim().min(1).max(100)).max(10).optional(), phaseLabel: z.string().trim().max(160).optional() });
const deliverableSchema = z.object({ title, workstreamId: title, ownerId: unassignedMember, description: textField, lifecyclePhase: optionalPhase, status: z.enum(['planned', 'draft', 'in_review', 'accepted']).nullish().transform(value => value ?? undefined), evidenceLinks: links.optional() });
const milestoneSchema = z.object({ title, workstreamIds: z.array(title).min(1), deliverableIds: z.array(title), ownerId: title, baselineDate: day, forecastDate: day, actualDate: day.optional(), status: z.enum(['planned', 'at_risk', 'complete']), notes: textField });
const registerSchema = z.object({ type: z.enum(['risk', 'assumption', 'issue', 'dependency', 'decision']), title, detail: textField, clientSummary: textField, clientVisible: z.boolean(), workstreamId: title, relatedItemIds: z.array(title).max(50), milestoneIds: z.array(title).max(30), ownerId: title, dueDate: day, priority, probability: z.enum(['Low', 'Medium', 'High']), status: z.enum(['open', 'monitoring', 'escalated', 'resolved']), mitigation: textField, nextAction: textField, impact: textField });
const meetingSchema = z.object({ title, heldAt: z.string().datetime({ offset: true }), notes: textField, linkedItemIds: z.array(title).max(50), linkedRegisterIds: z.array(title).max(50) });
export const reportBodySchema = z.object({ summary: textField, highlights: z.array(textField).max(30), nextWeek: z.array(textField).max(30), attention: z.array(textField).max(30), workstreams: z.array(z.object({ name: title, health, completed: z.array(textField).max(30), next: z.array(textField).max(30), attention: z.array(textField).max(30), confirmed: z.boolean() })).max(30), milestones: z.array(z.object({ title, forecastDate: day, status: textField })).max(50) });
export const schemas = { items: itemSchema, workstreams: workstreamSchema, deliverables: deliverableSchema, milestones: milestoneSchema, registers: registerSchema, meetings: meetingSchema, reports: z.object({ title, body: reportBodySchema, incompleteReason: textField.optional() }) };
export type Collection = keyof typeof schemas;
export function collection(value: string): Collection { requireThat(Object.hasOwn(schemas, value), 'Unknown collection', 404); return value as Collection; }
export function getRecord<T extends Versioned>(rows: T[], recordId: string): T { const record = rows.find(r => r.id === recordId); requireThat(record, 'Record not found', 404); return record; }
export function checkVersion(record: Versioned, version: unknown) { requireThat(Number.isInteger(version) && record.version === version, 'This record changed. Refresh and retry with the latest version.', 409); }
export function touch(record: Versioned, now: string) { record.version += 1; record.updatedAt = now; }
export function audit(state: HubState, user: Member, entityType: string, entityId: string, action: string, detail: string, before: unknown, after: unknown, now: string) {
  state.events.push({ id: id(), entityType, entityId, actorId: user.id, action, detail, before: structuredClone(before), after: structuredClone(after), createdAt: now });
}
export function delivery(user: Member) { requireThat(user.role !== 'executive', 'This view is read-only for executives.', 403); }
export function pmo(user: Member) { requireThat(['pmo', 'admin'].includes(user.role), 'PMO or administrator access required.', 403); }
function assignedWorkstream(state: HubState, user: Member, workstreamId: string) { return user.workstreamIds.includes(workstreamId) || user.role === 'lead' && state.workstreams.some(workstream => workstream.id === workstreamId && workstream.leadId === user.id); }
export function authorize(state: HubState, user: Member, type: Collection, record: any) {
  delivery(user);
  if (['pmo', 'admin'].includes(user.role)) return;
  requireThat(type !== 'reports', 'PMO manages report drafts.', 403);
  const streams: string[] = record.workstreamIds ?? (record.workstreamId ? [record.workstreamId] : type === 'workstreams' ? [record.id] : []);
  if (type === 'meetings') return;
  const lead = user.role === 'lead' && streams.some(s => state.workstreams.find(w => w.id === s)?.leadId === user.id);
  if (type === 'workstreams') { requireThat(lead, 'Only the workstream lead or PMO can update this workstream.', 403); return; }
  const backlogCreator = type === 'items' && record.stage === 'Backlog' && state.events.some(e => e.entityId === record.id && e.action === 'created' && e.actorId === user.id);
  requireThat(lead || backlogCreator || record.ownerId === user.id || record.currentOwnerId === user.id, 'Only an assigned owner, workstream lead, or PMO can update this record.', 403);
}
export function validateReferences(state: HubState, type: Collection, record: any) {
  const exists = (key: 'members' | 'workstreams' | 'deliverables' | 'items' | 'milestones' | 'registers', value: string) => requireThat(state[key].some(r => r.id === value), `Unknown ${key} reference: ${value}`);
  for (const key of ['ownerId', 'currentOwnerId', 'leadId']) if (record[key]) exists('members', record[key]);
  if (record.workstreamId) exists('workstreams', record.workstreamId);
  if (record.deliverableId) { exists('deliverables', record.deliverableId); requireThat(state.deliverables.find(d => d.id === record.deliverableId)?.workstreamId === record.workstreamId, 'Deliverable must belong to this workstream.'); }
  for (const [field, target] of [['workstreamIds', 'workstreams'], ['deliverableIds', 'deliverables'], ['relatedItemIds', 'items'], ['linkedItemIds', 'items'], ['milestoneIds', 'milestones'], ['linkedRegisterIds', 'registers']] as const) for (const value of record[field] ?? []) exists(target, value);
  if (type === 'milestones') for (const deliverableId of record.deliverableIds) requireThat(record.workstreamIds.includes(state.deliverables.find(d => d.id === deliverableId)?.workstreamId), 'Milestone deliverables must belong to one of its use cases.');
  if (type === 'deliverables') {
    requireThat(!state.items.some(item => item.deliverableId === record.id && item.workstreamId !== record.workstreamId), 'This artifact has linked work in another use case. Reassign that work before moving the artifact.');
    requireThat(!state.milestones.some(milestone => milestone.deliverableIds.includes(record.id) && !milestone.workstreamIds.includes(record.workstreamId)), 'This artifact has a milestone outside the selected use case. Update the milestone association before moving the artifact.');
  }
  if (type === 'items') {
    requireThat((record.kind === 'software' ? SOFTWARE_STAGES : GENERAL_STAGES).includes(record.stage), 'Stage does not belong to the selected workflow.');
    if (record.blocked) requireThat(record.blockReason.trim() && record.nextAction.trim(), 'Blocked work requires a reason and next action.');
    if (record.stage !== 'Backlog') {
      requireThat(record.ownerId && record.currentOwnerId && record.dueDate && record.acceptanceCriteria.trim() && record.nextAction.trim(), 'Before work starts, add an accountable owner, current action owner, due date, acceptance criteria, and next action.');
      requireThat(state.members.find(m => m.id === record.currentOwnerId)?.role !== 'executive', 'The current action owner must be a delivery team member.');
    }
  }
}

export function createRecord(state: HubState, user: Member, type: Collection, input: unknown, now: string) {
  delivery(user);
  requireThat(type !== 'reports', 'Use the report draft endpoint.');
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const today = localDate(new Date(now), state.settings.timezone);
  const defaults: Record<string, object> = {
    items: { description: '', workstreamId: user.workstreamIds[0] ?? state.workstreams[0]?.id, kind: 'software', category: 'feature', priority: 'Medium', ownerId: '', currentOwnerId: raw.ownerId ?? '', baselineDate: raw.dueDate ?? '', dueDate: '', acceptanceCriteria: '', evidenceLinks: [], blocked: false, blockReason: '', nextAction: '', clientSummary: '', clientVisible: false, tags: [] },
    workstreams: { shortName: raw.name, description: '', leadId: '', health: 'unknown', statusNote: '', clientSummary: '', color: '#8600d6' },
    deliverables: { ownerId: '', description: '' },
    milestones: { workstreamIds: [], deliverableIds: [], ownerId: user.id, baselineDate: today, forecastDate: today, status: 'planned', notes: '' },
    registers: { type: 'issue', detail: '', clientSummary: '', clientVisible: false, relatedItemIds: [], milestoneIds: [], ownerId: user.id, dueDate: today, priority: 'Medium', probability: 'Medium', status: 'open', mitigation: '', nextAction: '', impact: '' },
    meetings: { heldAt: now, notes: '', linkedItemIds: [], linkedRegisterIds: [] },
  };
  const fields = schemas[type].parse({ ...defaults[type], ...raw });
  const record: any = { ...fields, id: id(), version: 1, updatedAt: now };
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  if (type === 'items') Object.assign(record, { stage: 'Backlog', cycle: 1, createdAt: now, ...(record.blocked ? { blockedSince: now } : {}) });
  if (type === 'items' && !record.baselineDate && record.dueDate) record.baselineDate = record.dueDate;
  if (type === 'workstreams' || type === 'milestones') pmo(user);
  else if (type !== 'meetings' && !['pmo', 'admin'].includes(user.role)) requireThat(assignedWorkstream(state, user, record.workstreamId), 'Create records in your assigned workstreams.', 403);
  validateReferences(state, type, record);
  (state[type] as any[]).push(record);
  audit(state, user, type, record.id, 'created', `Created ${record.title ?? record.name}`, null, record, now);
  return record;
}

export function patchRecord(state: HubState, user: Member, type: Collection, recordId: string, input: unknown, now: string) {
  const body = z.object({ version: z.number().int(), changes: z.record(z.string(), z.unknown()), reason: textField.optional() }).parse(input);
  const record = getRecord(state[type] as Versioned[], recordId) as any;
  authorize(state, user, type, record);
  checkVersion(record, body.version);
  if (type === 'reports') requireThat(record.status === 'draft', 'Approved reports are immutable. Create a correction draft.', 409);
  const known = Object.keys(schemas[type].shape);
  requireThat(Object.keys(body.changes).every(k => known.includes(k) || ['id', 'version', 'updatedAt'].includes(k)), 'One or more fields require a dedicated workflow action.');
  const changes = schemas[type].partial().parse(body.changes) as Record<string, unknown>;
  if (!['pmo', 'admin'].includes(user.role) && changes.workstreamId !== undefined && changes.workstreamId !== record.workstreamId) requireThat(assignedWorkstream(state, user, String(changes.workstreamId)), 'Move records only into your assigned use cases.', 403);
  if (type === 'items') {
    requireThat(record.stage !== 'Closed', 'Reopen this item before editing it.', 409);
    if (changes.kind !== undefined && changes.kind !== record.kind) requireThat(record.stage === 'Backlog', 'Workflow can only change in the backlog.');
    if (Object.hasOwn(changes, 'baselineDate') && record.baselineDate && changes.baselineDate !== record.baselineDate) { pmo(user); requireThat(body.reason?.trim(), 'A baseline change requires a reason.'); }
    if (Object.hasOwn(changes, 'dueDate') && record.dueDate && changes.dueDate !== record.dueDate) requireThat(body.reason?.trim(), 'Changing an agreed due date requires a reason.');
  }
  if (type === 'milestones' && changes.baselineDate && changes.baselineDate !== record.baselineDate) { pmo(user); requireThat(body.reason?.trim(), 'A baseline change requires a reason.'); }
  if (type === 'milestones' && changes.forecastDate && changes.forecastDate !== record.forecastDate) requireThat(body.reason?.trim(), 'Changing a milestone forecast requires a reason.');
  const before = structuredClone(record);
  Object.assign(record, changes);
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  if (type === 'items') {
    if (!record.baselineDate && record.dueDate) record.baselineDate = record.dueDate;
    if (record.blocked && !before.blocked) record.blockedSince = now;
    if (!record.blocked) delete record.blockedSince;
  }
  validateReferences(state, type, record);
  touch(record, now);
  audit(state, user, type, record.id, 'updated', body.reason || 'Updated record', before, record, now);
  // A record leaving a use case must invalidate that case's earlier review too.
  // Its updated timestamp is no longer included by the old association scan.
  const priorScope: string[] = before.workstreamIds ?? (before.workstreamId ? [before.workstreamId] : []);
  const currentScope: string[] = record.workstreamIds ?? (record.workstreamId ? [record.workstreamId] : []);
  if (JSON.stringify([...priorScope].sort()) !== JSON.stringify([...currentScope].sort())) {
    for (const workstreamId of new Set([...priorScope, ...currentScope])) {
      const workstream = getRecord(state.workstreams, workstreamId), prior = structuredClone(workstream);
      touch(workstream, now);
      audit(state, user, 'workstreams', workstreamId, 'association_changed', `Updated use-case association for ${record.title ?? record.name}`, prior, workstream, now);
    }
  }
  return record;
}

export function transition(state: HubState, user: Member, itemId: string, input: unknown, now: string) {
  const body = z.object({ version: z.number().int(), stage: z.string(), currentOwnerId: z.string().optional(), evidence: z.string().max(2000).optional(), reason: textField.optional() }).parse(input);
  const item = getRecord(state.items, itemId);
  delivery(user); checkVersion(item, body.version);
  const stages = item.kind === 'software' ? [...SOFTWARE_STAGES] : [...GENERAL_STAGES];
  const next = stages.indexOf(body.stage as never), current = stages.indexOf(item.stage as never);
  requireThat(next >= 0 && next !== current, 'Select a different valid stage.');
  requireThat(item.stage !== 'Closed', 'Use reopen for closed items.');
  requireThat(!(item.kind === 'software' && body.stage === 'Closed'), 'Software closure requires explicit client acceptance.');
  const backwards = next < current;
  requireThat(backwards || next === current + 1, 'Advance one stage at a time.');
  requireThat(!backwards || body.reason?.trim(), 'Returning work requires a reason.');
  if (!backwards) {
    requireThat(!item.blocked, 'Resolve the item blocker before advancing.');
    requireThat(!state.tests.some(t => t.itemId === item.id && t.result === 'fail' && t.blocking && !t.resolvedAt), 'Resolve open blocking test failures before advancing.');
    requireThat(item.acceptanceCriteria.trim(), 'Set acceptance criteria before advancing.');
    if (['UAT', 'Production verification', 'Review'].includes(item.stage)) requireThat(state.tests.some(t => t.itemId === item.id && t.cycle === item.cycle && t.stage === item.stage && t.result === 'pass'), 'Record a passing result for this stage in the current cycle.');
    if (body.stage === 'Production verification') requireThat(body.evidence?.trim(), 'Deployment evidence is required before production verification.');
  }
  if (body.currentOwnerId) requireThat(state.members.some(m => m.id === body.currentOwnerId && m.role !== 'executive'), 'Choose a delivery team member.');
  const before = structuredClone(item);
  if (body.evidence?.trim() && /^https?:\/\//i.test(body.evidence.trim())) item.evidenceLinks = [...new Set([...item.evidenceLinks, link.parse(body.evidence.trim())])];
  item.stage = body.stage as Stage;
  if (body.currentOwnerId) item.currentOwnerId = body.currentOwnerId;
  if (!item.baselineDate && item.dueDate) item.baselineDate = item.dueDate;
  validateReferences(state, 'items', item);
  if (backwards) { item.cycle += 1; delete item.closedAt; }
  if (body.stage === 'Closed') item.closedAt = now;
  touch(item, now);
  audit(state, user, 'items', item.id, backwards ? 'returned' : 'transitioned', `${body.reason || `${before.stage} → ${item.stage}`}${body.evidence?.trim() ? `\nEvidence / handover: ${body.evidence.trim()}` : ''}`, before, item, now);
  return item;
}

export function localDate(date: Date, timezone: string) { return dateInTimezone(date, timezone); }
export function period(now: Date, timezone: string, cutoffHour = 12) { return reportingPeriod(now, timezone, cutoffHour); }
export function sourceVersions(state: HubState) {
  const versions: Record<string, number> = { 'settings:project': state.settings.version ?? 1 };
  for (const key of ['workstreams', 'deliverables', 'items', 'milestones', 'registers', 'submissions'] as const) for (const record of state[key]) versions[`${key}:${record.id}`] = record.version;
  return versions;
}
export function latestStreamChange(state: HubState, workstreamId: string) {
  return latestWorkstreamChange(state, workstreamId);
}
export function streamConfirmed(state: HubState, workstreamId: string, end: string) {
  return confirmationState(state, workstreamId, end).confirmed;
}
export function reportDraft(state: HubState, user: Member, audience: 'internal' | 'client', now: string, supersedesId?: string): Report {
  pmo(user);
  const snapshotTime = new Date(now);
  const range = period(snapshotTime, state.settings.timezone, state.settings.cutoffHour);
  const previous = supersedesId ? getRecord(state.reports, supersedesId) : undefined;
  if (previous) {
    requireThat(previous.status === 'approved' && previous.audience === audience, 'Corrections must reference an approved report for the same audience.');
    return { id: id(), version: 1, updatedAt: now, title: `${audience === 'client' ? 'Client' : 'Internal'} weekly brief · ${previous.periodEnd} · correction`, audience, periodStart: previous.periodStart, periodEnd: previous.periodEnd, asOf: previous.asOf, status: 'draft', body: structuredClone(previous.body), sourceVersions: sourceVersions(state), createdBy: user.id, createdAt: now, supersedesId };
  }
  const client = audience === 'client';
  const items = state.items.filter(i => !client || (i.clientVisible && i.clientSummary.trim()));
  const registers = state.registers.filter(r => !client || (r.clientVisible && r.clientSummary.trim()));
  const label = (i: WorkItem) => client ? i.clientSummary : i.title;
  const priorities = { Critical: 0, High: 1, Medium: 2, Low: 3, 'Not set': 4 };
  const order = <T extends { dueDate: string; priority: keyof typeof priorities }>(a: T, b: T) => a.dueDate.localeCompare(b.dueDate) || priorities[a.priority] - priorities[b.priority];
  const today = localDate(snapshotTime, state.settings.timezone);
  const nextHorizon = shiftDate(today, 7);
  const completed = items.filter(item => {
    if (item.stage !== 'Closed' || !item.closedAt) return false;
    const closed = new Date(item.closedAt).getTime();
    return closed >= new Date(range.startAt).getTime() && closed < new Date(range.endAt).getTime() && closed <= snapshotTime.getTime();
  });
  const planned = items.filter(i => i.stage !== 'Closed' && !i.blocked && i.dueDate >= today && i.dueDate <= nextHorizon).sort(order);
  const nextLabel = (item: WorkItem) => client ? `${item.clientSummary} — ${item.stage}` : `${item.title}: ${item.nextAction || item.stage}`;
  const openRegisters = registers.filter(r => r.status !== 'resolved').sort(order);
  const registerLabel = (record: typeof registers[number]) => `${recordAttention(record, state.settings, snapshotTime).escalationDue ? 'Needs escalation: ' : ''}${client ? record.clientSummary : `${record.title}: ${record.nextAction || record.impact}`}`;
  const attentionItems = items.filter(i => i.stage !== 'Closed' && (i.blocked || recordAttention(i, state.settings, snapshotTime).overdue) && !openRegisters.some(r => r.relatedItemIds.includes(i.id))).sort(order);
  const attentionLabel = (item: WorkItem) => `${recordAttention(item, state.settings, snapshotTime).escalationDue ? 'Needs escalation: ' : item.blocked ? 'Blocked: ' : 'Overdue: '}${client ? item.clientSummary : `${item.title}: ${item.blockReason || item.nextAction}`}`;
  const unique = (values: string[]) => [...new Set(values.filter(value => value.trim()))];
  const body: ReportBody = {
    summary: `${state.settings.phaseName} delivery update for the week ending ${range.end}.`,
    highlights: completed.map(label).slice(0, 30),
    nextWeek: planned.slice(0, 8).map(nextLabel),
    attention: [...openRegisters.map(registerLabel), ...attentionItems.map(attentionLabel)].slice(0, 30),
    workstreams: state.workstreams.map(w => {
      const readiness = confirmationState(state, w.id, range.end);
      // Weekly free text is internal commentary. Client drafts use only explicitly
      // client-visible summaries; raw lead notes never cross that boundary.
      const submission = client ? undefined : readiness.submission;
      const note = (text: string | undefined, type: string) => text?.trim() ? [`${readiness.stale ? 'Unconfirmed lead' : 'Lead'} ${type}: ${text.trim()}`] : [];
      return {
        name: w.name, health: w.health,
        completed: completed.filter(i => i.workstreamId === w.id).map(label).slice(0, 30),
        next: unique([...planned.filter(i => i.workstreamId === w.id).slice(0, 6).map(nextLabel), ...note(submission?.next, 'plan')]),
        attention: unique([...openRegisters.filter(r => r.workstreamId === w.id).map(registerLabel), ...attentionItems.filter(i => i.workstreamId === w.id).map(attentionLabel), ...note(submission?.completed, 'progress note'), ...note(submission?.changes, 'change note'), ...note(submission?.blockers, 'dependency note')]).slice(0, 30),
        confirmed: readiness.confirmed,
      };
    }),
    milestones: state.milestones.map(m => ({ title: m.title, forecastDate: m.forecastDate, status: m.status })),
  };
  return { id: id(), version: 1, updatedAt: now, title: `${client ? 'Client' : 'Internal'} weekly brief · ${range.end}`, audience, periodStart: range.start, periodEnd: range.end, asOf: now, status: 'draft', body, sourceVersions: sourceVersions(state), createdBy: user.id, createdAt: now };
}
