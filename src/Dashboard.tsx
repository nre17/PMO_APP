import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowRight, ArrowUpRight, AlertTriangle, Check, ChevronDown, ChevronRight, Clock3, FileCheck2, Link2, ListChecks, Play, Plus, X } from 'lucide-react';
import { SOFTWARE_STAGES, GENERAL_STAGES, type PageProps, type Stage, type WorkflowKind, type Milestone, type WorkItem } from '../shared/types';
import { confirmationState, reportingPeriod, recordAttention, submissionTiming } from '../shared/reporting';
import { Avatar, Badge, Empty, SafeLink, formatDate, healthLabel, memberName } from './ui';
import { MilestoneForm } from './Delivery';
import { WorkstreamEditor, AuditHistory } from './OverviewExtras';
import { selectOverview, selectWorkContext, type OverviewRow } from './overview-model';
import './overview.css';

type DashboardProps = PageProps & {
  navigate:(page:string,filter?:string)=>void;
  startMeeting:()=>void;
  onStage:(kind:WorkflowKind,stage:Stage)=>void;
  onWorkstream:(id:string)=>void;
  onRegister?:(id:string)=>void;
};
type QueueFilter='intervention'|'blocked'|'overdue'|'client';
const reasonLabel=(row:OverviewRow)=>({escalation:'Escalation due',blocked:'Blocked',overdue:'Past target',client:'Awaiting client',due_today:'Due today',due_soon:'Due soon'})[row.reason||'due_soon'];
const reasonTone=(row:OverviewRow)=>row.reason==='escalation'||row.reason==='blocked'?'red':row.reason==='overdue'||row.reason==='due_today'?'amber':'neutral';
const varianceLabel=(days:number|null)=>days===null?'Dates not set':days===0?'On baseline':(days>0?'+':'')+days+' calendar '+(Math.abs(days)===1?'day':'days');

export default function Dashboard(props:DashboardProps){
  const {state,user,navigate,startMeeting,onStage,onWorkstream,openItem}=props;
  const [now,setNow]=useState(()=>new Date());
  const overview=useMemo(()=>selectOverview(state,now),[state,now]);
  const {counts}=overview;
  const [selectedId,setSelectedId]=useState<string|undefined>(()=>typeof window!=='undefined'&&window.matchMedia?.('(max-width: 1190px)').matches?undefined:overview.interventions[0]?.item.id);
  const [queueFilter,setQueueFilter]=useState<QueueFilter>('intervention');
  const [kind,setKind]=useState<WorkflowKind>('software');
  const [milestone,setMilestone]=useState<Milestone>();const [newMilestone,setNewMilestone]=useState(false);
  const [stream,setStream]=useState<string>();const [history,setHistory]=useState(false);
  const panelHeading=useRef<HTMLHeadingElement>(null);const queueHeading=useRef<HTMLHeadingElement>(null);const contextPane=useRef<HTMLElement>(null);
  const forecastHeading=useRef<HTMLHeadingElement>(null);const lastTrigger=useRef<HTMLElement|null>(null);
  const selected=state.items.find(item=>item.id===selectedId);
  const isPMO=user.role==='pmo'||user.role==='admin';
  const period=reportingPeriod(now,state.settings.timezone,state.settings.cutoffHour);
  const ready=state.workstreams.filter(w=>confirmationState(state,w.id,period.end).confirmed).length;
  const rows=overview.interventions.filter(({item,flags})=>queueFilter==='intervention'||queueFilter==='blocked'&&item.blocked||queueFilter==='overdue'&&flags.overdue||queueFilter==='client'&&item.stage==='Awaiting client acceptance');
  const registerRows=state.registers.map(register=>({register,flags:recordAttention(register,state.settings,now)}))
    .filter(({register,flags})=>register.status!=='resolved'&&(register.status==='escalated'||flags.overdue||flags.dueToday))
    .sort((a,b)=>Number(b.flags.alreadyEscalated)-Number(a.flags.alreadyEscalated)||Number(b.flags.escalationDue)-Number(a.flags.escalationDue)||Number(b.flags.overdue)-Number(a.flags.overdue)||a.register.dueDate.localeCompare(b.register.dueDate));
  const forecasts=[...overview.milestoneVariances].sort((a,b)=>Number(b.forecastBeyondBaseline)-Number(a.forecastBeyondBaseline)||a.forecastDate.localeCompare(b.forecastDate));
  const currentStages=kind==='software'?SOFTWARE_STAGES:GENERAL_STAGES;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60_000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{if(selectedId&&!state.items.some(item=>item.id===selectedId))setSelectedId(undefined);},[state.items,selectedId]);
  useEffect(()=>{if(contextPane.current)contextPane.current.scrollTop=0;},[selectedId]);

  function chooseItem(itemId:string,trigger:HTMLElement,fromRoutine=false){
    lastTrigger.current=trigger;setSelectedId(itemId);
    requestAnimationFrame(()=>{
      if(fromRoutine||window.matchMedia('(max-width: 1190px)').matches){
        panelHeading.current?.focus({preventScroll:true});panelHeading.current?.scrollIntoView({block:'start'});
      }
    });
  }
  function closeContext(){
    setSelectedId(undefined);
    requestAnimationFrame(()=>{if(lastTrigger.current?.isConnected&&lastTrigger.current.getClientRects().length)lastTrigger.current.focus();else queueHeading.current?.focus();});
  }
  function chooseFilter(filter:QueueFilter,trigger:HTMLElement){
    setQueueFilter(filter);lastTrigger.current=trigger;
    const matching=overview.interventions.filter(({item,flags})=>filter==='intervention'||filter==='blocked'&&item.blocked||filter==='overdue'&&flags.overdue||filter==='client'&&item.stage==='Awaiting client acceptance');
    if(!matching.some(({item})=>item.id===selectedId))setSelectedId(matching[0]?.item.id);
  }
  function openRegister(id:string){if(props.onRegister)props.onRegister(id);else navigate('registers');}
  function jumpToForecasts(){forecastHeading.current?.focus({preventScroll:true});forecastHeading.current?.scrollIntoView({block:'start'});}
  function workRow(row:OverviewRow,routine=false){
    const item=row.item;
    return <button key={item.id} className={'ov-work-row '+(routine?'ov-routine-row ':'')+(selectedId===item.id?'is-selected':'')} aria-pressed={selectedId===item.id} aria-controls={selected?'overview-context':undefined} onClick={event=>chooseItem(item.id,event.currentTarget,routine)}>
      {!routine&&<span className="ov-row-reason"><Badge tone={reasonTone(row)}>{reasonLabel(row)}</Badge></span>}
      <span className="ov-row-record">
        <span className="ov-row-reference">{state.workstreams.find(w=>w.id===item.workstreamId)?.shortName}<span aria-hidden="true"> · </span><span className="ov-code">{item.id}</span></span>
        <strong>{item.title}</strong>
        {!routine&&<span className="ov-row-next"><ArrowRight size={13}/><span>{item.nextAction||'Next action not yet recorded.'}</span></span>}
        <span className="ov-row-stage">{item.stage} <span aria-hidden="true">·</span> {item.kind==='software'?'Software':'General work'}</span>
      </span>
      <span className="ov-row-owner"><span className="ov-sr-only">Next action owner: </span><Avatar member={state.members.find(m=>m.id===item.currentOwnerId)} size={25}/><span>{memberName(state,item.currentOwnerId)}</span></span>
      <span className={'ov-row-target '+(row.flags.overdue?'ov-overdue':'')}><span className="ov-sr-only">Target: </span><strong>{formatDate(item.dueDate)}</strong><span>{row.flags.overdue?'Overdue':row.flags.dueToday?'Due today':routine?'Upcoming':'Target date'}</span></span>
      <ChevronRight className="ov-row-chevron" size={16}/>
    </button>;
  }

  return <div className="operational-overview">
    <header className="ov-page-heading">
      <div><div className="ov-dateline">{now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:state.settings.timezone})}<span>All use cases</span></div><h1>Delivery overview</h1><p>{counts.active} active work items. {counts.interventions?counts.interventions+' need intervention.':'No work is blocked, overdue, or awaiting a client response.'} {counts.dueSoon>0&&counts.dueSoon+' additional work items have due-date reminders.'}</p></div>
      <button className="button primary" onClick={startMeeting}><Play size={15}/>Run daily review</button>
    </header>
    <section className="ov-summary-strip" aria-label="Current project position">
      <button onClick={()=>navigate('delivery','intervention')}><span>Need intervention</span><strong>{counts.interventions}</strong><small>{counts.blocked} blocked · {counts.overdue} past target · {counts.awaitingClient} awaiting client</small></button>
      <button onClick={()=>navigate('delivery','escalation')}><span>Escalation due</span><strong className={counts.escalations?'ov-overdue':''}>{counts.escalations}</strong><small>Critical blockers, or blocked {state.settings.blockedEscalationDays}+ working days</small></button>
      <button onClick={()=>navigate('delivery','due-soon')}><span>Additional due soon</span><strong>{counts.dueSoon}</strong><small>Due today or matching the working-day reminder</small></button>
      <button onClick={jumpToForecasts}><span>Forecasts beyond baseline</span><strong>{counts.forecastsBeyondBaseline}</strong><small>Current target later than the original commitment</small></button>
      <button onClick={()=>navigate('reports')}><span>Use cases confirmed</span><strong>{ready}<em> / {state.workstreams.length}</em></strong><small>Current updates for week ending {formatDate(period.end)}</small></button>
    </section>

    <div className={'ov-review-layout '+(selected?'has-context':'')}>
      <div className="ov-working-column">
        <section className="ov-queue-section" aria-labelledby="overview-queue-heading">
          <div className="ov-section-heading"><div><h2 id="overview-queue-heading" ref={queueHeading} tabIndex={-1}>Intervention queue <span className="ov-inline-count">{rows.length}</span></h2><p>Blocked, past target, or awaiting client acceptance. Select a record for context.</p></div><button className="text-button" onClick={()=>navigate('delivery',queueFilter)}>Open in Delivery<ArrowUpRight size={14}/></button></div>
          <div className="ov-queue-filters" role="group" aria-label="Filter interventions">{([{id:'intervention',label:'All',count:counts.interventions},{id:'blocked',label:'Blocked',count:counts.blocked},{id:'overdue',label:'Past target',count:counts.overdue},{id:'client',label:'Awaiting client',count:counts.awaitingClient}] as const).map(filter=><button key={filter.id} aria-pressed={queueFilter===filter.id} onClick={event=>chooseFilter(filter.id,event.currentTarget)}>{filter.label}<span>{filter.count}</span></button>)}</div>
          <div className="ov-row-headings" aria-hidden="true"><span>Reason</span><span>Record & next action</span><span>Acts next</span><span>Target</span><span/></div>
          <div className="ov-work-list">{rows.map(row=>workRow(row))}{!rows.length&&<Empty title={queueFilter==='intervention'?'No intervention needed right now':'No records match this reason'}>{queueFilter==='intervention'?'Routine due dates and reporting confirmations remain visible below.':'Choose All to see the full intervention queue.'}</Empty>}</div>
          <div className="ov-section-foot"><span>Reasons can overlap; each work item appears once.</span>{selected&&<span>Selected records open alongside the queue.</span>}</div>
        </section>

        <section className="ov-routine-section" aria-label="Additional work due soon">
          <details className="ov-routine-disclosure"><summary><div><h2>Due soon <span className="ov-inline-count">{counts.dueSoon}</span></h2><p>Due today or matching the working-day reminder. Intervention records are excluded.</p></div><span className="ov-disclosure-action">Review due work<ChevronDown size={17}/></span></summary><div className="ov-routine-headings" aria-hidden="true"><span>Record</span><span>Acts next</span><span>Target</span><span/></div><div>{overview.dueSoon.map(row=>workRow(row,true))}{!overview.dueSoon.length&&<Empty title="No additional work is due in this window"/>}</div><button className="ov-list-link" onClick={()=>navigate('delivery','due-soon')}>Open this due-soon list in Delivery<ArrowUpRight size={15}/></button></details>
        </section>

        <section className="ov-register-section" aria-labelledby="overview-register-heading">
          <div className="ov-section-heading"><div><h2 id="overview-register-heading">Register follow-ups <span className="ov-inline-count">{registerRows.length}</span></h2><p>Open concerns that are escalated, overdue, or due today.</p></div><button className="text-button" onClick={()=>navigate('registers')}>All registers<ArrowUpRight size={14}/></button></div>
          <div className="ov-register-list">{registerRows.map(({register,flags})=><button className="ov-register-row" key={register.id} onClick={()=>openRegister(register.id)}><span><span className="ov-record-kind">{register.type} · {register.status}</span><strong>{register.title}</strong><span>{register.nextAction||'Next action not yet recorded.'}</span></span><span className="ov-register-owner">{memberName(state,register.ownerId)}<small className={flags.overdue?'ov-overdue':''}>{formatDate(register.dueDate)} · {flags.alreadyEscalated?'Escalated':flags.overdue?'Overdue':'Due today'}</small></span><ArrowUpRight size={15}/></button>)}{!registerRows.length&&<Empty title="No register follow-ups need attention today"/>}</div>
        </section>
      </div>

      {selected&&<aside ref={contextPane} id="overview-context" className="ov-context-pane" aria-labelledby="overview-context-heading" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeContext();}}}>
        <SelectedContext {...props} item={selected} headingRef={panelHeading} now={now} onClose={closeContext} onRegister={openRegister} onMilestone={setMilestone}/>
      </aside>}
    </div>

    <section className="ov-workstream-section" aria-labelledby="overview-workstream-heading">
      <div className="ov-section-heading"><div><h2 id="overview-workstream-heading">Across the use cases</h2><p>Health is the lead’s assessment. Confirmation records whether this week’s facts are current.</p></div><div className="ov-heading-actions">{isPMO&&<button className="text-button" onClick={()=>setStream('new')}><Plus size={14}/>Add use case</button>}<button className="button secondary small" onClick={()=>navigate('reports')}><FileCheck2 size={15}/>Prepare weekly report</button></div></div>
      <div className="ov-stream-headings" aria-hidden="true"><span>Use case / lead</span><span>Health & recorded position</span><span>Thursday confirmation</span><span>Delivery records</span></div>
      {state.workstreams.map(w=>{
        const confirmation=confirmationState(state,w.id,period.end);
        const timing=submissionTiming(period.end,state.settings,confirmation.confirmed?confirmation.submission?.confirmedAt:undefined,now);
        const confirmationLabel=confirmation.confirmed?(timing.late?'Confirmed late':'Confirmed'):confirmation.stale?(timing.overdue?'Reconfirmation overdue':'Changed since confirmation'):timing.overdue?'Confirmation overdue':'Not yet confirmed';
        const items=state.items.filter(i=>i.workstreamId===w.id);
        const closed=items.filter(i=>i.stage==='Closed'&&i.closedAt&&new Date(i.closedAt)<=now).length;
        const imported=items.filter(i=>i.stage==='Closed'&&i.importedFrom&&!i.closedAt).length;
        const editable=isPMO||w.leadId===user.id;
        return <div className="ov-stream-row" key={w.id}>
          <div><button className="ov-stream-name" onClick={()=>onWorkstream(w.id)}>{w.name}<ArrowUpRight size={14}/></button><span className="ov-secondary">{memberName(state,w.leadId)}</span></div>
          <div><button className="ov-health-button" onClick={()=>setStream(w.id)} aria-label={(editable?'Review health assessment for ':'View health assessment for ')+w.name}><Badge tone={w.health}>{healthLabel[w.health]}</Badge><span>{editable?'Review assessment':'View assessment'}<ArrowUpRight size={12}/></span></button><p>{w.statusNote||'No assessment recorded yet.'}</p></div>
          <div><span className={'ov-confirmation-status '+(confirmation.confirmed&&!timing.late?'ov-confirmed':timing.overdue?'ov-overdue':'')}>{confirmation.confirmed?<Check size={15}/>:<Clock3 size={15}/>} {confirmationLabel}</span><span className="ov-secondary">{confirmation.submission?'Last confirmed '+formatDate(confirmation.submission.confirmedAt,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:state.settings.timezone}):'Due '+formatDate(period.end)+' at '+String(state.settings.submissionHour).padStart(2,'0')+':00'}</span><button className="text-button" onClick={()=>navigate('reports')}>Review weekly update<ArrowUpRight size={12}/></button></div>
          <button className="ov-stream-records" onClick={()=>onWorkstream(w.id)}><strong>{closed}<span> / {items.length}</span></strong><span>closed with evidence / all records</span>{imported>0&&<small>{imported} imported closed; included in total</small>}<span className="ov-secondary">{items.filter(i=>i.stage!=='Closed').length} active</span></button>
        </div>;
      })}
      <footer className="ov-section-foot"><span>Week ending {formatDate(period.end)} · updates by {String(state.settings.submissionHour).padStart(2,'0')}:00 · report cutoff {String(state.settings.cutoffHour).padStart(2,'0')}:00 · {state.settings.timezone}</span></footer>
    </section>

    <section className="ov-forecast-section" aria-labelledby="overview-forecast-heading">
      <div className="ov-section-heading"><div><h2 id="overview-forecast-heading" ref={forecastHeading} tabIndex={-1}>Milestone outlook</h2><p>Current forecast against baseline, in calendar days. Actual completion stays separate.</p></div>{isPMO&&<button className="text-button" onClick={()=>setNewMilestone(true)}><Plus size={15}/>Add milestone</button>}</div>
      <div className="ov-forecast-headings" aria-hidden="true"><span>Milestone</span><span>Baseline</span><span>Forecast</span><span>Variance</span><span>Actual</span><span/></div>
      {forecasts.map(({milestone:m,calendarDays})=><button key={m.id} className="ov-forecast-row" onClick={()=>setMilestone(m)}><span><strong>{m.title}</strong><small>{memberName(state,m.ownerId)} · {m.status==='at_risk'?'At risk':m.status==='complete'?'Complete':'Planned'}</small></span><span data-label="Baseline">{formatDate(m.baselineDate)}</span><span data-label="Forecast">{formatDate(m.forecastDate)}</span><span data-label="Variance" className={calendarDays!==null&&calendarDays>0?'ov-variance':''}>{varianceLabel(calendarDays)}</span><span data-label="Actual">{m.actualDate?formatDate(m.actualDate):'Not recorded'}</span><ArrowUpRight size={15}/></button>)}
      {!forecasts.length&&<Empty title="No milestones recorded"/>}
    </section>

    <section className="ov-flow-section" aria-label="Delivery stage counts">
      <div className="ov-section-heading"><div><h2>Delivery position</h2><p>Current item counts at each stage. Select a stage to open its work.</p></div><div className="ov-flow-switch" role="group" aria-label="Delivery workflow">{(['software','general'] as const).map(value=><button key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{value==='software'?'Software changes':'General work'}</button>)}</div></div>
      <div className={'ov-flow-counts '+(kind==='general'?'is-general':'')}>{currentStages.map((stage,index)=>{const items=state.items.filter(i=>i.kind===kind&&i.stage===stage);const blocked=items.filter(i=>i.stage!=='Closed'&&i.blocked).length;return <button key={stage} onClick={()=>onStage(kind,stage)} aria-label={stage+': '+items.length+' items'+(blocked?', '+blocked+' blocked':'')}><span>{stage}</span><strong>{items.length}</strong><small>{blocked?blocked+' blocked':stage==='Closed'?'Closed records':'View work'}</small>{index<currentStages.length-1&&<ChevronRight size={13} className="ov-flow-arrow"/>}</button>;})}</div>
    </section>

    <footer className="ov-page-footer"><span>{counts.recordedClosures} recorded acceptances / completed reviews{counts.importedClosed?' · '+counts.importedClosed+' imported closed':''}. Delivery history stays with each record.</span><button className="text-button" onClick={()=>setHistory(true)}>View project history<ArrowUpRight size={14}/></button></footer>
    {(milestone||newMilestone)&&<MilestoneForm {...props} milestone={milestone} onClose={()=>{setMilestone(undefined);setNewMilestone(false);}}/>}
    {stream&&<WorkstreamEditor {...props} id={stream} onClose={()=>setStream(undefined)}/>}
    {history&&<AuditHistory {...props} onClose={()=>setHistory(false)}/>}
  </div>;
}

function SelectedContext({item,headingRef,now,onClose,onRegister,onMilestone,...props}:PageProps&{
  item:WorkItem;headingRef:RefObject<HTMLHeadingElement|null>;now:Date;onClose:()=>void;
  onRegister:(id:string)=>void;onMilestone:(milestone:Milestone)=>void;
}){
  const {state,openItem}=props;
  const context=selectWorkContext(state,item.id);
  const flags=recordAttention(item,state.settings,now);
  const variances=selectOverview(state,now).milestoneVariances;
  const findings=state.tests.filter(test=>test.itemId===item.id&&test.result==='fail'&&test.blocking&&!test.resolvedAt);
  const relatedIds=[...new Set(context.registers.flatMap(({register})=>register.relatedItemIds))].filter(id=>id!==item.id);
  const isImported=item.stage==='Closed'&&item.importedFrom&&!item.closedAt;
  const why=item.stage==='Closed'?(isImported?'The source backlog marked this record closed. No acceptance date is claimed.':'Acceptance or completed review was recorded '+formatDate(item.closedAt)+'.'):
    flags.escalationDue?(item.priority==='Critical'?'This blocked commitment is Critical and needs an escalation review.':'This commitment has been blocked for '+flags.blockedWorkingDays+' working days; the escalation threshold is '+state.settings.blockedEscalationDays+'.'):
    item.blocked?'A recorded blocker prevents this work advancing.':
    flags.overdue?'The current target date has passed.':
    item.stage==='Awaiting client acceptance'?'An actual client response and supporting evidence are required before this work can close.':
    flags.dueToday?'This commitment is due today.':
    flags.dueReminder?'The configured working-day reminder is active for this target date.':'Review the current stage and the next recorded action.';
  return <>
    <header className="ov-context-heading"><div><span className="ov-context-label">Selected record</span><h2 id="overview-context-heading" ref={headingRef} tabIndex={-1}>{item.title}</h2><span className="ov-code">{item.id}</span><button className="button primary ov-open-record" onClick={()=>openItem(item.id)}>Open delivery record<ArrowUpRight size={16}/></button></div><button className="icon-button" onClick={onClose} aria-label="Close selected record and return to the queue"><X size={18}/></button></header>
    <div className="ov-context-body">
      <div className="ov-context-chips"><Badge tone={item.blocked&&item.stage!=='Closed'?'red':item.stage==='Closed'?'green':'neutral'}>{isImported?'Imported closed':item.stage}</Badge><span>{item.kind==='software'?'Software change':'General work'}</span><span>{item.priority} priority</span><span>Cycle {item.cycle}</span></div>
      <dl className="ov-owner-grid">
        <div><dt>Accountable owner</dt><dd><Avatar member={state.members.find(m=>m.id===item.ownerId)} size={26}/>{memberName(state,item.ownerId)}</dd><small>Owns the outcome</small></div>
        <div><dt>Next action owner</dt><dd><Avatar member={state.members.find(m=>m.id===item.currentOwnerId)} size={26}/>{memberName(state,item.currentOwnerId)}</dd><small>Acts next</small></div>
        <div><dt>Baseline</dt><dd className="ov-code">{item.baselineDate?formatDate(item.baselineDate):'Not set'}</dd></div>
        <div><dt>Current target</dt><dd className={'ov-code '+(flags.overdue?'ov-overdue':'')}>{item.dueDate?formatDate(item.dueDate):'Not set'}</dd>{flags.overdue&&<small className="ov-overdue">{flags.overdueWorkingDays>0?flags.overdueWorkingDays+' working '+(flags.overdueWorkingDays===1?'day':'days')+' overdue':'Target date has passed'}</small>}</div>
      </dl>
      <section className="ov-context-section"><h3>Why it is here</h3><p>{why}</p>{findings.length>0&&<p className="ov-finding-note"><AlertTriangle size={15}/><span>{findings.length} unresolved blocking {findings.length===1?'finding prevents':'findings prevent'} the next handover, including findings from earlier cycles.</span></p>}</section>
      {item.blocked&&item.stage!=='Closed'&&<section className="ov-context-section ov-recorded-blocker"><h3>Recorded blocker</h3><p>{item.blockReason||'Blocker detail not recorded.'}</p>{item.blockedSince&&<small>Blocked since {formatDate(item.blockedSince,{day:'numeric',month:'short',timeZone:state.settings.timezone})} · {flags.blockedWorkingDays} working days</small>}</section>}
      <section className="ov-context-section ov-next-action"><h3><ArrowRight size={15}/>Next action</h3><p>{item.nextAction||'Define a concrete next step in the delivery record.'}</p></section>

      <section className="ov-linked-context" aria-label="Recorded links for selected work">
        <div className="ov-linked-heading"><Link2 size={16}/><h3>Linked delivery context</h3></div>
        <p className="ov-link-explanation">Recorded links from registers and deliverables.</p>
        <div className="ov-relationship-step"><span className="ov-relationship-label">Related concerns</span>
          {context.registers.map(({register})=><article className="ov-concern" key={register.id}><span className="ov-record-kind">{register.type} · {register.status}{register.status==='resolved'?' · historical context':''}</span><button className="ov-context-link" onClick={()=>onRegister(register.id)}><strong>{register.title}</strong><ArrowUpRight size={14}/></button><span className="ov-secondary">{memberName(state,register.ownerId)} · {formatDate(register.dueDate)}</span><p>{register.nextAction||register.detail}</p></article>)}
          {!context.registers.length&&<p className="ov-context-empty">No register entry links directly to this work.</p>}
        </div>
        <div className="ov-relationship-anchor"><span className="ov-relationship-label">Related work</span><strong>{item.title}</strong><span>{memberName(state,item.currentOwnerId)} acts next</span></div>
        <div className="ov-relationship-step"><span className="ov-relationship-label">Associated milestones</span>
          {context.milestones.map(({milestone,links})=>{const variance=variances.find(v=>v.milestone.id===milestone.id);return <article className="ov-associated-milestone" key={milestone.id}><span className="ov-record-kind">{milestone.status==='at_risk'?'At risk':milestone.status==='complete'?'Complete':'Planned'}</span><button className="ov-context-link" onClick={()=>onMilestone(milestone)}><strong>{milestone.title}</strong><ArrowUpRight size={14}/></button><div className="ov-linked-dates"><span>Baseline <strong>{formatDate(milestone.baselineDate)}</strong></span><ArrowRight size={13}/><span>Forecast <strong>{formatDate(milestone.forecastDate)}</strong></span></div><span className={variance?.forecastBeyondBaseline?'ov-variance':'ov-secondary'}>{varianceLabel(variance?.calendarDays??null)}</span>{milestone.actualDate&&<span className="ov-secondary">Actual completion {formatDate(milestone.actualDate)}</span>}<ul className="ov-link-provenance">{links.map(link=><li key={link.kind==='via_register'?'register:'+link.registerId:'deliverable:'+link.deliverableId}>{link.kind==='via_register'?'Linked through register: '+(state.registers.find(r=>r.id===link.registerId)?.title||link.registerId):'Deliverable membership: '+(state.deliverables.find(d=>d.id===link.deliverableId)?.title||link.deliverableId)}</li>)}</ul></article>;})}
          {!context.milestones.length&&<p className="ov-context-empty">No milestone association is recorded through a register or deliverable.</p>}
        </div>
        {relatedIds.length>0&&<details className="ov-related-work"><summary>Other work linked to these concerns <span>{relatedIds.length}</span></summary>{relatedIds.map(id=>{const sibling=state.items.find(i=>i.id===id);return sibling&&<button key={id} className="ov-context-link" onClick={()=>openItem(id)}><span>{sibling.title}</span><ArrowUpRight size={14}/></button>;})}</details>}
      </section>

      <details className="ov-definition"><summary>Definition & acceptance criteria<ChevronDown size={16}/></summary><h3>Context</h3><p>{item.description||'No additional context recorded.'}</p><h3>Acceptance criteria</h3><p>{item.acceptanceCriteria||'Define acceptance criteria before work starts.'}</p></details>
      {item.evidenceLinks.length>0&&<section className="ov-context-section"><h3>Evidence & references</h3><div className="ov-evidence-list">{item.evidenceLinks.map(link=><SafeLink key={link} href={link}/>)}</div></section>}
    </div>
  </>;
}
