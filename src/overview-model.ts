import type { HubState, Milestone, Register, WorkItem } from '../shared/types.js';
import { dateInTimezone, recordAttention, shiftDate } from '../shared/reporting.js';

export { dateInTimezone } from '../shared/reporting.js';

export type OverviewReason = 'escalation' | 'blocked' | 'overdue' | 'client' | 'due_today' | 'due_soon' | null;
export interface OverviewRow {
  item: WorkItem;
  flags: ReturnType<typeof recordAttention>;
  reason: OverviewReason;
  /** Lower ranks come first; dates break ties within each urgency group. */
  rank: number;
}
export interface MilestoneVariance {
  milestone: Milestone;
  baselineDate: string;
  forecastDate: string;
  /** Signed calendar days, not working days or a count of changes during a period. */
  calendarDays: number | null;
  forecastBeyondBaseline: boolean;
}
export interface OverviewCounts {
  total: number;
  active: number;
  closed: number;
  recordedClosures: number;
  importedClosed: number;
  interventions: number;
  dueSoon: number;
  blocked: number;
  overdue: number;
  escalations: number;
  awaitingClient: number;
  /** Recorded milestone forecasts beyond baseline, irrespective of when they changed. */
  forecastsBeyondBaseline: number;
}

const DAY = 86_400_000;
function calendarDateStamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const stamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

/** The next configured working calendar date, strictly after the supplied project-local date. */
export function nextWorkingDate(today: string, workingDays: number[]): string {
  if (calendarDateStamp(today) === null) throw new Error('Use a valid calendar date.');
  const days = new Set(workingDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6));
  if (!days.size) throw new Error('Select at least one working day.');
  let next = shiftDate(today, 1);
  while (!days.has(new Date(`${next}T12:00:00Z`).getUTCDay())) next = shiftDate(next, 1);
  return next;
}

function milestoneVariance(milestone: Milestone): MilestoneVariance {
  const baseline = calendarDateStamp(milestone.baselineDate);
  const forecast = calendarDateStamp(milestone.forecastDate);
  const calendarDays = baseline === null || forecast === null ? null : (forecast - baseline) / DAY;
  return { milestone, baselineDate: milestone.baselineDate, forecastDate: milestone.forecastDate, calendarDays, forecastBeyondBaseline: calendarDays !== null && calendarDays > 0 };
}

function overviewRow(item: WorkItem, state: HubState, now: Date): OverviewRow {
  const flags = recordAttention(item, state.settings, now);
  const reason: OverviewReason = flags.escalationDue ? 'escalation' : item.blocked ? 'blocked' : flags.overdue ? 'overdue' : item.stage === 'Awaiting client acceptance' ? 'client' : flags.dueToday ? 'due_today' : flags.dueReminder ? 'due_soon' : null;
  const rank = reason === 'escalation' ? 0 : reason === 'blocked' ? 1 : reason === 'overdue' ? 2 : reason === 'client' ? 3 : reason === 'due_today' ? 4 : reason === 'due_soon' ? 5 : 6;
  return { item, flags, reason, rank };
}
const compareRows = (a: OverviewRow, b: OverviewRow) => a.rank - b.rank || (a.item.dueDate || '9999').localeCompare(b.item.dueDate || '9999') || a.item.title.localeCompare(b.item.title) || a.item.id.localeCompare(b.item.id);

/** Derives two disjoint queues from one snapshot; overlapping reasons never duplicate an item. */
export function selectOverview(state: HubState, now = new Date()) {
  const today = dateInTimezone(now, state.settings.timezone);
  const active = state.items.filter(item => item.stage !== 'Closed').map(item => overviewRow(item, state, now));
  const interventions = active.filter(({ item, flags }) => item.blocked || flags.overdue || item.stage === 'Awaiting client acceptance').sort(compareRows);
  const interventionIds = new Set(interventions.map(({ item }) => item.id));
  // Keep the existing reminder rule: on Friday this can include weekend targets as well as Monday.
  const dueSoon = active.filter(({ item, flags }) => !interventionIds.has(item.id) && (flags.dueToday || flags.dueReminder)).sort(compareRows);
  const closed = state.items.filter(item => item.stage === 'Closed');
  const milestoneVariances = state.milestones.map(milestoneVariance);
  const counts: OverviewCounts = {
    total: state.items.length,
    active: active.length,
    closed: closed.length,
    recordedClosures: closed.filter(item => item.closedAt && Number.isFinite(Date.parse(item.closedAt)) && Date.parse(item.closedAt) <= now.getTime()).length,
    importedClosed: closed.filter(item => item.importedFrom && !item.closedAt).length,
    interventions: interventions.length,
    dueSoon: dueSoon.length,
    blocked: active.filter(({ item }) => item.blocked).length,
    overdue: active.filter(({ flags }) => flags.overdue).length,
    escalations: active.filter(({ flags }) => flags.escalationDue).length,
    awaitingClient: active.filter(({ item }) => item.stage === 'Awaiting client acceptance').length,
    forecastsBeyondBaseline: milestoneVariances.filter(variance => variance.forecastBeyondBaseline).length,
  };
  return { today, nextWorkingDate: nextWorkingDate(today, state.settings.workingDays), counts, interventions, dueSoon, milestoneVariances };
}

export interface LinkedRegisterContext {
  register: Register;
  kind: 'direct_item_link';
  label: 'Linked register entry';
}
export type MilestoneLink =
  | { kind: 'via_register'; registerId: string; label: 'Linked through register' }
  | { kind: 'via_deliverable'; deliverableId: string; label: 'Deliverable membership' };
export interface LinkedMilestoneContext { milestone: Milestone; links: MilestoneLink[] }
export interface WorkContext {
  item: WorkItem | undefined;
  registers: LinkedRegisterContext[];
  milestones: LinkedMilestoneContext[];
}

/** Associations only: neither shared workstream nor a shared register proves a critical path. */
export function selectWorkContext(state: HubState, itemId: string): WorkContext {
  const item = state.items.find(record => record.id === itemId);
  if (!item) return { item: undefined, registers: [], milestones: [] };
  const registers: LinkedRegisterContext[] = state.registers.filter(register => register.relatedItemIds.includes(item.id))
    .map(register => ({ register, kind: 'direct_item_link', label: 'Linked register entry' }));
  const deliverable = state.deliverables.find(record => record.id === item.deliverableId);
  const milestones: LinkedMilestoneContext[] = [];
  for (const milestone of state.milestones) {
    const links: MilestoneLink[] = registers.filter(({ register }) => register.milestoneIds.includes(milestone.id))
      .map(({ register }) => ({ kind: 'via_register', registerId: register.id, label: 'Linked through register' }));
    if (deliverable && milestone.deliverableIds.includes(deliverable.id)) links.push({ kind: 'via_deliverable', deliverableId: deliverable.id, label: 'Deliverable membership' });
    if (links.length) milestones.push({ milestone, links });
  }
  return { item, registers, milestones };
}
