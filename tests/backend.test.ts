import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createApp } from '../server/app.js';
import { createSeedState } from '../server/seed.js';
import { latestStreamChange } from '../server/domain.js';
import type { HubState, WorkItem } from '../shared/types.js';

let app: Awaited<ReturnType<typeof createApp>>, directory: string, cookie = '';
let clock = new Date('2026-09-10T06:00:00.000Z');
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'pmo-backend-test-'));
  app = await createApp({ dataDir: path.join(directory, 'database'), state: createSeedState(clock), testMode: true, now: () => clock });
});
after(async () => {
  await app?.close();
  assert.ok(directory.startsWith(path.join(os.tmpdir(), 'pmo-backend-test-')));
  await rm(directory, { recursive: true, force: true });
});
async function api(method: any, url: string, payload?: unknown, expected = 200) {
  const response = await app.inject({ method, url, headers: { host: 'localhost:4310', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
  const setCookie = response.headers['set-cookie'];
  if (setCookie) cookie = String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
  return response.json();
}
async function persona(userId: string) { await api('POST', '/api/demo/persona', { userId }); }
async function state(): Promise<HubState> { return (await api('GET', '/api/bootstrap')).state; }
async function item(id: string): Promise<WorkItem> { return (await state()).items.find(i => i.id === id)!; }

test('loopback sessions, origin checks and server-side permissions cannot be bypassed', async () => {
  await api('POST', '/api/items', { title: 'Untrusted' }, 401);
  const bootstrap = await api('GET', '/api/bootstrap');
  assert.equal(bootstrap.currentUserId, 'pmo-nadia');
  assert.equal(bootstrap.demoMode, true);
  const crossOrigin = await app.inject({ method: 'POST', url: '/api/demo/persona', headers: { host: 'localhost:4310', origin: 'https://example.com', cookie, 'content-type': 'application/json' }, payload: { userId: 'admin-jules' } });
  assert.equal(crossOrigin.statusCode, 403);
  const badHost = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { host: 'evil.example' } });
  assert.equal(badHost.statusCode, 403);
  await persona('exec-omar');
  await api('POST', '/api/items', { title: 'Executive write', workstreamId: 'ws-data' }, 403);
  await persona('dev-yusuf');
  const target = await item('work-assistant-02');
  await api('PATCH', `/api/records/items/${target.id}`, { version: target.version, changes: { title: 'Not assigned to me' } }, 403);
  await api('PATCH', '/api/settings', { projectName: 'Unauthorized' }, 403);
  await persona('pmo-nadia');
});

test('quick Backlog capture is incomplete until work starts and changing agreed dates needs rationale', async () => {
  await persona('dev-yusuf');
  let work = await api('POST', '/api/items', { title: 'Quickly captured idea' });
  assert.equal(work.stage, 'Backlog'); assert.equal(work.dueDate, ''); assert.equal(work.baselineDate, ''); assert.equal(work.ownerId, '');
  await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage: 'Development' }, 400);
  work = await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { ownerId: 'dev-yusuf', currentOwnerId: 'dev-yusuf', dueDate: '2026-09-21', acceptanceCriteria: 'Clear outcome', nextAction: 'Implement the agreed outcome' } });
  assert.equal(work.baselineDate, '2026-09-21');
  work = await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage: 'Development' });
  await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { dueDate: '2026-09-22' } }, 400);
  work = await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { dueDate: '2026-09-22' }, reason: 'Dependency review needs another day.' });
  assert.equal(work.baselineDate, '2026-09-21'); assert.equal(work.dueDate, '2026-09-22');
  await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { currentOwnerId: '' } }, 400);
  await persona('pmo-nadia');
  const milestone = (await state()).milestones.find(m => m.status !== 'complete')!;
  await api('PATCH', `/api/records/milestones/${milestone.id}`, { version: milestone.version, changes: { forecastDate: '2026-09-27' } }, 400);
  await api('PATCH', `/api/records/milestones/${milestone.id}`, { version: milestone.version, changes: { forecastDate: '2026-09-27' }, reason: 'Revised after dependency review.' });
});

test('software lifecycle enforces tests, failures, deployment proof and client acceptance', async () => {
  let work = await api('POST', '/api/items', { title: 'Lifecycle acceptance test', workstreamId: 'ws-assistant', ownerId: 'pmo-nadia', currentOwnerId: 'pmo-nadia', dueDate: '2026-09-20', nextAction: 'Deliver and verify the agreed outcome', acceptanceCriteria: 'Demonstrated verified outcome' });
  const move = async (stage: string, extra = {}, status = 200) => {
    work = await item(work.id);
    const result = await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage, ...extra }, status);
    if (status === 200) work = result;
    return result;
  };
  await move('UAT', {}, 400);
  await move('Development', { currentOwnerId: 'dev-yusuf' });
  assert.equal(work.currentOwnerId, 'dev-yusuf');
  await move('UAT', { currentOwnerId: 'qa-ellie' });
  await move('Ready for production', {}, 400);
  await persona('dev-maya');
  const failure = await api('POST', `/api/items/${work.id}/tests`, { result: 'fail', blocking: true, notes: 'A criterion fails', evidence: 'Run 12, case 3', stage: 'UAT' });
  await api('POST', `/api/items/${work.id}/tests`, { result: 'pass', notes: 'Retest passes', evidence: 'Run 13', stage: 'UAT' });
  await persona('pmo-nadia');
  await move('Ready for production', {}, 400);
  await api('POST', `/api/test-results/${failure.id}/resolve`, { notes: 'Retest verified the fix.' });
  await move('Ready for production');
  await move('Production verification', {}, 400);
  await move('Production verification', { evidence: 'https://example.com/deployment/one' });
  await move('Awaiting client acceptance', {}, 400);
  await api('POST', `/api/items/${work.id}/tests`, { result: 'pass', notes: 'Production acceptance criteria verified', evidence: 'Release check 15' });
  await move('Awaiting client acceptance');
  await move('Closed', {}, 400);
  work = await api('POST', `/api/items/${work.id}/client-response`, { version: work.version, decision: 'rejected', notes: 'Client requests correction to agreed outcome', evidence: 'Client response 9' });
  assert.equal(work.stage, 'Development'); assert.equal(work.cycle, 2);
  assert.equal(work.currentOwnerId, work.ownerId);
  await move('UAT');
  await move('Ready for production', {}, 400); // old-cycle pass cannot satisfy new UAT
  await api('POST', `/api/items/${work.id}/tests`, { result: 'pass', notes: 'Cycle two UAT', evidence: 'Run 16' });
  await move('Ready for production');
  await move('Production verification', { evidence: 'https://example.com/deployment/two' });
  await api('POST', `/api/items/${work.id}/tests`, { result: 'pass', notes: 'Cycle two production verification', evidence: 'Run 17' });
  await move('Awaiting client acceptance');
  work = await api('POST', `/api/items/${work.id}/client-response`, { version: work.version, decision: 'accepted', notes: 'Client explicitly accepted', evidence: 'Acceptance record 12' });
  assert.equal(work.stage, 'Closed'); assert.ok(work.closedAt);
  const closed = work;
  await api('PATCH', `/api/records/items/${work.id}`, { version: work.version, changes: { stage: 'Development' } }, 400);
  work = await api('POST', `/api/items/${work.id}/reopen`, { version: work.version, reason: 'Regression after acceptance' });
  assert.equal(work.cycle, 3); assert.equal(work.closedAt, undefined);
  assert.equal(work.baselineDate, closed.baselineDate);
  assert.ok((await state()).events.some(e => e.entityId === work.id && e.action === 'client_accepted'));
});

test('optimistic version conflicts roll back the losing change and its audit event', async () => {
  const work = await api('POST', '/api/items', { title: 'Concurrent edit target', kind: 'general', workstreamId: 'ws-evaluation' });
  const request = (title: string) => app.inject({ method: 'PATCH', url: `/api/records/items/${work.id}`, headers: { host: 'localhost:4310', cookie, 'content-type': 'application/json' }, payload: { version: work.version, changes: { title } } });
  const results = await Promise.all([request('First edit'), request('Second edit')]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  const latest = await state();
  assert.equal(latest.items.find(i => i.id === work.id)!.version, 2);
  assert.equal(latest.events.filter(e => e.entityId === work.id && e.action === 'updated').length, 1);
});

test('generic work closes only after a passing review', async () => {
  let work = await api('POST', '/api/items', { title: 'Reviewed generic outcome', workstreamId: 'ws-evaluation', kind: 'general', ownerId: 'pmo-nadia', currentOwnerId: 'pmo-nadia', dueDate: '2026-09-20', nextAction: 'Complete the review', acceptanceCriteria: 'Reviewer accepts the evidence' });
  for (const stage of ['In progress', 'Review']) work = await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage });
  await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage: 'Closed' }, 400);
  await persona('dev-yusuf'); // Any delivery teammate can verify and greenlight.
  await api('POST', `/api/items/${work.id}/tests`, { result: 'pass', notes: 'Review accepted', evidence: 'Reviewed document' });
  work = await item(work.id);
  work = await api('POST', `/api/items/${work.id}/transition`, { version: work.version, stage: 'Closed' });
  assert.equal(work.stage, 'Closed');
  await persona('pmo-nadia');
});

test('confirmations detect concurrent changes and client report snapshots stay isolated and immutable', async () => {
  const old = await state(), stream = old.workstreams.find(w => w.id === 'ws-data')!;
  const captured = latestStreamChange(old, stream.id);
  clock = new Date(clock.getTime() + 1000);
  await api('PATCH', `/api/records/workstreams/${stream.id}`, { version: stream.version, changes: { statusNote: 'INTERNAL-ONLY-COMMERCIAL-NOTE changed after review' } });
  await api('POST', '/api/submissions', { workstreamId: stream.id, completed: 'Reviewed', next: 'Next', changes: '', blockers: '', health: 'amber', sourceUpdatedAt: captured }, 409);
  for (const w of (await state()).workstreams) await api('POST', '/api/submissions', { workstreamId: w.id, completed: 'Confirmed', next: 'Next', changes: '', blockers: '', health: w.health });
  let draft = await api('POST', '/api/reports', { audience: 'client' });
  assert.equal(JSON.stringify(draft.body).includes('INTERNAL-ONLY-COMMERCIAL-NOTE'), false);
  await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version }, 403);
  const source = (await state()).workstreams[0];
  clock = new Date(clock.getTime() + 1000);
  await api('PATCH', `/api/records/workstreams/${source.id}`, { version: source.version, changes: { statusNote: 'Source changes after report drafting' } });
  await persona('exec-omar');
  await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version, incompleteReason: 'Needed now' }, 409);
  await persona('pmo-nadia');
  draft = await api('POST', '/api/reports', { audience: 'client' });
  await persona('exec-omar');
  await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version }, 400);
  const approved = await api('POST', `/api/reports/${draft.id}/approve`, { version: draft.version, incompleteReason: 'One stream confirmation is outstanding; known status reviewed.' });
  const snapshot = await api('GET', `/api/reports/${draft.id}/presentation`);
  assert.equal('sourceVersions' in snapshot, false); assert.equal('events' in snapshot, false);
  await persona('pmo-nadia');
  await api('PATCH', `/api/records/reports/${draft.id}`, { version: approved.version, changes: { title: 'Rewrite approved history' } }, 409);
  const latest = (await state()).items.find(i => i.stage !== 'Closed')!;
  await api('PATCH', `/api/records/items/${latest.id}`, { version: latest.version, changes: { description: 'Post-publication internal changes' } });
  assert.deepEqual(await api('GET', `/api/reports/${draft.id}/presentation`), snapshot);
  clock = new Date(clock.getTime() + 7 * 86400000);
  const revision = await api('POST', '/api/reports', { audience: 'client', supersedesId: draft.id });
  assert.equal(revision.periodEnd, draft.periodEnd); assert.deepEqual(revision.body, approved.body);
});

test('import validates row issues, suppresses duplicates and commits idempotently', async () => {
  const csv = 'Title,Workstream,Owner,Due date\r\nImported valid action,Data foundation,Arjun Mehta,2026-09-19\r\nImported valid action,Data foundation,Arjun Mehta,2026-09-19\r\nInvalid owner,Data foundation,Nobody,2026-09-19';
  const preview = await api('POST', '/api/import/preview', { filename: 'backlog.csv', content: Buffer.from(csv).toString('base64'), mapping: { title: 'Title', workstreamId: 'Workstream', ownerId: 'Owner', dueDate: 'Due date' } });
  assert.equal(preview.validCount, 1); assert.equal(preview.duplicateCount, 1); assert.equal(preview.invalidCount, 1);
  const first = await api('POST', '/api/import/commit', { previewId: preview.id });
  assert.equal(first.importedCount, 1);
  const again = await api('POST', '/api/import/commit', { previewId: preview.id });
  assert.equal(again.importedCount, 0);
  assert.equal((await state()).items.filter(i => i.title === 'Imported valid action').length, 1);
});

test('late blocking findings reopen work and reject old-cycle results', async () => {
  const target = await item('work-assistant-02');
  await persona('dev-yusuf');
  const failure = await api('POST', `/api/items/${target.id}/tests`, { result: 'fail', blocking: true, notes: 'Late verification found a broken agreed criterion', evidence: 'Run 77', stage: target.stage, cycle: target.cycle, version: target.version });
  const changed = await item(target.id);
  assert.equal(changed.stage, 'Development'); assert.equal(changed.cycle, target.cycle + 1); assert.equal(changed.blocked, true);
  assert.equal(failure.cycle, target.cycle); assert.equal(failure.stage, target.stage);
  await api('POST', `/api/items/${target.id}/tests`, { result: 'fail', notes: 'Stale UI result', evidence: 'Old run', stage: changed.stage, cycle: target.cycle }, 409);
  await api('POST', `/api/items/${target.id}/reopen`, { version: changed.version, reason: 'Route active work through another correction cycle' });
  assert.equal((await item(target.id)).cycle, changed.cycle + 1);
  await persona('pmo-nadia');
});

test('explicit imported stages retain provenance without fabricated acceptance', async () => {
  const csv = 'Title,Workstream,Owner,Stage\nLegacy UAT,Knowledge assistant,Leila Mansour,UAT\nLegacy closed,Knowledge assistant,Leila Mansour,Closed\nUnknown stage,Knowledge assistant,Leila Mansour,Shipped-ish';
  const preview = await api('POST', '/api/import/preview', { filename: 'legacy.csv', content: Buffer.from(csv).toString('base64') });
  assert.equal(preview.validCount, 2); assert.equal(preview.invalidCount, 1);
  const result = await api('POST', '/api/import/commit', { previewId: preview.id });
  const legacyClosed = result.items.find((i: WorkItem) => i.title === 'Legacy closed');
  const legacyUat = result.items.find((i: WorkItem) => i.title === 'Legacy UAT');
  assert.equal(legacyUat.stage, 'UAT'); assert.equal(legacyUat.kind, 'software');
  assert.equal(legacyClosed.stage, 'Closed'); assert.equal(legacyClosed.closedAt, undefined); assert.ok(legacyClosed.importedFrom);
  const current = await state();
  assert.equal(current.tests.some(t => t.itemId === legacyClosed.id), false);
  assert.equal(current.events.some(e => e.entityId === legacyClosed.id && e.action === 'client_accepted'), false);
  const report = await api('POST', '/api/reports', { audience: 'internal' });
  assert.equal(report.body.highlights.some((line: string) => line.includes('Legacy closed')), false);
});

test('meeting capture commits the reviewed record and link atomically', async () => {
  const meeting = await api('POST', '/api/records/meetings', { title: 'Governance review', notes: 'Arjun will resolve access by Friday.' });
  const proposal = { type: 'action', title: 'Resolve access', detail: 'Complete the access request', ownerId: 'lead-arjun', dueDate: '2026-09-19', sourceQuote: 'Arjun will resolve access by Friday.' };
  const response = await api('POST', `/api/meetings/${meeting.id}/capture`, { version: meeting.version, workstreamId: 'ws-data', proposal });
  assert.ok(response.meeting.linkedItemIds.includes(response.record.id));
  assert.equal(response.record.stage, 'Backlog'); assert.equal(response.record.kind, 'general');
  const before = (await state()).items.length;
  await api('POST', `/api/meetings/${meeting.id}/capture`, { version: meeting.version, workstreamId: 'ws-data', proposal }, 409);
  assert.equal((await state()).items.length, before);
  await api('POST', `/api/meetings/${meeting.id}/capture`, { version: response.meeting.version, workstreamId: 'ws-data', proposal }, 409);
  assert.equal((await state()).items.length, before);
  await api('POST', `/api/meetings/${meeting.id}/capture`, { version: response.meeting.version, workstreamId: 'ws-data', proposal: { ...proposal, ownerId: 'missing-person' } }, 400);
  assert.equal((await state()).items.length, before);
});

test('XLSX previews and downloadable exports use real workbook content', async () => {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Backlog');
  sheet.addRow(['Title', 'Workstream', 'Owner', 'Stage']);
  sheet.addRow(['Workbook imported action', 'Data foundation', 'Arjun Mehta', 'In progress']);
  const content = Buffer.from(await book.xlsx.writeBuffer()).toString('base64');
  const preview = await api('POST', '/api/import/preview', { filename: 'real-workbook.xlsx', content });
  assert.equal(preview.validCount, 1); assert.equal(preview.rows[0].item.stage, 'In progress');
  const response = await app.inject({ method: 'GET', url: '/api/export?format=xlsx', headers: { host: 'localhost:4310', cookie } });
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['content-type']), /spreadsheetml/);
  const downloaded = new ExcelJS.Workbook(); await downloaded.xlsx.load(response.rawPayload as any);
  assert.equal(downloaded.worksheets.length, 3);
  assert.equal(downloaded.getWorksheet('Backlog')!.rowCount, (await state()).items.length + 1);
  const csv = await app.inject({ method: 'GET', url: '/api/export?format=csv', headers: { host: 'localhost:4310', cookie } });
  assert.equal(csv.statusCode, 200); assert.ok(csv.body.includes('Legacy UAT'));
  sheet.getCell('A2').value = { formula: 'HYPERLINK("https://example.com")', result: 'Calculated title' };
  await api('POST', '/api/import/preview', { filename: 'formula.xlsx', content: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') }, 400);
});

test('a second process cannot own the same local database', async () => {
  await assert.rejects(createApp({ dataDir: path.join(directory, 'database'), state: createSeedState(clock), testMode: true }), /already has an owner/);
});

test('records and approved reports survive closing and reopening the database', async () => {
  const before = await state();
  await app.close(); cookie = '';
  app = await createApp({ dataDir: path.join(directory, 'database'), state: createSeedState(clock), testMode: true, now: () => clock });
  const reopened = await state();
  assert.deepEqual(reopened.items, before.items);
  assert.deepEqual(reopened.reports, before.reports);
  assert.deepEqual(reopened.events, before.events);
});

test('an abruptly exited owner is recovered without resetting persisted records', async () => {
  const crashDataDir = path.join(directory, 'abrupt-exit');
  const script = `import { Store } from ${JSON.stringify(pathToFileURL(path.resolve('server/db.ts')).href)};
    import { createSeedState } from ${JSON.stringify(pathToFileURL(path.resolve('server/seed.ts')).href)};
    const store = await Store.open({dataDir:${JSON.stringify(crashDataDir)},initialState:createSeedState(new Date('2026-09-10T06:00:00Z'))});
    await store.mutate(state => { state.settings.projectName='Saved before abrupt exit'; state.items[0].description='Preserve this committed edit'; });
    process.exit(0);`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += String(chunk); });
  await new Promise<void>((resolve, reject) => { child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`Crash fixture failed (${code}): ${stderr}`))); });
  const oldLock = JSON.parse(await readFile(`${crashDataDir}.pmo-lock`, 'utf8'));
  assert.equal(oldLock.pid, child.pid);
  const starts = await Promise.allSettled([
    createApp({ dataDir: crashDataDir, testMode: true }),
    createApp({ dataDir: crashDataDir, testMode: true }),
  ]);
  assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(starts.filter(r => r.status === 'rejected').length, 1);
  const recovered = starts.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof createApp>>>;
  try {
    const response = await recovered.value.inject({ method: 'GET', url: '/api/bootstrap', headers: { host: 'localhost:4310' } });
    assert.equal(response.statusCode, 200);
    const saved = response.json().state as HubState;
    assert.equal(saved.settings.projectName, 'Saved before abrupt exit');
    assert.ok(saved.items.some(i => i.description === 'Preserve this committed edit'));
    const lock = JSON.parse(await readFile(`${crashDataDir}.pmo-lock`, 'utf8'));
    assert.equal(lock.pid, process.pid); assert.notEqual(lock.token, oldLock.token);
  } finally { await recovered.value.close(); }
});

test('unknown lock ownership fails closed and preserves the lock', async () => {
  const unknownDir = path.join(directory, 'unknown-owner');
  const content = JSON.stringify({ token: 'missing-pid' });
  await writeFile(`${unknownDir}.pmo-lock`, content);
  await assert.rejects(createApp({ dataDir: unknownDir, testMode: true }), /ownership is unknown/);
  assert.equal(await readFile(`${unknownDir}.pmo-lock`, 'utf8'), content);
});
