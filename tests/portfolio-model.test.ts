import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortfolioState } from '../server/portfolio-seed.js';
import { createSeedState } from '../server/seed.js';
import { canCreateArtifact, canEditArtifact, selectPortfolio, selectUseCaseRelated } from '../src/portfolio-model.js';

test('unconfigured use cases remain outside every lifecycle phase and gate count', () => {
  const state = createPortfolioState(new Date('2026-09-08T09:00:00Z'));
  const before = structuredClone(state);
  const summary = selectPortfolio(state);
  assert.equal(summary.total, 10);
  assert.equal(summary.phaseUnset, 10);
  assert.equal(summary.phaseSet, 0);
  assert.equal(summary.gatesSet, 0);
  assert.equal(summary.artifacts, 0);
  assert.ok(summary.phases.every(phase => phase.count === 0));
  assert.deepEqual(state, before);
});

test('changing a use-case phase does not recategorize its task workflow', () => {
  const state = createSeedState(new Date('2026-09-08T09:00:00Z'));
  const stages = state.items.map(item => ({ id: item.id, kind: item.kind, stage: item.stage }));
  state.workstreams[0].lifecyclePhase = 'discovery';
  state.workstreams[0].nextGate = '   ';
  const summary = selectPortfolio(state);
  assert.equal(summary.phases.find(phase => phase.phase === 'discovery')?.count, 1);
  assert.equal(summary.gatesSet, 0, 'Whitespace is not a recorded gate.');
  assert.deepEqual(state.items.map(item => ({ id: item.id, kind: item.kind, stage: item.stage })), stages);
});

test('use-case context includes explicit cross-case links without unrelated milestones', () => {
  const state = createSeedState(new Date('2026-09-08T09:00:00Z'));
  const stream = state.workstreams[0];
  const item = state.items.find(item => item.workstreamId === stream.id)!;
  const artifact = state.deliverables.find(value => value.workstreamId === stream.id)!;
  const template = state.milestones[0];
  state.milestones = [
    { ...template, id: 'direct', workstreamIds: [stream.id], deliverableIds: [] },
    { ...template, id: 'artifact', workstreamIds: [], deliverableIds: [artifact.id] },
    { ...template, id: 'register', workstreamIds: [], deliverableIds: [] },
    { ...template, id: 'unrelated', workstreamIds: [], deliverableIds: [] },
  ];
  state.registers = [{ ...state.registers[0], workstreamId: state.workstreams[1].id, relatedItemIds: [item.id], milestoneIds: ['register'] }];
  const related = selectUseCaseRelated(state, stream.id);
  assert.deepEqual(related.milestones.map(value => value.id), ['direct', 'artifact', 'register']);
  assert.equal(related.registers.length, 1);
  assert.ok(related.items.every(value => value.workstreamId === stream.id));
});

test('artifact controls honor accountable lead and owner while keeping executive preview read-only', () => {
  const state = createSeedState(new Date('2026-09-08T09:00:00Z'));
  const stream = state.workstreams[0];
  const lead = { ...state.members.find(member => member.role === 'lead')!, workstreamIds: [] };
  stream.leadId = lead.id;
  const artifact = { ...state.deliverables[0], workstreamId: stream.id, ownerId: '' };
  assert.equal(canCreateArtifact(state, lead, stream.id), true);
  assert.equal(canEditArtifact(state, lead, artifact), true);
  const other = { ...lead, id: 'unrelated-contributor', role: 'contributor' as const };
  assert.equal(canCreateArtifact(state, other, stream.id), false);
  assert.equal(canEditArtifact(state, other, artifact), false);
  assert.equal(canEditArtifact(state, other, { ...artifact, ownerId: other.id }), true);
  const executive = { ...lead, role: 'executive' as const, workstreamIds: [stream.id] };
  assert.equal(canCreateArtifact(state, executive, stream.id), false);
  assert.equal(canEditArtifact(state, executive, { ...artifact, ownerId: executive.id }), false);
});
