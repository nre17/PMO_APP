import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Calculator, ChartNoAxesCombined, Check, ChevronRight, FileText, Flag, Gauge, Landmark, Layers3, LayoutGrid, List, PieChart, Plus, Radar, Scale, Search, ShieldAlert, Table2, TrendingUp, Wallet, X } from 'lucide-react';
import { LIFECYCLE_PHASES, type Deliverable, type Milestone, type PageProps, type Workstream } from '../shared/types';
import { Avatar, Badge, Field, Modal, SafeLink, formatDate, healthLabel } from './ui';
import { MilestoneForm } from './Delivery';
import { artifactStatusLabels, canCreateArtifact, canEditArtifact, canEditUseCase, phaseGuidance, phaseLabels, selectPortfolio, selectUseCaseRelated, workstreamGroups, type LifecyclePhase } from './portfolio-model';
import './portfolio.css';

type PortfolioProps = PageProps & {
  onWorkstream: (id: string) => void;
  onDelivery: (workstreamId: string) => void;
  initialSelection?: { id: string; key: number };
};
const notSet = 'Not yet set';
const dateLabel = (date?: string) => date ? formatDate(date) : notSet;
const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
function useCaseGlyph(name: string) {
  const title = name.toLowerCase();
  if (title.includes('performance')) return ChartNoAxesCombined;
  if (title.includes('investment')) return TrendingUp;
  if (title.includes('legal')) return Scale;
  if (title.includes('market')) return Radar;
  if (title.includes('accounting')) return Calculator;
  if (title.includes('benchmark')) return Gauge;
  if (title.includes('treasury')) return Wallet;
  if (title.includes('spreadsheet')) return Table2;
  if (title.includes('public finance')) return Landmark;
  if (title.includes('budget')) return PieChart;
  return Layers3;
}

export function Portfolio(props: PortfolioProps) {
  const { state, user, initialSelection, onWorkstream } = props;
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<LifecyclePhase | 'all' | 'unset'>('all');
  const [group, setGroup] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'name' | 'phase' | 'priority'>('name');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelection?.id);
  const [artifactEditor, setArtifactEditor] = useState<{ streamId: string; value?: Deliverable }>();
  const [milestone, setMilestone] = useState<Milestone>();
  const summary = useMemo(() => selectPortfolio(state), [state]);
  useEffect(() => {
    if (!initialSelection) return;
    setPhase('all'); setGroup('all'); setQuery(''); setSelectedId(initialSelection.id);
  }, [initialSelection?.id, initialSelection?.key]);
  const visible = useMemo(() => state.workstreams.filter(stream => {
    const lead = state.members.find(member => member.id === stream.leadId)?.name || '';
    return (group === 'all' || (group ? workstreamGroups(stream).includes(group) : !workstreamGroups(stream).length)) && (phase === 'all' || (phase === 'unset' ? !stream.lifecyclePhase : stream.lifecyclePhase === phase)) &&
      [stream.name, stream.shortName, stream.description, stream.scope, ...workstreamGroups(stream), stream.phaseLabel, lead].join(' ').toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'phase') return (a.lifecyclePhase ? LIFECYCLE_PHASES.indexOf(a.lifecyclePhase) : 99) - (b.lifecyclePhase ? LIFECYCLE_PHASES.indexOf(b.lifecyclePhase) : 99) || a.name.localeCompare(b.name);
    if (sort === 'priority') return (a.priority ? priorityOrder[a.priority] : 99) - (b.priority ? priorityOrder[b.priority] : 99) || a.name.localeCompare(b.name);
    return 0;
  }), [state, phase, query, group, sort]);
  const hasGroups = summary.groups.some(value => !!value.name);
  const selected = visible.find(stream => stream.id === selectedId) || visible[0];
  const filtered = phase !== 'all' || group !== 'all' || !!query.trim();
  const editArtifact = (streamId: string, value?: Deliverable) => setArtifactEditor({ streamId, value });

  return <div className="portfolio-workspace">
    <header className="portfolio-hero">
      <div className="portfolio-hero-shapes" aria-hidden="true"><span/><span/><span/></div>
      <div className="portfolio-hero-copy">
        <span className="portfolio-kicker">{state.settings.phaseName} / Use-case portfolio</span>
        <h1>The AI portfolio<span>.</span></h1>
        <p>{state.settings.demoScenario === 'consulting-lifecycle' ? 'One view of the programme: clear owners, upcoming decisions and a reviewed weekly position.' : state.sourceDocuments?.length ? `${summary.currentTrackerRecords} current tracker rows across ${summary.trackerCoveredUseCases} use cases. Keep source context alongside the delivery plan.` : summary.phaseSet === 0 ? 'Start with the brief. Add the confirmed outcome, lead and next gate for each use case.' : 'See where each use case stands, what comes next, and the work behind it.'}</p>
      </div>
      <div className="portfolio-hero-facts"><div className="portfolio-total"><strong>{summary.total.toString().padStart(2, '0')}</strong><span>use cases<br/>in the portfolio</span></div><dl><div><dt>Lifecycle phase set</dt><dd>{summary.phaseSet}<span> / {summary.total}</span></dd></div><div><dt>Next gate recorded</dt><dd>{summary.gatesSet}<span> / {summary.total}</span></dd></div><div><dt>Lifecycle artifacts</dt><dd>{summary.artifacts}</dd></div></dl></div>
    </header>
    {(state.sourceRecords || []).some(record => record.disposition === 'needs_review') && <div className="portfolio-source-review"><div><strong>{(state.sourceRecords || []).filter(record => record.disposition === 'needs_review').length} source statuses to reconcile</strong><span>Review the original status and its linked follow-up before changing delivery work.</span></div><a className="text-link" href="#sources">Review source records <ArrowUpRight size={15}/></a></div>}

    <section className="portfolio-lifecycle" aria-labelledby="portfolio-lifecycle-title">
      <div className="portfolio-section-heading"><div><span className="portfolio-section-index">01</span><h2 id="portfolio-lifecycle-title">The lifecycle</h2><p>A use-case phase sits above the task workflow.</p></div>{summary.phaseUnset > 0 && <button className={`portfolio-unset ${phase === 'unset' ? 'is-active' : ''}`} aria-pressed={phase === 'unset'} onClick={() => setPhase(phase === 'unset' ? 'all' : 'unset')}>{summary.phaseUnset} not yet set <ChevronRight size={15}/></button>}</div>
      <div className="portfolio-phase-ribbon" aria-label="Filter use cases by lifecycle phase">{summary.phases.map(({ phase: value, count }, index) => <button key={value} aria-pressed={phase === value} title={phaseGuidance[value]} className={phase === value ? 'is-active' : ''} onClick={() => setPhase(phase === value ? 'all' : value)}><span className="portfolio-phase-number">{String(index + 1).padStart(2, '0')}</span><strong>{phaseLabels[value]}</strong><span className="portfolio-phase-count">{count} <span>{count === 1 ? 'use case' : 'use cases'}</span></span><ChevronRight className="portfolio-phase-chevron" size={17}/></button>)}</div>
      {phase !== 'all' && <div className="portfolio-phase-note"><span>{phase === 'unset' ? 'The lifecycle phase has not been recorded for these use cases.' : phaseGuidance[phase]}</span><button className="text-button" onClick={() => setPhase('all')}>Show every phase <X size={14}/></button></div>}
    </section>

    <section className="portfolio-catalog" aria-labelledby="portfolio-catalog" id="portfolio-catalog-region">
      <div className="portfolio-section-heading"><div><span className="portfolio-section-index">02</span><h2 id="portfolio-catalog" tabIndex={-1}>The use cases</h2><p>{filtered ? `${visible.length} of ${summary.total} match your view` : 'Choose a use case to open its brief and linked work.'}</p></div><div className="portfolio-catalog-actions">{canEditUseCase(user) && <button className="button secondary small" onClick={() => onWorkstream('new')}><Plus size={15}/>Add use case</button>}<div className="portfolio-view-switch" aria-label="Portfolio layout"><button aria-label="Card view" aria-pressed={view === 'grid'} className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}><LayoutGrid size={17}/></button><button aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><List size={19}/></button></div></div></div>
      <div className="portfolio-tools"><div className="search-input"><Search size={18}/><input aria-label="Search use cases" placeholder="Find a use case, outcome or lead…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="icon-button" aria-label="Clear use-case search" onClick={() => setQuery('')}><X size={16}/></button>}</div>{hasGroups&&<label className="portfolio-sort portfolio-group-filter">Group<select aria-label="Filter portfolio group" value={group} onChange={event=>setGroup(event.target.value)}><option value="all">All groups</option>{summary.groups.map(value=><option key={value.name} value={value.name}>{value.name||'Not yet grouped'} ({value.count})</option>)}</select></label>}<label className="portfolio-sort">Order by<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="name">Name</option><option value="phase">Lifecycle phase</option><option value="priority">Priority</option></select></label><span className="portfolio-results" role="status">{visible.length} {visible.length === 1 ? 'use case' : 'use cases'}</span>{filtered && <button className="text-button" onClick={() => { setPhase('all'); setGroup('all'); setQuery(''); }}>Clear filters</button>}</div>
      <div className={`portfolio-layout ${!selected ? 'no-selection' : ''}`}>
        <div className={`portfolio-cards portfolio-cards-${view}`}>
          {visible.map(stream => {
            const related = selectUseCaseRelated(state, stream.id);
            const lead = state.members.find(member => member.id === stream.leadId);
            const Glyph = useCaseGlyph(stream.name);
            return <button key={stream.id} className={`portfolio-card ${selected?.id === stream.id ? 'is-selected' : ''}`} aria-pressed={selected?.id === stream.id} aria-controls="portfolio-selected-case" onClick={() => setSelectedId(stream.id)}>
              <span className="portfolio-card-top"><span className="portfolio-card-glyph" aria-hidden="true"><Glyph size={21}/></span><span className={`portfolio-phase-tag ${stream.lifecyclePhase ? 'is-set' : ''}`}>{stream.lifecyclePhase ? phaseLabels[stream.lifecyclePhase] : notSet}</span><ArrowUpRight size={18}/></span>
              <strong className="portfolio-card-title">{stream.name}</strong>{workstreamGroups(stream).length>0&&<span className="portfolio-group-chips">{workstreamGroups(stream).map(name=><span key={name}>{name}</span>)}</span>}
              <span className="portfolio-card-bottom"><span className="portfolio-card-person">{lead && <Avatar member={lead} size={25}/>}<span><span>Lead</span>{lead?.name || notSet}</span></span><span className="portfolio-card-records"><span>{related.activeItems.length} active work</span><span>{related.artifacts.length} artifacts</span>{related.currentTrackerRecords.length>0&&<span>{related.currentTrackerRecords.length} current tracker rows</span>}</span></span>
            </button>;
          })}
          {!visible.length && <div className="portfolio-empty"><Search size={27}/><h3>{summary.total ? 'No use cases match this view' : 'A place for your next use case'}</h3><p>{summary.total ? 'Try a different name or include every lifecycle phase.' : 'Add the name first. Build out the brief when the facts are confirmed.'}</p>{filtered ? <button className="button secondary" onClick={() => { setPhase('all'); setGroup('all'); setQuery(''); }}>Show all use cases</button> : canEditUseCase(user) && <button className="button primary" onClick={() => onWorkstream('new')}>Add use case</button>}</div>}
        </div>
        {selected && <UseCaseDetail key={selected.id} {...props} stream={selected} editArtifact={editArtifact} openMilestone={setMilestone}/>}
      </div>
    </section>
    {artifactEditor && <ArtifactEditor key={artifactEditor.value?.id || artifactEditor.streamId} {...props} workstreamId={artifactEditor.streamId} value={artifactEditor.value} onClose={() => setArtifactEditor(undefined)}/>}
    {milestone && <MilestoneForm key={milestone.id} {...props} milestone={milestone} onClose={() => setMilestone(undefined)}/>}
  </div>;
}
export default Portfolio;

function UseCaseDetail({ stream, editArtifact, openMilestone, ...props }: PortfolioProps & { stream: Workstream; editArtifact: (streamId: string, value?: Deliverable) => void; openMilestone: (milestone: Milestone) => void }) {
  const { state, user, onWorkstream, onDelivery, openItem } = props;
  const [tab, setTab] = useState<'brief' | 'artifacts' | 'work'>('brief');
  const [workSection, setWorkSection] = useState<'items' | 'milestones' | 'registers'>('items');
  const detailBody = useRef<HTMLDivElement>(null);
  const recordSections = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (tab !== 'work') return;
    const body = detailBody.current;
    const section = recordSections.current[workSection];
    if (body && section) {
      body.scrollTop = Math.max(0, section.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8);
      section.focus({ preventScroll: true });
    }
  }, [tab, workSection]);
  function showWork(section: typeof workSection) { setWorkSection(section); setTab('work'); }
  const related = selectUseCaseRelated(state, stream.id);
  const lead = state.members.find(member => member.id === stream.leadId);
  const editable = canEditUseCase(user, stream);
  const isUnshaped = !stream.description?.trim() && !stream.scope?.trim() && !stream.lifecyclePhase && !stream.nextGate?.trim();
  const nextTasks = [...related.items].sort((a, b) => Number(a.stage === 'Closed') - Number(b.stage === 'Closed') || Number(b.blocked) - Number(a.blocked) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  return <aside className="portfolio-detail" id="portfolio-selected-case" aria-label={`${stream.name}: use-case workspace`}>
    <header className="portfolio-detail-header"><span className="portfolio-kicker">Use-case workspace</span><h2>{stream.name}</h2><div className="portfolio-detail-actions"><button className="button primary" onClick={() => onWorkstream(stream.id)}>{editable ? isUnshaped ? 'Set up profile' : 'Edit profile' : 'View profile'}<ArrowUpRight size={16}/></button><button className="button secondary" onClick={() => onDelivery(stream.id)}>Delivery work <ArrowRight size={16}/></button></div></header>
    <nav className="portfolio-detail-tabs" aria-label="Use-case sections"><button aria-pressed={tab === 'brief'} className={tab === 'brief' ? 'is-active' : ''} onClick={() => setTab('brief')}>Brief</button><button aria-pressed={tab === 'artifacts'} className={tab === 'artifacts' ? 'is-active' : ''} onClick={() => setTab('artifacts')}>Artifacts <span>{related.artifacts.length}</span></button><button aria-pressed={tab === 'work'} className={tab === 'work' ? 'is-active' : ''} onClick={() => setTab('work')}>Work & records</button></nav>
    <div className="portfolio-detail-body" ref={detailBody}>
      {tab === 'brief' && <>
        <dl className="portfolio-profile-meta"><div><dt>Lifecycle phase</dt><dd>{stream.lifecyclePhase ? phaseLabels[stream.lifecyclePhase] : notSet}</dd></div><div><dt>Priority</dt><dd>{stream.priority || notSet}</dd></div><div className="portfolio-meta-wide"><dt>Accountable lead</dt><dd>{lead ? <span className="portfolio-person"><Avatar member={lead} size={27}/>{lead.name}</span> : notSet}</dd></div></dl>
        {(workstreamGroups(stream).length || stream.phaseLabel || stream.sources?.length || related.sourceRecords.length) ? <section className="portfolio-source-context"><div className="portfolio-inline-heading"><h3>Source context</h3><a className="text-link" href="#sources">View sources <ArrowUpRight size={14}/></a></div><dl><div><dt>Portfolio group</dt><dd>{workstreamGroups(stream).join(' · ') || notSet}</dd></div><div><dt>Source label</dt><dd>{stream.phaseLabel || notSet}</dd></div></dl>{related.currentTrackerRecords.length > 0 && <p className="portfolio-source-coverage"><strong>{related.currentTrackerRecords.length}</strong> current tracker {related.currentTrackerRecords.length === 1 ? 'row' : 'rows'} linked</p>}{related.currentTrackerRecords.length > 0 && <div className="portfolio-source-statuses">{[...new Set(related.currentTrackerRecords.map(record => record.sourceStatus || 'Not stated'))].map(status => <span key={status}>{status} <b>{related.currentTrackerRecords.filter(record => (record.sourceStatus || 'Not stated') === status).length}</b></span>)}</div>}{!!stream.sources?.length && <ul className="portfolio-source-references">{stream.sources.map((reference, index) => { const document = state.sourceDocuments?.find(value => value.id === reference.documentId); const matchesRevision = !reference.fileHash || reference.fileHash === document?.fileHash; return <li key={`${reference.documentId}-${reference.locator}-${index}`}><strong>{document?.name || 'Source document unavailable'}</strong><span>{reference.locator || 'Location not stated'}{matchesRevision && document?.sourceDate ? ` · ${formatDate(document.sourceDate, { day: 'numeric', month: 'short', year: 'numeric', timeZone: state.settings.timezone })}` : ''}</span>{!matchesRevision && <><span>{document?.fileHash ? 'Earlier source revision · date not recorded' : 'Pinned source revision · date not recorded'}</span><span>Pinned fingerprint: <code>{reference.fileHash}</code></span></>}{matchesRevision && document?.coverage === 'context' && <span>Historical / project context</span>}</li>; })}</ul>}</section> : null}
        {isUnshaped && <div className="portfolio-profile-invitation"><span className="portfolio-invitation-mark" aria-hidden="true">›</span><div><h3>The name is the starting point.</h3><p>Bring in the confirmed brief to give this use case an outcome, scope and next gate.</p></div></div>}
        <section className="portfolio-brief-section"><h3>Intended outcome</h3><p className={!stream.description ? 'is-unset' : ''}>{stream.description || notSet}</p></section>
        <section className="portfolio-brief-section"><h3>Scope</h3><p className={!stream.scope ? 'is-unset' : ''}>{stream.scope || notSet}</p></section>
        <section className="portfolio-next-gate"><div><Flag size={18}/><h3>Next gate</h3></div><strong>{stream.nextGate || notSet}</strong><span>Target date <b>{dateLabel(stream.gateDate)}</b></span></section>
        <section className="portfolio-brief-section"><div className="portfolio-inline-heading"><h3>Delivery assessment</h3>{stream.health !== 'unknown' ? <Badge tone={stream.health}>{healthLabel[stream.health]}</Badge> : <span className="is-unset">{notSet}</span>}</div>{stream.statusNote && <p>{stream.statusNote}</p>}</section>
        <section className="portfolio-related-summary"><h3>Connected to this use case</h3><button onClick={() => setTab('artifacts')}><FileText size={17}/><span>Lifecycle artifacts</span><strong>{related.artifacts.length}</strong><ChevronRight size={16}/></button><button onClick={() => showWork('items')}><Layers3 size={17}/><span>Active work items</span><strong>{related.activeItems.length}</strong><ChevronRight size={16}/></button><button onClick={() => showWork('milestones')}><Flag size={17}/><span>Associated milestones</span><strong>{related.milestones.length}</strong><ChevronRight size={16}/></button><button onClick={() => showWork('registers')}><ShieldAlert size={17}/><span>Open register entries</span><strong>{related.openRegisters.length}</strong><ChevronRight size={16}/></button></section>
      </>}
      {tab === 'artifacts' && <><div className="portfolio-detail-section-heading"><div><h3>Lifecycle artifacts</h3><p>Keep briefs, designs and evaluation evidence with their use case.</p></div>{canCreateArtifact(state, user, stream.id) && <button className="button secondary small" onClick={() => editArtifact(stream.id)}><Plus size={15}/>Add artifact</button>}</div>
        {related.artifacts.length ? <div className="portfolio-artifacts">{related.artifacts.map(artifact => <article className="portfolio-artifact" key={artifact.id}><div className="portfolio-artifact-labels"><span>{artifact.lifecyclePhase ? phaseLabels[artifact.lifecyclePhase] : 'Phase: Not yet set'}</span><span className={artifact.status === 'accepted' ? 'is-accepted' : ''}>{artifact.status === 'accepted' && <Check size={13}/>} {artifact.status ? artifactStatusLabels[artifact.status] : 'Status: Not yet set'}</span></div><button className="portfolio-record-title" onClick={() => editArtifact(stream.id, artifact)}><FileText size={17}/><strong>{artifact.title}</strong><ArrowUpRight size={16}/></button><p>{artifact.description || 'Description: Not yet set'}</p><span className="portfolio-artifact-owner">Owner · {state.members.find(member => member.id === artifact.ownerId)?.name || notSet}</span>{artifact.evidenceLinks?.length ? <div className="portfolio-evidence-links">{artifact.evidenceLinks.map(link => <SafeLink key={link} href={link}/>)}</div> : <span className="portfolio-no-evidence">No evidence reference recorded</span>}</article>)}</div> : <div className="portfolio-detail-empty"><FileText size={25}/><h3>No artifacts recorded yet</h3><p>Add the first brief or source document when it is available. The artifact’s phase and status can be set independently.</p>{canCreateArtifact(state, user, stream.id) && <button className="text-button" onClick={() => editArtifact(stream.id)}>Add the first artifact <Plus size={15}/></button>}</div>}
      </>}
      {tab === 'work' && <>
        <section className="portfolio-record-section" tabIndex={-1} aria-label="Delivery work" ref={element => { recordSections.current.items = element; }}><div className="portfolio-inline-heading"><h3>Delivery work <span>{related.items.length}</span></h3><button className="text-button" onClick={() => onDelivery(stream.id)}>Open delivery <ArrowUpRight size={14}/></button></div><p className="portfolio-section-help">Task stages stay separate from the use-case lifecycle.</p>{nextTasks.length ? nextTasks.map(item => <button className="portfolio-linked-work" key={item.id} onClick={() => openItem(item.id)}><span><strong>{item.title}</strong><span>{item.stage} · {item.kind === 'software' ? 'Software delivery' : 'General work'}</span><span className={item.blocked && item.stage !== 'Closed' ? 'is-blocked' : ''}>{item.blocked && item.stage !== 'Closed' ? `Blocked: ${item.blockReason}` : item.nextAction || 'Next action: Not yet set'}</span></span><ArrowUpRight size={16}/></button>) : <p className="portfolio-inline-empty">No delivery work linked yet.</p>}</section>
        <section className="portfolio-record-section" tabIndex={-1} aria-label="Associated milestones" ref={element => { recordSections.current.milestones = element; }}><h3>Associated milestones <span>{related.milestones.length}</span></h3>{related.milestones.length ? related.milestones.map(value => <button className="portfolio-linked-work" key={value.id} onClick={() => openMilestone(value)}><span><strong>{value.title}</strong><span>Forecast {dateLabel(value.forecastDate)} · {value.status === 'at_risk' ? 'At risk' : value.status === 'complete' ? 'Complete' : 'Planned'}</span><span>Baseline {dateLabel(value.baselineDate)}</span></span><ArrowUpRight size={16}/></button>) : <p className="portfolio-inline-empty">No associated milestones recorded.</p>}</section>
        <section className="portfolio-record-section" tabIndex={-1} aria-label="Risks, decisions and dependencies" ref={element => { recordSections.current.registers = element; }}><h3>Risks, decisions & dependencies <span>{related.registers.length}</span></h3>{related.registers.length ? related.registers.map(record => <details className="portfolio-register" key={record.id}><summary><span><span>{record.type} · {record.status}</span><strong>{record.title}</strong></span><ChevronRight size={15}/></summary><div><p>{record.detail || 'Detail: Not yet set'}</p><dl><div><dt>Owner</dt><dd>{state.members.find(member => member.id === record.ownerId)?.name || notSet}</dd></div><div><dt>Target date</dt><dd>{dateLabel(record.dueDate)}</dd></div><div><dt>Next action</dt><dd>{record.nextAction || notSet}</dd></div>{record.mitigation && <div><dt>Response</dt><dd>{record.mitigation}</dd></div>}</dl>{record.relatedItemIds.map(id => state.items.find(item => item.id === id)).filter(Boolean).map(item => <button key={item!.id} className="text-button" onClick={() => openItem(item!.id)}>{item!.title}<ArrowUpRight size={14}/></button>)}</div></details>) : <p className="portfolio-inline-empty">No register entries linked yet.</p>}</section>
      </>}
    </div>
  </aside>;
}

function ArtifactEditor({ workstreamId, value, onClose, ...props }: PageProps & { workstreamId: string; value?: Deliverable; onClose: () => void }) {
  const { state, user, mutate, notify } = props;
  const stream = state.workstreams.find(record => record.id === workstreamId);
  const allowed = value ? canEditArtifact(state, user, value) : canCreateArtifact(state, user, workstreamId);
  const [form, setForm] = useState({ title: value?.title || '', description: value?.description || '', ownerId: value?.ownerId || '', lifecyclePhase: value?.lifecyclePhase || '', status: value?.status || '', evidence: value?.evidenceLinks?.join('\n') || '' });
  const [version] = useState(value?.version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (!allowed || busy) return;
    const evidenceLinks = form.evidence.split('\n').map(line => line.trim()).filter(Boolean);
    if (evidenceLinks.some(link => { try { return !['http:', 'https:'].includes(new URL(link).protocol); } catch { return true; } })) { setError('Use a complete HTTP or HTTPS link for each evidence reference.'); return; }
    const changes = { title: form.title.trim(), description: form.description.trim(), ownerId: form.ownerId, workstreamId, lifecyclePhase: form.lifecyclePhase || null, status: form.status || null, evidenceLinks };
    setBusy(true); setError('');
    try { await mutate(value ? `/api/records/deliverables/${value.id}` : '/api/records/deliverables', value ? { version, changes } : changes, value ? 'PATCH' : 'POST'); notify(value ? 'Artifact updated' : 'Artifact added'); onClose(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <Modal wide title={value ? allowed ? 'Edit lifecycle artifact' : 'Lifecycle artifact' : 'Add lifecycle artifact'} description={stream?.name} onClose={()=>!busy&&onClose()} className="portfolio-artifact-modal"><form onSubmit={save}>
    <fieldset disabled={!allowed || busy} className="portfolio-form-fieldset"><Field label="Artifact name"><input required maxLength={240} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Name the brief, design or evidence record"/></Field><Field label="Purpose and review notes"><textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What does this artifact establish? Include the review context if available."/></Field><div className="form-grid"><Field label="Lifecycle phase"><select value={form.lifecyclePhase} onChange={event => setForm({ ...form, lifecyclePhase: event.target.value })}><option value="">Not yet set</option>{LIFECYCLE_PHASES.map(phase => <option key={phase} value={phase}>{phaseLabels[phase]}</option>)}</select></Field><Field label="Artifact status"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="">Not yet set</option>{Object.entries(artifactStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></Field></div><Field label="Artifact owner"><select value={form.ownerId} onChange={event => setForm({ ...form, ownerId: event.target.value })}><option value="">Not yet set</option>{state.members.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select></Field><Field label="Evidence references · one link per line"><textarea rows={3} value={form.evidence} onChange={event => setForm({ ...form, evidence: event.target.value })} placeholder="https://…"/></Field>{form.status === 'accepted' && <p className="portfolio-form-hint">Link the reviewed artifact or acceptance reference, and include the decision context in the review notes.</p>}</fieldset>
    {error && <div className="notice notice-warning" role="alert">{error}</div>}
    {!allowed && value?.evidenceLinks?.length ? <div className="portfolio-evidence-links">{value.evidenceLinks.map(link => <SafeLink key={link} href={link}/>)}</div> : null}
    <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{allowed ? 'Cancel' : 'Close'}</button>{allowed && <button className="button primary" disabled={busy}>{busy ? 'Saving…' : value ? 'Save artifact' : 'Add artifact'}</button>}</div>
  </form></Modal>;
}
