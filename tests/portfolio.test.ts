import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createPortfolioState, PORTFOLIO_USE_CASES } from '../server/portfolio-seed.js';
import { createSeedState } from '../server/seed.js';
import { seedConfiguration } from '../server/seed-config.js';
import { createRecord, reportDraft, schemas, validateReferences } from '../server/domain.js';
import { confirmationState, latestWorkstreamChange, reportingPeriod } from '../shared/reporting.js';
import { LIFECYCLE_PHASES, type HubState, type Member } from '../shared/types.js';

const fixedNow = new Date('2026-09-08T08:00:00.000Z');
const firstId = PORTFOLIO_USE_CASES[0][0], secondId = PORTFOLIO_USE_CASES[1][0];
const expectedNames = ['Performance Portfolio Intelligence', 'Investment Companion', 'Legal Companion', 'Market Intelligence', 'Accounting Companion', 'Benchmark', 'AI Based Treasury Liquidity Management', 'Spreadsheet Intelligence', 'Public Finance', 'Budget Companion'];

function roleFixture(): HubState {
  const state = createPortfolioState(fixedNow);
  const member = (id: string, role: Member['role'], workstreamIds: string[], canApproveReports = false): Member => ({ id, role, workstreamIds, canApproveReports, name: `${role} test role`, initials: 'QA', title: 'Test fixture role', color: '#397d79' });
  state.members.push(member('test-lead', 'lead', []), member('test-contributor', 'contributor', [firstId]), member('test-approver', 'executive', [], true));
  return state;
}

async function fixture(run: (context: {
  api: (method: string, url: string, payload?: unknown, expected?: number) => Promise<any>;
  state: () => Promise<HubState>;
  advance: () => void;
}) => Promise<void>, initialState: HubState = roleFixture()) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pmo-portfolio-test-'));
  let clock = new Date(fixedNow), cookie = '';
  const app = await createApp({ dataDir: path.join(directory, 'database'), state: initialState, testMode: true, now: () => clock });
  const api = async (method: string, url: string, payload?: unknown, expected = 200) => {
    const response = await app.inject({ method: method as any, url, headers: { host: 'localhost:4310', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }) });
    assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
    const setCookie = response.headers['set-cookie'];
    if (setCookie) cookie = String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
    return response.json();
  };
  try {
    await api('GET', '/api/bootstrap');
    await run({ api, state: async () => (await api('GET', '/api/bootstrap')).state, advance: () => { clock = new Date(clock.getTime() + 1000); } });
  } finally {
    await app.close();
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'pmo-portfolio-test-')));
    await rm(directory, { recursive: true, force: true });
  }
}

test('portfolio seed contains only the ten confirmed names, unknown details and explicit local roles', () => {
  const state = createPortfolioState(fixedNow);
  assert.deepEqual(state.workstreams.map(workstream => workstream.name), expectedNames);
  assert.deepEqual(LIFECYCLE_PHASES, ['shaping', 'discovery', 'design', 'build', 'assurance', 'release', 'adoption']);
  assert.equal(new Set(state.workstreams.map(workstream => workstream.id)).size, 10);
  for (const workstream of state.workstreams) {
    assert.equal(workstream.health, 'unknown'); assert.equal(workstream.leadId, '');
    assert.equal(workstream.description, ''); assert.equal(workstream.statusNote, ''); assert.equal(workstream.clientSummary, '');
    for (const key of ['priority', 'lifecyclePhase', 'scope', 'nextGate', 'gateDate']) assert.equal(key in workstream, false);
    assert.equal(workstream.updatedAt, fixedNow.toISOString());
    assert.ok(workstream.shortName.length <= 24);
  }
  for (const key of ['deliverables', 'milestones', 'items', 'tests', 'registers', 'meetings', 'submissions', 'reports', 'events'] as const) assert.deepEqual(state[key], []);
  assert.equal(state.members.length, 4); assert.equal(state.members[0].id, 'preview-pmo');
  assert.match(state.members[0].name, /preview/i); assert.deepEqual(state.members[0].workstreamIds, []);
  assert.ok(state.members.every(member => /preview/i.test(member.name) && member.title === 'Local preview role'));
  assert.equal(state.members.find(member => member.id === 'preview-approver')!.canApproveReports, true);
  assert.equal(state.members.find(member => member.id === 'preview-lead')!.workstreamIds.length, 10);
  assert.equal(state.members.find(member => member.id === 'preview-contributor')!.workstreamIds.length, 10);
  assert.deepEqual(createPortfolioState(fixedNow), state);
  state.workstreams[0].name = 'Changed locally';
  assert.equal(createPortfolioState(fixedNow).workstreams[0].name, expectedNames[0]);
});

test('seed configuration defaults to an isolated portfolio and respects explicit profile and directory', () => {
  assert.deepEqual(seedConfiguration({}, {}), { seedProfile: 'portfolio', dataDir: '.data/portfolio' });
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'demo' }), { seedProfile: 'demo', dataDir: '.data/pmo' });
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'demo', DATA_DIR: 'existing-store' }), { seedProfile: 'demo', dataDir: 'existing-store' });
  assert.deepEqual(seedConfiguration({ seedProfile: 'portfolio', dataDir: 'chosen-store' }, { SEED_PROFILE: 'demo', DATA_DIR: 'environment-store' }), { seedProfile: 'portfolio', dataDir: 'chosen-store' });
  assert.throws(() => seedConfiguration({}, { SEED_PROFILE: 'mistyped' }), /SEED_PROFILE/);
  assert.throws(() => seedConfiguration({}, { DATA_DIR: '' }), /DATA_DIR/);
});

test('fresh startup selects portfolio or demo explicitly, supplied state wins and existing databases remain untouched', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pmo-portfolio-store-'));
  const read = async (app: Awaited<ReturnType<typeof createApp>>) => (await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { host: 'localhost:4310' } })).json().state as HubState;
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp({ dataDir: path.join(directory, 'portfolio'), seedProfile: 'portfolio', testMode: true, now: () => fixedNow });
    const portfolio = await read(app);
    assert.deepEqual(portfolio.workstreams.map(workstream => workstream.name).sort(), [...expectedNames].sort());
    assert.equal(portfolio.items.length, 0); await app.close(); app = undefined;
    app = await createApp({ dataDir: path.join(directory, 'portfolio'), seedProfile: 'demo', state: createSeedState(fixedNow), testMode: true });
    assert.deepEqual(await read(app), portfolio); await app.close(); app = undefined;
    app = await createApp({ dataDir: path.join(directory, 'demo'), seedProfile: 'demo', testMode: true, now: () => fixedNow });
    const demo = await read(app); assert.equal(demo.items.length, 30); assert.equal(demo.workstreams.length, 3); await app.close(); app = undefined;
    const supplied = createPortfolioState(fixedNow); supplied.settings.projectName = 'Explicit caller state'; supplied.workstreams = [];
    app = await createApp({ dataDir: path.join(directory, 'supplied'), seedProfile: 'demo', state: supplied, testMode: true });
    const persisted = await read(app);
    assert.deepEqual(persisted.settings, supplied.settings); assert.deepEqual(persisted.workstreams, []);
    assert.deepEqual(persisted.members, [...supplied.members].sort((a, b) => a.id.localeCompare(b.id)));
  } finally {
    await app?.close();
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'pmo-portfolio-store-')));
    await rm(directory, { recursive: true, force: true });
  }
});

test('use-case lifecycle edits are versioned and audited, and optional selections can be cleared', async () => fixture(async ({ api, state, advance }) => {
  let workstream = (await state()).workstreams.find(value => value.id === firstId)!;
  advance();
  workstream = await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes: { lifecyclePhase: 'discovery', priority: 'High', description: 'Confirm an agreed outcome', scope: 'Discovery scope', nextGate: 'Discovery review', gateDate: '2026-10-15', leadId: 'test-lead' } });
  assert.equal(workstream.version, 2); assert.equal(workstream.lifecyclePhase, 'discovery'); assert.equal(workstream.gateDate, '2026-10-15');
  workstream = await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes: { name: 'Reviewed use case' } });
  assert.equal(workstream.lifecyclePhase, 'discovery'); assert.equal(workstream.priority, 'High');
  await api('PATCH', `/api/records/workstreams/${firstId}`, { version: 1, changes: { lifecyclePhase: 'release' } }, 409);
  workstream = await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes: { lifecyclePhase: null, priority: null, leadId: '', scope: '', nextGate: '', gateDate: '' } });
  assert.equal('lifecyclePhase' in workstream, false); assert.equal('priority' in workstream, false); assert.equal(workstream.leadId, '');
  const changes = (await state()).events.filter(event => event.entityId === firstId).sort((a, b) => (a.after as any).version - (b.after as any).version);
  assert.equal(changes.length, 3); assert.equal((changes[0].after as any).lifecyclePhase, 'discovery');
  assert.equal((changes.at(-1)!.before as any).priority, 'High'); assert.equal((changes.at(-1)!.after as any).priority, undefined);
  const newCase = await api('POST', '/api/records/workstreams', { name: 'User supplied case', lifecyclePhase: 'shaping' });
  assert.equal(newCase.leadId, ''); assert.equal(newCase.health, 'unknown'); assert.equal(newCase.lifecyclePhase, 'shaping');
}));

test('invalid lifecycle values, dates, owners and evidence are rejected without partial edits', async () => fixture(async ({ api, state }) => {
  const workstream = (await state()).workstreams.find(value => value.id === firstId)!;
  const before = await state();
  for (const changes of [{ lifecyclePhase: 'implementation' }, { priority: 'Urgent' }, { gateDate: '2026-02-30' }, { gateDate: '2026-9-8' }, { leadId: 'unknown-member' }]) await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes }, 400);
  for (const extra of [{ lifecyclePhase: 'UAT' }, { status: 'approved' }, { ownerId: 'unknown-member' }, { workstreamId: 'unknown-case' }, { evidenceLinks: ['javascript:alert(1)'] }, { evidenceLinks: ['file:///private/document.docx'] }, { evidenceLinks: ['https://'] }]) await api('POST', '/api/records/deliverables', { title: 'Rejected artifact', workstreamId: firstId, ...extra }, 400);
  assert.deepEqual(await state(), before);
  const validLeap = await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes: { gateDate: '2028-02-29' } });
  assert.equal(validLeap.gateDate, '2028-02-29');
}));

test('artifacts retain user evidence and status without inventing a work-item approval', async () => fixture(async ({ api, state }) => {
  let artifact = await api('POST', '/api/records/deliverables', { title: 'Discovery findings', workstreamId: firstId, lifecyclePhase: 'discovery', status: 'draft', evidenceLinks: ['https://example.com/discovery'] });
  assert.equal(artifact.ownerId, ''); assert.equal(artifact.lifecyclePhase, 'discovery');
  const item = await api('POST', '/api/items', { title: 'Review the findings', workstreamId: firstId, deliverableId: artifact.id, kind: 'general' });
  artifact = await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { status: 'accepted' } });
  assert.equal(artifact.status, 'accepted'); assert.deepEqual(artifact.evidenceLinks, ['https://example.com/discovery']); assert.equal(artifact.lifecyclePhase, 'discovery');
  const after = await state(); assert.equal(after.items.find(value => value.id === item.id)!.stage, 'Backlog'); assert.equal(after.tests.length, 0);
  assert.equal(after.events.some(event => event.action === 'client_accepted'), false);
  artifact = await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { lifecyclePhase: null, status: null, evidenceLinks: [] } });
  assert.equal('lifecyclePhase' in artifact, false); assert.equal('status' in artifact, false); assert.deepEqual(artifact.evidenceLinks, []);
}));

test('artifact, task and milestone associations remain valid when records move', async () => fixture(async ({ api, state, advance }) => {
  const artifact = await api('POST', '/api/records/deliverables', { title: 'Associated artifact', workstreamId: firstId });
  const item = await api('POST', '/api/items', { title: 'Associated task', workstreamId: firstId, deliverableId: artifact.id });
  await api('POST', '/api/items', { title: 'Wrong task association', workstreamId: secondId, deliverableId: artifact.id }, 400);
  await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { workstreamId: secondId } }, 400);
  await api('POST', '/api/records/milestones', { title: 'Wrong milestone association', workstreamIds: [secondId], deliverableIds: [artifact.id] }, 400);
  const milestone = await api('POST', '/api/records/milestones', { title: 'Associated gate', workstreamIds: [firstId], deliverableIds: [artifact.id] });
  await api('PATCH', `/api/records/items/${item.id}`, { version: item.version, changes: { deliverableId: '', workstreamId: secondId } });
  await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { workstreamId: secondId } }, 400);
  await api('PATCH', `/api/records/milestones/${milestone.id}`, { version: milestone.version, changes: { workstreamIds: [firstId, secondId] } });
  await api('POST', '/api/submissions', { workstreamId: firstId, completed: '', next: '', changes: '', blockers: '', health: 'unknown' });
  advance();
  const moved = await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { workstreamId: secondId } });
  assert.equal(moved.workstreamId, secondId);
  const current = await state();
  assert.equal(current.items.filter(value => value.title === 'Wrong task association').length, 0);
  const end = reportingPeriod(fixedNow, current.settings.timezone, current.settings.cutoffHour).end;
  assert.equal(confirmationState(current, firstId, end).stale, true);
  assert.ok(current.events.some(event => event.entityId === firstId && event.action === 'association_changed'));
}));

test('a designated lead can create in that use case while contributors and executives retain their boundaries', async () => fixture(async ({ api, state }) => {
  const workstream = (await state()).workstreams.find(value => value.id === firstId)!;
  await api('PATCH', `/api/records/workstreams/${firstId}`, { version: workstream.version, changes: { leadId: 'test-lead' } });
  await api('POST', '/api/demo/persona', { userId: 'test-lead' });
  const artifact = await api('POST', '/api/records/deliverables', { title: 'Lead scoped artifact', workstreamId: firstId });
  await api('POST', '/api/items', { title: 'Lead scoped task', workstreamId: firstId });
  await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { status: 'in_review' } });
  await api('POST', '/api/records/deliverables', { title: 'Outside lead scope', workstreamId: secondId }, 403);
  await api('POST', '/api/demo/persona', { userId: 'test-contributor' });
  const owned = await api('POST', '/api/records/deliverables', { title: 'Contributor artifact', workstreamId: firstId, ownerId: 'test-contributor' });
  await api('PATCH', `/api/records/deliverables/${owned.id}`, { version: owned.version, changes: { workstreamId: secondId } }, 403);
  await api('POST', '/api/records/deliverables', { title: 'Outside contributor scope', workstreamId: secondId }, 403);
  await api('POST', '/api/demo/persona', { userId: 'test-approver' });
  await api('PATCH', `/api/records/deliverables/${owned.id}`, { version: owned.version, changes: { status: 'accepted' } }, 403);
}));

test('artifact changes stale confirmations and report drafts without exposing internal artifact content to clients', async () => fixture(async ({ api, state, advance }) => {
  const artifact = await api('POST', '/api/records/deliverables', { title: 'INTERNAL-ONLY-COMMERCIAL-NOTE', description: 'Internal scope assumptions', workstreamId: firstId, evidenceLinks: ['https://example.com/internal-evidence'] });
  let current = await state();
  await api('POST', '/api/submissions', { workstreamId: firstId, completed: '', next: '', changes: '', blockers: '', health: 'unknown', sourceUpdatedAt: latestWorkstreamChange(current, firstId) });
  current = await state(); const end = reportingPeriod(fixedNow, current.settings.timezone, current.settings.cutoffHour).end;
  assert.equal(confirmationState(current, firstId, end).confirmed, true);
  const report = await api('POST', '/api/reports', { audience: 'client' });
  assert.equal(report.sourceVersions[`deliverables:${artifact.id}`], 1);
  assert.equal(JSON.stringify(report.body).includes('INTERNAL-ONLY-COMMERCIAL-NOTE'), false);
  assert.equal(JSON.stringify(report.body).includes('internal-evidence'), false);
  advance();
  await api('PATCH', `/api/records/deliverables/${artifact.id}`, { version: artifact.version, changes: { status: 'in_review' } });
  current = await state(); assert.equal(confirmationState(current, firstId, end).stale, true);
  await api('POST', '/api/demo/persona', { userId: 'test-approver' });
  await api('POST', `/api/reports/${report.id}/approve`, { version: report.version, incompleteReason: 'Known gaps' }, 409);
}));

test('undated backlog work is not falsely reported as overdue or complete', () => {
  const state = createPortfolioState(fixedNow), user = state.members[0];
  createRecord(state, user, 'items', { title: 'Unscheduled discovery question', workstreamId: firstId, kind: 'general' }, fixedNow.toISOString());
  const report = reportDraft(state, user, 'internal', fixedNow.toISOString());
  assert.deepEqual(report.body.attention, []); assert.deepEqual(report.body.highlights, []); assert.deepEqual(report.body.nextWeek, []);
  assert.equal(state.items[0].dueDate, ''); assert.equal(state.items[0].baselineDate, '');
});

test('imports preserve missing dates and an invalid duplicate does not suppress the valid row', async () => fixture(async ({ api, state }) => {
  const csv = `Title,Workstream,Owner,Due date\nDiscovery follow-up,${firstId},unknown-member,\nDiscovery follow-up,${firstId},preview-pmo,\nDated follow-up,${firstId},preview-pmo,2026-10-15`;
  const preview = await api('POST', '/api/import/preview', { filename: 'discovery.csv', content: Buffer.from(csv).toString('base64') });
  assert.equal(preview.invalidCount, 1); assert.equal(preview.validCount, 2); assert.equal(preview.duplicateCount, 0);
  assert.equal(preview.rows[1].item.dueDate, ''); assert.equal(preview.rows[1].item.baselineDate, '');
  assert.equal(preview.rows[2].item.baselineDate, '2026-10-15');
  const result = await api('POST', '/api/import/commit', { previewId: preview.id });
  assert.equal(result.importedCount, 2);
  const imported = (await state()).items.find(value => value.title === 'Discovery follow-up')!;
  assert.equal(imported.dueDate, ''); assert.equal(imported.baselineDate, '');
}));

test('existing synthetic workstreams, artifacts and milestones remain valid without lifecycle fields', () => {
  const state = createSeedState(fixedNow);
  for (const collection of ['workstreams', 'deliverables', 'milestones'] as const) for (const record of state[collection]) {
    assert.equal(schemas[collection].safeParse(record).success, true);
    assert.doesNotThrow(() => validateReferences(state, collection, record));
  }
  assert.equal(state.items.length, 30); assert.equal(state.reports.length, 2);
});

test('settings reject stale editors and metadata changes, with version one compatibility for existing stores', async () => {
  const legacy = roleFixture(); delete legacy.settings.version;
  await fixture(async ({ api, state }) => {
    const initial = await state(); assert.equal(initial.settings.version, undefined);
    const report = await api('POST', '/api/reports', { audience: 'client' });
    assert.equal(report.sourceVersions['settings:project'], 1);
    await api('PATCH', '/api/settings', { projectName: 'Missing version' }, 400);
    await api('PATCH', '/api/settings', { expectedVersion: 1, version: 100 }, 400);
    const saved = await api('PATCH', '/api/settings', { expectedVersion: 1, projectName: 'Reviewed portfolio settings' });
    assert.equal(saved.version, 2); assert.equal(saved.projectName, 'Reviewed portfolio settings');
    await api('PATCH', '/api/settings', { expectedVersion: 1, projectName: 'A stale editor would overwrite this' }, 409);
    await api('PATCH', '/api/settings', { expectedVersion: 2, cutoffHour: 9 }, 400);
    const current = await state(); assert.deepEqual(current.settings, saved);
    const audits = current.events.filter(event => event.entityType === 'settings');
    assert.equal(audits.length, 1); assert.equal((audits[0].before as any).version, undefined); assert.equal((audits[0].after as any).version, 2);
    await api('POST', '/api/demo/persona', { userId: 'test-approver' });
    await api('POST', `/api/reports/${report.id}/approve`, { version: report.version, incompleteReason: 'Known gaps' }, 409);
  }, legacy);
});
