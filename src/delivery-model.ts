import { GENERAL_STAGES, SOFTWARE_STAGES, type HubState, type Stage, type WorkItem, type WorkflowKind } from '../shared/types';
import { recordAttention } from '../shared/reporting';
import { selectOverview } from './overview-model';

export const workflowStages = (kind: WorkflowKind): readonly Stage[] => kind === 'software' ? SOFTWARE_STAGES : GENERAL_STAGES;
export type DeliverySort = 'attention' | 'due' | 'priority' | 'title';
export interface DeliveryFilters { query: string; workstream: string; owner: string; status: string; kind: WorkflowKind | 'all'; stage: Stage | 'all'; sort: DeliverySort }

export function selectDeliveryItems(state: HubState, filters: DeliveryFilters, now = new Date()): WorkItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const overview = ['intervention', 'due-soon', 'escalation', 'overdue'].includes(filters.status) ? selectOverview(state, now) : undefined;
  const overviewRows = !overview ? [] : filters.status === 'due-soon' ? overview.dueSoon : filters.status === 'escalation' ? overview.interventions.filter(row => row.flags.escalationDue) : filters.status === 'overdue' ? overview.interventions.filter(row => row.flags.overdue) : overview.interventions;
  const overviewIds = new Set(overviewRows.map(row => row.item.id));
  const attention = (item: WorkItem) => {
    const flags = recordAttention(item, state.settings, now);
    return flags.escalationDue ? 6 : item.stage !== 'Closed' && item.blocked ? 5 : flags.overdue ? 4 : item.stage === 'Awaiting client acceptance' ? 3 : flags.dueToday ? 2 : flags.dueReminder ? 1 : 0;
  };
  return state.items.filter(item => {
    const owner = state.members.find(member => member.id === item.currentOwnerId)?.name || 'Unassigned';
    const flags = recordAttention(item, state.settings, now);
    const status = overviewIds.has(item.id) || filters.status === 'all' || (filters.status === 'active' && item.stage !== 'Closed') || (filters.status === 'blocked' && item.stage !== 'Closed' && item.blocked) || (filters.status === 'client' && item.stage === 'Awaiting client acceptance') || (filters.status === 'closed' && item.stage === 'Closed') || (filters.status === 'attention' && item.stage !== 'Closed' && (item.blocked || flags.overdue || flags.escalationDue || flags.dueToday || flags.dueReminder || item.stage === 'Awaiting client acceptance'));
    return status && (filters.workstream === 'all' || item.workstreamId === filters.workstream) && (filters.owner === 'all' || (filters.owner === 'unassigned' ? !item.currentOwnerId : item.currentOwnerId === filters.owner)) && (filters.kind === 'all' || item.kind === filters.kind) && (filters.stage === 'all' || item.stage === filters.stage) && (!query || [item.title, item.nextAction, item.blockReason, item.id, owner].join(' ').toLocaleLowerCase().includes(query));
  }).sort((a,b) => {
    const due = (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    const selected = filters.sort === 'attention' ? attention(b) - attention(a) : filters.sort === 'priority' ? priority[a.priority] - priority[b.priority] : filters.sort === 'title' ? a.title.localeCompare(b.title) : due;
    return selected || due || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

export interface DeliveryPrerequisite { key: string; label: string; met: boolean; action: 'definition' | 'checks' | 'handoff' }
export function deliveryPrerequisites(state: HubState, item: WorkItem, nextOwnerId = item.currentOwnerId, evidence = '') {
  const nextStage = workflowStages(item.kind)[workflowStages(item.kind).indexOf(item.stage) + 1];
  const unresolved = state.tests.filter(test => test.itemId === item.id && test.result === 'fail' && test.blocking && !test.resolvedAt);
  const checks: DeliveryPrerequisite[] = [
    { key: 'owner', label: item.ownerId ? 'Accountable owner assigned' : 'Assign an accountable owner', met: Boolean(item.ownerId), action: 'definition' },
    { key: 'date', label: item.dueDate ? 'Target date agreed' : 'Agree a target date', met: Boolean(item.dueDate), action: 'definition' },
    { key: 'criteria', label: item.acceptanceCriteria.trim() ? 'Acceptance criteria defined' : 'Define acceptance criteria', met: Boolean(item.acceptanceCriteria.trim()), action: 'definition' },
    { key: 'next', label: item.nextAction.trim() ? 'Next action recorded' : 'Record the next action', met: Boolean(item.nextAction.trim()), action: 'definition' },
    { key: 'blocked', label: item.blocked ? 'Clear the delivery blocker' : 'No delivery blocker', met: !item.blocked, action: 'definition' },
    { key: 'findings', label: unresolved.length ? `${unresolved.length} blocking finding${unresolved.length === 1 ? '' : 's'} to resolve` : 'No unresolved blocking findings', met: !unresolved.length, action: 'checks' },
  ];
  if (['UAT','Production verification','Review'].includes(item.stage)) {
    const passed=state.tests.some(test => test.itemId === item.id && test.cycle === item.cycle && test.stage === item.stage && test.result === 'pass');
    checks.push({ key: 'pass', label: passed ? item.stage+' passed in delivery cycle '+item.cycle : 'Record a passing '+item.stage+' check in cycle '+item.cycle, met: passed, action: 'checks' });
  }
  const nextOwnerValid=state.members.some(member => member.id === nextOwnerId && member.role !== 'executive');
  checks.push({ key: 'nextOwner', label: nextOwnerValid ? 'Next action owner selected' : 'Select the next action owner', met: nextOwnerValid, action: 'handoff' });
  if (nextStage === 'Production verification') checks.push({ key: 'deployment', label: evidence.trim() ? 'Deployment evidence recorded' : 'Add deployment evidence', met: Boolean(evidence.trim()), action: 'handoff' });
  return { nextStage, unresolved, checks, ready: checks.every(check => check.met) };
}

export const handoffLabel = (item: WorkItem): string => ({
  Backlog: item.kind === 'software' ? 'Start development' : 'Start work',
  Development: 'Hand over to UAT',
  UAT: 'Mark ready for production',
  'Ready for production': 'Record deployment',
  'Production verification': 'Request client acceptance',
  'Awaiting client acceptance': 'Record client response',
  'In progress': 'Submit for review',
  Review: 'Accept & close',
  Closed: 'View delivery history',
}[item.stage]);

export const itemStageLabel = (item: WorkItem) => item.stage === 'Closed' && item.importedFrom && !item.closedAt ? 'Imported closed' : item.stage;
