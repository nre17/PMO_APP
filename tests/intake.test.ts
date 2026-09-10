import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/db.js';
import { seedConfiguration } from '../server/seed-config.js';
import { HttpError } from '../server/domain.js';
import { applyIntake, previewIntake, intakeBundleSchema, sourceRecordId, type IntakeBundle } from '../server/intake.js';
import type { HubState, Member, SourceRecord } from '../shared/types.js';

// Entirely synthetic records: no user documents or client data are read by these tests.
const now = '2026-09-08T08:00:00.000Z';
const later = '2026-09-09T08:00:00.000Z';
const hash = 'a'.repeat(64);
const revisedHash = 'b'.repeat(64);
const streamId = 'example-stream';
const documentId = 'example-source';
const actorId = 'test-pmo';

function stateFixture(): HubState {
  const member = (role: Member['role']): Member => ({
    id: `test-${role}`, name: `Test ${role} role`, initials: 'QA', role,
    title: 'Synthetic test role', color: '#666666', workstreamIds: [streamId], canApproveReports: role === 'executive',
  });
  return {
    settings: { version: 1, projectName: 'Example project', phaseName: 'Example phase', timezone: 'Asia/Dubai', submissionHour: 10, cutoffHour: 12, blockedEscalationDays: 2, workingDays: [1, 2, 3, 4, 5] },
    members: (['pmo', 'admin', 'lead', 'contributor', 'executive'] as const).map(member),
    workstreams: [{ id: streamId, version: 1, updatedAt: now, name: 'Example use case', shortName: 'Example', description: '', leadId: '', health: 'unknown', statusNote: '', clientSummary: '', color: '#666666', groups: [] }],
    deliverables: [], milestones: [], items: [], tests: [], registers: [], meetings: [], submissions: [], reports: [], events: [],
  };
}

function row(index: number, disposition: SourceRecord['disposition']): IntakeBundle['records'][number] {
  return {
    documentId, sourceKey: `EX-${index}`, locator: `Tracker!A${index + 1}:H${index + 1}`, workstreamId: streamId,
    title: `Example task ${index}`, detail: `Synthetic source detail ${index}`,
    sourceStatus: { active: 'Awaiting retest', completed: 'Done', needs_review: 'Done with unresolved remarks', excluded: 'No action required' }[disposition],
    sourceOwner: 'Source team label', sourcePriority: '', sourceDates: 'Reported 2026-09-01',
    resolutionNotes: disposition === 'needs_review' ? 'A remaining remark needs reconciliation.' : '',
    disposition, mappingNote: 'Source wording is retained independently of the delivery workflow.',
  };
}

function bundleFixture(dispositions: SourceRecord['disposition'][] = ['active', 'completed', 'needs_review', 'excluded']): IntakeBundle {
  return {
    version: 1, projectName: 'Example project',
    documents: [{ id: documentId, name: 'Example tracker.xlsx', kind: 'tracker', coverage: 'current', sourceDate: '2026-09-08', receivedAt: now, fileHash: hash, summary: 'Synthetic current tracker.', warnings: [] }],
    useCases: [{ id: streamId, changes: { groups: ['Example group', 'Shared group'], scope: 'Source-backed example scope' }, sources: [{ documentId, locator: 'Overview!A2' }] }],
    records: dispositions.map((disposition, index) => row(index + 1, disposition)),
  };
}

function linkedItem(state: HubState, key: string) {
  const source = state.sourceRecords!.find(record => record.sourceKey === key)!;
  assert.ok(source.itemId, 'Expected an explicit source-to-item link');
  return state.items.find(item => item.id === source.itemId)!;
}

test('intake preview accounts for 35 source records without mutating the existing state', () => {
  const state = stateFixture(), before = structuredClone(state);
  const dispositions: SourceRecord['disposition'][] = [
    ...Array<SourceRecord['disposition']>(18).fill('active'), ...Array<SourceRecord['disposition']>(2).fill('needs_review'),
    ...Array<SourceRecord['disposition']>(8).fill('completed'), ...Array<SourceRecord['disposition']>(7).fill('excluded'),
  ];
  const preview = previewIntake(state, bundleFixture(dispositions), actorId, now);
  assert.deepEqual(state, before);
  assert.deepEqual(preview.result, { newDocuments: 1, updatedDocuments: 0, newRecords: 35, updatedRecords: 0, newItems: 20, unchangedRecords: 0, profileUpdates: 1, conflicts: [] });
  assert.equal(preview.state.sourceRecords!.length, 35);
  assert.equal(preview.state.items.filter(item => item.kind === 'software').length, 18);
  assert.equal(preview.state.items.filter(item => item.kind === 'general').length, 2);
  assert.equal(preview.state.items.filter(item => item.stage === 'Closed').length, 0);
  assert.deepEqual(preview.state.workstreams[0].groups, ['Example group', 'Shared group']);
});

test('four source dispositions preserve literal provenance without manufacturing delivery facts', () => {
  const state = stateFixture(), bundle = bundleFixture();
  applyIntake(state, bundle, actorId, now);
  assert.equal(state.items.length, 2);
  for (const [index, source] of state.sourceRecords!.entries()) {
    const incoming = bundle.records[index];
    assert.equal(source.id, sourceRecordId(documentId, incoming.sourceKey));
    for (const field of ['sourceStatus', 'sourceOwner', 'sourcePriority', 'sourceDates', 'locator', 'mappingNote'] as const) assert.equal(source[field], incoming[field]);
    assert.equal(source.fileHash, hash); assert.equal(source.documentId, documentId); assert.equal(source.version, 1);
    if (['completed', 'excluded'].includes(source.disposition)) assert.equal(source.itemId, undefined);
  }
  for (const item of state.items) {
    assert.equal(item.stage, 'Backlog'); assert.equal(item.priority, 'Not set');
    for (const field of ['ownerId', 'currentOwnerId', 'baselineDate', 'dueDate', 'acceptanceCriteria', 'clientSummary'] as const) assert.equal(item[field], '');
    assert.deepEqual(item.evidenceLinks, []); assert.equal(item.closedAt, undefined);
    assert.equal(item.clientVisible, false); assert.equal(item.blocked, false);
    assert.equal(item.importedFrom, `source:${state.sourceRecords!.find(source => source.itemId === item.id)!.id}`);
  }
  const active = linkedItem(state, 'EX-1'), review = linkedItem(state, 'EX-3');
  assert.equal(active.kind, 'software'); assert.equal(active.title, bundle.records[0].title);
  assert.equal(review.kind, 'general'); assert.equal(review.category, 'action');
  assert.match(review.title, /^Confirm tracker status: /); assert.match(review.nextAction, /Confirm/);
  assert.deepEqual(state.tests, []); assert.deepEqual(state.reports, []); assert.deepEqual(state.submissions, []);
});

test('identical reimports retain stable IDs, human item edits and audit history without duplicates', () => {
  const state = stateFixture(), bundle = bundleFixture();
  applyIntake(state, bundle, actorId, now);
  const item = linkedItem(state, 'EX-1');
  Object.assign(item, { title: 'Human revised task', nextAction: 'Human assigned next action', ownerId: 'test-lead', currentOwnerId: 'test-contributor', dueDate: '2026-09-15', version: 2, updatedAt: later });
  const before = structuredClone(state);
  const result = applyIntake(state, bundle, actorId, later);
  assert.equal(result.newItems, 0); assert.equal(result.newRecords, 0); assert.equal(result.updatedRecords, 0); assert.equal(result.unchangedRecords, 4);
  assert.equal(result.updatedDocuments, 0); assert.equal(result.profileUpdates, 0);
  assert.deepEqual(state, before);
  assert.equal(new Set(state.items.map(value => value.id)).size, state.items.length);
});

test('source revisions retain operational edits and audit the previous and replacement hashes', () => {
  const state = stateFixture(), bundle = bundleFixture(['active']);
  applyIntake(state, bundle, actorId, now);
  const item = linkedItem(state, 'EX-1'); item.nextAction = 'Keep the reviewed operational action'; item.version = 2;
  const operational = structuredClone(item);
  const revised = structuredClone(bundle);
  revised.documents[0].fileHash = revisedHash;
  revised.records[0].sourceStatus = 'Source says complete';
  revised.records[0].disposition = 'completed';
  revised.records[0].locator = 'Tracker!A20:H20';
  const result = applyIntake(state, revised, actorId, later);
  assert.equal(result.updatedDocuments, 1); assert.equal(result.updatedRecords, 1); assert.equal(result.newItems, 0);
  assert.deepEqual(state.items[0], operational);
  const source = state.sourceRecords![0];
  assert.equal(source.itemId, operational.id); assert.equal(source.version, 2); assert.equal(source.fileHash, revisedHash);
  assert.equal(source.disposition, 'completed'); assert.match(source.syncNote!, /Linked work was preserved/);
  const revision = state.events.find(event => event.entityId === source.id && event.action === 'source-revised')!;
  assert.equal(revision.actorId, actorId); assert.equal(revision.createdAt, later);
  assert.equal((revision.before as SourceRecord).fileHash, hash); assert.equal((revision.after as SourceRecord).fileHash, revisedHash);
  assert.equal((revision.before as SourceRecord).sourceStatus, 'Awaiting retest');
  assert.equal((revision.after as SourceRecord).sourceStatus, 'Source says complete');
  assert.ok(state.events.some(event => event.entityType === 'sourceDocuments' && event.action === 'source-document-revised'));
  const before = structuredClone(state);
  assert.equal(applyIntake(state, revised, actorId, later).unchangedRecords, 1);
  assert.deepEqual(state, before);
});

test('a source-only completed row becoming active requests reconciliation without creating work automatically', () => {
  const state = stateFixture(), bundle = bundleFixture(['completed']);
  applyIntake(state, bundle, actorId, now);
  const recordId = state.sourceRecords![0].id;
  bundle.records[0].disposition = 'active'; bundle.records[0].sourceStatus = 'Reopened in source';
  const result = applyIntake(state, bundle, actorId, later);
  assert.equal(result.updatedRecords, 1); assert.equal(result.newItems, 0);
  assert.equal(state.items.length, 0); assert.equal(state.sourceRecords![0].itemId, undefined);
  assert.equal(state.sourceRecords![0].id, recordId); assert.match(state.sourceRecords![0].syncNote!, /before creating work/);
});

test('stable source keys are independent of row locations and cannot collide through concatenation', () => {
  assert.notEqual(sourceRecordId('ab', 'c'), sourceRecordId('a', 'bc'));
  assert.notEqual(sourceRecordId('source-a', 'EX-1'), sourceRecordId('source-b', 'EX-1'));
  const state = stateFixture(), bundle = bundleFixture(['active']);
  applyIntake(state, bundle, actorId, now);
  const originalId = state.sourceRecords![0].id, originalItemId = state.items[0].id;
  bundle.records[0].title = 'Moved row with revised wording'; bundle.records[0].locator = 'Tracker!A99:H99';
  applyIntake(state, bundle, actorId, later);
  assert.equal(state.sourceRecords!.length, 1); assert.equal(state.items.length, 1);
  assert.equal(state.sourceRecords![0].id, originalId); assert.equal(state.items[0].id, originalItemId);
  assert.equal(state.items[0].title, 'Example task 1');
});

test('intake rejects unknown associations and duplicate source, document and use-case keys', () => {
  const cases: { mutate: (bundle: IntakeBundle) => void; message: RegExp }[] = [
    { mutate: bundle => { bundle.records[0].workstreamId = 'missing-stream'; }, message: /Unknown tracker use case/ },
    { mutate: bundle => { bundle.records[0].documentId = 'missing-document'; }, message: /requires a document/ },
    { mutate: bundle => { bundle.useCases[0].id = 'missing-stream'; }, message: /Unknown use case/ },
    { mutate: bundle => { bundle.useCases[0].sources[0].documentId = 'missing-document'; }, message: /Unknown profile source/ },
    { mutate: bundle => { bundle.records.push(structuredClone(bundle.records[0])); }, message: /Duplicate source keys/ },
    { mutate: bundle => { bundle.documents.push(structuredClone(bundle.documents[0])); }, message: /Duplicate source document/ },
    { mutate: bundle => { bundle.useCases.push(structuredClone(bundle.useCases[0])); }, message: /Duplicate use-case/ },
  ];
  for (const entry of cases) {
    const state = stateFixture(), before = structuredClone(state), bundle = bundleFixture(); entry.mutate(bundle);
    assert.throws(() => previewIntake(state, bundle, actorId, now), entry.message);
    assert.deepEqual(state, before);
  }
});

test('historical and unavailable sources cannot originate active or status-confirmation work', () => {
  for (const coverage of ['context', 'unavailable'] as const) for (const disposition of ['active', 'needs_review'] as const) {
    const bundle = bundleFixture([disposition]); bundle.documents[0].coverage = coverage;
    assert.throws(() => applyIntake(stateFixture(), bundle, actorId, now), /Historical sources cannot create active work/);
  }
  const bundle = bundleFixture(['completed', 'excluded']); bundle.documents[0].coverage = 'context';
  const state = stateFixture(); applyIntake(state, bundle, actorId, now);
  assert.equal(state.sourceRecords!.length, 2); assert.equal(state.items.length, 0);
});

test('only existing PMO and administrator actors can apply reviewed intake', () => {
  for (const role of ['lead', 'contributor', 'executive'] as const) {
    const state = stateFixture(), before = structuredClone(state);
    assert.throws(() => applyIntake(state, bundleFixture(), `test-${role}`, now), error => error instanceof HttpError && error.statusCode === 403);
    assert.deepEqual(state, before);
  }
  assert.throws(() => applyIntake(stateFixture(), bundleFixture(), 'missing-actor', now), /existing PMO actor/);
  for (const role of ['pmo', 'admin'] as const) {
    const state = stateFixture(); applyIntake(state, bundleFixture(), `test-${role}`, now);
    assert.ok(state.events.length > 0); assert.ok(state.events.every(event => event.actorId === `test-${role}`));
  }
});

test('source schema rejects invented operational assignments, invalid provenance and invalid dates', () => {
  const invalid: ((bundle: any) => void)[] = [
    bundle => { bundle.records[0].intake = { ownerId: 'test-lead' }; },
    bundle => { bundle.records[0].intake = { dueDate: '2026-09-10' }; },
    bundle => { bundle.records[0].intake = { evidenceLinks: ['https://example.com/assumed-proof'] }; },
    bundle => { bundle.records[0].itemId = 'preassigned-item'; },
    bundle => { bundle.records[0].fileHash = hash; },
    bundle => { bundle.documents[0].fileHash = 'not-a-hash'; },
    bundle => { bundle.documents[0].sourceDate = '2026-02-30'; },
    bundle => { bundle.documents[0].receivedAt = 'yesterday'; },
  ];
  for (const change of invalid) { const bundle = bundleFixture(); change(bundle); assert.equal(intakeBundleSchema.safeParse(bundle).success, false); }
  const bundle = bundleFixture(['active']);
  bundle.records[0].intake = { priority: 'High', category: 'bug', nextAction: 'Explicitly reviewed source action' };
  const state = stateFixture(); applyIntake(state, bundle, actorId, now);
  assert.equal(state.items[0].priority, 'High'); assert.equal(state.items[0].category, 'bug');
  assert.equal(state.items[0].nextAction, 'Explicitly reviewed source action');
});

test('source-backed profile context fills blank fields while preserving later human edits', () => {
  const state = stateFixture(), bundle = bundleFixture([]);
  applyIntake(state, bundle, actorId, now);
  const workstream = state.workstreams[0];
  workstream.scope = 'Human revised scope'; workstream.groups = ['Human group'];
  const beforeVersion = workstream.version;
  bundle.useCases[0].changes.name = 'Unrequested replacement name';
  const result = applyIntake(state, bundle, actorId, later);
  assert.equal(workstream.name, 'Example use case'); assert.equal(workstream.scope, 'Human revised scope');
  assert.deepEqual(workstream.groups, ['Human group']); assert.equal(workstream.sources!.length, 1);
  assert.equal(workstream.version, beforeVersion); assert.equal(result.profileUpdates, 0);
  assert.equal(result.conflicts.length, 3);
  bundle.useCases[0].renameFrom = 'Example use case';
  bundle.useCases[0].changes.shortName = 'Reviewed label';
  assert.equal(applyIntake(state, bundle, actorId, later).profileUpdates, 1);
  assert.equal(workstream.name, 'Unrequested replacement name'); assert.equal(workstream.shortName, 'Reviewed label');
});

test('removing optional source metadata removes row hashes once and identical reimports cause no churn', () => {
  const state = stateFixture(), bundle = bundleFixture(['active']);
  applyIntake(state, bundle, actorId, now);
  const operational = structuredClone(state.items[0]);
  delete bundle.documents[0].fileHash;
  delete bundle.documents[0].sourceDate;
  const revised = applyIntake(state, bundle, actorId, later);
  assert.equal(revised.updatedDocuments, 1); assert.equal(revised.updatedRecords, 1);
  const document = state.sourceDocuments![0], record = state.sourceRecords![0];
  assert.equal(Object.hasOwn(document, 'fileHash'), false);
  assert.equal(Object.hasOwn(document, 'sourceDate'), false);
  assert.equal(Object.hasOwn(record, 'fileHash'), false);
  assert.equal(record.syncNote, undefined, 'A metadata-only revision does not claim the source row changed');
  assert.deepEqual(state.items[0], operational);
  const documentRevision = state.events.find(event => event.action === 'source-document-revised')!;
  assert.equal((documentRevision.before as { fileHash: string }).fileHash, hash);
  assert.equal(Object.hasOwn(documentRevision.after as object, 'fileHash'), false);
  const afterRemoval = structuredClone(state);
  const repeated = applyIntake(state, bundle, actorId, '2026-09-10T08:00:00.000Z');
  assert.equal(repeated.updatedDocuments, 0); assert.equal(repeated.updatedRecords, 0);
  assert.equal(repeated.unchangedRecords, 1); assert.equal(repeated.profileUpdates, 0);
  assert.deepEqual(state, afterRemoval, 'Unchanged metadata must not bump versions or append audit events');
});

test('repeated imports of the generic project name do not increment settings or create naming audits', () => {
  const state = stateFixture(), bundle = bundleFixture([]);
  state.settings.projectName = 'AI use case portfolio';
  bundle.projectName = 'AI use case portfolio';
  const originalSettings = structuredClone(state.settings);
  applyIntake(state, bundle, actorId, now);
  applyIntake(state, bundle, actorId, later);
  assert.deepEqual(state.settings, originalSettings);
  assert.equal(state.events.filter(event => event.entityType === 'settings').length, 0);
  bundle.projectName = 'Reviewed example project';
  applyIntake(state, bundle, actorId, later);
  assert.equal(state.settings.version, 2); assert.equal(state.settings.projectName, 'Reviewed example project');
  const afterNaming = structuredClone(state);
  applyIntake(state, bundle, actorId, '2026-09-10T08:00:00.000Z');
  assert.deepEqual(state, afterNaming);
  const namingEvents = state.events.filter(event => event.action === 'project-named');
  assert.equal(namingEvents.length, 1);
  assert.equal((namingEvents[0].before as { version: number }).version, 1);
  assert.equal((namingEvents[0].after as { version: number }).version, 2);
});

test('a preserved profile description keeps its original source hash when a conflicting document revision arrives', () => {
  const state = stateFixture(), bundle = bundleFixture([]);
  bundle.useCases[0].changes = { description: 'Description supported by source revision A.' };
  applyIntake(state, bundle, actorId, now);
  const originalProfile = structuredClone(state.workstreams[0]);
  assert.deepEqual(originalProfile.sources, [{ documentId, locator: 'Overview!A2', fileHash: hash }]);
  bundle.documents[0].fileHash = revisedHash;
  bundle.useCases[0].changes.description = 'Conflicting description from source revision B.';
  const result = applyIntake(state, bundle, actorId, later);
  assert.equal(result.updatedDocuments, 1); assert.equal(result.profileUpdates, 0);
  assert.deepEqual(result.conflicts, [`${streamId}: existing description preserved.`]);
  assert.equal(state.sourceDocuments![0].fileHash, revisedHash);
  assert.deepEqual(state.workstreams[0], originalProfile, 'Conflicting source text must not relabel preserved content as evidence from the new revision');
  const profileAudit = state.events.find(event => event.entityType === 'workstreams')!;
  assert.equal((profileAudit.after as HubState['workstreams'][number]).sources![0].fileHash, hash);
  const beforeRepeat = structuredClone(state);
  applyIntake(state, bundle, actorId, '2026-09-10T08:00:00.000Z');
  assert.deepEqual(state, beforeRepeat);
});

test('explicit general action intake remains a general Backlog action without delivery approvals', () => {
  const state = stateFixture(), bundle = bundleFixture(['active']);
  bundle.records[0].intake = { kind: 'general', category: 'action', nextAction: 'Confirm the outstanding planning decision.' };
  applyIntake(state, bundle, actorId, now);
  const item = state.items[0];
  assert.equal(item.kind, 'general'); assert.equal(item.category, 'action'); assert.equal(item.stage, 'Backlog');
  assert.equal(item.title, bundle.records[0].title); assert.equal(item.nextAction, bundle.records[0].intake.nextAction);
  assert.equal(item.priority, 'Not set'); assert.equal(item.ownerId, ''); assert.equal(item.currentOwnerId, '');
  assert.equal(item.dueDate, ''); assert.equal(item.acceptanceCriteria, ''); assert.equal(item.closedAt, undefined);
  assert.deepEqual(item.evidenceLinks, []); assert.deepEqual(state.tests, []);
  const before = structuredClone(state);
  assert.equal(applyIntake(state, bundle, actorId, later).unchangedRecords, 1);
  assert.deepEqual(state, before);
});

test('project seed selection uses its own local directory and respects explicit storage overrides', () => {
  assert.deepEqual(seedConfiguration({ seedProfile: 'project' }, {}), { seedProfile: 'project', dataDir: '.data/client' });
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'project' }), { seedProfile: 'project', dataDir: '.data/client' });
  assert.deepEqual(seedConfiguration({}, { SEED_PROFILE: 'project', DATA_DIR: 'example-existing-store' }), { seedProfile: 'project', dataDir: 'example-existing-store' });
  assert.deepEqual(seedConfiguration({ seedProfile: 'project', dataDir: 'example-explicit-store' }, { SEED_PROFILE: 'demo', DATA_DIR: 'example-environment-store' }), { seedProfile: 'project', dataDir: 'example-explicit-store' });
  assert.deepEqual(seedConfiguration({}, {}), { seedProfile: 'portfolio', dataDir: '.data/portfolio' });
  assert.deepEqual(seedConfiguration({ seedProfile: 'demo' }, {}), { seedProfile: 'demo', dataDir: '.data/pmo' });
});

test('Store persists new source collections, supports old states and rolls back failed intake atomically', async () => {
  const prefix = path.join(os.tmpdir(), 'pmo-intake-test-');
  const directory = await mkdtemp(prefix), dataDir = path.join(directory, 'database');
  let store: Store | undefined;
  try {
    // This state intentionally predates the optional source collections.
    const initial = stateFixture();
    assert.equal(initial.sourceDocuments, undefined); assert.equal(initial.sourceRecords, undefined);
    store = await Store.open({ dataDir, initialState: initial });
    const legacyRead = await store.read();
    assert.deepEqual(legacyRead.sourceDocuments, []); assert.deepEqual(legacyRead.sourceRecords, []);
    const bundle = bundleFixture();
    await store.mutate(state => applyIntake(state, bundle, actorId, now));
    const persisted = await store.read();
    assert.equal(persisted.sourceDocuments!.length, 1); assert.equal(persisted.sourceRecords!.length, 4);
    assert.equal(persisted.sourceDocuments![0].fileHash, hash);
    assert.ok(persisted.sourceRecords!.every(record => record.fileHash === hash));
    const repeated = await store.mutate(state => applyIntake(state, bundle, actorId, later));
    assert.equal(repeated.unchangedRecords, 4, 'JSONB round trips must not turn identical source content into revisions');
    assert.equal(repeated.updatedRecords, 0); assert.equal(repeated.updatedDocuments, 0); assert.equal(repeated.profileUpdates, 0);
    assert.deepEqual(await store.read(), persisted);
    const newBundle = bundleFixture(['active']);
    newBundle.documents[0].id = 'another-source';
    newBundle.records[0].documentId = 'another-source';
    newBundle.useCases[0].sources[0].documentId = 'another-source';
    await assert.rejects(store.mutate(state => {
      applyIntake(state, newBundle, actorId, later);
      throw new Error('Synthetic failure after intake mutation');
    }), /Synthetic failure/);
    assert.deepEqual(await store.read(), persisted);
    await store.close(); store = undefined;
    store = await Store.open({ dataDir, initialState: stateFixture() });
    assert.deepEqual(await store.read(), persisted, 'Reopening never replaces existing source records with the initial seed');
  } finally {
    if (store) await store.close();
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(prefix)) && path.dirname(resolved) === path.resolve(os.tmpdir()));
    await rm(resolved, { recursive: true, force: true });
  }
});
