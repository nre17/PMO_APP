import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createShowcaseState } from '../server/showcase-seed.js';
import { createPortfolioState } from '../server/portfolio-seed.js';
import { seedConfiguration } from '../server/seed-config.js';
import { schemas, validateReferences } from '../server/domain.js';
import { LIFECYCLE_PHASES, type HubState } from '../shared/types.js';
import { confirmationState, reportingPeriod } from '../shared/reporting.js';

const fixedNow = new Date('2026-09-08T08:00:00.000Z');
type Api = (method: string, url: string, payload?: unknown, expected?: number) => Promise<any>;
async function fixture(run: (api: Api, state: () => Promise<HubState>) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pmo-showcase-test-'));
  const app = await createApp({ dataDir: path.join(root, 'database'), seedProfile: 'showcase', testMode: true, now: () => fixedNow });
  let cookie = '';
  const api: Api = async (method, url, payload, expected = 200) => {
    const response = await app.inject({ method: method as any, url, headers: { host: 'localhost:4311', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }) });
    assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
    if (response.headers['set-cookie']) cookie = String(response.headers['set-cookie']).split(';')[0];
    return response.json();
  };
  try {
    await api('GET', '/api/bootstrap');
    assert.match(cookie, /^pmo_showcase_session=/);
    await run(api, async () => (await api('GET', '/api/bootstrap')).state);
  } finally {
    await app.close();
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'pmo-showcase-test-')));
    await rm(root, { recursive: true, force: true });
  }
}

test('showcase covers the consulting lifecycle with valid links and explicit illustrative context', () => {
  const state = createShowcaseState(fixedNow);
  assert.equal(state.settings.demoScenario, 'consulting-lifecycle');
  assert.match(state.settings.projectName, /demonstration/i);
  assert.equal(state.workstreams.length, 10);
  assert.equal(state.workstreams.find(w => w.id === 'uc-accounting-validation')?.name, 'Accounting Companion');
  assert.deepEqual(new Set(state.workstreams.map(w => w.lifecyclePhase)), new Set(LIFECYCLE_PHASES));
  for (const collection of ['items', 'workstreams', 'deliverables', 'milestones', 'registers', 'meetings'] as const) {
    assert.equal(new Set(state[collection].map(row => row.id)).size, state[collection].length);
    for (const row of state[collection]) { schemas[collection].parse(row); validateReferences(state, collection, row); }
  }
  for (const stream of state.workstreams) {
    for (const field of ['description', 'scope', 'leadId', 'lifecyclePhase', 'priority', 'nextGate', 'gateDate', 'statusNote', 'clientSummary'] as const) assert.ok(stream[field], `${stream.name}: missing ${field}`);
    assert.ok(stream.groups?.length && stream.sources?.length);
    assert.ok(state.milestones.some(milestone => milestone.workstreamIds.includes(stream.id) && milestone.title === stream.nextGate && milestone.forecastDate === stream.gateDate));
  }
  for (const item of state.items) {
    for (const field of ['description', 'ownerId', 'currentOwnerId', 'baselineDate', 'dueDate', 'acceptanceCriteria', 'nextAction', 'deliverableId'] as const) assert.ok(item[field], `${item.id}: missing ${field}`);
    assert.notEqual(item.priority, 'Not set');
    assert.ok(item.evidenceLinks.length);
    assert.ok(item.createdAt <= item.updatedAt);
    if (item.stage === 'Closed') assert.ok(item.closedAt && item.closedAt <= fixedNow.toISOString());
  }
  for (const artifact of state.deliverables) { assert.ok(artifact.evidenceLinks?.length); assert.ok(artifact.description.length > 80); assert.ok(state.items.some(item => item.deliverableId === artifact.id)); }
  for (const result of state.tests) {
    assert.ok(state.items.some(item => item.id === result.itemId));
    assert.ok(state.members.some(member => member.id === result.authorId));
    assert.match(result.evidence, /synthetic|illustrative|demo|example\.invalid/i);
  }
  assert.ok(state.registers.some(r => r.type === 'dependency' && r.relatedItemIds.includes('showcase-ppi-blocker') && r.milestoneIds.length));
  assert.ok(state.sourceRecords?.every(row => row.disposition !== 'needs_review' && !row.syncNote && row.sourceOwner && row.sourcePriority && row.sourceDates && row.resolutionNotes));
  const reconciled = state.sourceRecords?.find(row => row.sourceKey === 'DEMO-2')!;
  assert.equal(reconciled.sourceStatus, 'Done');
  assert.equal(reconciled.disposition, 'completed');
  assert.equal(state.items.find(item => item.id === reconciled.itemId)?.stage, 'Closed');
  assert.ok(state.events.some(event => event.entityId === reconciled.id && event.action === 'source-reconciled'));
  const reviewed = state.reports.find(report => report.id === 'showcase-report-reviewed')!;
  assert.equal(reviewed.status, 'approved');
  assert.ok(reviewed.body.highlights.length > 0 && reviewed.body.milestones.length > 0);
  assert.equal(reviewed.body.workstreams.filter(stream => !stream.confirmed).length, 0);
  assert.equal(reviewed.incompleteReason, undefined);
  const period = reportingPeriod(fixedNow, state.settings.timezone, state.settings.cutoffHour);
  assert.ok(state.workstreams.every(stream => confirmationState(state, stream.id, period.end).confirmed));
  assert.ok(state.items.some(item => item.stage !== 'Closed' && item.currentOwnerId === 'demo-pmo'), 'The opening PMO persona has a meaningful assignment.');
  assert.ok(state.reports.some(report => report.audience === 'internal' && report.periodEnd === period.end && report.body.summary));
  const privateRisk = state.registers.find(record => record.id === 'showcase-raid-internal')!;
  assert.equal(privateRisk.detail, 'The pilot support roster still needs a named backup for analyst training and first-line issue triage.');
  assert.equal(privateRisk.clientVisible, false);
  assert.ok(state.reports.find(report => report.id === 'showcase-report-internal')!.body.attention.some(line => line.includes(privateRisk.title)), 'Internal reporting retains the meaningful staffing concern.');
  for (const report of state.reports.filter(report => report.audience === 'client')) for (const privateText of [privateRisk.title, privateRisk.detail, privateRisk.nextAction]) {
    assert.ok(!JSON.stringify(report.body).includes(privateText), `${report.id} must omit the internal staffing concern.`);
  }
  for (const stream of reviewed.body.workstreams) assert.ok(stream.completed.length && stream.next.length && stream.attention.length);
  const benchmark = state.workstreams.find(stream => stream.id === 'uc-benchmark')!;
  assert.match(`${benchmark.description} ${benchmark.scope}`, /portfolio|peer|index/i);
  assert.doesNotMatch(`${benchmark.description} ${benchmark.scope}`, /scoring rubric|reference.answer|model evaluation/i);
  assert.equal(createPortfolioState(fixedNow).settings.demoScenario, undefined);
});

test('manager review history spans three months and approved archives contain only contemporaneous facts', () => {
  const state = createShowcaseState(fixedNow);
  const first = state.reports.find(report => report.id === 'showcase-report-approved')!;
  const second = state.reports.find(report => report.id === 'showcase-report-month-two')!;
  const current = state.reports.find(report => report.id === 'showcase-report-reviewed')!;
  assert.ok(first.asOf < second.asOf && second.asOf < current.asOf);
  assert.ok(new Date(current.asOf).getTime() - Math.min(...state.items.map(item => new Date(item.createdAt).getTime())) >= 89 * 86_400_000);
  for (const report of [first, second, current]) {
    assert.equal(report.status, 'approved');
    assert.equal(report.body.workstreams.length, 10);
    assert.ok(report.body.workstreams.every(stream => stream.confirmed));
    assert.equal(report.incompleteReason, undefined);
    assert.ok(report.body.highlights.length > 0, `${report.id} should show real closures from its period`);
    assert.match(report.body.summary, /illustrative|fictional/i);
  }
  assert.ok(first.body.highlights.some(line => line.includes('initial discovery stakeholders')));
  assert.ok(second.body.highlights.some(line => line.includes('reviewer journey')));
  for (const report of [first, second]) {
    assert.ok(!report.body.attention.some(line => /sample.access decision|filter resets/i.test(line)));
    for (const key of Object.keys(report.sourceVersions).filter(key => key.startsWith('items:'))) {
      const events = state.events.filter(event => event.entityType === 'items' && event.entityId === key.slice(6) && event.createdAt <= report.asOf && event.after).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      assert.equal(report.sourceVersions[key], (events.at(-1)!.after as any).version);
    }
  }
  const snapshot = structuredClone(current);
  state.items[0].title = 'Edited after approval';
  state.workstreams[0].statusNote = 'Updated after approval';
  assert.deepEqual(current, snapshot);
});

test('showcase discovery and release heroes can complete real guarded workflow actions', async () => fixture(async (api, state) => {
  const item = async (id: string) => (await state()).items.find(value => value.id === id)!;
  const move = async (id: string, stage: string, expected = 200, extra = {}) => api('POST', `/api/items/${id}/transition`, { version: (await item(id)).version, stage, ...extra }, expected);
  const pass = async (id: string) => api('POST', `/api/items/${id}/tests`, { version: (await item(id)).version, result: 'pass', notes: 'Synthetic demonstration check passed.', evidence: 'Illustrative local rehearsal evidence.' });
  const discovery = 'showcase-budget-discovery';
  assert.equal((await item(discovery)).stage, 'In progress');
  await move(discovery, 'Review');
  await move(discovery, 'Closed', 400);
  await pass(discovery);
  await move(discovery, 'Closed');
  assert.ok((await item(discovery)).closedAt);

  const release = 'showcase-mi-release';
  assert.equal((await item(release)).stage, 'Development');
  await move(release, 'UAT', 200, { currentOwnerId: 'demo-qa' });
  await move(release, 'Ready for production', 400);
  await pass(release);
  await move(release, 'Ready for production', 200, { currentOwnerId: 'demo-engineer' });
  await move(release, 'Production verification', 400);
  await move(release, 'Production verification', 200, { currentOwnerId: 'demo-qa', evidence: 'Synthetic release rehearsal — no real deployment.' });
  await pass(release);
  await move(release, 'Awaiting client acceptance');
  await move(release, 'Closed', 400);
  await api('POST', `/api/items/${release}/client-response`, { version: (await item(release)).version, decision: 'rejected', notes: 'Illustrative client requests a revised headline.', evidence: 'Synthetic rehearsal response.', currentOwnerId: 'demo-engineer' });
  const returned = await item(release);
  assert.equal(returned.stage, 'Development');
  assert.equal(returned.cycle, 2);
  await move(release, 'UAT');
  await move(release, 'Ready for production', 400);

  const accounting = 'showcase-accounting-acceptance';
  assert.equal((await item(accounting)).stage, 'Awaiting client acceptance');
  await api('POST', `/api/items/${accounting}/client-response`, { version: (await item(accounting)).version, decision: 'accepted', notes: 'Illustrative acceptance for the demo.', evidence: 'Synthetic client-response record.' });
  assert.equal((await item(accounting)).stage, 'Closed');
  const blocker = await item('showcase-ppi-blocker');
  assert.ok(blocker.blocked);
  await move(blocker.id, blocker.kind === 'software' ? 'UAT' : 'Review', 400);
}));

test('showcase meeting capture, confirmations and approved presentation remain functional and labelled', async () => fixture(async (api, state) => {
  const initial = await state();
  const meeting = initial.meetings[0];
  const captured = await api('POST', `/api/meetings/${meeting.id}/capture`, { version: meeting.version, workstreamId: 'uc-budget-companion', proposal: { type: 'action', title: 'Confirm the rehearsal workshop participants', detail: 'Illustrative meeting follow-up for the end-to-end test.', ownerId: 'demo-lead', dueDate: '2026-09-10' } });
  assert.ok(captured.meeting.linkedItemIds.includes(captured.record.id));
  for (const stream of (await state()).workstreams) await api('POST', '/api/submissions', { workstreamId: stream.id, completed: 'Illustrative delivery progress reviewed.', next: 'Complete the next demonstration gate.', changes: '', blockers: '', health: stream.health });
  const draft = await api('POST', '/api/reports', { audience: 'client' });
  assert.ok(draft.body.workstreams.every((w: any) => w.confirmed));
  await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version }, 403);
  await api('POST', '/api/demo/persona', { userId: 'demo-approver' });
  await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version });
  const snapshot = await api('GET', `/api/reports/${draft.id}/presentation`);
  assert.equal(snapshot.demoScenario, 'consulting-lifecycle');
  assert.equal(snapshot.status, 'approved');
  const privateRisk = initial.registers.find(record => record.id === 'showcase-raid-internal')!;
  for (const privateText of [privateRisk.title, privateRisk.detail, privateRisk.nextAction]) assert.ok(!JSON.stringify(snapshot).includes(privateText), 'The approved client presentation must exclude internal staffing information.');
  await api('POST', '/api/demo/persona', { userId: 'demo-pmo' });
  const work = (await state()).items.find(i => i.id === 'showcase-budget-scope')!;
  await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { title: 'Revised demonstration scope follow-up' } });
  assert.deepEqual(await api('GET', `/api/reports/${draft.id}/presentation`), snapshot);
  assert.equal(snapshot.sourceDocuments, undefined);
  assert.equal(snapshot.events, undefined);
}));

test('showcase storage defaults are isolated and profile changes preserve saved work', async () => {
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'showcase' }), { seedProfile: 'showcase', dataDir: '.data/showcase' });
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'project' }), { seedProfile: 'project', dataDir: '.data/client' });
  const root = await mkdtemp(path.join(os.tmpdir(), 'pmo-showcase-test-'));
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp({ dataDir: path.join(root, 'saved'), seedProfile: 'showcase', testMode: true, now: () => fixedNow });
    const original = (await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { host: 'localhost:4311' } })).json().state;
    await app.close(); app = undefined;
    app = await createApp({ dataDir: path.join(root, 'saved'), seedProfile: 'project', testMode: true, now: () => fixedNow });
    const reopened = (await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { host: 'localhost:4310' } })).json().state;
    assert.deepEqual(reopened, original);
  } finally {
    await app?.close();
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'pmo-showcase-test-')));
    await rm(root, { recursive: true, force: true });
  }
});
