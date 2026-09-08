import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, ExternalLink, FileText, History, LockKeyhole, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import type { HubState, PageProps, Report, ReportBody, Submission, Workstream } from '../shared/types';
import { Avatar, Badge, Field, Modal, formatDate, healthLabel } from './ui';
import { confirmationState, latestWorkstreamChange, reportingPeriod, submissionTiming } from '../shared/reporting';
import './reporting.css';

function sourceRecords(state: HubState) {
  return [
    { id: 'project', version: state.settings.version ?? 1, updatedAt: '', key: 'settings:project', kind: 'Project settings', label: 'Project settings', context: 'Reporting cadence and project configuration', streams: [] as string[] },
    ...state.workstreams.map(record => ({ ...record, key: `workstreams:${record.id}`, kind: 'Use case', label: record.name, context: healthLabel[record.health], streams: [record.id] })),
    ...state.items.map(record => ({ ...record, key: `items:${record.id}`, kind: 'Work item', label: record.title, context: record.blocked ? `Blocked · ${record.stage}` : record.stage, streams: [record.workstreamId] })),
    ...state.deliverables.map(record => ({ ...record, key: `deliverables:${record.id}`, kind: 'Deliverable', label: record.title, context: record.status ? record.status.replaceAll('_', ' ') : 'Status unassigned', streams: [record.workstreamId] })),
    ...state.registers.map(record => ({ ...record, key: `registers:${record.id}`, kind: 'Register entry', label: record.title, context: `${record.type} · ${record.status}`, streams: [record.workstreamId] })),
    ...state.milestones.map(record => ({ ...record, key: `milestones:${record.id}`, kind: 'Milestone', label: record.title, context: `Forecast ${formatDate(record.forecastDate)}`, streams: record.workstreamIds })),
    ...state.submissions.map(record => ({ ...record, key: `submissions:${record.id}`, kind: 'Confirmation', label: state.workstreams.find(stream => stream.id === record.workstreamId)?.name || 'Use case confirmation', context: `Week ending ${formatDate(record.periodEnd)}`, streams: [record.workstreamId] })),
  ];
}
const lines = (value: string[]) => value.join('\n');
const cleanLines = (value: string[]) => value.map(line => line.trim()).filter(Boolean);
function cleanBody(body: ReportBody): ReportBody {
  return { ...body, summary: body.summary.trim(), highlights: cleanLines(body.highlights), nextWeek: cleanLines(body.nextWeek), attention: cleanLines(body.attention), workstreams: body.workstreams.map(stream => ({ ...stream, completed: cleanLines(stream.completed), next: cleanLines(stream.next), attention: cleanLines(stream.attention) })) };
}
function bodyText(body: ReportBody) {
  const section = (title: string, values: string[]) => values.length ? `${title}\n${values.map(value => `• ${value}`).join('\n')}` : '';
  return [body.summary, section('Progress this week', body.highlights), section('Next week', body.nextWeek), section('Attention & decisions', body.attention), ...body.workstreams.map(stream => [stream.name, healthLabel[stream.health], section('Progress', stream.completed), section('Next', stream.next), section('Attention', stream.attention)].filter(Boolean).join('\n')), section('Milestones', body.milestones.map(milestone => `${milestone.title} — ${formatDate(milestone.forecastDate)} · ${milestone.status.replaceAll('_', ' ')}`))].filter(Boolean).join('\n\n');
}
function BriefList({ values, empty }: { values: string[]; empty: string }) {
  const visible = values.filter(value => value.trim());
  return visible.length ? <ul>{visible.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p className="muted">{empty}</p>;
}

/** Intentionally renders report content only: no hub state, internal records or audit metadata. */
export function ReportPresentation({ report }: { report: Report }) {
  return <article className="report-page delivery-report">
    <header className="report-cover">
      <div className="report-masthead"><div className="report-audience">{report.audience === 'client' ? 'Client delivery brief' : 'Internal delivery brief'}</div><span className="report-edition-status">{report.status === 'approved' ? <LockKeyhole size={13} aria-hidden="true" /> : <Pencil size={13} aria-hidden="true" />}{report.status === 'approved' ? 'Approved edition' : 'Draft · for review'}</span></div>
      <div className="report-dateline"><span>Reporting period</span><span><time dateTime={report.periodStart}>{formatDate(report.periodStart)}</time> — <time dateTime={report.periodEnd}>{formatDate(report.periodEnd, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' })}</time></span></div>
      <h1>{report.title}</h1>
      <p className="report-lede">{report.body.summary}</p>
    </header>
    <div className="report-columns">
      <section className="report-section"><h2>This week</h2><BriefList values={report.body.highlights} empty="No completed outcomes recorded for this period." /></section>
      <section className="report-section"><h2>Next week</h2><BriefList values={report.body.nextWeek} empty="Next steps will be confirmed in the next update." /></section>
    </div>
    <section className={`report-section report-attention ${report.body.attention.some(value => value.trim()) ? 'has-attention' : ''}`}><h2>Attention & decisions</h2><BriefList values={report.body.attention} empty="No additional decisions or escalations recorded." /></section>
    {report.body.workstreams.length > 0 && <section className="report-section"><h2>Use case outlook</h2><div className="report-workstream-list">{report.body.workstreams.map((stream, index) => <div className="report-workstream" key={`${stream.name}-${index}`}>
      <header className="report-workstream-heading"><h3>{stream.name}</h3><Badge tone={stream.health}>{healthLabel[stream.health]}</Badge></header>
      {!stream.confirmed && <p className="report-confirmation-note"><Clock3 size={14} aria-hidden="true" />{report.status === 'approved' ? 'Use case confirmation was outstanding at publication.' : 'Use case confirmation is outstanding for this edition.'}</p>}
      <div className="report-columns"><div><h4>Progress</h4><BriefList values={stream.completed} empty="No completed outcomes recorded." /></div><div><h4>Next steps</h4><BriefList values={stream.next} empty="No further steps recorded." /></div></div>
      {stream.attention.some(value => value.trim()) && <div><h4>Attention</h4><BriefList values={stream.attention} empty="" /></div>}
    </div>)}</div></section>}
    {report.body.milestones.length > 0 && <section className="report-section"><h2>Milestones</h2><table className="data-table"><thead><tr><th scope="col">Milestone</th><th scope="col">Forecast</th><th scope="col">Outlook</th></tr></thead><tbody>{report.body.milestones.map((milestone, index) => <tr key={index}><td>{milestone.title}</td><td>{formatDate(milestone.forecastDate)}</td><td>{milestone.status === 'at_risk' ? 'At risk' : milestone.status === 'complete' ? 'Complete' : milestone.status === 'planned' ? 'Planned' : milestone.status}</td></tr>)}</tbody></table></section>}
    <footer className="report-folio"><span>Information as of <time dateTime={report.asOf}>{formatDate(report.asOf, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}</time> GST</span><span>{report.status === 'approved' ? 'A fixed record of this reporting period' : 'Review required before publication'}</span></footer>
  </article>;
}

type ConfirmationDraft = Pick<Submission, 'workstreamId' | 'completed' | 'next' | 'changes' | 'blockers' | 'health' | 'sourceUpdatedAt'>;

export function Reports({ state, user, mutate, notify, aiAvailable, initialView = 'current', onCurrentPeriod }: PageProps & { initialView?: 'current' | 'archive'; onCurrentPeriod?:()=>void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'current' | 'archive'>(initialView);
  const [archiveStatus, setArchiveStatus] = useState<'all' | Report['status']>(initialView === 'archive' ? 'approved' : 'all');
  const [step, setStep] = useState<number | null>(null);
  const [currentAudience, setCurrentAudience] = useState<Report['audience']>('client');
  const [audienceFilter, setAudienceFilter] = useState<'all' | Report['audience']>('all');
  const [creating, setCreating] = useState(false);
  const [newAudience, setNewAudience] = useState<Report['audience']>('client');
  const [editor, setEditor] = useState<Report | null>(null);
  const [approval, setApproval] = useState<Report | null>(null);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationDraft | null>(null);
  const [proposal, setProposal] = useState<{ report: Report; body: ReportBody } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setView(initialView); setSelectedId(null); setStep(null); setError('');
    setArchiveStatus(initialView === 'archive' ? 'approved' : 'all');
  }, [initialView]);
  const isPMO = user.role === 'pmo' || user.role === 'admin';
  const periodRange = reportingPeriod(new Date(), state.settings.timezone, state.settings.cutoffHour);
  const periodEnd = periodRange.end;
  const streams = state.workstreams.map(stream => ({ ...stream, readiness: confirmationState(state, stream.id, periodEnd) }));
  const confirmedCount = streams.filter(stream => stream.readiness.confirmed).length;
  const reports = useMemo(() => [...state.reports].filter(report => view === 'current' ? report.periodEnd === periodEnd && report.audience === currentAudience : (audienceFilter === 'all' || report.audience === audienceFilter) && (archiveStatus === 'all' || report.status === archiveStatus)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.reports, view, periodEnd, currentAudience, audienceFilter, archiveStatus]);
  const selected = reports.find(report => report.id === selectedId) || reports[0];
  const sources = sourceRecords(state);
  const changedSources = selected?.status === 'draft' ? sources.filter(source => selected.sourceVersions[source.key] !== source.version) : [];
  const removedSourceCount = selected?.status === 'draft' ? Object.keys(selected.sourceVersions).filter(key => !sources.some(source => source.key === key)).length : 0;
  const selectedStale = changedSources.length > 0 || removedSourceCount > 0;
  const activeStep = step ?? (selected?.status === 'approved' ? 2 : selected ? 1 : 0);
  const snapshotConfirmations = Boolean(selected && (selected.status === 'approved' || selected.supersedesId || selected.periodEnd !== periodEnd));
  const reviewMissing = selected && snapshotConfirmations ? selected.body.workstreams.filter(stream => !stream.confirmed) : streams.filter(stream => !stream.readiness.confirmed);
  const approvalMissing = approval ? approval.supersedesId
    ? (state.reports.find(report => report.id === approval.supersedesId)?.body.workstreams || []).filter(stream => !stream.confirmed)
    : state.workstreams.filter(stream => !confirmationState(state, stream.id, approval.periodEnd).confirmed) : [];
  const allowConfirm = (stream: Workstream) => isPMO || (user.role === 'lead' && stream.leadId === user.id);
  function closeDialogs() { setCreating(false); setEditor(null); setApproval(null); setConfirmation(null); setProposal(null); setError(''); }
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (caught) { const message = caught instanceof Error ? caught.message : 'The action could not be completed. Please try again.'; setError(message); notify(message, true); }
    finally { setBusy(false); }
  }
  async function createReport(audience: Report['audience'], supersedesId?: string) {
    await perform(async () => {
      const report: Report = await mutate('/api/reports', { audience, ...(supersedesId ? { supersedesId } : {}) }, 'POST');
      setAudienceFilter('all'); setArchiveStatus('all'); setCurrentAudience(report.audience); setView(report.periodEnd === periodEnd ? 'current' : 'archive'); setStep(1); setSelectedId(report.id); closeDialogs();
      notify(supersedesId ? 'Correction draft created. The approved report is preserved.' : 'Draft prepared from the current reporting sources.');
    });
  }
  function openApproval(report: Report) { setApproval(report); setIncompleteReason(''); setError(''); }
  const nextConfirmation = streams.find(stream => !stream.readiness.confirmed && allowConfirm(stream));
  const prepare = () => { setNewAudience(currentAudience); setError(''); setCreating(true); };
  const primaryAction = view === 'current' && activeStep === 0
    ? nextConfirmation
      ? <button className="button primary" onClick={() => openConfirmation(nextConfirmation)}>Confirm {nextConfirmation.shortName}<ArrowRight size={16} /></button>
      : selected
        ? <button className="button primary" onClick={() => setStep(1)}>Review draft<ArrowRight size={16} /></button>
        : isPMO ? <button className="button primary" onClick={prepare}>Prepare draft<ArrowRight size={16} /></button> : null
    : selected?.status === 'approved'
      ? <a className="button primary" href={`/brief/${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Present approved edition</a>
      : selectedStale && isPMO
        ? <button className="button primary" disabled={busy} onClick={() => createReport(selected.audience, selected.supersedesId)}><RefreshCw size={16} />Prepare fresh draft</button>
        : selected && view === 'current' && activeStep === 1
          ? <button className="button primary" disabled={selectedStale} onClick={() => setStep(2)}>Continue to approval<ArrowRight size={16} /></button>
        : selected && user.canApproveReports
          ? <button className="button primary" disabled={busy || selectedStale} onClick={() => openApproval(selected)}><Check size={16} />Approve edition</button>
          : selected && isPMO
            ? <button className="button primary" onClick={() => { setEditor(structuredClone(selected)); setError(''); }}><Pencil size={16} />Edit draft</button>
            : !selected && view === 'current' && isPMO ? <button className="button primary" onClick={prepare}>Prepare draft<ArrowRight size={16} /></button> : null;
  function openConfirmation(stream: Workstream) {
    const existing = confirmationState(state, stream.id, periodEnd).submission;
    const work = state.items.filter(item => item.workstreamId === stream.id);
    const openedAt = Date.now();
    setError('');
    setConfirmation({ workstreamId: stream.id,
      completed: existing?.completed ?? work.filter(item => { const closedAt = item.closedAt ? new Date(item.closedAt).getTime() : NaN; return item.stage === 'Closed' && closedAt >= new Date(periodRange.startAt).getTime() && closedAt < new Date(periodRange.endAt).getTime() && closedAt <= openedAt; }).map(item => item.title).join('\n'),
      next: existing?.next ?? work.filter(item => item.stage !== 'Closed' && !item.blocked).slice(0, 6).map(item => `${item.title}${item.nextAction ? ` — ${item.nextAction}` : ''}`).join('\n'),
      changes: existing?.changes ?? stream.statusNote,
      blockers: existing?.blockers ?? [...work.filter(item => item.blocked).map(item => `${item.title} — ${item.blockReason}`), ...state.registers.filter(register => register.workstreamId === stream.id && register.status === 'escalated').map(register => register.title)].join('\n'),
      health: stream.health, sourceUpdatedAt: latestWorkstreamChange(state, stream.id),
    });
  }
  const textField = (label: string, key: 'highlights' | 'nextWeek' | 'attention', rows = 4) => editor && <Field label={label}><textarea className="textarea" rows={rows} value={lines(editor.body[key])} onChange={event => setEditor({ ...editor, body: { ...editor.body, [key]: event.target.value.split('\n') } })} /></Field>;
  return <div className="stack reporting-workspace">
    <div className="page-header">
      <div><h1 className="page-title">{view === 'current' ? 'Weekly report' : archiveStatus === 'approved' ? 'Approved briefs' : 'Previous editions'}</h1><p className="page-subtitle">{view === 'current' ? `Week ending ${formatDate(periodEnd, { day: 'numeric', month: 'long', year: 'numeric' })} · Confirm the position, review the wording, publish a fixed edition.` : archiveStatus === 'approved' ? 'Published delivery positions, preserved exactly as approved.' : 'Saved drafts, approved snapshots, and their corrections.'}</p></div>
      <button className="button secondary" onClick={() => { if(view==='archive'&&initialView==='archive'&&onCurrentPeriod){onCurrentPeriod();return;} setView(view === 'current' ? 'archive' : 'current'); setArchiveStatus('all'); setSelectedId(null); setStep(null); setError(''); }}>{view === 'current' ? <History size={16} /> : <ArrowLeft size={16} />}{view === 'current' ? 'Previous editions' : 'Current period'}</button>
    </div>

    {view === 'current' ? <>
      <div className="report-period-bar"><span>Lead updates by <strong>{state.settings.submissionHour}:00</strong> · Thursday cutoff <strong>{state.settings.cutoffHour}:00</strong> · {state.settings.timezone}</span><label className="report-audience-control">Audience<select className="select" value={currentAudience} onChange={event => { setCurrentAudience(event.target.value as Report['audience']); setSelectedId(null); setStep(null); }}><option value="client">Client</option><option value="internal">Internal</option></select></label></div>
      <nav className="report-workflow" aria-label="Weekly report workflow">
        {[
          { title: 'Confirm use cases', detail: `${confirmedCount} of ${streams.length} current`, done: confirmedCount === streams.length },
          { title: 'Review draft', detail: selected ? selectedStale ? 'Sources changed' : 'Draft available' : 'Prepare from delivery records', done: selected?.status === 'approved' },
          { title: 'Approve & present', detail: selected?.status === 'approved' ? 'Approved edition ready' : 'Reviewed snapshot', done: selected?.status === 'approved' },
        ].map((item, index) => <button key={item.title} className={`report-workflow-step ${activeStep === index ? 'active' : ''}`} onClick={() => setStep(index)} aria-current={activeStep === index ? 'step' : undefined}><span className={`report-step-number ${item.done ? 'complete' : ''}`}>{item.done ? <Check size={16} /> : index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}
      </nav>
    </> : <section className="panel report-editions">
      <div className="panel-header"><div><h2 className="section-title">{archiveStatus === 'approved' ? 'Approved editions' : archiveStatus === 'draft' ? 'Saved drafts' : 'All saved editions'}</h2><p className="muted">Approval fixes an edition. A correction keeps the original available.</p></div><div className="report-archive-filters"><label>Status<select className="select" value={archiveStatus} onChange={event => { setArchiveStatus(event.target.value as typeof archiveStatus); setSelectedId(null); }}><option value="approved">Approved</option><option value="draft">Drafts</option><option value="all">All editions</option></select></label><label>Audience<select className="select" value={audienceFilter} onChange={event => { setAudienceFilter(event.target.value as typeof audienceFilter); setSelectedId(null); }}><option value="all">All audiences</option><option value="client">Client</option><option value="internal">Internal</option></select></label></div></div>
      <div className="report-edition-list">{reports.length ? reports.map(report => <button key={report.id} className={`report-edition ${selected?.id === report.id ? 'active' : ''}`} onClick={() => { setSelectedId(report.id); setError(''); }} aria-current={selected?.id === report.id ? 'true' : undefined}><strong>{formatDate(report.periodEnd)}</strong><span>{report.audience === 'client' ? 'Client' : 'Internal'} · {report.supersedesId ? 'Correction' : 'Original'} · v{report.version}</span><span>{report.status === 'approved' ? <LockKeyhole size={14} /> : <Pencil size={14} />}{report.status === 'approved' ? 'Approved' : 'Draft'} · {formatDate(report.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone })}</span></button>) : <p className="muted">No editions match these filters.</p>}</div>
    </section>}

    {error && !creating && !editor && !approval && !confirmation && !proposal && <div className="notice notice-warning" role="alert">{error}</div>}
    <div className="report-desk">
      <section className="report-main" aria-label={view === 'current' ? 'Current reporting step' : 'Selected edition'}>
        <div className="report-step-heading"><div><h2>{view === 'current' && activeStep === 0 ? 'Confirm the delivery position' : selected?.status === 'approved' ? 'Ready to present' : activeStep === 2 && view === 'current' ? 'Review before approval' : selected ? 'Review the report' : 'Prepare this week’s draft'}</h2><p className="muted">{view === 'current' && activeStep === 0 ? 'Use case leads review progress, plans, and dependencies once.' : selected?.status === 'approved' ? 'This edition stays fixed when delivery records change.' : selectedStale ? 'Review the changed sources and prepare a fresh snapshot.' : activeStep === 2 && view === 'current' ? 'An authorized approver checks the content and any confirmation gaps.' : 'Check completed outcomes, next plans, and decisions for the selected audience.'}</p></div>{primaryAction}</div>

        {view === 'current' && activeStep === 0 ? <section className="panel report-confirmations" aria-label="Use case confirmations">
          {streams.map(stream => {
            const lead = state.members.find(member => member.id === stream.leadId);
            const status = stream.readiness;
            const timing = submissionTiming(periodEnd, state.settings, status.confirmed ? status.submission?.confirmedAt : undefined);
            const changes = status.stale ? sources.filter(source => source.kind !== 'Confirmation' && source.streams.includes(stream.id) && source.updatedAt > (status.submission?.sourceUpdatedAt || '')) : [];
            return <article className="report-confirmation-row" key={stream.id}>
              <div className="report-confirmation-heading"><div><h3>{stream.name}</h3><span className="report-lead"><Avatar member={lead} size={25} />{lead?.name || 'Lead unassigned'}</span></div><Badge tone={status.confirmed ? timing.late ? 'amber' : 'green' : timing.overdue ? 'red' : status.stale ? 'amber' : 'neutral'}>{status.confirmed ? timing.late ? 'Confirmed late' : 'Confirmed' : status.stale ? 'Needs reconfirmation' : timing.overdue ? 'Confirmation overdue' : 'Awaiting confirmation'}</Badge></div>
              <p className="muted">{status.confirmed ? `Reviewed ${formatDate(status.submission?.confirmedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone })}. ${timing.late ? 'Received after the submission deadline.' : 'Current sources are confirmed.'}` : status.stale ? 'Delivery sources changed after the last confirmation.' : timing.overdue ? 'The submission deadline has passed. A reviewed update is still needed.' : `Due Thursday at ${state.settings.submissionHour}:00 (${state.settings.timezone}).`}</p>
              {changes.length > 0 && <details className="report-source-details"><summary>{changes.length} changed {changes.length === 1 ? 'source' : 'sources'} to review</summary><ul>{changes.map(source => <li key={source.key}><span>{source.kind}</span><strong>{source.label}</strong><small>{source.context}</small></li>)}</ul></details>}
              {allowConfirm(stream) && <button className="button secondary" onClick={() => openConfirmation(stream)}>{status.confirmed ? 'Review confirmation' : status.stale ? 'Review changes & confirm' : 'Review & confirm'}<ArrowRight size={15} /></button>}
            </article>;
          })}
          {isPMO && confirmedCount < streams.length && <div className="report-confirmation-foot"><span>A draft can be prepared while updates are outstanding. Approval will require the gaps to be acknowledged.</span><button className="text-button" onClick={prepare}>Prepare draft with gaps<ArrowRight size={15} /></button></div>}
        </section> : selected ? <>
          {selectedStale && <section className="report-source-warning" role="status"><div className="heading-inline"><RefreshCw size={17} /><strong>Sources changed since this draft</strong></div><p>Prepare a fresh draft after reviewing the changes. The wording in this draft remains saved.</p><details className="report-source-details" open><summary>{changedSources.length + removedSourceCount} changed {changedSources.length + removedSourceCount === 1 ? 'source' : 'sources'}</summary><ul>{changedSources.map(source => <li key={source.key}><span>{source.kind}</span><strong>{source.label}</strong><small>{source.context}</small></li>)}{removedSourceCount > 0 && <li><strong>{removedSourceCount} source records are no longer available.</strong></li>}</ul></details></section>}
          {selected.supersedesId && <div className="notice"><History size={16} /><span>Correction of the {formatDate(state.reports.find(report => report.id === selected.supersedesId)?.periodEnd)} edition. Its historical content and reporting period are retained.</span></div>}
          <div className="report-canvas-toolbar"><span className="report-canvas-label">{selected.audience === 'client' ? 'Client audience' : 'Internal audience'} · {selected.status === 'approved' ? 'Approved' : 'Draft'} · v{selected.version}</span><div className="toolbar">
            <button className="button ghost" onClick={() => { navigator.clipboard.writeText(bodyText(selected.body)).then(() => notify('Report text copied.')).catch(() => notify('Copy was unavailable in this browser. Open the presentation and select the text.', true)); }}><Copy size={15} />Copy text</button>
            {selected.status === 'draft' && isPMO && <><button className="button secondary" onClick={() => { setEditor(structuredClone(selected)); setError(''); }}><Pencil size={15} />Edit wording</button><button className="button secondary" disabled={!aiAvailable || busy || selectedStale} title={!aiAvailable ? 'An approved AI provider has not been configured.' : selectedStale ? 'Prepare a fresh draft before using AI assistance.' : 'Review suggested wording before applying it.'} onClick={() => perform(async () => { const result: { body: ReportBody } = await mutate('/api/ai/report', { reportId: selected.id }, 'POST'); setProposal({ report: selected, body: result.body }); })}><Sparkles size={15} />AI wording proposal</button></>}
            {selected.status === 'approved' && isPMO && <button className="button secondary" disabled={busy} onClick={() => createReport(selected.audience, selected.id)}><RefreshCw size={15} />Create correction</button>}
          </div></div>
          <ReportPresentation report={selected} />
        </> : <section className="panel report-first-draft"><FileText size={32} /><h3>{view === 'archive' ? 'No edition selected' : `No ${currentAudience} draft for this period`}</h3><p>{view === 'archive' ? 'Choose another status or audience to find a saved edition.' : 'A draft combines the recorded delivery position, milestone forecasts, and summaries for this audience.'}</p>{view === 'current' && !isPMO && <p className="muted">A PMO team member prepares the draft after use case review.</p>}</section>}
      </section>

      <aside className="report-review-sidebar" aria-label="Report review checklist">
        <section className="panel"><div className="panel-header"><h2 className="section-title">Review checklist</h2></div><div className="report-checklist">
          <div className="report-check"><CheckCircle2 size={18} /><div><strong>{(selected?.audience || currentAudience) === 'client' ? 'Client audience' : 'Internal audience'}</strong><p>{(selected?.audience || currentAudience) === 'client' ? 'Check every line is appropriate for the client.' : 'This edition can include internal project context.'}</p></div></div>
          <div className={`report-check ${reviewMissing.length ? 'needs-attention' : 'complete'}`}>{reviewMissing.length ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}<div><strong>{reviewMissing.length ? `${reviewMissing.length} confirmations outstanding` : 'Use cases confirmed'}</strong><p>{reviewMissing.length ? reviewMissing.map(stream => stream.name).join(', ') : snapshotConfirmations ? 'Confirmed in this saved snapshot.' : 'All current use case sources have been reviewed.'}</p>{snapshotConfirmations && <small>Status recorded for this edition.</small>}</div></div>
          <div className={`report-check ${selectedStale ? 'needs-attention' : ''}`}>{selected?.status === 'approved' ? <LockKeyhole size={18} /> : <RefreshCw size={18} />}<div><strong>{selected?.status === 'approved' ? 'Fixed source snapshot' : selectedStale ? 'Source review needed' : selected ? 'Sources match this draft' : 'Draft not prepared'}</strong><p>{selected?.status === 'approved' ? 'Later changes do not alter this report.' : selectedStale ? 'Named source changes are shown beside the draft.' : selected ? 'No tracked records changed after preparation.' : 'Prepare after reviewing the delivery position.'}</p></div></div>
          <div className="report-check"><FileText size={18} /><div><strong>{selected?.status === 'approved' ? 'Approved wording' : 'Content review'}</strong><p>{selected?.status === 'approved' ? `Approved ${formatDate(selected.approvedAt)} by ${state.members.find(member => member.id === selected.approvedBy)?.name || 'an authorized approver'}.` : 'Verify completed outcomes, next plans, dependencies, and milestone dates before approval.'}</p></div></div>
        </div>
        <dl className="report-facts"><div><dt>Reporting period</dt><dd>Week ending {formatDate(selected?.periodEnd || periodEnd)}</dd></div>{selected && <div><dt>Information as of</dt><dd>{formatDate(selected.asOf, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone })}<small>{state.settings.timezone}</small></dd></div>}<div><dt>Approval</dt><dd>{selected?.status === 'approved' ? 'Approved edition' : user.canApproveReports ? 'You can approve this report' : `Awaiting ${state.members.filter(member => member.canApproveReports).map(member => member.name).join(' or ') || 'an authorized approver'}`}</dd></div></dl>
        </section>
        {selected?.incompleteReason && <section className="report-internal-note"><strong>Internal approval note</strong><p>{selected.incompleteReason}</p><small>This explanation is excluded from the presentation.</small></section>}
        {view === 'current' && reports.length > 1 && <Field label="Saved editions this period"><select className="select" value={selected?.id || ''} onChange={event => { setSelectedId(event.target.value); setStep(null); }}>{reports.map(report => <option key={report.id} value={report.id}>{report.status === 'approved' ? 'Approved' : 'Draft'}{report.supersedesId ? ' correction' : ''} · {formatDate(report.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone })}</option>)}</select></Field>}
      </aside>
    </div>
    {creating && <Modal title="Prepare a weekly brief" description="Start from the current delivery position. You can edit every line before approval." onClose={() => !busy && closeDialogs()}>
      <div className="stack">{error && <div className="notice notice-warning" role="alert">{error}</div>}<Field label="Audience"><select className="select" value={newAudience} onChange={event => setNewAudience(event.target.value as Report['audience'])}><option value="client">Client — client-safe source summaries</option><option value="internal">Internal — full project context</option></select></Field>
        <div className="notice"><strong>Week ending {formatDate(periodEnd)}</strong><p style={{ marginBottom: 0 }}>{confirmedCount} of {streams.length} use cases are confirmed. Drafting is available now; outstanding confirmations remain visible during approval.</p></div>
        <div className="form-actions"><button className="button secondary" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" disabled={busy} onClick={() => createReport(newAudience)}>{busy ? 'Preparing…' : 'Prepare draft'}</button></div>
      </div>
    </Modal>}

    {confirmation && <Modal title={`Confirm ${state.workstreams.find(stream => stream.id === confirmation.workstreamId)?.name || 'use case'}`} description={`Review the internal position for the week ending ${formatDate(periodEnd)}.`} onClose={() => !busy && closeDialogs()} variant="drawer" className="report-confirmation-drawer" wide>
      <form className="stack" onSubmit={event => { event.preventDefault(); perform(async () => { await mutate('/api/submissions', confirmation, 'POST'); closeDialogs(); notify('Use case confirmed for this reporting period.'); }); }}>
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
        {confirmation.sourceUpdatedAt !== latestWorkstreamChange(state, confirmation.workstreamId) && <div className="notice notice-warning">Sources changed while this form was open. Close and reopen the confirmation to review the current position.</div>}
        <div className="notice">This confirms the use case’s internal update. Client wording is reviewed separately in the report draft.</div>
        <details className="report-source-details" open><summary>Source records · latest changes first</summary><ul>{sources.filter(source => source.kind !== 'Confirmation' && source.streams.includes(confirmation.workstreamId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(source => <li key={source.key}><span>{source.kind}</span><strong>{source.label}</strong><small>{source.context} · Updated {formatDate(source.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone })}</small></li>)}</ul></details>
        <Field label="Delivery health"><select className="select" value={confirmation.health} onChange={event => setConfirmation({ ...confirmation, health: event.target.value as Submission['health'] })}>{Object.entries(healthLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <div className="form-grid"><Field label="Completed this week"><textarea className="textarea" rows={5} value={confirmation.completed} onChange={event => setConfirmation({ ...confirmation, completed: event.target.value })} /></Field><Field label="Next steps"><textarea className="textarea" rows={5} value={confirmation.next} onChange={event => setConfirmation({ ...confirmation, next: event.target.value })} /></Field><Field label="Changes to the plan"><textarea className="textarea" rows={4} value={confirmation.changes} onChange={event => setConfirmation({ ...confirmation, changes: event.target.value })} /></Field><Field label="Blockers / decisions needed"><textarea className="textarea" rows={4} value={confirmation.blockers} onChange={event => setConfirmation({ ...confirmation, blockers: event.target.value })} /></Field></div>
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" type="submit" disabled={busy || confirmation.sourceUpdatedAt !== latestWorkstreamChange(state, confirmation.workstreamId)}><Check size={15} />{busy ? 'Confirming…' : 'Confirm use case'}</button></div>
      </form>
    </Modal>}

    {editor && <Modal title="Edit report wording" description={editor.audience === 'client' ? 'Client audience. Only client-safe content belongs in this draft. Use one bullet per line.' : 'Internal audience. Refine the narrative using one bullet per line.'} onClose={() => !busy && closeDialogs()} variant="drawer" wide>
      <form className="stack" onSubmit={event => { event.preventDefault(); perform(async () => { await mutate(`/api/records/reports/${editor.id}`, { version: editor.version, changes: { body: cleanBody(editor.body) } }, 'PATCH'); closeDialogs(); notify('Report draft saved.'); }); }}>
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
        <Field label="Executive summary"><textarea className="textarea" rows={3} value={editor.body.summary} onChange={event => setEditor({ ...editor, body: { ...editor.body, summary: event.target.value } })} /></Field>
        <div className="form-grid">{textField('Progress this week', 'highlights')}{textField('Next week', 'nextWeek')}<div style={{ gridColumn: '1 / -1' }}>{textField('Attention & decisions', 'attention', 3)}</div></div>
        {editor.body.workstreams.map((stream, index) => <section className="panel" key={`${stream.name}-${index}`}><div className="panel-header"><h3 className="section-title">{stream.name}</h3><Badge tone={stream.health}>{healthLabel[stream.health]}</Badge></div><div className="panel-body form-grid">{(['completed', 'next', 'attention'] as const).map(key => <Field key={key} label={key === 'completed' ? 'Progress' : key === 'next' ? 'Next steps' : 'Attention'}><textarea className="textarea" rows={3} value={lines(stream[key])} onChange={event => setEditor({ ...editor, body: { ...editor.body, workstreams: editor.body.workstreams.map((value, position) => position === index ? { ...value, [key]: event.target.value.split('\n') } : value) } })} /></Field>)}</div></section>)}
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div>
      </form>
    </Modal>}

    {approval && <Modal title="Approve this brief" description="Approval creates a fixed edition. Further changes require a new revision." onClose={() => !busy && closeDialogs()}>
      <form className="stack" onSubmit={event => { event.preventDefault(); perform(async () => { await mutate(`/api/reports/${approval.id}/approve`, { version: approval.version, incompleteReason: incompleteReason.trim() || undefined }, 'POST'); closeDialogs(); notify('Brief approved. The presentation is ready.'); }); }}>
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
        <div className="notice"><strong>{approval.audience === 'client' ? 'Client' : 'Internal'} brief · {formatDate(approval.periodEnd)}</strong><p style={{ marginBottom: 0 }}>Confirm that you have reviewed the report’s content and it is appropriate for its audience.</p></div>
        {approvalMissing.length > 0 && <><div className="notice notice-warning"><strong>Outstanding confirmation</strong><p style={{ marginBottom: 0 }}>{approvalMissing.map(stream => stream.name).join(', ')}. Their reporting position is not currently confirmed.</p></div><Field label="Why is publication appropriate with these gaps?"><textarea className="textarea" rows={3} required value={incompleteReason} onChange={event => setIncompleteReason(event.target.value)} placeholder="Record your reason for approving an incomplete update." /></Field><p className="muted" style={{ fontSize: 13, marginTop: -8 }}>This approval explanation stays inside the hub.</p></>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" type="submit" disabled={busy || (approvalMissing.length > 0 && !incompleteReason.trim())}><LockKeyhole size={15} />{busy ? 'Approving…' : 'Approve edition'}</button></div>
      </form>
    </Modal>}

    {proposal && <Modal title="Review AI draft proposal" description="Check the suggested wording against your sources. Applying it replaces the draft’s report body; approval remains separate." onClose={() => !busy && closeDialogs()} wide>
      <div className="stack">{error && <div className="notice notice-warning" role="alert">{error}</div>}<div className="notice"><Sparkles size={16} /><span>This is a proposal. Nothing has been changed yet.</span></div><ReportPresentation report={{ ...proposal.report, body: proposal.body }} /><div className="form-actions"><button className="button secondary" disabled={busy} onClick={closeDialogs}>Discard proposal</button><button className="button primary" disabled={busy} onClick={() => perform(async () => { await mutate(`/api/records/reports/${proposal.report.id}`, { version: proposal.report.version, changes: { body: cleanBody(proposal.body) } }, 'PATCH'); closeDialogs(); notify('AI proposal applied to the draft. Review before approval.'); })}>{busy ? 'Applying…' : 'Apply to draft'}</button></div></div>
    </Modal>}
  </div>;
}
