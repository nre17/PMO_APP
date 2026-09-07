import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationState, dateInTimezone, previousWorkingDate, recordAttention, reportingPeriod, submissionDeadline, submissionTiming, workingDaysBetween } from '../shared/reporting.js';
import { createSeedState } from '../server/seed.js';
import { latestStreamChange, period, reportDraft, streamConfirmed } from '../server/domain.js';

const dubai = 'Asia/Dubai';
const weekdays = [1, 2, 3, 4, 5];

test('Thursday cutoff uses half-open periods before, at, and after noon Dubai', () => {
  const before = reportingPeriod(new Date('2026-09-10T07:59:59.999Z'), dubai, 12);
  assert.deepEqual(before, { start: '2026-09-03', end: '2026-09-10', startAt: '2026-09-03T08:00:00.000Z', endAt: '2026-09-10T08:00:00.000Z' });
  const at = reportingPeriod(new Date('2026-09-10T08:00:00.000Z'), dubai, 12);
  assert.equal(at.startAt, before.endAt);
  assert.equal(at.endAt, '2026-09-17T08:00:00.000Z');
  assert.deepEqual(reportingPeriod(new Date('2026-09-10T11:00:00.000Z'), dubai, 12), at);
  assert.deepEqual(period(new Date('2026-09-10T08:00:00.000Z'), dubai, 12), at);
});

test('configured cutoff and Dubai midnight do not revert to a calendar-day week', () => {
  const custom = reportingPeriod(new Date('2026-09-10T05:00:00.000Z'), dubai, 9);
  assert.equal(custom.startAt, '2026-09-10T05:00:00.000Z');
  assert.equal(custom.endAt, '2026-09-17T05:00:00.000Z');
  assert.equal(dateInTimezone(new Date('2026-09-10T20:01:00.000Z'), dubai), '2026-09-11');
  assert.equal(reportingPeriod(new Date('2026-09-10T20:01:00.000Z'), dubai, 12).start, '2026-09-10');
});

test('London periods resolve each endpoint independently across spring and autumn DST', () => {
  const spring = reportingPeriod(new Date('2026-03-30T09:00:00Z'), 'Europe/London', 12);
  assert.equal(spring.startAt, '2026-03-26T12:00:00.000Z');
  assert.equal(spring.endAt, '2026-04-02T11:00:00.000Z');
  assert.equal((Date.parse(spring.endAt) - Date.parse(spring.startAt)) / 3_600_000, 167);
  const autumn = reportingPeriod(new Date('2026-10-26T09:00:00Z'), 'Europe/London', 12);
  assert.equal(autumn.startAt, '2026-10-22T11:00:00.000Z');
  assert.equal(autumn.endAt, '2026-10-29T12:00:00.000Z');
  assert.equal((Date.parse(autumn.endAt) - Date.parse(autumn.startAt)) / 3_600_000, 169);
});

test('submission timing distinguishes missing, on-time, and late updates in the project zone', () => {
  const settings = { timezone: dubai, submissionHour: 10, cutoffHour: 12 };
  assert.equal(submissionDeadline('2026-09-10', dubai, 10), '2026-09-10T06:00:00.000Z');
  assert.equal(submissionTiming('2026-09-10', settings, undefined, new Date('2026-09-10T05:59:00Z')).overdue, false);
  assert.equal(submissionTiming('2026-09-10', settings, undefined, new Date('2026-09-10T06:00:00Z')).overdue, true);
  assert.equal(submissionTiming('2026-09-10', settings, '2026-09-10T06:00:00Z').late, false);
  assert.equal(submissionTiming('2026-09-10', settings, '2026-09-10T06:01:00Z').late, true);
  assert.equal(submissionDeadline('2026-07-02', 'Europe/London', 10), '2026-07-02T09:00:00.000Z');
});

test('blocked escalation and due reminders honor weekends and the configured working week', () => {
  const state = createSeedState(new Date('2026-09-07T08:00:00Z'));
  const item = { ...state.items[0], blocked: true, blockedSince: '2026-09-04T08:00:00Z', dueDate: '2026-09-07' };
  const settings = { timezone: dubai, workingDays: weekdays, blockedEscalationDays: 2 };
  const friday = recordAttention(item, settings, new Date('2026-09-04T10:00:00Z'));
  assert.equal(friday.dueReminder, true);
  assert.equal(previousWorkingDate('2026-09-07', weekdays), '2026-09-04');
  assert.equal(recordAttention(item, settings, new Date('2026-09-06T10:00:00Z')).blockedWorkingDays, 0);
  assert.equal(recordAttention(item, settings, new Date('2026-09-07T10:00:00Z')).escalationDue, false);
  const tuesday = recordAttention(item, settings, new Date('2026-09-08T10:00:00Z'));
  assert.equal(tuesday.blockedWorkingDays, 2);
  assert.equal(tuesday.escalationDue, true);
  assert.equal(recordAttention({ ...item, stage: 'Closed' }, settings, new Date('2026-09-08T10:00:00Z')).escalationDue, false);
  assert.equal(workingDaysBetween('2026-09-03', '2026-09-06', [0, 1, 2, 3, 4]), 1);
  assert.equal(previousWorkingDate('2026-09-06', [0, 1, 2, 3, 4]), '2026-09-03');
  assert.equal(workingDaysBetween('2026-09-10', '2026-09-03', weekdays), 0);
});

test('critical blockers escalate immediately, including weekends, without escalating unblocked or closed work', () => {
  const now = new Date('2026-09-05T08:00:00Z');
  const state = createSeedState(now);
  const settings = { timezone: dubai, workingDays: weekdays, blockedEscalationDays: 2 };
  const critical = { ...state.items[0], priority: 'Critical' as const, blocked: true, blockedSince: now.toISOString(), dueDate: '2026-09-10' };
  const attention = recordAttention(critical, settings, now);
  assert.equal(attention.blockedWorkingDays, 0);
  assert.equal(attention.overdue, false);
  assert.equal(attention.escalationDue, true);
  assert.equal(recordAttention({ ...critical, blockedSince: undefined }, settings, now).escalationDue, true);
  assert.equal(recordAttention({ ...critical, priority: 'High' }, settings, now).escalationDue, false);
  assert.equal(recordAttention({ ...critical, blocked: false }, settings, now).escalationDue, false);
  assert.equal(recordAttention({ ...critical, stage: 'Closed' }, settings, now).escalationDue, false);
});

test('register escalation and overdue dates use project timezone and exclude resolved records', () => {
  const state = createSeedState(new Date('2026-09-07T08:00:00Z'));
  const register = { ...state.registers[1], status: 'open' as const, dueDate: '2026-09-04' };
  const settings = { timezone: dubai, workingDays: weekdays, blockedEscalationDays: 2 };
  assert.equal(recordAttention(register, settings, new Date('2026-09-07T08:00:00Z')).escalationDue, false);
  assert.equal(recordAttention(register, settings, new Date('2026-09-08T08:00:00Z')).escalationDue, true);
  assert.equal(recordAttention({ ...register, status: 'resolved' }, settings, new Date('2026-09-08T08:00:00Z')).overdue, false);
  const sundayDue = { ...register, dueDate: '2026-09-06' };
  assert.equal(recordAttention(sundayDue, settings, new Date('2026-09-06T22:00:00Z')).overdue, true);
  assert.equal(recordAttention(sundayDue, { ...settings, timezone: 'UTC' }, new Date('2026-09-06T22:00:00Z')).overdue, false);
});

test('shared and server confirmation checks agree when sources change and are reconfirmed', () => {
  const now = new Date('2026-09-07T08:00:00Z');
  const state = createSeedState(now);
  const end = reportingPeriod(now, state.settings.timezone, state.settings.cutoffHour).end;
  for (const workstream of state.workstreams) assert.equal(confirmationState(state, workstream.id, end).confirmed, streamConfirmed(state, workstream.id, end));
  assert.equal(confirmationState(state, 'ws-assistant', end).confirmed, true);
  assert.equal(confirmationState(state, 'ws-data', end).stale, true);
  assert.equal(confirmationState(state, 'ws-evaluation', end).missing, true);
  state.items[0].updatedAt = now.toISOString(); state.items[0].version++;
  assert.equal(confirmationState(state, 'ws-assistant', end).stale, true);
  assert.equal(streamConfirmed(state, 'ws-assistant', end), false);
  state.submissions[0].sourceUpdatedAt = latestStreamChange(state, 'ws-assistant');
  assert.equal(confirmationState(state, 'ws-assistant', end).confirmed, true);
});

test('Thursday afternoon completion appears in the next interval; future and undated closures do not', () => {
  const beforeCutoff = '2026-09-10T07:59:59.999Z';
  const state = createSeedState(new Date(beforeCutoff));
  const pmo = state.members.find(m => m.id === 'pmo-nadia')!;
  const item = state.items.find(i => i.id === 'work-assistant-02')!;
  assert.ok(!reportDraft(state, pmo, 'client', beforeCutoff).body.highlights.includes(item.clientSummary));
  item.stage = 'Closed'; item.closedAt = '2026-09-10T11:00:00.000Z';
  const next = reportDraft(state, pmo, 'client', '2026-09-11T08:00:00.000Z');
  assert.ok(next.body.highlights.includes(item.clientSummary));
  item.closedAt = '2026-09-11T09:00:00.000Z';
  assert.ok(!reportDraft(state, pmo, 'client', '2026-09-11T08:00:00.000Z').body.highlights.includes(item.clientSummary));
  item.closedAt = '2026-09-10T08:00:00.000Z';
  assert.ok(reportDraft(state, pmo, 'client', '2026-09-10T08:00:00.000Z').body.highlights.includes(item.clientSummary));
  delete item.closedAt;
  assert.ok(!reportDraft(state, pmo, 'client', '2026-09-11T08:00:00.000Z').body.highlights.includes(item.clientSummary));
});

test('plans are dated, raw lead notes stay internal, and accepted outcomes are not inferred from commentary', () => {
  const now = '2026-09-07T08:00:00.000Z';
  const state = createSeedState(new Date(now));
  const pmo = state.members.find(m => m.id === 'pmo-nadia')!;
  state.items[0].dueDate = '2030-01-01';
  const submission = state.submissions[0];
  submission.completed = 'INTERNAL-NARRATIVE-progress';
  submission.next = 'INTERNAL-NARRATIVE-plan';
  submission.changes = 'INTERNAL-NARRATIVE-change';
  submission.blockers = 'INTERNAL-NARRATIVE-dependency';
  const internal = reportDraft(state, pmo, 'internal', now);
  for (const marker of ['progress', 'plan', 'change', 'dependency']) assert.ok(JSON.stringify(internal.body).includes(`INTERNAL-NARRATIVE-${marker}`));
  assert.ok(!internal.body.highlights.some(line => line.includes('INTERNAL-NARRATIVE')));
  const client = reportDraft(state, pmo, 'client', now);
  assert.ok(!client.body.nextWeek.some(line => line.includes(state.items[0].clientSummary)));
  assert.ok(!JSON.stringify(client.body).includes('INTERNAL-NARRATIVE'));
  assert.ok(!JSON.stringify(client.body).includes('INTERNAL-ONLY-COMMERCIAL-NOTE'));
});

test('seed dates follow the active cutoff interval without future historical approvals', () => {
  for (const stamp of ['2026-09-10T07:59:59.999Z', '2026-09-10T08:00:00.000Z', '2026-09-10T08:15:00.000Z', '2026-09-10T20:01:00.000Z']) {
    const now = new Date(stamp), state = createSeedState(now);
    const end = reportingPeriod(now, state.settings.timezone, state.settings.cutoffHour).end;
    assert.ok(state.submissions.every(submission => submission.periodEnd === end));
    assert.ok(state.reports.every(report => Date.parse(report.approvedAt!) < now.getTime()));
  }
});
