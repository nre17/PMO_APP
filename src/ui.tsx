import { useId, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink } from 'lucide-react';
import type { Member, Health, WorkItem, HubState } from '../shared/types';
export const healthLabel: Record<Health, string> = { green: 'On track', amber: 'At risk', red: 'Off track', unknown: 'Unconfirmed' };
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`badge badge-${tone}`}><span className="badge-dot" />{children}</span>; }
export function Avatar({ member, size = 30 }: { member?: Member; size?: number }) { return <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size*.33)) }} title={member?.name || 'Unassigned'}>{member?.initials || '?'}</span>; }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  const input = isValidElement(children) && typeof children.type === 'string' && ['input','select','textarea'].includes(children.type) ? children as ReactElement<{id?:string}> : null;
  const id = input?.props.id || generatedId;
  return <div className="field">{input ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}{input ? cloneElement(input,{id}) : children}</div>;
}
export function Modal({ title, description, children, onClose, wide = false, variant = 'dialog', className = '' }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean; variant?: 'dialog'|'drawer'; className?: string }) {
  const descriptionId = useId();
  return <Dialog.Root open onOpenChange={open => !open && onClose()}><Dialog.Portal><Dialog.Overlay className={`modal-overlay ${variant==='drawer'?'drawer-overlay':''}`} /><Dialog.Content className={`modal ${wide ? 'modal-wide' : ''} ${variant==='drawer'?'modal-drawer':''} ${className}`} aria-describedby={description ? descriptionId : undefined}><div className="modal-heading"><div><Dialog.Title>{title}</Dialog.Title>{description && <Dialog.Description id={descriptionId}>{description}</Dialog.Description>}</div><Dialog.Close className="icon-button" aria-label="Close"><X size={20} /></Dialog.Close></div><div className="modal-body">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function formatDate(value?: string, options?: Intl.DateTimeFormatOptions) { if (!value) return 'No date'; const d = new Date(value.length === 10 ? value + 'T12:00:00Z' : value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', options || { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' }); }
export function canEdit(user: Member) { return user.role !== 'executive'; }
export function canManage(user: Member) { return ['pmo','admin','lead'].includes(user.role); }
export function dateToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
export function isOverdue(item: WorkItem) { return item.stage !== 'Closed' && !!item.dueDate && item.dueDate < dateToday(); }
export function memberName(state: HubState, id: string) { return state.members.find(m => m.id === id)?.name || 'Unassigned'; }
export function SafeLink({ href, children }: { href: string; children?: ReactNode }) { if (!/^https?:\/\//i.test(href)) return <span className="muted">{children || href}</span>; return <a className="text-link" href={href} target="_blank" rel="noreferrer">{children || href}<ExternalLink size={13}/></a>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty-state"><strong>{title}</strong>{children && <p>{children}</p>}</div>; }
export function initialsName(name: string) { return name.split(' ').map(s => s[0]).slice(0, 2).join(''); }
