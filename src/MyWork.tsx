import { ArrowRight, ArrowUpRight, ListTodo } from 'lucide-react';
import type { PageProps } from '../shared/types';
import { Avatar, Badge, Empty, formatDate } from './ui';
import { recordAttention, reportingPeriod, confirmationState, submissionTiming } from '../shared/reporting';
export default function MyWork(props:PageProps&{navigate:(page:string,filter?:string)=>void}) {
  const {state,user,openItem,navigate}=props;
  const now=new Date();
  const urgency=(flags:ReturnType<typeof recordAttention>)=>Number(flags.escalationDue)*8+Number(flags.overdue)*4+Number(flags.dueToday)*2+Number(flags.dueReminder);
  const items=state.items.filter(i=>i.currentOwnerId===user.id&&i.stage!=='Closed').map(item=>({item,flags:recordAttention(item,state.settings,now)})).sort((a,b)=>urgency(b.flags)-urgency(a.flags)||a.item.dueDate.localeCompare(b.item.dueDate));
  const regs=state.registers.filter(r=>r.ownerId===user.id&&r.status!=='resolved').map(record=>({record,flags:recordAttention(record,state.settings,now)})).sort((a,b)=>urgency(b.flags)-urgency(a.flags)||a.record.dueDate.localeCompare(b.record.dueDate));
  const reminder=(flags:ReturnType<typeof recordAttention>,dueDate:string)=>[
    flags.escalationDue?'Escalation review':'',
    flags.overdue?'Overdue':flags.dueToday?'Due today':flags.dueReminder?(state.settings.workingDays.includes(new Date(`${dueDate}T12:00:00Z`).getUTCDay())?'Due next working day':'Due before next working day'):'',
  ].filter(Boolean).join(' · ');
  const periodEnd=reportingPeriod(now,state.settings.timezone,state.settings.cutoffHour).end;
  const managedStreams=state.workstreams.filter(w=>['pmo','admin'].includes(user.role)||(user.role==='lead'&&w.leadId===user.id));
  const dueSoon=items.filter(({flags})=>flags.dueToday||flags.dueReminder).length;
  return <>
    <div className="page-header"><div><div className="eyebrow">Your next moves</div><h1 className="page-title">My work</h1><p className="page-subtitle">What needs your attention, {user.name.split(' ')[0]}.</p></div><Avatar member={user} size={48}/></div>
    <div className="actions-summary"><span><strong>{items.length}</strong> active commitments</span><span><strong>{items.filter(({flags})=>flags.overdue).length}</strong> overdue</span><span><strong>{dueSoon}</strong> due soon</span><span><strong>{regs.length}</strong> open follow-ups</span></div>
    <section className="panel"><div className="panel-header"><h2>Assigned to you</h2><Badge>{user.title}</Badge></div>{items.length?<div className="attention-list">{items.map(({item:i,flags})=><button className="attention-row" key={i.id} onClick={()=>openItem(i.id)}><div className="item-stage-icon"><ListTodo size={19}/></div><div><strong>{i.title}</strong><span>{i.id} · {i.nextAction}</span>{reminder(flags,i.dueDate)&&<span style={{color:flags.escalationDue||flags.overdue?'#a3374b':'#8c5a19',fontWeight:600}}>{reminder(flags,i.dueDate)}</span>}</div><Badge tone={flags.escalationDue?'red':i.blocked?'amber':'neutral'}>{i.blocked?'Blocked':i.stage}</Badge><span className={flags.overdue?'date-overdue':'muted'}>{formatDate(i.dueDate)}</span><ArrowUpRight size={16}/></button>)}</div>:<Empty title="Your queue is clear">Items assigned to you will appear here immediately.</Empty>}</section>
    <div className="overview-bottom">
      <section className="panel"><div className="panel-header"><h2>Your follow-ups</h2></div>{regs.length?regs.map(({record:r,flags})=><button className="attention-row" key={r.id} onClick={()=>navigate('registers')}><div><strong>{r.title}</strong><span>{r.type} · {r.nextAction}</span><span style={reminder(flags,r.dueDate)?{color:flags.escalationDue||flags.overdue?'#a3374b':'#8c5a19',fontWeight:600}:undefined}>{reminder(flags,r.dueDate)||'Upcoming follow-up'} · {formatDate(r.dueDate)}</span></div><Badge tone={flags.escalationDue?'red':'amber'}>{r.status}</Badge><ArrowUpRight size={16}/></button>):<Empty title="No open register items"/>}</section>
      <section className="panel"><div className="panel-header"><h2>Weekly responsibilities</h2></div><div className="panel-body"><p className="muted">{managedStreams.length?'Review the use case summaries and confirm the week’s progress.':'Keep your commitments current so your use case lead can confirm the weekly update.'}</p>
        {managedStreams.map(stream=>{
          const ready=confirmationState(state,stream.id,periodEnd);
          const timing=submissionTiming(periodEnd,state.settings,ready.confirmed?ready.submission?.confirmedAt:undefined,now);
          const status=ready.confirmed?(timing.late?'Confirmed late':'Confirmed'):ready.stale?(timing.overdue?'Reconfirmation overdue':'Needs reconfirmation'):timing.overdue?'Confirmation overdue':'Confirmation due';
          return <button className="attention-row" key={stream.id} onClick={()=>navigate('reports')}><div><strong>{stream.shortName}</strong><span>Confirm by {formatDate(timing.deadlineAt,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:state.settings.timezone})} · {state.settings.timezone}</span></div><Badge tone={timing.overdue?'red':ready.confirmed&&!timing.late?'green':'amber'}>{status}</Badge></button>;
        })}
        {user.canApproveReports&&<div className="notice">You can approve client briefs for publication.</div>}<button className="button secondary" onClick={()=>navigate('reports')}>Open reporting<ArrowRight size={16}/></button></div></section>
    </div>
  </>;
}
