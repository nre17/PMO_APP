import test from 'node:test';
import assert from 'node:assert/strict';
import type { WorkItem } from '../shared/types.js';
import { createSeedState } from '../server/seed.js';
import { dateInTimezone, nextWorkingDate, selectOverview, selectWorkContext } from '../src/overview-model.js';
import { selectDeliveryItems, type DeliveryFilters } from '../src/delivery-model.js';

// A saved Monday project position reviewed on Tuesday, not a moving fixture.
const savedAt = new Date('2026-09-07T08:00:00Z');
const reviewedAt = new Date('2026-09-08T08:00:00Z');
const snapshot = () => createSeedState(savedAt);

test('fixed saved snapshot separates interventions from upcoming work without double-counting reasons', () => {
  const state = snapshot();
  const before = structuredClone(state);
  const model = selectOverview(state, reviewedAt);
  assert.deepEqual(model.counts, { total: 30, active: 25, closed: 5, recordedClosures: 5, importedClosed: 0, interventions: 7, dueSoon: 9, blocked: 3, overdue: 5, escalations: 3, awaitingClient: 2, forecastsBeyondBaseline: 2 });
  assert.equal(model.today, '2026-09-08');
  assert.equal(model.nextWorkingDate, '2026-09-09');
  assert.deepEqual(model.interventions.map(row => row.item.id), ['work-data-01', 'work-evaluation-02', 'work-data-02', 'work-assistant-01', 'work-data-08', 'work-assistant-04', 'work-assistant-02']);
  assert.equal(new Set([...model.interventions, ...model.dueSoon].map(row => row.item.id)).size, 16);
  assert.ok(model.dueSoon.every(row => !row.item.blocked && !row.flags.overdue && row.item.stage !== 'Awaiting client acceptance'));
  assert.deepEqual(state, before, 'Selectors must not reorder or edit source records.');
});

test('overdue age and blocked age remain separate working-day values', () => {
  const access = selectOverview(snapshot(), reviewedAt).interventions.find(row => row.item.id === 'work-data-01')!;
  assert.equal(access.flags.overdueWorkingDays, 2);
  assert.equal(access.flags.blockedWorkingDays, 4);
  assert.equal(access.reason, 'escalation');
});

test('overview shortcuts open the exact same delivery membership, including combined filters', () => {
  const state = snapshot();
  const overview = selectOverview(state, reviewedAt);
  const filters: DeliveryFilters = { query: '', workstream: 'all', owner: 'all', status: 'all', kind: 'all', stage: 'all', sort: 'attention' };
  const expected = [
    { status: 'intervention', count: 7, rows: overview.interventions },
    { status: 'due-soon', count: 9, rows: overview.dueSoon },
    { status: 'escalation', count: 3, rows: overview.interventions.filter(row => row.flags.escalationDue) },
    { status: 'overdue', count: 5, rows: overview.interventions.filter(row => row.flags.overdue) },
  ];
  for (const { status, count, rows } of expected) {
    const result = selectDeliveryItems(state, { ...filters, status }, reviewedAt);
    assert.equal(result.length, count, status);
    assert.deepEqual(result.map(item => item.id), rows.map(row => row.item.id), `${status} uses identical membership and ordering`);
    assert.ok(result.every(item => item.stage !== 'Closed'));
  }
  assert.deepEqual(selectDeliveryItems(state, { ...filters, status: 'overdue', workstream: 'ws-data' }, reviewedAt).map(item => item.id), ['work-data-01', 'work-data-08']);
  assert.deepEqual(selectDeliveryItems(state, { ...filters, status: 'intervention', query: 'citation', kind: 'software', stage: 'UAT' }, reviewedAt).map(item => item.id), ['work-assistant-01']);
  assert.equal(selectDeliveryItems(state, { ...filters, status: 'due-soon', stage: 'Closed' }, reviewedAt).length, 0);
});

test('urgency sorting is escalation, blocked, overdue, client response, then target date', () => {
  const state = snapshot();
  const base = state.items[0];
  const item = (id: string, changes: Partial<WorkItem>): WorkItem => ({ ...base, id, title: id, stage: 'Development', dueDate: '2026-09-20', blocked: false, blockedSince: undefined, priority: 'Medium', ...changes });
  state.items = [
    item('client', { stage: 'Awaiting client acceptance' }),
    item('overdue-later', { dueDate: '2026-09-07' }),
    item('blocked', { blocked: true, blockedSince: reviewedAt.toISOString() }),
    item('escalation', { blocked: true, priority: 'Critical', blockedSince: reviewedAt.toISOString() }),
    item('overdue-earlier', { dueDate: '2026-09-06' }),
    item('overlap', { blocked: true, priority: 'Critical', dueDate: '2026-09-07', stage: 'Awaiting client acceptance' }),
    item('today', { dueDate: '2026-09-08' }),
    item('tomorrow', { dueDate: '2026-09-09' }),
  ];
  const model = selectOverview(state, reviewedAt);
  assert.deepEqual(model.interventions.map(row => row.item.id), ['overlap', 'escalation', 'blocked', 'overdue-earlier', 'overdue-later', 'client']);
  assert.deepEqual(model.dueSoon.map(row => row.item.id), ['today', 'tomorrow']);
  assert.equal(model.counts.interventions, 6);
  assert.equal(model.counts.blocked, 3);
  assert.equal(model.counts.overdue, 3);
  assert.equal(model.counts.awaitingClient, 2);
});

test('closed work never enters either queue and undated imported closure is not recorded acceptance', () => {
  const state = snapshot();
  state.items = state.items.slice(0, 4).map((item, index) => ({ ...item, stage: 'Closed', blocked: true, priority: 'Critical', dueDate: index % 2 ? '2026-09-08' : '2026-09-07', closedAt: index === 0 ? '2026-09-07T08:00:00Z' : index === 1 ? undefined : index === 2 ? '2026-09-09T08:00:00Z' : 'invalid', importedFrom: index === 1 ? 'legacy-backlog.xlsx' : undefined }));
  const model = selectOverview(state, reviewedAt);
  assert.equal(model.counts.closed, 4);
  assert.equal(model.counts.recordedClosures, 1);
  assert.equal(model.counts.importedClosed, 1);
  assert.equal(model.counts.active, 0);
  assert.equal(model.counts.escalations, 0);
  assert.deepEqual(model.interventions, []);
  assert.deepEqual(model.dueSoon, []);
});

test('next working date and reminder window honor configured weekends without claiming tomorrow', () => {
  const state = snapshot();
  const base = state.items[0];
  state.items = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'].map((dueDate, index) => ({ ...base, id: `weekend-${index}`, dueDate }));
  const friday = selectOverview(state, new Date('2026-09-04T08:00:00Z'));
  assert.equal(friday.nextWorkingDate, '2026-09-07');
  assert.equal(friday.dueSoon.length, 4, 'Existing reminders include weekend targets whose previous working day is Friday.');
  assert.equal(nextWorkingDate('2026-09-03', [0, 1, 2, 3, 4]), '2026-09-06');
  assert.equal(nextWorkingDate('2026-09-06', [0, 1, 2, 3, 4]), '2026-09-07');
  assert.equal(nextWorkingDate('2026-09-04', [5]), '2026-09-11');
  assert.throws(() => nextWorkingDate('2026-09-04', []), /working day/);
  assert.throws(() => nextWorkingDate('2026-02-30', [1]), /calendar date/);
});

test('overview date boundaries use the project timezone rather than the browser or UTC date', () => {
  const now = new Date('2026-09-07T21:00:00Z');
  const state = snapshot();
  state.items = [{ ...state.items[0], dueDate: '2026-09-07' }];
  assert.equal(dateInTimezone(now, 'Asia/Dubai'), '2026-09-08');
  assert.equal(selectOverview(state, now).interventions.length, 1);
  state.settings.timezone = 'UTC';
  assert.equal(selectOverview(state, now).today, '2026-09-07');
  assert.equal(selectOverview(state, now).interventions.length, 0);
  assert.equal(selectOverview(state, now).dueSoon.length, 1);
  assert.equal(nextWorkingDate(dateInTimezone(new Date('2026-03-27T23:30:00Z'), 'Europe/London'), [1, 2, 3, 4, 5]), '2026-03-30');
});

test('milestone variance compares recorded baseline with forecast in calendar days, not actuals or change history', () => {
  const state = snapshot();
  state.settings.timezone = 'Europe/London';
  const base = state.milestones[0];
  state.milestones = [
    { ...base, id: 'later', baselineDate: '2026-03-27', forecastDate: '2026-03-30', actualDate: '2026-03-27', status: 'complete' },
    { ...base, id: 'earlier', baselineDate: '2026-03-30', forecastDate: '2026-03-27' },
    { ...base, id: 'same', baselineDate: '2026-03-30', forecastDate: '2026-03-30' },
    { ...base, id: 'unknown', baselineDate: '', forecastDate: '2026-03-30' },
  ];
  state.events = [];
  const model = selectOverview(state, new Date('2026-03-31T08:00:00Z'));
  assert.deepEqual(model.milestoneVariances.map(value => value.calendarDays), [3, -3, 0, null]);
  assert.equal(model.counts.forecastsBeyondBaseline, 1);
  assert.equal(model.milestoneVariances[0].forecastDate, '2026-03-30');
});

test('linked context retains explicit register and deliverable provenance without inferring shared-workstream causality', () => {
  const state = snapshot();
  const item = state.items.find(value => value.id === 'work-data-01')!;
  const context = selectWorkContext(state, item.id);
  assert.deepEqual(context.registers.map(value => [value.register.id, value.kind]), [['reg-finance-access', 'direct_item_link']]);
  assert.deepEqual(context.milestones.map(value => [value.milestone.id, value.links]), [
    ['ms-finance-ready', [{ kind: 'via_register', registerId: 'reg-finance-access', label: 'Linked through register' }, { kind: 'via_deliverable', deliverableId: 'del-data-pipeline', label: 'Deliverable membership' }]],
    ['ms-release-review', [{ kind: 'via_deliverable', deliverableId: 'del-data-pipeline', label: 'Deliverable membership' }]],
  ]);
  const linkedRegister = state.registers.find(value => value.id === 'reg-finance-access')!;
  linkedRegister.relatedItemIds.push(item.id);
  linkedRegister.milestoneIds.push('ms-finance-ready', 'missing-milestone');
  linkedRegister.status = 'resolved';
  assert.equal(selectWorkContext(state, item.id).registers.length, 1, 'Repeated IDs do not duplicate a record; resolved links remain useful historical context.');
  assert.equal(selectWorkContext(state, item.id).milestones.length, 2);
  item.deliverableId = undefined;
  assert.deepEqual(selectWorkContext(state, item.id).milestones.map(value => value.milestone.id), ['ms-finance-ready']);
  item.deliverableId = 'missing-deliverable';
  assert.equal(selectWorkContext(state, item.id).milestones.length, 1);
  linkedRegister.relatedItemIds = [];
  assert.deepEqual(selectWorkContext(state, item.id).milestones, [], 'Shared workstream alone does not establish a link.');
  assert.deepEqual(selectWorkContext(state, 'missing-item'), { item: undefined, registers: [], milestones: [] });
});
