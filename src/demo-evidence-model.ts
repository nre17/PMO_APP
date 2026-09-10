import type { HubState } from '../shared/types';

export interface DemoEvidenceRecord {
  title: string; kind: string; status: string; useCase: string;
  owner: string; recordedAt: string; purpose: string; criteria: string[];
  observations: string[]; nextAction: string; relatedWork: string[];
}

/** Evidence is resolved from an actual reference in this illustrative workspace. */
export function resolveDemoEvidence(state: HubState, reference: string): DemoEvidenceRecord | undefined {
  if (state.settings.demoScenario !== 'consulting-lifecycle' || !reference || reference.length > 500) return;
  const matches = (link: string) => {
    try {
      const url = new URL(link);
      return ['http:', 'https:'].includes(url.protocol) && url.host === 'example.invalid' && url.pathname.startsWith('/synthetic-demo/') && decodeURIComponent(url.pathname.slice('/synthetic-demo/'.length)) === reference;
    } catch { return false; }
  };
  const artifact = state.deliverables.find(record => record.evidenceLinks?.some(matches));
  const check = state.tests.find(record => matches(record.evidence));
  const work = check ? state.items.find(record => record.id === check.itemId) : state.items.find(record => record.evidenceLinks.some(matches));
  if (!artifact && !work) return;
  const owner = (id: string) => state.members.find(member => member.id === id)?.name || 'Owner not recorded';
  const stream = state.workstreams.find(record => record.id === (artifact?.workstreamId || work?.workstreamId));
  if (artifact) {
    const items = state.items.filter(record => record.deliverableId === artifact.id);
    return {
      title: artifact.title, kind: 'Artifact review record', status: (artifact.status || 'planned').replaceAll('_', ' '),
      useCase: stream?.name || 'Use case not recorded', owner: owner(artifact.ownerId), recordedAt: artifact.updatedAt,
      purpose: artifact.description, criteria: items.map(item => item.acceptanceCriteria).filter(Boolean),
      observations: ['The artifact has a recorded assessment of ' + (artifact.status || 'planned').replaceAll('_', ' ') + '.', 'The linked work below defines the review scope. This specimen does not contain an actual client deliverable.'],
      nextAction: items.find(item => item.stage !== 'Closed')?.nextAction || (artifact.status === 'accepted' ? 'Retain the accepted record for the next programme review.' : 'Record the review outcome and next action for this artifact.'),
      relatedWork: items.map(item => item.title),
    };
  }
  return {
    title: check ? `${work!.title} · ${check.stage} check` : work!.title,
    kind: check ? 'Recorded check' : 'Work reference', status: check ? check.result : work!.stage,
    useCase: stream?.name || 'Use case not recorded', owner: owner(check?.authorId || work!.currentOwnerId), recordedAt: check?.createdAt || work!.updatedAt,
    purpose: work!.description, criteria: [work!.acceptanceCriteria].filter(Boolean),
    observations: check ? [check.notes, `Recorded in delivery cycle ${check.cycle}.`, ...(check.resolution ? [`Finding response: ${check.resolution}`] : [])] : [`Current work stage: ${work!.stage}.`, 'This reference explains the prepared work and its acceptance criteria; it is not a recorded test pass.'],
    nextAction: work!.nextAction, relatedWork: [work!.title],
  };
}
