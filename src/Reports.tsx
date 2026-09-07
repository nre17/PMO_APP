import { useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock3, Copy, ExternalLink, FileText, LockKeyhole, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { HubState, PageProps, Report, ReportBody, Submission, Workstream } from '../shared/types';
import { Avatar, Badge, Field, Modal, formatDate, healthLabel } from './ui';
import { confirmationState, latestWorkstreamChange, reportingPeriod, submissionTiming } from '../shared/reporting';

function isSourceStale(state: HubState, report: Report) {
  const current: Record<string, number> = {};
  for (const collection of ['workstreams', 'items', 'milestones', 'registers', 'submissions'] as const) for (const record of state[collection]) current[`${collection}:${record.id}`] = record.version;
  return Object.keys(current).length !== Object.keys(report.sourceVersions).length || Object.entries(current).some(([key, version]) => report.sourceVersions[key] !== version);
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
  return <article className="report-page">
    <header className="report-cover">
      <div className="eyebrow">{report.audience === 'client' ? 'CLIENT DELIVERY BRIEF' : 'INTERNAL DELIVERY BRIEF'}</div>
      <div className="report-meta"><span>{formatDate(report.periodStart)} — {formatDate(report.periodEnd, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' })}</span><span>{report.status === 'approved' ? 'Approved edition' : 'Draft · for review'}</span></div>
      <h1>{report.title}</h1>
      <p>{report.body.summary}</p>
    </header>
    <div className="report-columns">
      <section className="report-section"><div className="eyebrow">01 / PROGRESS</div><h2>This week</h2><BriefList values={report.body.highlights} empty="No completed outcomes recorded for this period." /></section>
      <section className="report-section"><div className="eyebrow">02 / LOOKING AHEAD</div><h2>Next week</h2><BriefList values={report.body.nextWeek} empty="Next steps will be confirmed in the next update." /></section>
    </div>
    <section className="report-section report-attention"><div className="eyebrow">03 / ATTENTION & DECISIONS</div><h2>Where we need alignment</h2><BriefList values={report.body.attention} empty="No additional decisions or escalations recorded." /></section>
    {report.body.workstreams.length > 0 && <section className="report-section"><div className="eyebrow">04 / WORKSTREAMS</div><h2>Delivery outlook</h2><div className="stack">{report.body.workstreams.map((stream, index) => <div className="report-workstream" key={`${stream.name}-${index}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}><h3>{stream.name}</h3><Badge tone={stream.health}>{healthLabel[stream.health]}</Badge></div>
      {!stream.confirmed && <p className="muted" style={{ fontSize: 12 }}>{report.status === 'approved' ? 'Workstream confirmation was outstanding at publication.' : 'Workstream confirmation is outstanding for this edition.'}</p>}
      <div className="report-columns"><div><h4>Progress</h4><BriefList values={stream.completed} empty="No completed outcomes recorded." /></div><div><h4>Next steps</h4><BriefList values={stream.next} empty="No further steps recorded." /></div></div>
      {stream.attention.some(value => value.trim()) && <div><h4>Attention</h4><BriefList values={stream.attention} empty="" /></div>}
    </div>)}</div></section>}
    {report.body.milestones.length > 0 && <section className="report-section"><div className="eyebrow">05 / MILESTONES</div><h2>Dates that matter</h2><table className="data-table"><thead><tr><th>Milestone</th><th>Forecast</th><th>Outlook</th></tr></thead><tbody>{report.body.milestones.map((milestone, index) => <tr key={index}><td>{milestone.title}</td><td>{formatDate(milestone.forecastDate)}</td><td>{milestone.status === 'at_risk' ? 'At risk' : milestone.status === 'complete' ? 'Complete' : milestone.status === 'planned' ? 'Planned' : milestone.status}</td></tr>)}</tbody></table></section>}
    <footer className="report-meta" style={{ paddingTop: 24, marginTop: 18, borderTop: '1px solid var(--border, #e7e7ee)' }}><span>Information as of {formatDate(report.asOf, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })} GST</span><span>{report.status === 'approved' ? 'A fixed record of this reporting period' : 'Review required before publication'}</span></footer>
  </article>;
}

type ConfirmationDraft = Pick<Submission, 'workstreamId' | 'completed' | 'next' | 'changes' | 'blockers' | 'health' | 'sourceUpdatedAt'>;

export function Reports({ state, user, mutate, notify, aiAvailable }: PageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const isPMO = user.role === 'pmo' || user.role === 'admin';
  const periodRange = reportingPeriod(new Date(), state.settings.timezone, state.settings.cutoffHour);
  const periodEnd = periodRange.end;
  const streams = state.workstreams.map(stream => ({ ...stream, readiness: confirmationState(state, stream.id, periodEnd) }));
  const confirmedCount = streams.filter(stream => stream.readiness.confirmed).length;
  const reports = useMemo(() => [...state.reports].filter(report => audienceFilter === 'all' || report.audience === audienceFilter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.reports, audienceFilter]);
  const selected = reports.find(report => report.id === selectedId) || reports[0];
  const selectedStale = Boolean(selected?.status === 'draft' && isSourceStale(state, selected));
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
      setAudienceFilter('all'); setSelectedId(report.id); closeDialogs();
      notify(supersedesId ? 'Correction draft created. The approved report is preserved.' : 'Draft prepared from the current reporting sources.');
    });
  }
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
  return <div className="stack">
    <div className="page-header"><div><div className="eyebrow">THURSDAY, WITHOUT THE CHASE</div><h1 className="page-title">Weekly brief</h1><p className="page-subtitle">One reviewed story. A clear record of what we committed to.</p></div>{isPMO && <button className="button primary" onClick={() => { setError(''); setCreating(true); }}><Plus size={17} /> New brief</button>}</div>

    <section className="panel">
      <div className="panel-header"><div><h2 className="section-title">Ready for Thursday</h2><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Week ending {formatDate(periodEnd)} · Lead updates by {state.settings.submissionHour}:00 · Cutoff {state.settings.cutoffHour}:00 ({state.settings.timezone})</p></div><Badge tone={confirmedCount === streams.length ? 'green' : 'amber'}>{confirmedCount} / {streams.length} confirmed</Badge></div>
      <div className="report-readiness" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 0 }}>
        {streams.map(stream => { const lead = state.members.find(member => member.id === stream.leadId); const status = stream.readiness; const timing = submissionTiming(periodEnd, state.settings, status.confirmed ? status.submission?.confirmedAt : undefined); return <div className="readiness-card" key={stream.id} style={{ padding: '20px 24px', borderTop: '1px solid var(--border, #e7e7ee)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><span className="tag">{stream.shortName}</span>{status.confirmed ? <CheckCircle2 size={18} style={{ color: '#30856a' }} /> : <Clock3 size={18} style={{ color: '#b47928' }} />}</div>
          <h3 style={{ margin: '13px 0 8px', fontSize: 15 }}>{stream.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar member={lead} size={23} /><span className="muted" style={{ fontSize: 12 }}>{lead?.name || 'Lead unassigned'}</span></div>
          <div style={{ marginTop: 15 }}><Badge tone={status.confirmed ? timing.late ? 'amber' : 'green' : timing.overdue ? 'red' : status.stale ? 'amber' : 'neutral'}>{status.confirmed ? timing.late ? 'Confirmed · late' : 'Confirmed' : timing.overdue ? status.stale ? 'Reconfirmation overdue' : 'Update overdue' : status.stale ? 'Changed since confirmation' : 'Awaiting confirmation'}</Badge></div>
          <p className="muted" style={{ fontSize: 12, minHeight: 32, margin: '9px 0 12px' }}>{status.confirmed ? `Reviewed ${formatDate(status.submission?.confirmedAt)}${timing.late ? ' after the submission deadline' : ''}. Ready for this reporting period.` : status.stale ? 'Delivery sources changed. Review and confirm the latest position.' : timing.overdue ? 'The submission deadline has passed. A reviewed update is still needed.' : 'The lead has not confirmed this week’s position yet.'}</p>
          {allowConfirm(stream) && <button className="button ghost small" onClick={() => openConfirmation(stream)}>{status.confirmed ? 'Review confirmation' : 'Review & confirm'}<ArrowRight size={13} /></button>}
        </div>; })}
      </div>
    </section>

    {error && !creating && !editor && !approval && !confirmation && !proposal && <div className="notice notice-warning" role="alert">{error}</div>}
    <div className="reports-layout">
      <aside className="panel report-archive">
        <div className="panel-header"><h2 className="section-title">Brief archive</h2><FileText size={17} className="muted" /></div>
        <div style={{ padding: '0 16px 14px' }}><select className="select" style={{ width: '100%' }} aria-label="Report audience" value={audienceFilter} onChange={event => { setAudienceFilter(event.target.value as typeof audienceFilter); setSelectedId(null); }}><option value="all">All audiences</option><option value="client">Client briefs</option><option value="internal">Internal briefs</option></select></div>
        {reports.length ? <div className="report-archive-list">{reports.map(report => <button key={report.id} className={`report-archive-entry ${selected?.id === report.id ? 'active' : ''}`} onClick={() => { setSelectedId(report.id); setError(''); }} aria-current={selected?.id === report.id ? 'true' : undefined}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><strong>{formatDate(report.periodEnd)}</strong>{report.status === 'approved' ? <LockKeyhole size={13} /> : <Pencil size={13} />}</span>
          <span className="muted" style={{ fontSize: 12 }}>{report.audience === 'client' ? 'Client brief' : 'Internal brief'}{report.supersedesId ? ' · correction' : ''}</span>
          <span><Badge tone={report.status === 'approved' ? 'green' : 'neutral'}>{report.status === 'approved' ? 'Approved' : 'Draft'}</Badge></span>
        </button>)}</div> : <div className="empty-state"><p>No briefs for this audience yet.</p></div>}
      </aside>

      {selected ? <section className="panel" style={{ minWidth: 0 }}>
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 14 }}><div><h2 className="section-title">{selected.status === 'approved' ? 'Approved brief' : 'Review your draft'}</h2><p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{selected.audience === 'client' ? 'Client-safe report content' : 'Internal project update'} · Version {selected.version}</p></div>
          <div className="toolbar" style={{ gap: 7 }}>
            <button className="button ghost small" onClick={() => { navigator.clipboard.writeText(bodyText(selected.body)).then(() => notify('Report text copied.')).catch(() => notify('Copy was unavailable in this browser. Open the presentation and select the text.', true)); }}><Copy size={14} /> Copy text</button>
            {selected.status === 'approved' ? <><a className="button primary small" href={`/brief/${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Present</a>{isPMO && <button className="button secondary small" disabled={busy} onClick={() => createReport(selected.audience, selected.id)}><RefreshCw size={14} /> New revision</button>}</> : isPMO && <>
              <button className="button secondary small" onClick={() => { setEditor(structuredClone(selected)); setError(''); }}><Pencil size={14} /> Edit draft</button>
              <button className="button secondary small" disabled={!aiAvailable || busy || selectedStale} title={!aiAvailable ? 'Configure an AI provider to use optional draft assistance.' : selectedStale ? 'Create a fresh draft before requesting AI assistance.' : 'Generate a proposal for your review; nothing is applied automatically.'} onClick={() => perform(async () => { const result: { body: ReportBody } = await mutate('/api/ai/report', { reportId: selected.id }, 'POST'); setProposal({ report: selected, body: result.body }); })}><Sparkles size={14} /> {busy ? 'Working…' : 'AI proposal'}</button>
            </>}
            {selected.status === 'draft' && user.canApproveReports && <button className="button primary small" disabled={busy || selectedStale} onClick={() => { setApproval(selected); setIncompleteReason(''); setError(''); }}><Check size={14} /> Approve</button>}
          </div>
        </div>
        {selectedStale && <div className="notice notice-warning" style={{ margin: '0 24px 20px' }}><strong>Sources changed after this draft was created.</strong><p style={{ margin: '5px 0 10px' }}>Review the latest workstream confirmations, then create a fresh draft. This draft’s edited wording remains available for reference.</p>{isPMO && <button className="button secondary small" disabled={busy} onClick={() => createReport(selected.audience, selected.supersedesId)}><RefreshCw size={13} /> Create fresh draft</button>}</div>}
        {selected.status === 'approved' && <div className="notice notice-success" style={{ margin: '0 24px 20px' }}><LockKeyhole size={15} /><span>Approved {formatDate(selected.approvedAt)}. Later delivery updates do not change this edition.</span></div>}
        {selected.status === 'draft' && selected.audience === 'client' && <div className="notice" style={{ margin: '0 24px 20px' }}>Review every line for the client. The presentation contains this report’s selected content; internal notes and activity stay in the hub.</div>}
        <ReportPresentation report={selected} />
      </section> : <section className="panel empty-state"><FileText size={36} /><h2>Your first brief starts here</h2><p>Confirm workstream updates, prepare a draft, then approve the story you want to share.</p>{isPMO && <button className="button primary" onClick={() => setCreating(true)}>Create a brief</button>}</section>}
    </div>

    {creating && <Modal title="Prepare a weekly brief" description="Start from the current delivery position. You can edit every line before approval." onClose={() => !busy && closeDialogs()}>
      <div className="stack">{error && <div className="notice notice-warning" role="alert">{error}</div>}<Field label="Audience"><select className="select" value={newAudience} onChange={event => setNewAudience(event.target.value as Report['audience'])}><option value="client">Client — client-safe source summaries</option><option value="internal">Internal — full project context</option></select></Field>
        <div className="notice"><strong>Week ending {formatDate(periodEnd)}</strong><p style={{ marginBottom: 0 }}>{confirmedCount} of {streams.length} workstreams are confirmed. Drafting is available now; outstanding confirmations remain visible during approval.</p></div>
        <div className="form-actions"><button className="button secondary" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" disabled={busy} onClick={() => createReport(newAudience)}>{busy ? 'Preparing…' : 'Prepare draft'}</button></div>
      </div>
    </Modal>}

    {confirmation && <Modal title={`Confirm ${state.workstreams.find(stream => stream.id === confirmation.workstreamId)?.name || 'workstream'}`} description={`Review the internal position for the week ending ${formatDate(periodEnd)}.`} onClose={() => !busy && closeDialogs()} wide>
      <form className="stack" onSubmit={event => { event.preventDefault(); perform(async () => { await mutate('/api/submissions', confirmation, 'POST'); closeDialogs(); notify('Workstream confirmed for this reporting period.'); }); }}>
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
        {confirmation.sourceUpdatedAt !== latestWorkstreamChange(state, confirmation.workstreamId) && <div className="notice notice-warning">Sources changed while this form was open. Close and reopen the confirmation to review the current position.</div>}
        <div className="notice">This confirms the workstream’s internal update. Client wording is reviewed separately in the report draft.</div>
        <details className="panel" open={Boolean(confirmationState(state, confirmation.workstreamId, periodEnd).stale)}><summary style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 600 }}>Latest delivery position</summary><div className="panel-body" style={{ maxHeight: 220, overflowY: 'auto' }}>{state.items.filter(item => item.workstreamId === confirmation.workstreamId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10).map(item => <div key={item.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border, #e7e7ee)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong style={{ fontSize: 13 }}>{item.title}</strong><Badge tone={item.blocked ? 'red' : item.stage === 'Closed' ? 'green' : 'neutral'}>{item.blocked ? 'Blocked' : item.stage}</Badge></div><p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{item.blocked ? item.blockReason : item.nextAction || 'No next action recorded'}</p></div>)}</div></details>
        <Field label="Delivery health"><select className="select" value={confirmation.health} onChange={event => setConfirmation({ ...confirmation, health: event.target.value as Submission['health'] })}>{Object.entries(healthLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <div className="form-grid"><Field label="Completed this week"><textarea className="textarea" rows={5} value={confirmation.completed} onChange={event => setConfirmation({ ...confirmation, completed: event.target.value })} /></Field><Field label="Next steps"><textarea className="textarea" rows={5} value={confirmation.next} onChange={event => setConfirmation({ ...confirmation, next: event.target.value })} /></Field><Field label="Changes to the plan"><textarea className="textarea" rows={4} value={confirmation.changes} onChange={event => setConfirmation({ ...confirmation, changes: event.target.value })} /></Field><Field label="Blockers / decisions needed"><textarea className="textarea" rows={4} value={confirmation.blockers} onChange={event => setConfirmation({ ...confirmation, blockers: event.target.value })} /></Field></div>
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" type="submit" disabled={busy || confirmation.sourceUpdatedAt !== latestWorkstreamChange(state, confirmation.workstreamId)}><Check size={15} />{busy ? 'Confirming…' : 'Confirm workstream'}</button></div>
      </form>
    </Modal>}

    {editor && <Modal title="Edit report wording" description={editor.audience === 'client' ? 'Only client-safe content belongs in this draft. Use one bullet per line.' : 'Refine the internal narrative. Use one bullet per line.'} onClose={() => !busy && closeDialogs()} wide>
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
        {approvalMissing.length > 0 && <><div className="notice notice-warning"><strong>Outstanding confirmation</strong><p style={{ marginBottom: 0 }}>{approvalMissing.map(stream => stream.name).join(', ')}. Their reporting position is not currently confirmed.</p></div><Field label="Why is publication appropriate with these gaps?"><textarea className="textarea" rows={3} required value={incompleteReason} onChange={event => setIncompleteReason(event.target.value)} placeholder="Record your reason for approving an incomplete update." /></Field><p className="muted" style={{ fontSize: 12, marginTop: -8 }}>This approval explanation stays inside the hub.</p></>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={closeDialogs}>Cancel</button><button className="button primary" type="submit" disabled={busy || (approvalMissing.length > 0 && !incompleteReason.trim())}><LockKeyhole size={15} />{busy ? 'Approving…' : 'Approve edition'}</button></div>
      </form>
    </Modal>}

    {proposal && <Modal title="Review AI draft proposal" description="Check the suggested wording against your sources. Applying it replaces the draft’s report body; approval remains separate." onClose={() => !busy && closeDialogs()} wide>
      <div className="stack">{error && <div className="notice notice-warning" role="alert">{error}</div>}<div className="notice"><Sparkles size={16} /><span>This is a proposal. Nothing has been changed yet.</span></div><ReportPresentation report={{ ...proposal.report, body: proposal.body }} /><div className="form-actions"><button className="button secondary" disabled={busy} onClick={closeDialogs}>Discard proposal</button><button className="button primary" disabled={busy} onClick={() => perform(async () => { await mutate(`/api/records/reports/${proposal.report.id}`, { version: proposal.report.version, changes: { body: cleanBody(proposal.body) } }, 'PATCH'); closeDialogs(); notify('AI proposal applied to the draft. Review before approval.'); })}>{busy ? 'Applying…' : 'Apply to draft'}</button></div></div>
    </Modal>}
  </div>;
}
