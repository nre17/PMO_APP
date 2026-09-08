import type { HubState, Register, Settings, WorkItem } from './types.js';

const DAY = 86_400_000;
type CadenceSettings = Pick<Settings, 'timezone' | 'submissionHour' | 'cutoffHour'>;
type AttentionSettings = Pick<Settings, 'timezone' | 'workingDays' | 'blockedEscalationDays'>;
export interface ReportingPeriod { start: string; end: string; startAt: string; endAt: string }

export function dateInTimezone(value: Date, timezone: string): string {
  if (!Number.isFinite(value.getTime())) throw new Error('A valid date is required.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftDate(value: string, days: number): string {
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Resolve a wall-clock hour in the configured zone, including changes in UTC offset. */
function zonedHour(value: string, hour: number, timezone: string): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('Use an hour from 0 to 23.');
  const [year, month, day] = value.split('-').map(Number);
  const requested = Date.UTC(year, month - 1, day, hour);
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = requested;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find(p => p.type === type)!.value);
    const represented = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    const delta = requested - represented;
    if (!delta) return new Date(instant).toISOString();
    instant += delta;
  }
  throw new Error('The configured reporting hour does not exist in this timezone on that date.');
}

/** Reporting intervals are [previous Thursday cutoff, next Thursday cutoff). */
export function reportingPeriod(now: Date, timezone: string, cutoffHour = 12): ReportingPeriod {
  const today = dateInTimezone(now, timezone);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  let end = shiftDate(today, (4 - weekday + 7) % 7);
  let endAt = zonedHour(end, cutoffHour, timezone);
  if (now.getTime() >= new Date(endAt).getTime()) {
    end = shiftDate(end, 7);
    endAt = zonedHour(end, cutoffHour, timezone);
  }
  const start = shiftDate(end, -7);
  return { start, end, startAt: zonedHour(start, cutoffHour, timezone), endAt };
}

export function submissionDeadline(periodEnd: string, timezone: string, submissionHour = 10): string {
  return zonedHour(periodEnd, submissionHour, timezone);
}

export function submissionTiming(periodEnd: string, settings: CadenceSettings, confirmedAt?: string, now = new Date()) {
  const deadlineAt = submissionDeadline(periodEnd, settings.timezone, settings.submissionHour);
  return {
    deadlineAt,
    overdue: !confirmedAt && now.getTime() >= new Date(deadlineAt).getTime(),
    late: Boolean(confirmedAt && new Date(confirmedAt).getTime() > new Date(deadlineAt).getTime()),
  };
}

function activeWorkingDays(workingDays: number[]): Set<number> {
  const days = new Set(workingDays.filter(value => Number.isInteger(value) && value >= 0 && value <= 6));
  if (!days.size) throw new Error('Select at least one working day.');
  return days;
}

/** Counts working calendar dates after start, through end; never treats weekends as elapsed workdays. */
export function workingDaysBetween(start: string, end: string, workingDays: number[]): number {
  const days = activeWorkingDays(workingDays);
  const elapsed = Math.max(0, Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / DAY));
  let count = Math.floor(elapsed / 7) * days.size;
  const weekday = new Date(`${start}T12:00:00Z`).getUTCDay();
  for (let offset = 1; offset <= elapsed % 7; offset++) if (days.has((weekday + offset) % 7)) count++;
  return count;
}

export function previousWorkingDate(value: string, workingDays: number[]): string {
  const days = activeWorkingDays(workingDays);
  let previous = shiftDate(value, -1);
  while (!days.has(new Date(`${previous}T12:00:00Z`).getUTCDay())) previous = shiftDate(previous, -1);
  return previous;
}

type AttentionRecord = Pick<WorkItem, 'stage' | 'dueDate' | 'blocked' | 'blockedSince' | 'priority'> | Pick<Register, 'status' | 'dueDate'>;
export function recordAttention(record: AttentionRecord, settings: AttentionSettings, now = new Date()) {
  const today = dateInTimezone(now, settings.timezone);
  const isItem = 'stage' in record;
  const inactive = isItem ? record.stage === 'Closed' : record.status === 'resolved';
  const overdue = !inactive && Boolean(record.dueDate && record.dueDate < today);
  const overdueWorkingDays = overdue ? workingDaysBetween(record.dueDate, today, settings.workingDays) : 0;
  const blockedWorkingDays = !inactive && isItem && record.blocked && record.blockedSince
    ? workingDaysBetween(dateInTimezone(new Date(record.blockedSince), settings.timezone), today, settings.workingDays) : 0;
  const alreadyEscalated = !isItem && record.status === 'escalated';
  return {
    overdue,
    dueToday: !inactive && record.dueDate === today,
    dueReminder: !inactive && Boolean(record.dueDate && previousWorkingDate(record.dueDate, settings.workingDays) === today),
    blockedWorkingDays,
    overdueWorkingDays,
    escalationDue: !inactive && (alreadyEscalated || (isItem ? record.blocked && (record.priority === 'Critical' || blockedWorkingDays >= settings.blockedEscalationDays) : overdue && overdueWorkingDays >= settings.blockedEscalationDays)),
    alreadyEscalated,
  };
}

export function latestWorkstreamChange(state: HubState, workstreamId: string): string {
  return [...state.items.filter(i => i.workstreamId === workstreamId), ...state.deliverables.filter(d => d.workstreamId === workstreamId), ...state.registers.filter(r => r.workstreamId === workstreamId), ...state.milestones.filter(m => m.workstreamIds.includes(workstreamId)), ...state.workstreams.filter(w => w.id === workstreamId)]
    .map(record => record.updatedAt).sort().at(-1) ?? '';
}

export function confirmationState(state: HubState, workstreamId: string, periodEnd: string) {
  const submission = state.submissions.find(s => s.workstreamId === workstreamId && s.periodEnd === periodEnd);
  const sourceUpdatedAt = latestWorkstreamChange(state, workstreamId);
  const stale = Boolean(submission && submission.sourceUpdatedAt < sourceUpdatedAt);
  return { submission, sourceUpdatedAt, missing: !submission, stale, confirmed: Boolean(submission && !stale) };
}
