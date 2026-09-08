import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, ClipboardList, GitBranch, Plus, Search, ShieldAlert } from 'lucide-react';
import type { PageProps, Register, RegisterType } from '../shared/types';
import { Avatar, Badge, Field, Modal, canEdit, formatDate } from './ui';
import { recordAttention } from '../shared/reporting';

const registerLabels: Record<RegisterType, string> = { risk: 'Risk', assumption: 'Assumption', issue: 'Issue', dependency: 'Dependency', decision: 'Decision' };
const registerPluralLabels: Record<RegisterType, string> = { risk: 'Risks', assumption: 'Assumptions', issue: 'Issues', dependency: 'Dependencies', decision: 'Decisions' };
const registerIcons = { risk: ShieldAlert, assumption: CircleHelp, issue: AlertTriangle, dependency: GitBranch, decision: Check };
type RegisterDraft = Omit<Register, 'id' | 'version' | 'updatedAt'>;

export function Registers({ state, user, mutate, notify, openItem, initialSelection }: PageProps & {initialSelection?:{id:string;key:number}}) {
  const [activeType, setActiveType] = useState<RegisterType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [workstreamId, setWorkstreamId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [editing, setEditing] = useState<Register | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isPMO = user.role === 'pmo' || user.role === 'admin';
  const createStreams = state.workstreams.filter(stream => isPMO || user.workstreamIds.includes(stream.id) || (user.role === 'lead' && stream.leadId === user.id));
  const emptyDraft = (): RegisterDraft => ({
    type: activeType === 'all' ? 'risk' : activeType, title: '', detail: '', clientSummary: '', clientVisible: false,
    workstreamId: createStreams.find(stream => stream.id === workstreamId)?.id || createStreams[0]?.id || '',
    relatedItemIds: [], milestoneIds: [], ownerId: user.id, dueDate: '', priority: 'Medium', probability: 'Medium',
    status: 'open', mitigation: '', nextAction: '', impact: '',
  });
  const [draft, setDraft] = useState<RegisterDraft>(emptyDraft);
  const editable = canEdit(user);
  const canCreate = editable && createStreams.length > 0;
  const canUpdate = editable && (editing === 'new' ? canCreate : Boolean(editing && (isPMO || editing.ownerId === user.id || (user.role === 'lead' && state.workstreams.some(stream => stream.id === editing.workstreamId && stream.leadId === user.id)))));
  const scoped = useMemo(() => state.registers.filter(register => workstreamId === 'all' || register.workstreamId === workstreamId), [state.registers, workstreamId]);
  const filtered = useMemo(() => scoped.filter(register =>
    (activeType === 'all' || register.type === activeType) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? register.status !== 'resolved' : register.status === statusFilter)) &&
    (!query || `${register.title} ${register.detail} ${register.nextAction}`.toLowerCase().includes(query.toLowerCase()))
  ).sort((a, b) => {
    const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return Number(b.status === 'escalated') - Number(a.status === 'escalated') || priority[a.priority] - priority[b.priority] || a.dueDate.localeCompare(b.dueDate);
  }), [scoped, activeType, statusFilter, query]);
  const update = <K extends keyof RegisterDraft>(key: K, value: RegisterDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const toggleLink = (key: 'relatedItemIds' | 'milestoneIds', id: string) => setDraft(previous => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter(value => value !== id) : [...previous[key], id] }));
  function openEditor(register?: Register) {
    setError('');
    if (register) {
      const { id: _id, version: _version, updatedAt: _updatedAt, ...values } = register;
      setDraft({ ...values, relatedItemIds: [...values.relatedItemIds], milestoneIds: [...values.milestoneIds] });
      setEditing(register);
    } else {
      setDraft(emptyDraft());
      setEditing('new');
    }
  }
  useEffect(()=>{if(initialSelection){const register=state.registers.find(r=>r.id===initialSelection.id);if(register)openEditor(register);}},[initialSelection]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canUpdate || !editing || saving) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await mutate('/api/records/registers', draft, 'POST');
      else await mutate(`/api/records/registers/${editing.id}`, { version: editing.version, changes: draft }, 'PATCH');
      notify(editing === 'new' ? `${registerLabels[draft.type]} added to the register.` : 'Register updated.');
      setEditing(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The register could not be saved. Please try again.';
      setError(message);
      notify(message, true);
    } finally { setSaving(false); }
  }
  const member = (id: string) => state.members.find(person => person.id === id);
  return <div className="stack registers-workspace">
    <div className="page-header">
      <div><h1 className="page-title">Risks & decisions</h1><p className="page-subtitle">Track the concerns, dependencies, and decisions that affect delivery.</p></div>
      {canCreate && <button className="button primary" onClick={() => openEditor()}><Plus size={17} /> Add entry</button>}
    </div>

    <div className="register-summary" aria-label="Register position for selected use cases"><span><strong>{scoped.filter(entry => entry.status !== 'resolved').length}</strong>active entries</span><span><strong>{scoped.filter(entry => entry.status === 'escalated').length}</strong>escalated</span><span><strong>{scoped.filter(entry => recordAttention(entry, state.settings).overdue).length}</strong>overdue follow-ups</span><span><strong>{scoped.filter(entry => entry.type === 'decision' && entry.status !== 'resolved').length}</strong>decisions outstanding</span></div>

    <section className="panel">
      <div className="panel-header" style={{ display: 'block' }}>
        <div className="tabs" role="group" aria-label="Filter register type">
          {(['all', 'risk', 'issue', 'dependency', 'decision', 'assumption'] as const).map(type => <button key={type} className={`tab ${activeType === type ? 'active' : ''}`} aria-pressed={activeType === type} onClick={() => setActiveType(type)}>
            {type === 'all' ? 'All entries' : registerPluralLabels[type]} <span className="muted">{scoped.filter(entry => type === 'all' || entry.type === type).length}</span>
          </button>)}
        </div>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}><Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} /><input className="input" aria-label="Search register" placeholder="Search entries or next actions…" value={query} onChange={event => setQuery(event.target.value)} style={{ paddingLeft: 36, width: '100%' }} /></div>
          <select className="select" aria-label="Filter register use case" value={workstreamId} onChange={event => setWorkstreamId(event.target.value)}><option value="all">All use cases</option>{state.workstreams.map(workstream => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}</select>
          <select className="select" aria-label="Filter register status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="active">Active entries</option><option value="all">All statuses</option><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></select>
        </div>
      </div>
      {filtered.length ? <div style={{ overflowX: 'auto' }}><table className="data-table register-table">
        <thead><tr><th>Concern & impact</th><th>Use case</th><th>Owner & next action</th><th>Follow-up date</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>{filtered.map(register => {
          const Icon = registerIcons[register.type];
          const owner = member(register.ownerId);
          const attention = recordAttention(register, state.settings);
          return <tr key={register.id}>
            <td style={{ minWidth: 265, maxWidth: 370 }}><div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon size={17} style={{ flexShrink: 0, marginTop: 3, color: register.status === 'escalated' ? 'var(--red)' : 'var(--muted)' }} /><div>
              <button className="text-button" onClick={() => openEditor(register)} style={{ textAlign: 'left', fontWeight: 600 }}>{register.title}</button>
              <div className="register-row-context">{registerLabels[register.type]}{register.impact ? ` · ${register.impact}` : ''}</div>
              {register.relatedItemIds.length > 0 && <div className="register-row-links">{register.relatedItemIds.map(id => {
                const item = state.items.find(value => value.id === id);
                return item ? <button className="text-button" key={id} onClick={() => openItem(id)}><ArrowUpRight size={14} />{item.title}</button> : null;
              })}</div>}
            </div></div></td>
            <td data-label="Use case">{state.workstreams.find(workstream => workstream.id === register.workstreamId)?.shortName || 'Unassigned'}</td>
            <td data-label="Owner & next action" style={{ minWidth: 200, maxWidth: 280 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{owner && <Avatar member={owner} size={26} />}<span>{owner?.name || 'Unassigned'}</span></div><div className="register-row-context">{register.nextAction || 'Next action not recorded'}</div></td>
            <td data-label="Follow-up date" className={`register-due ${attention.overdue ? 'attention' : ''}`}>{register.dueDate ? formatDate(register.dueDate) : 'No date'}{attention.overdue ? <small>Overdue</small> : attention.dueToday ? <small>Due today</small> : attention.dueReminder ? <small>Due soon</small> : null}</td>
            <td data-label="Priority"><Badge tone={register.priority === 'Critical' ? 'red' : register.priority === 'High' ? 'amber' : 'neutral'}>{register.priority}</Badge></td>
            <td data-label="Status"><Badge tone={register.status === 'escalated' ? 'red' : register.status === 'resolved' ? 'green' : register.status === 'monitoring' ? 'amber' : 'neutral'}>{register.status.charAt(0).toUpperCase() + register.status.slice(1)}</Badge></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state"><ClipboardList size={32} /><h3>No entries match this view</h3><p>Adjust your filters or add a register entry to make the next action clear.</p>{canCreate && <button className="button secondary" onClick={() => openEditor()}>Add entry</button>}</div>}
    </section>

    {editing && <Modal title={editing === 'new' ? 'Add register entry' : draft.title} description={canUpdate ? 'Record the impact, owner, and next action.' : 'You can view this entry. Its owner, use case lead, or PMO can update it.'} onClose={() => !saving && setEditing(null)} variant="drawer" className="register-workspace" wide>
      <form onSubmit={save} className="stack">
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
        <fieldset disabled={!canUpdate || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <Field label="Type"><select className="select" value={draft.type} onChange={event => update('type', event.target.value as RegisterType)}>{Object.entries(registerLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></Field>
            <Field label="Use case"><select className="select" required value={draft.workstreamId} onChange={event => update('workstreamId', event.target.value)}>{(editing === 'new' ? createStreams : state.workstreams).map(workstream => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}</select></Field>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Title"><input className="input" value={draft.title} required maxLength={220} onChange={event => update('title', event.target.value)} placeholder="What needs to be addressed?" /></Field></div>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Internal detail"><textarea className="textarea" rows={3} value={draft.detail} onChange={event => update('detail', event.target.value)} placeholder="Context, evidence and what happens if this remains unresolved." /></Field></div>
            <Field label="Accountable owner"><select className="select" required value={draft.ownerId} onChange={event => update('ownerId', event.target.value)}>{state.members.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
            <Field label="Due date"><input className="input" type="date" required value={draft.dueDate} onChange={event => update('dueDate', event.target.value)} /></Field>
            <Field label="Priority"><select className="select" value={draft.priority} onChange={event => update('priority', event.target.value as Register['priority'])}>{['Low', 'Medium', 'High', 'Critical'].map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Status"><select className="select" value={draft.status} onChange={event => update('status', event.target.value as Register['status'])}><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></select></Field>
            {draft.type === 'risk' && <Field label="Probability"><select className="select" value={draft.probability} onChange={event => update('probability', event.target.value as Register['probability'])}>{['Low', 'Medium', 'High'].map(value => <option key={value}>{value}</option>)}</select></Field>}
            <Field label="Impact"><input className="input" value={draft.impact} onChange={event => update('impact', event.target.value)} placeholder="Delivery or milestone impact" /></Field>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Next action"><input className="input" value={draft.nextAction} onChange={event => update('nextAction', event.target.value)} placeholder="A specific next step for the owner" /></Field></div>
            <div style={{ gridColumn: '1 / -1' }}><Field label={draft.type === 'decision' ? 'Decision / rationale' : draft.status === 'resolved' ? 'Resolution / mitigation' : 'Mitigation / response'}><textarea className="textarea" rows={3} value={draft.mitigation} onChange={event => update('mitigation', event.target.value)} /></Field></div>
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <div><span className="label">Affected work items</span><div className="register-link-options" style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>{state.items.filter(item => item.workstreamId === draft.workstreamId || draft.relatedItemIds.includes(item.id)).map(item => <label className="checkbox-row" key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 9, fontSize: 13 }}><input type="checkbox" checked={draft.relatedItemIds.includes(item.id)} onChange={() => toggleLink('relatedItemIds', item.id)} />{item.title}</label>)}</div></div>
            <div><span className="label">Affected milestones</span><div className="register-link-options" style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>{state.milestones.filter(milestone => milestone.workstreamIds.includes(draft.workstreamId) || draft.milestoneIds.includes(milestone.id)).map(milestone => <label className="checkbox-row" key={milestone.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 9, fontSize: 13 }}><input type="checkbox" checked={draft.milestoneIds.includes(milestone.id)} onChange={() => toggleLink('milestoneIds', milestone.id)} />{milestone.title}</label>)}</div></div>
          </div>
          <div className="notice" style={{ marginTop: 20 }}>
            <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={draft.clientVisible} onChange={event => update('clientVisible', event.target.checked)} />Allow a client-safe summary in report drafts</label>
            {draft.clientVisible && <div style={{ marginTop: 12 }}><Field label="Client-safe summary"><textarea className="textarea" rows={2} required value={draft.clientSummary} onChange={event => update('clientSummary', event.target.value)} placeholder="Only approved-for-client wording. Internal detail stays internal." /></Field><p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>This supplies draft content. A report still needs review and approval.</p></div>}
          </div>
        </fieldset>
        <div className="form-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)} disabled={saving}>{canUpdate ? 'Cancel' : 'Close'}</button>{canUpdate && <button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add entry' : 'Save changes'}</button>}</div>
      </form>
    </Modal>}
  </div>;
}
