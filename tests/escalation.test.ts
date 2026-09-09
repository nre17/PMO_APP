import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createRecord } from '../server/domain.js';
import { confirmationState, reportingPeriod } from '../shared/reporting.js';
import type { HubState, Member, WorkItem } from '../shared/types.js';

const streamId = 'test-stream';
let app: Awaited<ReturnType<typeof createApp>>, directory = '', cookie = '';
let clock = new Date('2026-09-09T08:00:00.000Z');
function fixtureState(): HubState {
  const member = (id: string, role: Member['role'], workstreamIds: string[] = []): Member => ({ id, role, workstreamIds, name: `Synthetic ${id}`, initials: 'QA', title: 'Test role', color: '#666666', canApproveReports: role === 'executive' });
  const initial: HubState = {
    settings: { projectName: 'Synthetic escalation tests', phaseName: 'Test phase', timezone: 'Asia/Dubai', submissionHour: 10, cutoffHour: 12, blockedEscalationDays: 2, workingDays: [1, 2, 3, 4, 5] },
    members: [member('test-pmo', 'pmo'), member('test-admin', 'admin'), member('test-lead', 'lead'), member('test-owner', 'contributor'), member('test-current', 'contributor'), member('test-unassigned', 'contributor', [streamId]), member('test-executive', 'executive')],
    workstreams: [{ id: streamId, version: 1, updatedAt: clock.toISOString(), name: 'Synthetic use case', shortName: 'Example', description: '', leadId: 'test-lead', health: 'unknown', statusNote: '', clientSummary: '', color: '#666666' }],
    milestones: [{ id: 'test-milestone', version: 1, updatedAt: clock.toISOString(), title: 'Synthetic review gate', workstreamIds: [streamId], deliverableIds: [], ownerId: 'test-lead', baselineDate: '2026-09-15', forecastDate: '2026-09-15', status: 'planned', notes: '' }],
    items: [], deliverables: [], tests: [], registers: [], meetings: [], submissions: [], reports: [], events: [],
  };
  const owner = initial.members[0];
  const legacyItem = createRecord(initial, owner, 'items', { title: 'Synthetic legacy work', workstreamId: streamId, ownerId: 'test-owner', currentOwnerId: 'test-current', nextAction: 'Review the legacy escalation.' }, clock.toISOString());
  legacyItem.id = 'test-legacy-work';
  const legacyRegister = createRecord(initial, owner, 'registers', { title: 'Synthetic legacy escalation', type: 'issue', workstreamId: streamId, relatedItemIds: [legacyItem.id], ownerId: 'test-lead', status: 'escalated', nextAction: 'Confirm the existing decision.' }, clock.toISOString());
  legacyRegister.id = 'test-legacy-escalation';
  initial.events = []; // Older seeded records can legitimately lack creation audit snapshots.
  return initial;
}
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'pmo-escalation-test-'));
  app = await createApp({ dataDir: path.join(directory, 'database'), state: fixtureState(), testMode: true, now: () => clock });
  await api('GET', '/api/bootstrap');
});
after(async () => {
  await app?.close();
  if (directory) {
    const target = path.resolve(directory);
    assert.ok(target.startsWith(path.resolve(path.join(os.tmpdir(), 'pmo-escalation-test-'))) && path.dirname(target) === path.resolve(os.tmpdir()));
    await rm(target, { recursive: true, force: true });
  }
});
async function api(method: string, url: string, payload?: unknown, expected = 200) {
  const response = await app.inject({ method: method as any, url, headers: { host: 'localhost:4310', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }) });
  assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
  const setCookie = response.headers['set-cookie'];
  if (setCookie) cookie = String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
  return response.json();
}
async function persona(userId: string) { await api('POST', '/api/demo/persona', { userId }); }
async function state(): Promise<HubState> { return (await api('GET', '/api/bootstrap')).state; }
async function work(id: string): Promise<WorkItem> { return (await state()).items.find(item => item.id === id)!; }
async function createWork(title: string, blocked = false, kind: 'software' | 'general' = 'software'): Promise<WorkItem> {
  await persona('test-pmo');
  const item = await api('POST', '/api/items', { title, workstreamId: streamId, kind, ownerId: 'test-owner', currentOwnerId: 'test-current', dueDate: '2026-09-12', acceptanceCriteria: 'The synthetic outcome is reviewable.', nextAction: 'Complete the next synthetic work step.', blocked, blockReason: blocked ? 'A synthetic access decision is outstanding.' : '' });
  if (blocked) return item;
  return api('POST', `/api/items/${item.id}/transition`, { version: item.version, stage: kind === 'software' ? 'Development' : 'In progress' });
}
function payload(item: WorkItem) {
  return { version: item.version, title: 'Approve the synthetic sample-access decision', decisionNeeded: 'INTERNAL-ESCALATION-TEST: confirm the access decision and record the agreed next step.', ownerId: 'test-lead', dueDate: '2026-09-11', priority: 'High', milestoneIds: ['test-milestone'] };
}

test('escalation records the request and owner without altering delivery facts and invalidates confirmations', async () => {
  let item = await createWork('Work waiting on a decision');
  item = await api('PATCH', `/api/records/items/${item.id}`, { version: item.version, changes: { blocked: true, blockReason: 'An access decision is outstanding.' } });
  await api('POST', '/api/submissions', { workstreamId: streamId, completed: '', next: 'Review the decision.', changes: '', blockers: '', health: 'unknown' });
  const oldDraft = await api('POST', '/api/reports', { audience: 'client' });
  const before = await state();
  const periodEnd = reportingPeriod(clock, before.settings.timezone).end;
  assert.equal(confirmationState(before, streamId, periodEnd).confirmed, true);
  clock = new Date(clock.getTime() + 1000);
  await persona('test-current'); // Explicit item ownership authorizes this even without workstream membership.
  const response = await api('POST', `/api/items/${item.id}/escalate`, payload(item));
  const { register, item: updated } = response;
  assert.equal(register.type, 'issue'); assert.equal(register.status, 'escalated');
  assert.equal(register.title, payload(item).title); assert.equal(register.detail, payload(item).decisionNeeded);
  assert.equal(register.nextAction, payload(item).decisionNeeded); assert.equal(register.ownerId, 'test-lead');
  assert.equal(register.dueDate, '2026-09-11'); assert.equal(register.priority, 'High');
  assert.equal(register.workstreamId, streamId); assert.deepEqual(register.relatedItemIds, [item.id]);
  assert.deepEqual(register.milestoneIds, ['test-milestone']);
  assert.equal(register.clientVisible, false); assert.equal(register.clientSummary, '');
  assert.deepEqual(updated, { ...item, version: item.version + 1, updatedAt: clock.toISOString() });
  const current = await state();
  assert.equal(confirmationState(current, streamId, periodEnd).stale, true);
  assert.ok(current.events.some(event => event.entityType === 'registers' && event.entityId === register.id && event.action === 'escalated' && event.actorId === 'test-current'));
  const itemAudit = current.events.find(event => event.entityType === 'items' && event.entityId === item.id && event.action === 'escalated')!;
  assert.deepEqual(itemAudit.before, item); assert.deepEqual(itemAudit.after, updated);
  await persona('test-pmo');
  const freshDraft = await api('POST', '/api/reports', { audience: 'client' });
  assert.equal(JSON.stringify(freshDraft.body).includes('INTERNAL-ESCALATION-TEST'), false);
  await persona('test-executive');
  await api('POST', `/api/reports/${oldDraft.id}/approve`, { version: oldDraft.version, incompleteReason: 'Testing known confirmation gaps.' }, 409);
});

test('item access governs escalation: assigned owners, designated lead and PMO may act, other roles may not', async () => {
  const denied = await createWork('Permission boundary work');
  for (const userId of ['test-unassigned', 'test-executive']) {
    await persona(userId); const before = await state();
    await api('POST', `/api/items/${denied.id}/escalate`, payload(denied), 403);
    assert.deepEqual(await state(), before);
  }
  for (const userId of ['test-owner', 'test-current', 'test-lead', 'test-pmo', 'test-admin']) {
    const item = await createWork(`Escalation owned by ${userId}`);
    await persona(userId);
    const result = await api('POST', `/api/items/${item.id}/escalate`, payload(item));
    assert.equal(result.register.status, 'escalated');
    assert.equal((await state()).members.find(member => member.id === userId)!.workstreamIds.length, 0, 'Escalation does not grant workstream membership');
  }
});

test('invalid escalation details and stale versions roll back without saving a register or audit', async () => {
  const item = await createWork('Input validation work');
  const invalid: { changes: Record<string, unknown>; expected?: number }[] = [
    { changes: { title: ' ' } }, { changes: { decisionNeeded: ' ' } }, { changes: { ownerId: '' } },
    { changes: { ownerId: 'missing-person' } }, { changes: { ownerId: 'test-executive' } },
    { changes: { dueDate: '2026-02-30' } }, { changes: { dueDate: '' } },
    { changes: { priority: 'Not set' } }, { changes: { priority: undefined } },
    { changes: { milestoneIds: ['missing-milestone'] } }, { changes: { milestoneIds: ['test-milestone', 'test-milestone'] } },
    { changes: { clientVisible: true } }, { changes: { workstreamId: 'another-use-case' } },
    { changes: { version: item.version + 1 }, expected: 409 }, { changes: { version: 0 } },
  ];
  for (const invalidCase of invalid) {
    const before = await state();
    await api('POST', `/api/items/${item.id}/escalate`, { ...payload(item), ...invalidCase.changes }, invalidCase.expected ?? 400);
    assert.deepEqual(await state(), before, `Invalid payload persisted data: ${JSON.stringify(invalidCase.changes)}`);
  }
  await api('POST', '/api/items/missing-work/escalate', payload(item), 404);
  const noMilestones = payload(item) as Record<string, unknown>; delete noMilestones.milestoneIds;
  const result = await api('POST', `/api/items/${item.id}/escalate`, noMilestones);
  assert.deepEqual(result.register.milestoneIds, [], 'No milestone impact is inferred from associations');
});

test('unresolved escalations remain unique through status changes, and resolution permits a new escalation', async () => {
  const item = await createWork('Repeated escalation work', true);
  const raised = await api('POST', `/api/items/${item.id}/escalate`, payload(item));
  let before = await state();
  const duplicate = await api('POST', `/api/items/${item.id}/escalate`, payload(raised.item), 409);
  assert.match(duplicate.error, /Open existing escalation/); assert.deepEqual(await state(), before);
  const monitoring = await api('PATCH', `/api/records/registers/${raised.register.id}`, { version: raised.register.version, changes: { status: 'monitoring' } });
  before = await state();
  await api('POST', `/api/items/${item.id}/escalate`, payload(await work(item.id)), 409);
  assert.deepEqual(await state(), before);
  await persona('test-lead');
  const resolved = await api('PATCH', `/api/records/registers/${monitoring.id}`, { version: monitoring.version, changes: { status: 'resolved', nextAction: 'Synthetic decision recorded; follow-up remains on the item.' } });
  assert.equal(resolved.status, 'resolved');
  const beforeRaisingAgain = await work(item.id);
  assert.equal(beforeRaisingAgain.blocked, true, 'Resolving the escalation does not silently clear the delivery blocker');
  await persona('test-owner');
  const second = await api('POST', `/api/items/${item.id}/escalate`, { ...payload(beforeRaisingAgain), decisionNeeded: 'A separate decision is now required.' });
  assert.notEqual(second.register.id, resolved.id);
  assert.equal(second.item.stage, item.stage); assert.equal(second.item.blocked, item.blocked);
  const records = (await state()).registers.filter(register => register.relatedItemIds.includes(item.id));
  assert.equal(records.length, 2); assert.equal(records.filter(register => register.status !== 'resolved').length, 1);
});

test('legacy and manually created escalations retain duplicate protection after leaving escalated status', async () => {
  await persona('test-pmo');
  const legacy = (await state()).registers.find(register => register.id === 'test-legacy-escalation')!;
  assert.equal((await state()).events.some(event => event.entityId === legacy.id), false);
  const manualItem = await createWork('Manually escalated work');
  const manual = await api('POST', '/api/records/registers', { title: 'Manually raised escalation', type: 'issue', status: 'escalated', workstreamId: streamId, ownerId: 'test-lead', relatedItemIds: [manualItem.id], nextAction: 'Review the manual escalation.' });
  for (const register of [legacy, manual]) {
    const itemId = register.relatedItemIds[0];
    const monitoring = await api('PATCH', `/api/records/registers/${register.id}`, { version: register.version, changes: { status: 'monitoring' } });
    const current = await state();
    assert.equal(current.events.some(event => event.entityId === register.id && event.action === 'escalated'), false);
    assert.ok(current.events.some(event => event.entityId === register.id && (event.before as { status?: string } | undefined)?.status === 'escalated'));
    const duplicate = await api('POST', `/api/items/${itemId}/escalate`, payload(await work(itemId)), 409);
    assert.match(duplicate.error, /Open existing escalation/);
    assert.deepEqual(await state(), current);
    await api('PATCH', `/api/records/registers/${register.id}`, { version: monitoring.version, changes: { status: 'resolved' } });
    const raised = await api('POST', `/api/items/${itemId}/escalate`, payload(await work(itemId)));
    assert.notEqual(raised.register.id, register.id);
    assert.equal(raised.register.status, 'escalated');
  }
});

test('closed work cannot be escalated until it is explicitly reopened', async () => {
  let item = await createWork('Completed general work', false, 'general');
  item = await api('POST', `/api/items/${item.id}/transition`, { version: item.version, stage: 'Review' });
  await api('POST', `/api/items/${item.id}/tests`, { version: item.version, result: 'pass', notes: 'Synthetic review passed.', evidence: 'Synthetic test fixture evidence.' });
  item = await work(item.id);
  item = await api('POST', `/api/items/${item.id}/transition`, { version: item.version, stage: 'Closed' });
  const before = await state();
  await api('POST', `/api/items/${item.id}/escalate`, payload(item), 409);
  assert.deepEqual(await state(), before);
  item = await api('POST', `/api/items/${item.id}/reopen`, { version: item.version, reason: 'A new synthetic review decision is needed.' });
  const raised = await api('POST', `/api/items/${item.id}/escalate`, payload(item));
  assert.equal(raised.item.stage, 'In progress'); assert.equal(raised.item.cycle, item.cycle);
});

test('two concurrent submissions with one expected item version create exactly one escalation', async () => {
  const item = await createWork('Concurrent escalation request');
  const before = await state();
  const request = { method: 'POST' as const, url: `/api/items/${item.id}/escalate`, headers: { host: 'localhost:4310', 'content-type': 'application/json', cookie }, payload: JSON.stringify(payload(item)) };
  const responses = await Promise.all([app.inject(request), app.inject(request)]);
  assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 409]);
  const current = await state();
  assert.equal(current.registers.length, before.registers.length + 1);
  assert.equal(current.registers.filter(register => register.relatedItemIds.includes(item.id)).length, 1);
  assert.equal((await work(item.id)).version, item.version + 1);
  assert.equal(current.events.filter(event => event.entityType === 'items' && event.entityId === item.id && event.action === 'escalated').length, 1);
});
