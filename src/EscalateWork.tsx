import { useState, type FormEvent } from 'react';
import { ArrowRight, Flag } from 'lucide-react';
import type { HubState, PageProps, Priority, Register, WorkItem } from '../shared/types';
import { recordAttention } from '../shared/reporting';
import { Badge, Field, formatDate, memberName } from './ui';
import './escalate-work.css';

export function itemEscalations(state: HubState, itemId: string): Register[] {
  const hasEscalatedStatus = (snapshot: unknown): boolean => typeof snapshot === 'object' && snapshot !== null && 'status' in snapshot && snapshot.status === 'escalated';
  const raisedIds = new Set(state.events.filter(event => event.entityType === 'registers' && (event.action === 'escalated' || hasEscalatedStatus(event.before) || hasEscalatedStatus(event.after))).map(event => event.entityId));
  return state.registers.filter(record => record.relatedItemIds.includes(itemId) && (record.status === 'escalated' || raisedIds.has(record.id)))
    .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || b.updatedAt.localeCompare(a.updatedAt));
}

export function EscalationSummary({ state, item, allowed, onEscalate, onOpenRegister, recent }: {
  state: HubState; item: WorkItem; allowed: boolean; onEscalate: () => void;
  onOpenRegister?: (id: string) => void; recent?: Register;
}) {
  const recorded = itemEscalations(state, item.id);
  const records = recent && !state.registers.some(record => record.id === recent.id) ? [recent, ...recorded] : recorded;
  const unresolved = records.filter(record => record.status !== 'resolved');
  const resolved = records.filter(record => record.status === 'resolved');
  const attention = recordAttention(item, state.settings);
  const historyOnly = !unresolved.length && !attention.escalationDue && !allowed;
  if (!allowed && !records.length && !attention.escalationDue) return null;

  function renderRecord(record: Register) {
    return <article className="work-escalation-record" key={record.id}>
      <div className="work-escalation-record-heading"><strong>{record.title}</strong><Badge tone={record.status === 'resolved' ? 'green' : record.status === 'escalated' ? 'amber' : 'neutral'}>{record.status === 'resolved' ? 'Resolved' : record.status === 'escalated' ? 'Escalated' : record.status === 'monitoring' ? 'Monitoring' : 'Open'}</Badge></div>
      <p>{record.nextAction || record.detail || 'Review the escalation record for the next action.'}</p>
      <div className="work-escalation-record-footer"><span>{memberName(state, record.ownerId)} <span aria-hidden="true">·</span> Target {formatDate(record.dueDate)}</span>{onOpenRegister && <button type="button" className="text-button" onClick={() => onOpenRegister(record.id)}>Open escalation<ArrowRight size={14} aria-hidden="true" /></button>}</div>
    </article>;
  }

  return <section className={`work-escalation-summary${unresolved.length ? ' is-raised' : attention.escalationDue ? ' needs-review' : ''}`} aria-label="Work escalation">
    <div className="work-escalation-summary-heading"><div><h2><Flag size={17} aria-hidden="true" />{unresolved.length ? 'Escalation raised' : attention.escalationDue ? 'Escalation review due' : historyOnly ? 'Escalation history' : 'Need a decision or intervention?'}</h2>
      {!unresolved.length && !historyOnly && <p>{attention.escalationDue ? item.priority === 'Critical' ? 'This critical blocker needs an escalation review.' : `Blocked for ${attention.blockedWorkingDays} working days; the review threshold is ${state.settings.blockedEscalationDays}.` : 'Assign the help needed to a teammate with a clear target.'}{attention.escalationDue && ' No unresolved escalation is recorded.'}</p>}</div>
      {allowed && !unresolved.length && <button type="button" className="button secondary small" onClick={onEscalate}><Flag size={15} aria-hidden="true" />Escalate</button>}
    </div>
    {unresolved.map(renderRecord)}
    {!allowed && !unresolved.length && attention.escalationDue && <p className="work-escalation-permission">An assigned owner, use case lead, or PMO can raise the escalation.</p>}
    {resolved.length > 0 && <details className="work-escalation-history"><summary>{resolved.length} resolved escalation{resolved.length === 1 ? '' : 's'}</summary>{resolved.map(renderRecord)}</details>}
  </section>;
}

export default function EscalateWork({ item, allowed, onClose, onRaised, onBusyChange, ...props }: PageProps & {
  item: WorkItem; allowed: boolean; onClose: () => void; onRaised: (record: Register) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const { state, mutate, notify } = props;
  const [version, setVersion] = useState(item.version);
  const [title, setTitle] = useState(item.title);
  const [decisionNeeded, setDecisionNeeded] = useState(item.blockReason || item.nextAction || '');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority | ''>(item.priority === 'Not set' ? '' : item.priority);
  const [milestoneIds, setMilestoneIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = itemEscalations(state, item.id).find(record => record.status !== 'resolved');
  const stale = version !== item.version;
  const canSubmit = allowed && item.stage !== 'Closed' && !existing && !stale && title.trim() && decisionNeeded.trim() && ownerId && dueDate && priority;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const result: { register: Register; item: WorkItem } = await mutate(`/api/items/${encodeURIComponent(item.id)}/escalate`, {
        version, title: title.trim(), decisionNeeded: decisionNeeded.trim(), ownerId, dueDate, priority, milestoneIds
      }, 'POST');
      notify(`Escalation assigned to ${memberName(state, result.register.ownerId)}. Track the decision in the linked record.`);
      onRaised(result.register);
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message); notify(message, true);
    } finally { setBusy(false); onBusyChange?.(false); }
  }

  return <form className="work-escalation-form" onSubmit={save}>
    <ol className="work-escalation-flow" aria-label="Escalation workflow"><li>Identify issue</li><li aria-current="step">Assign escalation</li><li>Record decision</li></ol>
    <p className="desk-help">Give the person taking this escalation a specific decision or intervention to work toward. The linked issue record holds the response and resolution.</p>
    {error && <div className="notice notice-warning" role="alert">{error}</div>}
    {!allowed && <div className="notice notice-warning" role="alert">An assigned owner, use case lead, or PMO can escalate this work.</div>}
    {existing && <div className="notice notice-warning" role="status"><p>An unresolved escalation is already linked to this work: {existing.title}.</p>{props.openRegister && <button type="button" className="button secondary small" onClick={() => props.openRegister?.(existing.id)}>Open existing escalation<ArrowRight size={14} /></button>}</div>}
    {stale && !existing && <div className="notice notice-warning" role="alert"><p>This work changed while the form was open. Current stage: {item.stage}; next action owner: {memberName(state, item.currentOwnerId)}. Your escalation details are still here.</p><button type="button" className="button secondary small" disabled={busy || item.stage === 'Closed'} onClick={() => { setVersion(item.version); setError(''); }}>Use reviewed current record</button></div>}
    <fieldset className="desk-fieldset" disabled={busy || !allowed || Boolean(existing)}>
      <Field label="Escalation title"><input required maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <Field label="Decision or intervention needed"><textarea required maxLength={12000} rows={4} value={decisionNeeded} onChange={event => setDecisionNeeded(event.target.value)} placeholder="What needs to be decided or done, and what is the consequence of waiting?" /></Field>
      <div className="form-grid">
        <Field label="Who takes this escalation?"><select required value={ownerId} onChange={event => setOwnerId(event.target.value)}><option value="">Choose a teammate</option>{state.members.filter(member => member.role !== 'executive').map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
        <Field label="Response target"><input type="date" required value={dueDate} onChange={event => setDueDate(event.target.value)} /></Field>
        <Field label="Priority"><select required value={priority} onChange={event => setPriority(event.target.value as Priority | '')}><option value="">Choose priority</option>{(['Low', 'Medium', 'High', 'Critical'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
      </div>
      {state.milestones.length > 0 && <details className="work-escalation-milestones"><summary>Affected milestones <span>Optional{milestoneIds.length ? ` · ${milestoneIds.length} selected` : ''}</span></summary><div>{state.milestones.map(milestone => <label className="checkbox-label" key={milestone.id}><input type="checkbox" disabled={!milestoneIds.includes(milestone.id) && milestoneIds.length >= 30} checked={milestoneIds.includes(milestone.id)} onChange={event => setMilestoneIds(current => event.target.checked ? [...current, milestone.id] : current.filter(id => id !== milestone.id))} /><span>{milestone.title}</span></label>)}{milestoneIds.length >= 30 && <p className="desk-help">Up to 30 milestones can be linked to this escalation.</p>}</div></details>}
    </fieldset>
    <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !canSubmit}><Flag size={15} aria-hidden="true" />{busy ? 'Raising escalation…' : 'Raise escalation'}</button></div>
  </form>;
}
