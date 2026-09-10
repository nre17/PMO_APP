import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowRight, ArrowUpRight, AlertTriangle, ChevronDown, ChevronRight, Link2, Play, X } from 'lucide-react';
import { type PageProps, type Milestone, type WorkItem } from '../shared/types';
import { recordAttention } from '../shared/reporting';
import { Avatar, Badge, Empty, SafeLink, formatDate, memberName } from './ui';
import { MilestoneForm } from './Delivery';
import { itemEscalations } from './EscalateWork';
import { AuditHistory } from './OverviewExtras';
import { selectOverview, selectWorkContext, type OverviewRow } from './overview-model';
import './overview.css';

type DashboardProps = PageProps & {
  navigate:(page:string,filter?:string)=>void;
  startMeeting:()=>void;
  onRegister?:(id:string)=>void;
};
type QueueFilter='intervention'|'escalation'|'blocked'|'overdue'|'client';
const reasonLabel=(row:OverviewRow)=>({escalation:'Needs escalation',blocked:'Blocked',overdue:'Past target',client:'Awaiting client',due_today:'Due today',due_soon:'Due soon'})[row.reason||'due_soon'];
const reasonTone=(row:OverviewRow)=>row.reason==='escalation'||row.reason==='blocked'?'red':row.reason==='overdue'||row.reason==='due_today'?'amber':'neutral';
const varianceLabel=(days:number|null)=>days===null?'Dates not set':days===0?'On baseline':(days>0?'+':'')+days+' calendar '+(Math.abs(days)===1?'day':'days');

export default function Dashboard(props:DashboardProps){
  const {state,navigate,startMeeting}=props;
  const [now,setNow]=useState(()=>new Date());
  const overview=useMemo(()=>selectOverview(state,now),[state,now]);
  const {counts}=overview;
  const [selectedId,setSelectedId]=useState<string|undefined>(()=>typeof window!=='undefined'&&window.matchMedia?.('(max-width: 1190px)').matches?undefined:overview.interventions[0]?.item.id);
  const [queueFilter,setQueueFilter]=useState<QueueFilter>('intervention');
  const [milestone,setMilestone]=useState<Milestone>();
  const [history,setHistory]=useState(false);
  const panelHeading=useRef<HTMLHeadingElement>(null);const queueHeading=useRef<HTMLHeadingElement>(null);const contextPane=useRef<HTMLElement>(null);
  const lastTrigger=useRef<HTMLElement|null>(null);
  const selected=state.items.find(item=>item.id===selectedId);
  const raisedIds=new Set(state.items.filter(item=>itemEscalations(state,item.id).some(register=>register.status!=='resolved')).map(item=>item.id));
  const needsEscalation=overview.interventions.filter(row=>row.flags.escalationDue&&!raisedIds.has(row.item.id));
  const matchesFilter=({item,flags}:OverviewRow,filter:QueueFilter)=>filter==='intervention'||filter==='escalation'&&flags.escalationDue&&!raisedIds.has(item.id)||filter==='blocked'&&item.blocked||filter==='overdue'&&flags.overdue||filter==='client'&&item.stage==='Awaiting client acceptance';
  const rows=overview.interventions.filter(row=>matchesFilter(row,queueFilter));
  const registerRows=state.registers.map(register=>({register,flags:recordAttention(register,state.settings,now)}))
    .filter(({register,flags})=>register.status!=='resolved'&&(register.status==='escalated'||flags.overdue||flags.dueToday))
    .sort((a,b)=>Number(b.flags.alreadyEscalated)-Number(a.flags.alreadyEscalated)||Number(b.flags.escalationDue)-Number(a.flags.escalationDue)||Number(b.flags.overdue)-Number(a.flags.overdue)||a.register.dueDate.localeCompare(b.register.dueDate));
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
    const matching=overview.interventions.filter(row=>matchesFilter(row,filter));
    if(!matching.some(({item})=>item.id===selectedId))setSelectedId(matching[0]?.item.id);
  }
  function openRegister(id:string){if(props.onRegister)props.onRegister(id);else navigate('registers');}
  function workRow(row:OverviewRow,routine=false){
    const item=row.item;
    return <button key={item.id} className={'ov-work-row '+(routine?'ov-routine-row ':'')+(selectedId===item.id?'is-selected':'')} aria-pressed={selectedId===item.id} aria-controls={selected?'overview-context':undefined} onClick={event=>chooseItem(item.id,event.currentTarget,routine)}>
      {!routine&&<span className="ov-row-reason"><Badge tone={reasonTone(row)}>{raisedIds.has(item.id)?'Escalation raised':reasonLabel(row)}</Badge></span>}
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

  return <div className="operational-overview attention-view">
    <header className="attention-intro"><div><h2>What needs a decision</h2><p>{counts.interventions?counts.interventions+' work items need attention. Select one to see its next action and connected risks.':'No work is blocked, overdue, or awaiting a client response.'}</p></div><button className="button primary" onClick={startMeeting}><Play size={15}/>Run daily review</button></header>
    <div className="attention-process" aria-label="Escalation workflow"><span>Identify the concern</span><ArrowRight size={14}/><span>Assign a decision owner</span><ArrowRight size={14}/><span>Record the outcome</span><button className="text-button attention-raised-link" onClick={()=>navigate('registers')}>Track escalations<ArrowUpRight size={14}/></button></div>

    <div className={'ov-review-layout '+(selected?'has-context':'')}>
      <div className="ov-working-column">
        <section className="ov-queue-section" aria-labelledby="overview-queue-heading">
          <div className="ov-section-heading"><div><h2 id="overview-queue-heading" ref={queueHeading} tabIndex={-1}>Attention queue <span className="ov-inline-count">{rows.length}</span></h2><p>Blocked, past target, or awaiting client acceptance. Select a record for context.</p></div></div>
          <div className="ov-queue-filters" role="group" aria-label="Filter interventions">{([{id:'intervention',label:'All',count:counts.interventions},{id:'escalation',label:'Needs escalation',count:needsEscalation.length},{id:'blocked',label:'Blocked',count:counts.blocked},{id:'overdue',label:'Past target',count:counts.overdue},{id:'client',label:'Awaiting client',count:counts.awaitingClient}] as const).map(filter=><button key={filter.id} aria-pressed={queueFilter===filter.id} onClick={event=>chooseFilter(filter.id,event.currentTarget)}>{filter.label}<span>{filter.count}</span></button>)}</div>
          <div className="ov-row-headings" aria-hidden="true"><span>Reason</span><span>Record & next action</span><span>Acts next</span><span>Target</span><span/></div>
          <div className="ov-work-list">{rows.map(row=>workRow(row))}{!rows.length&&<Empty title={queueFilter==='intervention'?'No intervention needed right now':'No records match this reason'}>{queueFilter==='intervention'?'Open All work to plan the next commitment.':'Choose All to see the full intervention queue.'}</Empty>}</div>
          <div className="ov-section-foot"><span>Reasons can overlap; each work item appears once.</span>{selected&&<span>Selected records open alongside the queue.</span>}</div>
        </section>

        <section className="ov-routine-section" aria-label="Additional work due soon">
          <details className="ov-routine-disclosure"><summary><div><h2>Due soon <span className="ov-inline-count">{counts.dueSoon}</span></h2><p>Due today or matching the working-day reminder. Intervention records are excluded.</p></div><span className="ov-disclosure-action">Review due work<ChevronDown size={17}/></span></summary><div className="ov-routine-headings" aria-hidden="true"><span>Record</span><span>Acts next</span><span>Target</span><span/></div><div>{overview.dueSoon.map(row=>workRow(row,true))}{!overview.dueSoon.length&&<Empty title="No additional work is due in this window"/>}</div><button className="ov-list-link" onClick={()=>navigate('delivery','due-soon')}>Open due-soon work<ArrowUpRight size={15}/></button></details>
        </section>

        <section className="ov-register-section" aria-labelledby="overview-register-heading">
          <div className="ov-section-heading"><div><h2 id="overview-register-heading">Escalations & decisions <span className="ov-inline-count">{registerRows.length}</span></h2><p>Open concerns that are escalated, overdue, or due today.</p></div><button className="text-button" onClick={()=>navigate('registers')}>All risks & decisions<ArrowUpRight size={14}/></button></div>
          <div className="ov-register-list">{registerRows.map(({register,flags})=><button className="ov-register-row" key={register.id} onClick={()=>openRegister(register.id)}><span><span className="ov-record-kind">{register.type} · {register.status}</span><strong>{register.title}</strong><span>{register.nextAction||'Next action not yet recorded.'}</span></span><span className="ov-register-owner">{memberName(state,register.ownerId)}<small className={flags.overdue?'ov-overdue':''}>{formatDate(register.dueDate)} · {flags.alreadyEscalated?'Escalated':flags.overdue?'Overdue':'Due today'}</small></span><ArrowUpRight size={15}/></button>)}{!registerRows.length&&<Empty title="No register follow-ups need attention today"/>}</div>
        </section>
      </div>

      {selected&&<aside ref={contextPane} id="overview-context" className="ov-context-pane" aria-labelledby="overview-context-heading" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeContext();}}}>
        <SelectedContext {...props} item={selected} headingRef={panelHeading} now={now} onClose={closeContext} onRegister={openRegister} onMilestone={setMilestone}/>
      </aside>}
    </div>

    <footer className="ov-page-footer"><span>{counts.recordedClosures} recorded acceptances / completed reviews{counts.importedClosed?' · '+counts.importedClosed+' imported closed':''}. Delivery history stays with each record.</span><button className="text-button" onClick={()=>setHistory(true)}>View project history<ArrowUpRight size={14}/></button></footer>
    {milestone&&<MilestoneForm {...props} milestone={milestone} onClose={()=>setMilestone(undefined)}/>}
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
    <header className="ov-context-heading"><div><span className="ov-context-label">Selected record</span><h2 id="overview-context-heading" ref={headingRef} tabIndex={-1}>{item.title}</h2><span className="ov-code">{item.id}</span><button className="button primary ov-open-record" onClick={()=>openItem(item.id)}>Open work record<ArrowUpRight size={16}/></button></div><button className="icon-button" onClick={onClose} aria-label="Close selected record and return to the queue"><X size={18}/></button></header>
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
      <section className="ov-context-section ov-next-action"><h3><ArrowRight size={15}/>Next action</h3><p>{item.nextAction||'Define a concrete next step in the work record.'}</p></section>

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
