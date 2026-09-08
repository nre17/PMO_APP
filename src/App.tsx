import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, ListTodo, Layers3, ShieldAlert, FileText, Search, Plus, Settings2, HelpCircle, X, RefreshCw, AlertTriangle, CircleCheck, ArrowUpRight, Command, ChevronDown, Flag, Archive, Users, PanelsTopLeft, ChevronRight } from 'lucide-react';
import type { Bootstrap, PageProps, Report, Stage, WorkflowKind } from '../shared/types';
import { api } from './api';
import { Avatar, Modal, canEdit, Empty } from './ui';
import { Delivery, ItemDetail, ItemForm } from './Delivery';
import { Reports, ReportPresentation } from './Reports';
import { Registers } from './Registers';
import { MeetingWorkspace } from './Meetings';
import Dashboard from './Dashboard';
import MyWork from './MyWork';
import ProjectSettings from './ProjectSettings';
import Portfolio from './Portfolio';
import Sources from './Sources';
import { WorkstreamEditor } from './OverviewExtras';

const navigation = [
  {id:'sources',label:'Project sources',short:'Sources',icon:FileText},
  {id:'overview',label:'Use case portfolio',short:'Portfolio',icon:PanelsTopLeft},
  {id:'operations',label:'Delivery overview',short:'Overview',icon:LayoutDashboard},
  {id:'my-actions',label:'My work',short:'My work',icon:ListTodo},
  {id:'delivery',label:'Delivery',short:'Delivery',icon:Layers3},
  {id:'registers',label:'Risks & decisions',short:'Risks',icon:ShieldAlert},
  {id:'milestones',label:'Milestones',short:'Milestones',icon:Flag},
  {id:'reports',label:'Weekly report',short:'Report',icon:FileText},
  {id:'approved-briefs',label:'Approved briefs',short:'Briefs',icon:Archive},
];
const currentPage = () => navigation.some(n=>n.id===location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
export default function App() { return location.pathname.startsWith('/brief/') ? <BriefRoute/> : <Workspace/>; }

function BriefRoute() {
  const [report,setReport]=useState<Report>(); const [error,setError]=useState('');
  useEffect(()=>{api(`/api/reports/${encodeURIComponent(location.pathname.split('/')[2])}/presentation`).then(r=>setReport(r.report||r)).catch(()=>{});},[]);
  return <div className="presentation-shell"><div className="presentation-toolbar"><a className="button secondary" href="/#reports">Back to workspace</a><button className="button primary" onClick={()=>window.print()}>Print / save PDF</button></div>{error?<div role="alert" className="notice notice-warning">{error}</div>:report?<ReportPresentation report={report}/>:<div className="loading-screen">Opening approved brief…</div>}</div>;
}

function Workspace() {
  const [boot,setBoot]=useState<Bootstrap>(); const [error,setError]=useState(''); const [page,setPage]=useState(currentPage);
  const [toast,setToast]=useState<{text:string;error:boolean}>(); const [selected,setSelected]=useState<string>();
  const [create,setCreate]=useState(false); const [settings,setSettings]=useState(false); const [meeting,setMeeting]=useState(false); const [help,setHelp]=useState(false); const [searchOpen,setSearchOpen]=useState(false);
  const [search,setSearch]=useState(''); const [workstream,setWorkstream]=useState('all'); const [deliveryFilter,setDeliveryFilter]=useState('all');
  const [deliveryStage,setDeliveryStage]=useState<Stage>(); const [deliveryKind,setDeliveryKind]=useState<WorkflowKind>();
  const [registerSelection,setRegisterSelection]=useState<{id:string;key:number}>();
  const [portfolioSelection,setPortfolioSelection]=useState<{id:string;key:number}>();
  const [editingWorkstream,setEditingWorkstream]=useState<string>();
  const loadGeneration=useRef(0);
  const load=useCallback(async()=>{const generation=++loadGeneration.current;try{const response=await api<Bootstrap>('/api/bootstrap');if(generation===loadGeneration.current){setBoot(response);setError('');}return response;}catch(error){if(generation===loadGeneration.current)setError((error as Error).message);throw error;}},[]);
  useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')load().catch(()=>{});};refresh();const change=()=>{setPage(currentPage());window.scrollTo({top:0});};window.addEventListener('hashchange',change);window.addEventListener('focus',refresh);const timer=setInterval(refresh,60000);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('focus',refresh);clearInterval(timer);};},[load]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(undefined),6500);return()=>clearTimeout(timer);},[toast]);
  const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
  const mutate=useCallback(async(path:string,body?:unknown,method?:string)=>{const result=await api(path,body,method);await load().catch(()=>{});return result;},[load]);
  function navigate(id:string,filter='all') {location.hash=id;setPage(id);window.scrollTo({top:0});setWorkstream('all');setDeliveryFilter(filter);setDeliveryStage(undefined);setDeliveryKind(undefined);setRegisterSelection(undefined);setSearch('');}
  function openRegister(id:string){navigate('registers');setRegisterSelection({id,key:Date.now()});}
  function openUseCase(id:string){navigate('overview');setPortfolioSelection({id,key:Date.now()});}
  if(!boot)return <div className="loading-screen"><span className="brand-mark"><ChevronRight size={26}/></span><h1>Phase Two</h1>{error?<><p role="alert">{error}</p><button className="button primary" onClick={()=>load().catch(()=>{})}><RefreshCw size={16}/>Try again</button></>:<><span className="loading-bar"/><p>Opening the project workspace…</p></>}</div>;
  const {state}=boot; const user=state.members.find(m=>m.id===boot.currentUserId)||state.members[0];
  const props:PageProps={state,user,mutate,notify,openItem:setSelected,aiAvailable:boot.aiAvailable};
  const item=state.items.find(i=>i.id===selected);const assigned=state.items.filter(i=>i.currentOwnerId===user.id&&i.stage!=='Closed').length;
  const navLinks=(ids:string[],mobile=false)=>navigation.filter(n=>ids.includes(n.id)).map(n=><a key={n.id} href={`#${n.id}`} onClick={()=>navigate(n.id)} aria-current={page===n.id?'page':undefined} className={`nav-item ${page===n.id?'active':''}`}><n.icon size={17}/><span>{mobile?n.short:n.label}</span>{!mobile&&n.id==='my-actions'&&assigned>0&&<span className="nav-count">{assigned}</span>}</a>);
  return <div className="app-shell">
    <a className="skip-link" href="#page-content" onClick={e=>{e.preventDefault();document.getElementById('page-content')?.focus();}}>Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#overview" onClick={()=>navigate('overview')}><span className="brand-mark"><ChevronRight size={26}/></span><span>Phase Two<small>AI programme office</small></span></a><div className="workspace-label"><div><strong>{state.settings.projectName.split(' · ')[0]}</strong><span>{state.settings.phaseName}</span></div></div><nav aria-label="Main navigation"><div className="nav-group"><span className="nav-group-label">Programme</span>{navLinks(['overview','operations','my-actions','delivery'])}</div><div className="nav-group"><span className="nav-group-label">Records</span>{navLinks(['registers','milestones','sources'])}<button className="nav-item" onClick={()=>setMeeting(true)}><Users size={17}/><span>Meetings</span></button></div><div className="nav-group"><span className="nav-group-label">Reporting</span>{navLinks(['reports','approved-briefs'])}</div></nav><div className="sidebar-bottom"><button className="nav-item" onClick={()=>setHelp(true)}><HelpCircle size={17}/>How it works</button><button className="nav-item" onClick={()=>setSettings(true)}><Settings2 size={17}/>Project settings</button><div className="workspace-person"><Avatar member={user} size={32}/><div><strong>{user.name}</strong><span>{user.role==='pmo'?'PMO':user.role.charAt(0).toUpperCase()+user.role.slice(1)} · Local preview</span></div></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><span>{state.settings.projectName.split(' · ')[0]}</span><span className="breadcrumb-slash">/</span><strong>{navigation.find(n=>n.id===page)?.label}</strong></div><div className="topbar-actions"><button className="global-search" onClick={()=>setSearchOpen(true)} aria-label="Search the hub"><Search size={17}/><span>Search the hub…</span><kbd><Command size={11}/>K</kbd></button><button className="icon-button" aria-label="Refresh project data" onClick={()=>load().then(()=>notify('Project data refreshed')).catch(e=>notify(e.message,true))}><RefreshCw size={17}/></button><button className="icon-button mobile-settings" aria-label="Project settings" onClick={()=>setSettings(true)}><Settings2 size={18}/></button><div className="persona-switch"><Avatar member={user} size={30}/><label><span>Preview as</span><select aria-label="Demo persona" value={user.id} onChange={e=>mutate('/api/demo/persona',{userId:e.target.value}).then(()=>notify('Demo persona changed')).catch(e=>notify(e.message,true))}>{state.members.map(m=><option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}</select></label><ChevronDown size={12}/></div>{canEdit(user)&&!['overview','delivery','milestones'].includes(page)&&<button className="button primary global-create" onClick={()=>setCreate(true)}><Plus size={16}/><span>Add work</span></button>}{page==='overview'&&['pmo','admin'].includes(user.role)&&<button className="button primary global-create" onClick={()=>setEditingWorkstream('new')}><Plus size={16}/><span>Add use case</span></button>}</div></header>
      <main id="page-content" className="workspace-content" tabIndex={-1}>
        {error&&<div className="notice notice-warning" role="alert">Could not refresh the project. You are viewing the last loaded records. {error}<button className="button secondary small" onClick={()=>load().catch(()=>{})}>Try again</button></div>}
        {page==='overview'&&<Portfolio {...props} initialSelection={portfolioSelection} onWorkstream={setEditingWorkstream} onDelivery={id=>{navigate('delivery');setWorkstream(id);}}/>}
        {page==='operations'&&<Dashboard {...props} navigate={navigate} onRegister={openRegister} startMeeting={()=>setMeeting(true)} onStage={(kind,stage)=>{navigate('delivery');setWorkstream('all');setDeliveryKind(kind);setDeliveryStage(stage);}} onWorkstream={id=>{navigate('delivery');setWorkstream(id);}}/>}
        {page==='sources'&&<Sources {...props}/>}
        {page==='my-actions'&&<MyWork {...props} navigate={navigate}/>}
        {(page==='delivery'||page==='milestones')&&<Delivery {...props} initialTab={page==='milestones'?'milestones':'work'} initialFilter={deliveryFilter} initialStage={deliveryStage} initialKind={deliveryKind} search={search} setSearch={setSearch} workstream={workstream} setWorkstream={setWorkstream} createItem={()=>setCreate(true)}/>}
        {page==='registers'&&<Registers {...props} initialSelection={registerSelection}/>}{(page==='reports'||page==='approved-briefs')&&<Reports {...props} onCurrentPeriod={()=>navigate('reports')} initialView={page==='approved-briefs'?'archive':'current'}/>}
      </main><footer className="workspace-footer"><span>Phase Two · Local preview</span><button className="text-button" onClick={()=>setHelp(true)}>A guide to the workflow<ArrowUpRight size={13}/></button></footer>
    </div><nav className="mobile-navigation" aria-label="Mobile navigation">{navLinks(['overview','my-actions','delivery','registers','reports'],true)}</nav>
    {item&&<ItemDetail key={item.id} {...props} item={item} onClose={()=>setSelected(undefined)}/>}{create&&<ItemForm {...props} onClose={()=>setCreate(false)} defaultWorkstream={workstream!=='all'?workstream:undefined}/>}{settings&&<ProjectSettings {...props} onClose={()=>setSettings(false)}/>}{meeting&&<MeetingWorkspace {...props} onClose={()=>setMeeting(false)}/>}{searchOpen&&<WorkSearch {...props} onUseCase={openUseCase} onClose={()=>setSearchOpen(false)}/>}
    {editingWorkstream&&<WorkstreamEditor key={editingWorkstream} {...props} id={editingWorkstream} onClose={()=>setEditingWorkstream(undefined)}/>}
    {help&&<Modal title="From opportunity to sustained value" description="One use case, connected through its consulting and delivery lifecycle." onClose={()=>setHelp(false)}><div className="guide-steps">{[['1','Define the use case','Start in the portfolio. Record the outcome, scope, lead, current phase and next gate. Keep RFP, discovery, assessment and design artifacts with the use case.'],['2','Connect the plan to delivery','Plan deliverables and milestones, then link research, data, engineering, QA and release work. Review blockers and handoffs in Delivery overview.'],['3','Confirm the week’s position','Leads review the use case update. PMO prepares the brief from those records; a designated manager approves the client edition.'],['4','Present the approved edition','Open the saved brief for the client conversation. Later project changes do not rewrite that edition.']].map(([n,title,detail])=><div className="guide-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{detail}</p></div></div>)}</div><div className="notice">The “Preview as” selector lets you try the local preview roles. Phase and artifact status are recorded assessments; formal approval evidence remains with the underlying records. Corporate sign-in and shared hosting belong to the live rollout.</div></Modal>}
    {toast&&<div className={`toast ${toast.error?'toast-error':''}`} role={toast.error?'alert':'status'}>{toast.error?<AlertTriangle size={19}/>:<CircleCheck size={19}/>}<span>{toast.text}</span><button className="icon-button" onClick={()=>setToast(undefined)} aria-label="Dismiss notification"><X size={16}/></button></div>}
  </div>;
}

function WorkSearch({onClose,onUseCase,...props}:PageProps&{onClose:()=>void;onUseCase:(id:string)=>void}) {
  const [query,setQuery]=useState(''); const term=query.trim().toLowerCase();
  const cases=props.state.workstreams.filter(w=>[w.name,w.shortName,w.description].join(' ').toLowerCase().includes(term)).slice(0,10);
  const matches=props.state.items.filter(i=>[i.title,i.id,i.nextAction].join(' ').toLowerCase().includes(term)).slice(0,12);
  return <Modal title="Search the hub" description="Find a use case or a work item by name, reference or next action." onClose={onClose}><div className="search-input command-input"><Search size={20}/><input autoFocus aria-label="Search use cases and work" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Use case, title or reference…"/></div><div className="search-results">{cases.length>0&&<h3 className="search-section-label">Use cases</h3>}{cases.map(w=><button key={w.id} onClick={()=>{onClose();onUseCase(w.id);}}><div><strong>{w.name}</strong><span>Use case · {w.lifecyclePhase||'Phase not yet set'}</span></div><ArrowUpRight size={16}/></button>)}{matches.length>0&&<h3 className="search-section-label">Work items</h3>}{matches.map(i=><button key={i.id} onClick={()=>{onClose();props.openItem(i.id);}}><div><strong>{i.title}</strong><span>{props.state.workstreams.find(w=>w.id===i.workstreamId)?.shortName} · {i.stage}</span></div><ArrowUpRight size={16}/></button>)}{!matches.length&&!cases.length&&<Empty title="No matches">Try part of a use case name, title or work reference.</Empty>}</div></Modal>;
}
