import { LIFECYCLE_PHASES, type Deliverable, type HubState, type Member, type Workstream } from '../shared/types';

export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];
export const phaseLabels: Record<LifecyclePhase, string> = {
  shaping: 'Shaping', discovery: 'Discovery', design: 'Design', build: 'Build',
  assurance: 'Assurance', release: 'Release', adoption: 'Adoption',
};
export const phaseGuidance: Record<LifecyclePhase, string> = {
  shaping: 'Frame the opportunity, RFP or proposal, and prioritise the intended outcome.',
  discovery: 'Understand the current state, target state, users and scope.',
  design: 'Define the experience, semantics, data architecture and integrations.',
  build: 'Create and integrate the backend, frontend and AI solution.',
  assurance: 'Establish readiness through QA, evaluations and user acceptance testing.',
  release: 'Prepare production rollout and operational handover.',
  adoption: 'Support adoption and review the benefits achieved.',
};
export const artifactStatusLabels = { planned: 'Planned', draft: 'Draft', in_review: 'In review', accepted: 'Accepted' } as const;
export function workstreamGroups(stream?: Workstream) {
  return [...new Set((stream?.groups?.length ? stream.groups : stream?.group ? [stream.group] : []).map(group => group.trim()).filter(Boolean))];
}
export function canEditUseCase(user: Member, stream?: Workstream) {
  return ['pmo', 'admin'].includes(user.role) || (user.role === 'lead' && !!stream && stream.leadId === user.id);
}
export function canCreateArtifact(state: HubState, user: Member, streamId: string) {
  return user.role !== 'executive' && (canEditUseCase(user, state.workstreams.find(stream => stream.id === streamId)) || user.workstreamIds.includes(streamId));
}
export function canEditArtifact(state: HubState, user: Member, artifact: Deliverable) {
  return user.role !== 'executive' && (canEditUseCase(user, state.workstreams.find(w => w.id === artifact.workstreamId)) || artifact.ownerId === user.id);
}
export function selectUseCaseRelated(state: HubState, workstreamId: string) {
  const items = state.items.filter(item => item.workstreamId === workstreamId);
  const itemIds = new Set(items.map(item => item.id));
  const artifacts = state.deliverables.filter(artifact => artifact.workstreamId === workstreamId);
  const artifactIds = new Set(artifacts.map(artifact => artifact.id));
  const registers = state.registers.filter(record => record.workstreamId === workstreamId || record.relatedItemIds.some(id => itemIds.has(id)));
  const linkedMilestoneIds = new Set(registers.flatMap(record => record.milestoneIds));
  const milestones = state.milestones.filter(milestone => milestone.workstreamIds.includes(workstreamId) || milestone.deliverableIds.some(id => artifactIds.has(id)) || linkedMilestoneIds.has(milestone.id));
  const sourceRecords = (state.sourceRecords || []).filter(record => record.workstreamId === workstreamId);
  const currentTrackerIds = new Set((state.sourceDocuments || []).filter(document => document.kind === 'tracker' && document.coverage === 'current').map(document => document.id));
  const currentTrackerRecords = sourceRecords.filter(record => currentTrackerIds.has(record.documentId));
  return {
    items, artifacts, registers, milestones, sourceRecords, currentTrackerRecords,
    activeItems: items.filter(item => item.stage !== 'Closed'),
    openRegisters: registers.filter(record => record.status !== 'resolved'),
  };
}
export function selectPortfolio(state: HubState) {
  const phases = LIFECYCLE_PHASES.map(phase => ({ phase, count: state.workstreams.filter(stream => stream.lifecyclePhase === phase).length }));
  const groups = [...new Set(state.workstreams.flatMap(stream => workstreamGroups(stream).length ? workstreamGroups(stream) : ['']))].sort((a, b) => !a ? 1 : !b ? -1 : a.localeCompare(b)).map(name => ({ name, count: state.workstreams.filter(stream => name ? workstreamGroups(stream).includes(name) : workstreamGroups(stream).length === 0).length }));
  const currentTrackerIds = new Set((state.sourceDocuments || []).filter(document => document.kind === 'tracker' && document.coverage === 'current').map(document => document.id));
  const trackerRecords = (state.sourceRecords || []).filter(record => currentTrackerIds.has(record.documentId));
  return {
    phases, groups,
    total: state.workstreams.length,
    phaseSet: state.workstreams.filter(stream => !!stream.lifecyclePhase).length,
    phaseUnset: state.workstreams.filter(stream => !stream.lifecyclePhase).length,
    gatesSet: state.workstreams.filter(stream => !!stream.nextGate?.trim()).length,
    artifacts: state.deliverables.length,
    activeItems: state.items.filter(item => item.stage !== 'Closed').length,
    currentTrackerRecords: trackerRecords.length,
    trackerCoveredUseCases: new Set(trackerRecords.map(record => record.workstreamId).filter(id => state.workstreams.some(stream => stream.id === id))).size,
  };
}
