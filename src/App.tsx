import { useState, useEffect, useCallback, useRef } from 'react';
import { Layers3, ShieldAlert, FileText, Search, Plus, Settings2, HelpCircle, X, RefreshCw, AlertTriangle, CircleCheck, ArrowUpRight, Command, ChevronDown, Users, PanelsTopLeft, ChevronRight } from 'lucide-react';
import type { Bootstrap, PageProps, Report, Stage, WorkflowKind } from '../shared/types';
import { api } from './api';
import { Avatar, Modal, canEdit, Empty } from './ui';
import { ItemDetail, ItemForm } from './Delivery';
import { Reports, ReportPresentation } from './Reports';
import { Registers } from './Registers';
import { MeetingWorkspace } from './Meetings';
import WorkWorkspace from './WorkWorkspace';
import { resolveWorkspaceRoute, workspaceHash, type WorkView } from './navigation';
import ProjectSettings from './ProjectSettings';
import Portfolio from './Portfolio';
import Sources from './Sources';
import { WorkstreamEditor } from './OverviewExtras';
import ShowcaseGuide from './ShowcaseGuide';
import DemoEvidence from './DemoEvidence';

const navigation = [
  {id:'sources',label:'Project sources',short:'Sources',icon:FileText},
  {id:'overview',label:'Portfolio',short:'Portfolio',icon:PanelsTopLeft},
  {id:'work',label:'Work',short:'Work',icon:Layers3},
  {id:'registers',label:'Risks & decisions',short:'Risks',icon:ShieldAlert},
  {id:'reports',label:'Reports',short:'Reports',icon:FileText},
];
const currentRoute = () => resolveWorkspaceRoute(location.hash);
export default function App() { return location.pathname.startsWith('/brief/') ? <BriefRoute/> : location.pathname.startsWith('/evidence/') ? <DemoEvidence/> : <Workspace/>; }

function useShowcaseEvidence(illustrative: boolean) {
  useEffect(() => {
    if (!illustrative) return;
    const openEvidence = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button > 1) return;
      const target = event.target;
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
      const anchor = element?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      try {
        const source = new URL(anchor.href, document.baseURI);
        const prefix = '/synthetic-demo/';
        if (!['http:', 'https:'].includes(source.protocol) || source.host !== 'example.invalid' || !source.pathname.startsWith(prefix)) return;
        const evidenceId = decodeURIComponent(source.pathname.slice(prefix.length));
        if (!evidenceId) return;
        event.preventDefault();
        window.open(`/evidence/${encodeURIComponent(evidenceId)}`, '_blank', 'noopener,noreferrer');
      } catch { /* Malformed references retain their normal link behavior. */ }
    };
    document.addEventListener('click', openEvidence);
    document.addEventListener('auxclick', openEvidence);
    return () => {
      document.removeEventListener('click', openEvidence);
      document.removeEventListener('auxclick', openEvidence);
    };
  }, [illustrative]);
}

function BriefRoute() {
  const [report,setReport]=useState<Report>(); const [error,setError]=useState('');
  const [illustrative,setIllustrative]=useState(false);
  useShowcaseEvidence(illustrative);
  useEffect(()=>{let active=true;api('/api/bootstrap').then(()=>api(`/api/reports/${encodeURIComponent(location.pathname.split('/')[2])}/presentation`)).then(r=>{if(active){setReport(r.report||r);setIllustrative(r.demoScenario==='consulting-lifecycle');}}).catch(e=>{if(active)setError(e.message||'This brief could not be opened. Return to the workspace and try again.');});return()=>{active=false;};},[]);
  return <div className="presentation-shell"><div className="presentation-toolbar"><a className="button secondary" href="/#reports">Back to workspace</a><button className="button primary" disabled={!report} onClick={()=>window.print()}>Print / save PDF</button></div>{error?<div role="alert" className="notice notice-warning">{error}</div>:report?<>{illustrative&&<div className="showcase-presentation-label" role="note">Demonstration · Illustrative data<span>This report, its approval, and linked evidence packs are synthetic examples.</span></div>}<ReportPresentation report={report}/></>:<div className="loading-screen">Opening approved brief…</div>}</div>;
}

function Workspace() {
  const [boot,setBoot]=useState<Bootstrap>(); const [error,setError]=useState(''); const [page,setPage]=useState(()=>currentRoute().page);
  const [workView,setWorkView]=useState<WorkView>(()=>currentRoute().workView);
  const [reportView,setReportView]=useState<'current'|'archive'>(()=>currentRoute().reportView);
  const [toast,setToast]=useState<{text:string;error:boolean}>(); const [selected,setSelected]=useState<string>();
  const [create,setCreate]=useState(false); const [settings,setSettings]=useState(false); const [meeting,setMeeting]=useState(false); const [help,setHelp]=useState(false); const [searchOpen,setSearchOpen]=useState(false);
  const [search,setSearch]=useState(''); const [workstream,setWorkstream]=useState('all'); const [deliveryFilter,setDeliveryFilter]=useState('all');
  const [deliveryStage,setDeliveryStage]=useState<Stage>(); const [deliveryKind,setDeliveryKind]=useState<WorkflowKind>();
  const [registerSelection,setRegisterSelection]=useState<{id:string;key:number}>();
  const [portfolioSelection,setPortfolioSelection]=useState<{id:string;key:number}>();
  const [editingWorkstream,setEditingWorkstream]=useState<string>();
  const [switchingPersona,setSwitchingPersona]=useState(false);
  const personaSwitch=useRef(false);
  const pendingLoads=useRef(new Set<Promise<Bootstrap>>());
  useShowcaseEvidence(boot?.state.settings.demoScenario==='consulting-lifecycle');
  const loadGeneration=useRef(0);
  const load=useCallback(async()=>{if(personaSwitch.current)return;const generation=++loadGeneration.current;const request=api<Bootstrap>('/api/bootstrap');pendingLoads.current.add(request);try{const response=await request;if(generation===loadGeneration.current){setBoot(response);setError('');}return response;}catch(error){if(generation===loadGeneration.current)setError((error as Error).message);throw error;}finally{pendingLoads.current.delete(request);}},[]);
  useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')load().catch(()=>{});};load().catch(()=>{});const change=()=>{const route=currentRoute();setPage(route.page);setWorkView(route.workView);setReportView(route.reportView);window.scrollTo({top:0});};window.addEventListener('hashchange',change);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(refresh,60000);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(timer);};},[load]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(undefined),6500);return()=>clearTimeout(timer);},[toast]);
  const notify=useCallback((text:string,error=false)=>setToast({text,error}),[]);
  const mutate=useCallback(async(path:string,body?:unknown,method?:string)=>{if(personaSwitch.current)throw new Error('Wait for the preview profile to finish changing.');const result=await api(path,body,method);await load().catch(()=>{});return result;},[load]);
  async function switchPersona(userId:string) {
    if(personaSwitch.current)return;
    personaSwitch.current=true;setSwitchingPersona(true);++loadGeneration.current;
    try{
      await Promise.allSettled([...pendingLoads.current]);
      await api('/api/demo/persona',{userId});
      const response=await api<Bootstrap>('/api/bootstrap');
      if(response.currentUserId!==userId)throw new Error('The preview profile could not be confirmed. Refresh before continuing.');
      setBoot(response);setError('');notify('Preview profile changed');
    }
    catch(error){setBoot(undefined);setError((error as Error).message || 'Could not confirm the preview profile. Refresh to continue.');}
    finally{personaSwitch.current=false;setSwitchingPersona(false);}
  }
  function navigate(id:string,filter='all') {const route=resolveWorkspaceRoute(id);location.hash=workspaceHash(route);setPage(route.page);setWorkView(route.workView);setReportView(route.reportView);window.scrollTo({top:0});setWorkstream('all');setDeliveryFilter(filter);setDeliveryStage(undefined);setDeliveryKind(undefined);setRegisterSelection(undefined);setSearch('');}
  function openRegister(id:string){setSelected(undefined);navigate('registers');setRegisterSelection({id,key:Date.now()});}
  function openUseCase(id:string){navigate('overview');setPortfolioSelection({id,key:Date.now()});}
  if(!boot)return <div className="loading-screen"><span className="brand-mark"><ChevronRight size={26}/></span><h1>Phase Two</h1>{error?<><p role="alert">{error}</p><button className="button primary" onClick={()=>load().catch(()=>{})}><RefreshCw size={16}/>Try again</button></>:<><span className="loading-bar"/><p>Opening the project workspace…</p></>}</div>;
  const {state}=boot; const user=state.members.find(m=>m.id===boot.currentUserId)||state.members[0];
  const props:PageProps={state,user,mutate,notify,openItem:setSelected,openRegister,aiAvailable:boot.aiAvailable};
  const item=state.items.find(i=>i.id===selected);
  const navLinks=(ids:string[],mobile=false)=>navigation.filter(n=>ids.includes(n.id)).map(n=><a key={n.id} href={`#${n.id}`} onClick={event=>{event.preventDefault();navigate(n.id);}} aria-current={page===n.id?'page':undefined} className={`nav-item ${page===n.id?'active':''}`}><n.icon size={17}/><span>{mobile?n.short:n.label}</span></a>);
  return <div className="app-shell">
    <a className="skip-link" href="#page-content" onClick={e=>{e.preventDefault();document.getElementById('page-content')?.focus();}}>Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#overview" onClick={()=>navigate('overview')}><span className="brand-mark"><ChevronRight size={26}/></span><span>Phase Two<small>AI programme office</small></span></a><div className="workspace-label"><div><strong>{state.settings.projectName.split(' · ')[0]}</strong><span>{state.settings.phaseName}</span></div></div><nav aria-label="Main navigation"><div className="nav-group">{navLinks(['overview','work','registers'])}<button className="nav-item" onClick={()=>setMeeting(true)}><Users size={17}/><span>Meetings</span></button>{navLinks(['reports'])}</div></nav><div className="sidebar-bottom">{navLinks(['sources'])}<button className="nav-item" onClick={()=>setHelp(true)}><HelpCircle size={17}/>How it works</button><button className="nav-item" onClick={()=>setSettings(true)}><Settings2 size={17}/>Project settings</button><div className="workspace-person"><Avatar member={user} size={32}/><div><strong>{user.name}</strong><span>{user.role==='pmo'?'PMO':user.role.charAt(0).toUpperCase()+user.role.slice(1)} · Local preview</span></div></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><span>{state.settings.projectName.split(' · ')[0]}</span><span className="breadcrumb-slash">/</span><strong>{navigation.find(n=>n.id===page)?.label}</strong></div><div className="topbar-actions"><button className="global-search" onClick={()=>setSearchOpen(true)} aria-label="Search the hub"><Search size={17}/><span>Search the hub…</span><kbd><Command size={11}/>K</kbd></button><button className="icon-button" aria-label="Refresh project data" onClick={()=>load().then(()=>notify('Project data refreshed')).catch(e=>notify(e.message,true))}><RefreshCw size={17}/></button><button className="icon-button mobile-settings" aria-label="Project settings" onClick={()=>setSettings(true)}><Settings2 size={18}/></button><div className="persona-switch"><Avatar member={user} size={30}/><label><span>Preview as</span><select aria-label="Demo persona" disabled={switchingPersona} aria-busy={switchingPersona} value={user.id} onChange={e=>void switchPersona(e.target.value)}>{state.members.map(m=><option key={m.id} value={m.id}>{m.name} · {state.settings.demoScenario === 'consulting-lifecycle' ? m.title || m.role : m.role}</option>)}</select></label><ChevronDown size={12}/></div>{canEdit(user)&&!['overview','work'].includes(page)&&<button className="button primary global-create" onClick={()=>setCreate(true)}><Plus size={16}/><span>Add work</span></button>}{page==='overview'&&['pmo','admin'].includes(user.role)&&<button className="button primary global-create" onClick={()=>setEditingWorkstream('new')}><Plus size={16}/><span>Add use case</span></button>}</div></header>
      {state.settings.demoScenario==='consulting-lifecycle'&&<ShowcaseGuide state={state} onNavigate={navigate} onOpenItem={setSelected} onMeeting={()=>setMeeting(true)} onAddWork={()=>setCreate(true)}/>}
      <main id="page-content" className="workspace-content" tabIndex={-1}>
        {error&&<div className="notice notice-warning" role="alert">Could not refresh the project. You are viewing the last loaded records. {error}<button className="button secondary small" onClick={()=>load().catch(()=>{})}>Try again</button></div>}
        {page==='overview'&&<Portfolio {...props} initialSelection={portfolioSelection} onWorkstream={setEditingWorkstream} onDelivery={id=>{navigate('delivery');setWorkstream(id);}}/>}
        {page==='sources'&&<Sources {...props}/>}
        {page==='work'&&<WorkWorkspace {...props} view={workView} onView={view=>navigate('work'+(view==='all'?'':'?view='+view))} navigate={navigate} startMeeting={()=>setMeeting(true)} initialFilter={deliveryFilter} initialStage={deliveryStage} initialKind={deliveryKind} search={search} setSearch={setSearch} workstream={workstream} setWorkstream={setWorkstream} createItem={()=>setCreate(true)}/>}
        {page==='registers'&&<Registers {...props} initialSelection={registerSelection}/>}{page==='reports'&&<Reports key={reportView} {...props} onCurrentPeriod={()=>navigate('reports')} onViewChange={view=>navigate(view==='archive'?'reports?view=archive':'reports')} initialView={reportView}/>}
      </main><footer className="workspace-footer"><span>Phase Two · {state.settings.demoScenario==='consulting-lifecycle'?'Illustrative demonstration':'Local preview'}</span><button className="text-button" onClick={()=>setHelp(true)}>A guide to the workflow<ArrowUpRight size={13}/></button></footer>
    </div><nav className="mobile-navigation" aria-label="Mobile navigation">{navLinks(['overview','work','registers','reports'],true)}</nav>
    {item&&<ItemDetail key={item.id} {...props} item={item} onClose={()=>setSelected(undefined)}/>}{create&&<ItemForm {...props} onClose={()=>setCreate(false)} defaultWorkstream={workstream!=='all'?workstream:undefined}/>}{settings&&<ProjectSettings {...props} onClose={()=>setSettings(false)}/>}{meeting&&<MeetingWorkspace {...props} onClose={()=>setMeeting(false)}/>}{searchOpen&&<WorkSearch {...props} onUseCase={openUseCase} onClose={()=>setSearchOpen(false)}/>}
    {editingWorkstream&&<WorkstreamEditor key={editingWorkstream} {...props} id={editingWorkstream} onClose={()=>setEditingWorkstream(undefined)}/>}
    {help&&<Modal title="From opportunity to sustained value" description="One use case, connected through its consulting and delivery lifecycle." onClose={()=>setHelp(false)}><div className="guide-steps">{[['1','Define the use case','Start in the portfolio. Record the outcome, scope, lead, current phase and next gate. Keep RFP, discovery, assessment and design artifacts with the use case.'],['2','Connect the plan to delivery','Plan deliverables and milestones, then link research, data, engineering, QA and release work. Review blockers and handoffs in Work → Needs attention. Raise an escalation when you need a named person to make a decision.'],['3','Confirm the week’s position','Leads review the use case update. PMO prepares the brief from those records; a designated manager approves the client edition.'],['4','Present the approved edition','Open the saved brief for the client conversation. Later project changes do not rewrite that edition.']].map(([n,title,detail])=><div className="guide-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{detail}</p></div></div>)}</div><div className="notice">The “Preview as” selector lets you try the local preview roles. Phase and artifact status are recorded assessments; formal approval evidence remains with the underlying records. Corporate sign-in and shared hosting belong to the live rollout.</div></Modal>}
    {toast&&<div className={`toast ${toast.error?'toast-error':''}`} role={toast.error?'alert':'status'}>{toast.error?<AlertTriangle size={19}/>:<CircleCheck size={19}/>}<span>{toast.text}</span><button className="icon-button" onClick={()=>setToast(undefined)} aria-label="Dismiss notification"><X size={16}/></button></div>}
  </div>;
}

function WorkSearch({onClose,onUseCase,...props}:PageProps&{onClose:()=>void;onUseCase:(id:string)=>void}) {
  const [query,setQuery]=useState(''); const term=query.trim().toLowerCase();
  const cases=props.state.workstreams.filter(w=>[w.name,w.shortName,w.description].join(' ').toLowerCase().includes(term)).slice(0,10);
  const matches=props.state.items.filter(i=>[i.title,i.id,i.nextAction].join(' ').toLowerCase().includes(term)).slice(0,12);
  return <Modal title="Search the hub" description="Find a use case or a work item by name, reference or next action." onClose={onClose}><div className="search-input command-input"><Search size={20}/><input autoFocus aria-label="Search use cases and work" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Use case, title or reference…"/></div><div className="search-results">{cases.length>0&&<h3 className="search-section-label">Use cases</h3>}{cases.map(w=><button key={w.id} onClick={()=>{onClose();onUseCase(w.id);}}><div><strong>{w.name}</strong><span>Use case · {w.lifecyclePhase||'Phase not yet set'}</span></div><ArrowUpRight size={16}/></button>)}{matches.length>0&&<h3 className="search-section-label">Work items</h3>}{matches.map(i=><button key={i.id} onClick={()=>{onClose();props.openItem(i.id);}}><div><strong>{i.title}</strong><span>{props.state.workstreams.find(w=>w.id===i.workstreamId)?.shortName} · {i.stage}</span></div><ArrowUpRight size={16}/></button>)}{!matches.length&&!cases.length&&<Empty title="No matches">Try part of a use case name, title or work reference.</Empty>}</div></Modal>;
}
