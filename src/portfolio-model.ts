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
  return {
    items, artifacts, registers, milestones,
    activeItems: items.filter(item => item.stage !== 'Closed'),
    openRegisters: registers.filter(record => record.status !== 'resolved'),
  };
}
export function selectPortfolio(state: HubState) {
  const phases = LIFECYCLE_PHASES.map(phase => ({ phase, count: state.workstreams.filter(stream => stream.lifecyclePhase === phase).length }));
  return {
    phases,
    total: state.workstreams.length,
    phaseSet: state.workstreams.filter(stream => !!stream.lifecyclePhase).length,
    phaseUnset: state.workstreams.filter(stream => !stream.lifecyclePhase).length,
    gatesSet: state.workstreams.filter(stream => !!stream.nextGate?.trim()).length,
    artifacts: state.deliverables.length,
    activeItems: state.items.filter(item => item.stage !== 'Closed').length,
  };
}
