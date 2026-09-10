import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedState } from '../server/seed';
import { deliveryPrerequisites, itemStageLabel, selectDeliveryItems, workflowStages, type DeliveryFilters } from '../src/delivery-model';
import type { HubState, TestResult, WorkItem } from '../shared/types';

const now=new Date('2026-09-07T08:00:00.000Z');
const seed=createSeedState(now);
const owner=seed.members.find(member=>member.role==='contributor')!;
const defaultFilters:DeliveryFilters={query:'',workstream:'all',owner:'all',status:'all',kind:'all',stage:'all',sort:'due'};
function item(overrides:Partial<WorkItem>={}):WorkItem{
  return {...seed.items[0],id:'work',title:'Document the evaluation outcome',kind:'software',stage:'Development',workstreamId:seed.workstreams[0].id,ownerId:owner.id,currentOwnerId:owner.id,priority:'Medium',dueDate:'2026-09-10',baselineDate:'2026-09-10',acceptanceCriteria:'Reviewed and accepted',nextAction:'Prepare the evidence',blocked:false,blockReason:'',blockedSince:undefined,closedAt:undefined,importedFrom:undefined,cycle:2,...overrides};
}
function state(items:WorkItem[],tests:TestResult[]=[]):HubState{return {...seed,items,tests};}
function check(overrides:Partial<TestResult>={}):TestResult{
  return {id:'check',itemId:'work',cycle:2,stage:'UAT',result:'pass',blocking:false,notes:'Verified the acceptance criteria',evidence:'Run 102',authorId:owner.id,createdAt:now.toISOString(),...overrides};
}
const select=(hub:HubState,overrides:Partial<DeliveryFilters>={})=>selectDeliveryItems(hub,{...defaultFilters,...overrides},now);

test('boards have distinct ordered delivery paths, including empty stages',()=>{
  assert.deepEqual(workflowStages('software'),['Backlog','Development','UAT','Ready for production','Production verification','Awaiting client acceptance','Closed']);
  assert.deepEqual(workflowStages('general'),['Backlog','In progress','Review','Closed']);
  assert.equal(workflowStages('general').includes('UAT'),false);
  assert.equal(workflowStages('software').includes('Review'),false);
});

test('pipeline drilldown preserves workflow for shared Backlog and Closed stage names',()=>{
  const hub=state([
    item({id:'software-backlog',stage:'Backlog'}),
    item({id:'general-backlog',kind:'general',stage:'Backlog'}),
    item({id:'software-closed',stage:'Closed'}),
    item({id:'general-closed',kind:'general',stage:'Closed'}),
  ]);
  assert.deepEqual(select(hub,{kind:'general',stage:'Backlog'}).map(i=>i.id),['general-backlog']);
  assert.deepEqual(select(hub,{kind:'software',stage:'Closed'}).map(i=>i.id),['software-closed']);
  assert.equal(select(hub,{stage:'Closed'}).length,2);
});

test('owner filter follows the next action owner, distinct from accountable ownership',()=>{
  const other=seed.members.find(m=>m.id!==owner.id&&m.role!=='executive')!;
  const hub=state([
    item({id:'mine',ownerId:other.id,currentOwnerId:owner.id}),
    item({id:'handed-over',ownerId:owner.id,currentOwnerId:other.id}),
    item({id:'captured',stage:'Backlog',currentOwnerId:'',ownerId:'',dueDate:''}),
  ]);
  assert.deepEqual(select(hub,{owner:owner.id}).map(i=>i.id),['mine']);
  assert.deepEqual(select(hub,{owner:'unassigned'}).map(i=>i.id),['captured']);
  assert.deepEqual(select(hub,{query:owner.name}).map(i=>i.id),['mine']);
});

test('attention and blocked filters exclude historical closed records with old blocker fields',()=>{
  const hub=state([
    item({id:'old-closed',stage:'Closed',blocked:true,priority:'Critical',dueDate:'2026-08-01',importedFrom:'Legacy.xlsx'}),
    item({id:'active-blocked',blocked:true,blockReason:'Waiting for a decision'}),
    item({id:'overdue',dueDate:'2026-09-04'}),
    item({id:'client',stage:'Awaiting client acceptance'}),
    item({id:'clear'}),
  ]);
  assert.deepEqual(select(hub,{status:'blocked'}).map(i=>i.id),['active-blocked']);
  assert.deepEqual(new Set(select(hub,{status:'attention'}).map(i=>i.id)),new Set(['active-blocked','overdue','client']));
  assert.equal(select(hub,{status:'closed'}).length,1);
});

test('search and sorting combine with filters without mutating the original state',()=>{
  const hub=state([
    item({id:'later',title:'Later work',dueDate:'2026-09-11',nextAction:'Review the evaluation'}),
    item({id:'unscheduled',title:'Unscheduled work',stage:'Backlog',dueDate:'',nextAction:'Review the evaluation'}),
    item({id:'earlier',title:'Earlier work',dueDate:'2026-09-09',nextAction:'Review the evaluation'}),
    item({id:'other',workstreamId:seed.workstreams[1].id,dueDate:'2026-09-08',nextAction:'Review the evaluation'}),
  ]);
  const before=hub.items.map(i=>i.id);
  assert.deepEqual(select(hub,{query:' EVALUATION ',workstream:seed.workstreams[0].id}).map(i=>i.id),['earlier','later','unscheduled']);
  assert.deepEqual(hub.items.map(i=>i.id),before);
  assert.deepEqual(select(hub,{sort:'title',workstream:seed.workstreams[0].id}).map(i=>i.id),['earlier','later','unscheduled']);
});

test('attention drilldown includes today and next-working-day reminders shown on Overview',()=>{
  const hub=state([
    item({id:'today',dueDate:'2026-09-07'}),
    item({id:'next-working-day',dueDate:'2026-09-08'}),
    item({id:'later',dueDate:'2026-09-10'}),
    item({id:'closed',stage:'Closed',dueDate:'2026-09-07'}),
  ]);
  assert.deepEqual(select(hub,{status:'attention',sort:'attention'}).map(i=>i.id),['today','next-working-day']);
});

test('handover checklist requires current-cycle and current-stage passing evidence',()=>{
  const work=item({stage:'Production verification'});
  const hub=state([work],[
    check({id:'old-pass',cycle:1,stage:'Production verification'}),
    check({id:'other-stage',cycle:2,stage:'UAT'}),
  ]);
  const before=deliveryPrerequisites(hub,work);
  assert.equal(before.checks.find(c=>c.key==='pass')?.met,false);
  assert.equal(before.checks.find(c=>c.key==='pass')?.label,'Record a passing Production verification check in cycle 2');
  assert.equal(before.ready,false);
  hub.tests.push(check({id:'correct-pass',stage:'Production verification'}));
  assert.equal(deliveryPrerequisites(hub,work).ready,true);
  assert.equal(deliveryPrerequisites(hub,work).checks.find(c=>c.key==='pass')?.label,'Production verification passed in delivery cycle 2');
});

test('earlier-cycle unresolved blocking findings remain visible after a new passing check',()=>{
  const work=item({stage:'UAT'});
  const hub=state([work],[check(),check({id:'old-failure',cycle:1,result:'fail',blocking:true})]);
  const before=deliveryPrerequisites(hub,work);
  assert.equal(before.unresolved.length,1);
  assert.equal(before.checks.find(c=>c.key==='pass')?.met,true);
  assert.equal(before.ready,false);
  hub.tests[1].resolvedAt=now.toISOString();
  assert.equal(deliveryPrerequisites(hub,work).ready,true);
});

test('deployment and quick-capture requirements are explicit before advancing',()=>{
  const release=item({stage:'Ready for production'});
  const hub=state([release]);
  assert.equal(deliveryPrerequisites(hub,release).ready,false);
  assert.equal(deliveryPrerequisites(hub,release,owner.id,'Release 14 deployed to production').ready,true);
  const backlog=item({stage:'Backlog',ownerId:'',currentOwnerId:'',dueDate:'',acceptanceCriteria:'',nextAction:''});
  const missing=deliveryPrerequisites(state([backlog]),backlog).checks.filter(c=>!c.met).map(c=>c.key);
  assert.deepEqual(missing,['owner','date','criteria','next','nextOwner']);
});

test('historical closure does not claim recorded acceptance',()=>{
  assert.equal(itemStageLabel(item({stage:'Closed',importedFrom:'Legacy.xlsx'})),'Imported closed');
  assert.equal(itemStageLabel(item({stage:'Closed',importedFrom:'Legacy.xlsx',closedAt:now.toISOString()})),'Closed');
});
