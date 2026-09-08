import { createHash } from 'node:crypto';
import { z } from 'zod';
import { LIFECYCLE_PHASES, type HubState, type SourceDocument, type SourceRecord, type WorkItem } from '../shared/types.js';
import { audit, day, itemSchema, pmo, requireThat, touch } from './domain.js';

const text = z.string().trim().max(12000);
const key = z.string().trim().min(1).max(160);
const reference = z.object({ documentId: key, locator: z.string().trim().min(1).max(500), fileHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const documentSchema = z.object({
  id: key, name: z.string().trim().min(1).max(500),
  kind: z.enum(['tracker', 'steerco', 'briefing', 'unavailable']),
  coverage: z.enum(['current', 'context', 'unavailable']), sourceDate: day.optional(),
  receivedAt: z.string().datetime({ offset: true }), fileHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  summary: text, warnings: z.array(text).max(50),
}).strict();
const recordSchema = z.object({
  documentId: key, sourceKey: key, locator: z.string().trim().min(1).max(500), workstreamId: key,
  title: z.string().trim().min(1).max(240), detail: text, sourceStatus: text,
  sourceOwner: text, sourcePriority: text, sourceDates: text, resolutionNotes: text,
  disposition: z.enum(['active', 'completed', 'needs_review', 'excluded']), mappingNote: text,
  intake: z.object({
    kind: z.enum(['software', 'general']).optional(),
    category: z.enum(['feature', 'bug', 'data', 'evaluation', 'action', 'research']).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical', 'Not set']).optional(),
    nextAction: text.optional(),
  }).strict().optional(),
}).strict();
export const intakeBundleSchema = z.object({
  version: z.literal(1), projectName: z.string().trim().min(1).max(200),
  documents: z.array(documentSchema).min(1).max(200),
  useCases: z.array(z.object({
    id: key, renameFrom: z.string().trim().min(1).max(240).optional(),
    changes: z.object({ name: z.string().trim().min(1).max(240).optional(), shortName: z.string().trim().min(1).max(240).optional(), description: text.optional(), scope: text.optional(), group: z.string().trim().max(100).optional(), groups: z.array(z.string().trim().min(1).max(100)).max(10).optional(), phaseLabel: z.string().trim().max(160).optional(), lifecyclePhase: z.enum(LIFECYCLE_PHASES).optional() }).strict(),
    sources: z.array(reference).min(1).max(30),
  }).strict()).max(100),
  records: z.array(recordSchema).max(5000),
}).strict();
export type IntakeBundle = z.infer<typeof intakeBundleSchema>;
export function sourceRecordId(documentId: string, sourceKey: string) {
  return 'source-' + createHash('sha256').update(JSON.stringify([documentId, sourceKey])).digest('hex').slice(0, 24);
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Reviewed local data intake. Source revisions never overwrite operational edits. */
export function applyIntake(state: HubState, input: unknown, actorId: string, now: string) {
  const bundle = intakeBundleSchema.parse(input);
  const actor = state.members.find(member => member.id === actorId);
  requireThat(actor, 'Choose an existing PMO actor.'); pmo(actor);
  const documents = state.sourceDocuments ??= [];
  const records = state.sourceRecords ??= [];
  const documentIds = new Set(bundle.documents.map(document => document.id));
  requireThat(documentIds.size === bundle.documents.length, 'Duplicate source document IDs.');
  requireThat(new Set(bundle.useCases.map(useCase => useCase.id)).size === bundle.useCases.length, 'Duplicate use-case IDs.');
  const recordIds = new Set<string>();
  for (const useCase of bundle.useCases) {
    requireThat(state.workstreams.some(stream => stream.id === useCase.id), 'Unknown use case in intake.');
    for (const ref of useCase.sources) requireThat(documentIds.has(ref.documentId) || documents.some(document => document.id === ref.documentId), 'Unknown profile source.');
  }
  for (const row of bundle.records) {
    requireThat(documentIds.has(row.documentId), 'Each imported row requires a document in the same bundle.');
    requireThat(state.workstreams.some(stream => stream.id === row.workstreamId), 'Unknown tracker use case.');
    const recordId = sourceRecordId(row.documentId, row.sourceKey);
    requireThat(!recordIds.has(recordId), 'Duplicate source keys in intake.'); recordIds.add(recordId);
    requireThat(bundle.documents.find(document => document.id === row.documentId)?.coverage === 'current' || !['active', 'needs_review'].includes(row.disposition), 'Historical sources cannot create active work.');
  }
  const result = { newDocuments: 0, updatedDocuments: 0, newRecords: 0, updatedRecords: 0, newItems: 0, unchangedRecords: 0, profileUpdates: 0, conflicts: [] as string[] };
  for (const incoming of bundle.documents) {
    const previous = documents.find(document => document.id === incoming.id);
    if (!previous) { documents.push({ ...incoming, version: 1, updatedAt: now }); result.newDocuments++; }
    else {
      const { version, updatedAt, ...content } = previous;
      if (!same(content, incoming)) {
        const before = structuredClone(previous);
        delete previous.fileHash; delete previous.sourceDate;
        Object.assign(previous, incoming); touch(previous, now); result.updatedDocuments++;
        audit(state, actor, 'sourceDocuments', incoming.id, 'source-document-revised', 'Revised source document metadata', before, previous, now);
      }
    }
  }
  if (state.settings.projectName === 'AI use case portfolio' && state.settings.projectName !== bundle.projectName) {
    const before = structuredClone(state.settings);
    state.settings.projectName = bundle.projectName;
    state.settings.version = (state.settings.version ?? 1) + 1;
    audit(state, actor, 'settings', 'project', 'project-named', 'Set project name from reviewed intake', before, state.settings, now);
  } else if (state.settings.projectName !== bundle.projectName) result.conflicts.push('Existing project name preserved.');
  for (const incoming of bundle.useCases) {
    const stream = state.workstreams.find(stream => stream.id === incoming.id)!;
    const before = structuredClone(stream);
    const canRename = incoming.renameFrom === stream.name;
    let conflictingFields = false;
    for (const [field, value] of Object.entries(incoming.changes)) {
      const existing = stream[field as keyof typeof incoming.changes];
      if (canRename && ['name', 'shortName'].includes(field) || !existing || Array.isArray(existing) && !existing.length) Object.assign(stream, { [field]: value });
      else if (!same(existing, value)) { result.conflicts.push(`${stream.id}: existing ${field} preserved.`); conflictingFields = true; }
    }
    const refs = stream.sources ?? [];
    if (!conflictingFields || !same(before, stream)) for (const source of incoming.sources) {
      const fileHash = source.fileHash ?? documents.find(document => document.id === source.documentId)?.fileHash;
      const ref = { ...source, ...(fileHash ? { fileHash } : {}) };
      if (!refs.some(existing => same(existing, ref))) refs.push(ref);
    }
    if (refs.length) stream.sources = refs;
    if (!same(before, stream)) {
      touch(stream, now); result.profileUpdates++;
      audit(state, actor, 'workstreams', stream.id, 'source-context-added', 'Added source context to use-case profile', before, stream, now);
    }
  }
  for (const incoming of bundle.records) {
    const { intake, ...fields } = incoming;
    const fileHash = bundle.documents.find(document => document.id === incoming.documentId)?.fileHash;
    const content = { ...fields, ...(fileHash ? { fileHash } : {}) };
    const recordId = sourceRecordId(incoming.documentId, incoming.sourceKey);
    const previous = records.find(record => record.id === recordId);
    if (previous) {
      const { id, version, updatedAt, itemId, syncNote, ...old } = previous;
      if (same(old, content)) { result.unchangedRecords++; continue; }
      const before = structuredClone(previous);
      delete previous.fileHash;
      Object.assign(previous, content);
      const { fileHash: oldHash, ...oldFields } = old;
      if (!same(oldFields, fields)) previous.syncNote = itemId ? 'Source changed. Linked work was preserved; reconcile its current position before updating it.' : 'Source changed. Review the new source position before creating work.';
      touch(previous, now); result.updatedRecords++;
      audit(state, actor, 'sourceRecords', recordId, 'source-revised', 'Updated source snapshot; operational work preserved', before, previous, now);
      continue;
    }
    const record: SourceRecord = { ...content, id: recordId, version: 1, updatedAt: now };
    if (record.disposition === 'active' || record.disposition === 'needs_review') {
      const followUp = record.disposition === 'needs_review';
      const itemId = 'intake-' + recordId.slice(7);
      requireThat(!state.items.some(item => item.id === itemId), 'Source item ID already exists without its provenance.');
      const definition = itemSchema.parse({
        title: followUp ? `Confirm tracker status: ${record.title}`.slice(0, 240) : record.title,
        description: record.detail, workstreamId: record.workstreamId,
        kind: followUp ? 'general' : intake?.kind ?? 'software', category: followUp ? 'action' : intake?.category ?? 'action', priority: intake?.priority ?? 'Not set',
        ownerId: '', currentOwnerId: '', baselineDate: '', dueDate: '', acceptanceCriteria: '',
        evidenceLinks: [], blocked: false, blockReason: '', clientSummary: '', clientVisible: false,
        nextAction: intake?.nextAction ?? (followUp ? 'Confirm whether the remaining source remarks are resolved and record the current position.' : 'Review the tracker position and assign the next action owner.'), tags: ['Source intake'],
      });
      const item: WorkItem = { ...definition, id: itemId, stage: 'Backlog', version: 1, updatedAt: now, createdAt: now, cycle: 1, importedFrom: `source:${recordId}` };
      state.items.push(item); record.itemId = itemId; result.newItems++;
      audit(state, actor, 'items', itemId, 'source-intake', 'Captured tracker work for PMO intake; source status retained separately', null, item, now);
    }
    records.push(record); result.newRecords++;
  }
  if (result.newDocuments || result.updatedDocuments || result.newRecords || result.updatedRecords || result.profileUpdates) {
    audit(state, actor, 'intake', 'project', 'intake-applied', `Reviewed intake: ${result.newRecords} new source rows, ${result.newItems} linked work items, ${result.updatedRecords} source revisions`, null, result, now);
  }
  return result;
}

/** Dry runs execute the same validation and mapping against a detached state. */
export function previewIntake(state: HubState, input: unknown, actorId: string, now: string) {
  const proposed = structuredClone(state);
  const result = applyIntake(proposed, input, actorId, now);
  return { result, state: proposed };
}
