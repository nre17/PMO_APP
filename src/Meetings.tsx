import { useState } from 'react';
import { ArrowUpRight, Check, Plus, Save, Sparkles } from 'lucide-react';
import type { AIProposal, Meeting, PageProps } from '../shared/types';
import { recordAttention } from '../shared/reporting';
import { Badge, Field, Modal, canEdit, formatDate } from './ui';

export function MeetingWorkspace({ onClose, ...props }: PageProps & { onClose: () => void }) {
  const { state, mutate, notify, user, openItem, aiAvailable } = props;
  const [selectedId, setSelectedId] = useState(state.meetings[0]?.id || '');
  const original = state.meetings.find(meeting => meeting.id === selectedId);
  const [title, setTitle] = useState(original?.title || 'Daily delivery review');
  const [notes, setNotes] = useState(original?.notes || '');
  const [heldAt, setHeldAt] = useState(original?.heldAt || new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposals, setProposals] = useState<(AIProposal & { workstreamId: string })[]>([]);
  const editable = canEdit(user);
  const allowedStreams = state.workstreams.filter(stream => user.role === 'pmo' || user.role === 'admin' || user.workstreamIds.includes(stream.id));
  const agenda = state.items.map(item => ({ item, attention: recordAttention(item, state.settings) }))
    .filter(({ item, attention }) => item.stage !== 'Closed' && (item.blocked || attention.overdue || item.stage === 'Awaiting client acceptance'))
    .sort((a, b) => Number(b.attention.escalationDue) - Number(a.attention.escalationDue) || Number(b.item.blocked) - Number(a.item.blocked) || a.item.dueDate.localeCompare(b.item.dueDate)).slice(0, 8);
  const decisions = state.registers.filter(register => register.type === 'decision' && register.status !== 'resolved').sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  async function save(): Promise<Meeting> {
    const data = { title, heldAt, notes, linkedItemIds: original?.linkedItemIds || [], linkedRegisterIds: original?.linkedRegisterIds || [] };
    const result = await mutate(original ? `/api/records/meetings/${original.id}` : '/api/records/meetings', original ? { version: original.version, changes: data } : data, original ? 'PATCH' : 'POST');
    setSelectedId(result.id);
    return result;
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (caught) { const message = caught instanceof Error ? caught.message : 'This action could not be completed.'; setError(message); notify(message, true); }
    finally { setBusy(false); }
  }
  const change = (index: number, key: string, value: string) => setProposals(current => current.map((proposal, position) => position === index ? { ...proposal, [key]: value } : proposal));
  function selectMeeting(id: string) {
    const meeting = state.meetings.find(value => value.id === id);
    setSelectedId(id); setTitle(meeting?.title || 'Daily delivery review'); setNotes(meeting?.notes || ''); setHeldAt(meeting?.heldAt || new Date().toISOString()); setProposals([]); setError('');
  }

  return <Modal wide className="meeting-workspace" title="Daily delivery review" description="Review exceptions, record the outcome, and give each follow-up an owner." onClose={() => !busy && onClose()}>
    {error && <div className="notice notice-warning" role="alert">{error}</div>}
    <div className="meeting-layout">
      <section className="meeting-agenda" aria-label="Live review agenda">
        <h3>Delivery exceptions</h3><p className="muted">Start with escalations, blockers, missed dates, and client responses.</p>
        {agenda.length ? agenda.map(({ item, attention }) => <button className="agenda-item" key={item.id} disabled={busy} onClick={() => { onClose(); openItem(item.id); }}>
          <strong>{item.title}</strong><span className="meeting-agenda-meta">{item.blocked ? 'Blocked' : item.stage} · {state.members.find(member => member.id === item.currentOwnerId)?.name || 'Unassigned'}</span><span>{item.blocked ? item.blockReason : item.nextAction || 'Next action not recorded'}</span><span className="meeting-agenda-meta">{attention.escalationDue ? 'Escalation review · ' : attention.overdue ? 'Overdue · ' : ''}Due {formatDate(item.dueDate)}</span><ArrowUpRight size={16} />
        </button>) : <p className="muted">No active blockers, overdue work, or client responses in the agenda.</p>}
        <h3>Decisions needed</h3>
        {decisions.length ? decisions.map(register => <div className="agenda-decision" key={register.id}><strong>{register.title}</strong><p>{register.nextAction || 'Next action not recorded'}</p><span className="meeting-agenda-meta">{state.members.find(member => member.id === register.ownerId)?.name || 'Unassigned'} · Due {formatDate(register.dueDate)}</span></div>) : <p className="muted">No open decision requests.</p>}
      </section>

      <section className="meeting-notes" aria-label="Meeting notes">
        <Field label="Meeting record"><select value={selectedId} disabled={busy} onChange={event => selectMeeting(event.target.value)}><option value="">New meeting</option>{state.meetings.map(meeting => <option value={meeting.id} key={meeting.id}>{meeting.title} · {formatDate(meeting.heldAt)}</option>)}</select></Field>
        <Field label="Meeting title"><input disabled={!editable || busy} value={title} onChange={event => setTitle(event.target.value)} /></Field>
        <Field label="Notes and outcomes"><textarea disabled={!editable || busy} rows={12} value={notes} onChange={event => setNotes(event.target.value)} placeholder="What changed? What was decided? Who acts next, and by when?" /></Field>
        {editable && <div className="form-actions meeting-save-row"><button className="button primary" disabled={busy || !title.trim()} onClick={() => perform(async () => { await save(); notify('Meeting notes saved.'); })}><Save size={16} />{busy ? 'Working…' : 'Save notes'}</button><button className="button secondary" disabled={busy || !notes.trim() || !title.trim() || !aiAvailable || !allowedStreams.length} title={!aiAvailable ? 'AI assistance is not configured. You can add follow-ups manually.' : 'Save notes and suggest follow-ups for your review.'} onClick={() => perform(async () => {
          await save();
          const response = await mutate('/api/ai/extract', { notes });
          setProposals(current => [...current, ...response.proposals.map((proposal: AIProposal) => ({ ...proposal, workstreamId: allowedStreams.some(stream => stream.id === proposal.workstreamId) ? proposal.workstreamId! : allowedStreams[0].id }))]);
          notify('Suggested follow-ups are ready for review.');
        })}><Sparkles size={16} />Suggest follow-ups</button></div>}
        {editable && <p className="muted small-text">{aiAvailable ? 'AI suggestions stay separate until you review and add them to the project.' : 'AI assistance is not configured. Add actions and decisions manually below.'}</p>}
        {original && (original.linkedItemIds.length > 0 || original.linkedRegisterIds.length > 0) && <section className="linked-records"><h3>Added to the project</h3>{original.linkedItemIds.map(id => <button className="text-button" key={id} disabled={busy} onClick={() => { onClose(); openItem(id); }}>{state.items.find(item => item.id === id)?.title || id}<ArrowUpRight size={14} /></button>)}{original.linkedRegisterIds.map(id => <p key={id}>{state.registers.find(register => register.id === id)?.title || id}</p>)}</section>}
      </section>
    </div>

    {editable && <section className="capture-section">
      <div className="panel-header"><div><h3>Follow-ups to review {proposals.length > 0 && <Badge>{proposals.length}</Badge>}</h3><p className="muted">Confirm the owner and date. Adding a follow-up creates one shared project record.</p></div><button className="button secondary" disabled={busy || !allowedStreams.length} onClick={() => setProposals(current => [...current, { type: 'action', title: '', detail: '', ownerId: null, dueDate: null, sourceQuote: '', workstreamId: allowedStreams[0].id }])}><Plus size={16} />Add follow-up</button></div>
      {!proposals.length && <p className="capture-empty">{allowedStreams.length ? 'No pending follow-ups. Add an action, issue, or decision from the discussion.' : 'You need workstream membership to capture a project follow-up.'}</p>}
      {proposals.map((proposal, index) => <article className="proposal-card" key={index}>
        {proposal.sourceQuote && <><p className="muted small-text">Suggested from these meeting notes</p><blockquote>{proposal.sourceQuote}</blockquote></>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="form-grid">
          <Field label="Follow-up type"><select value={proposal.type} onChange={event => change(index, 'type', event.target.value)}><option value="action">Action</option><option value="issue">Issue / blocker</option><option value="decision">Decision request</option></select></Field>
          <Field label="Workstream"><select value={proposal.workstreamId} onChange={event => change(index, 'workstreamId', event.target.value)}>{allowedStreams.map(stream => <option value={stream.id} key={stream.id}>{stream.name}</option>)}</select></Field>
        </div><Field label="Title"><input value={proposal.title} onChange={event => change(index, 'title', event.target.value)} placeholder="A specific action or decision" /></Field><Field label="Context and next action"><textarea rows={2} value={proposal.detail} onChange={event => change(index, 'detail', event.target.value)} /></Field><div className="form-grid">
          <Field label="Owner"><select value={proposal.ownerId || ''} onChange={event => change(index, 'ownerId', event.target.value)}><option value="">Choose owner</option>{state.members.filter(member => member.role !== 'executive').map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select></Field>
          <Field label="Due date"><input type="date" value={proposal.dueDate || ''} onChange={event => change(index, 'dueDate', event.target.value)} /></Field>
        </div></fieldset>
        <div className="form-actions"><button className="button ghost" disabled={busy} onClick={() => setProposals(current => current.filter((_, position) => position !== index))}>Discard</button><button className="button primary" disabled={busy || !proposal.ownerId || !proposal.dueDate || !proposal.title.trim() || !title.trim()} onClick={() => perform(async () => {
          const saved = await save();
          await mutate(`/api/meetings/${saved.id}/capture`, { version: saved.version, proposal, workstreamId: proposal.workstreamId });
          setProposals(current => current.filter((_, position) => position !== index));
          notify('Follow-up added to the project.');
        })}><Check size={16} />Add to project</button></div>
      </article>)}
    </section>}
  </Modal>;
}