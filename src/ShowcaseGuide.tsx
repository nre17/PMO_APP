import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, Compass, X } from 'lucide-react';
import type { HubState } from '../shared/types';
import './showcase.css';

type GuideAction = { label: string; page?: string; itemId?: string; meeting?: boolean };
type GuideStep = {
  id: string; title: string; subject: string; role: string; instructions: string[];
  outcome: string; action: GuideAction; secondary?: GuideAction;
};

const steps: GuideStep[] = [
  {
    id: 'portfolio', title: 'See the whole programme', subject: 'Ten use cases', role: 'Start as Demo PMO · about 1 minute',
    instructions: [
      'Open a use case. Read its outcome, accountable lead, lifecycle phase and next gate.',
      'Look at its artifacts and connected work. Discovery, engineering and adoption each have a place.'
    ],
    outcome: 'One programme view replaces separate status slides and scattered trackers.',
    action: { label: 'Explore the portfolio', page: 'overview' }
  },
  {
    id: 'work', title: 'Follow one piece of work', subject: 'From discovery to delivery', role: 'Stay as Demo PMO · about 2 minutes',
    instructions: [
      'Open the Budget Companion discovery record to see the brief, owner, acceptance criteria and review step.',
      'Then inspect the Market Intelligence handoff. Try handing it to QA for UAT; one action is enough to see how ownership and history stay connected.'
    ],
    outcome: 'The next step is clear for consulting work and software delivery, without maintaining a separate tracker for each.',
    action: { label: 'Open discovery work', page: 'work', itemId: 'showcase-budget-discovery' },
    secondary: { label: 'Try the UAT handoff', page: 'work', itemId: 'showcase-mi-release' }
  },
  {
    id: 'decision', title: 'See what needs your help', subject: 'Performance Portfolio Intelligence', role: 'Stay as Demo PMO · about 1 minute',
    instructions: [
      'Open the blocked reconciliation work. Its escalation names the decision needed, the person taking it and the response date.',
      'Follow the escalation to its linked record. Meeting notes and affected milestones explain why the decision matters.'
    ],
    outcome: 'Management sees a specific decision to make, with an owner and a delivery consequence.',
    action: { label: 'Open the decision context', page: 'work?view=attention', itemId: 'showcase-ppi-blocker' },
    secondary: { label: 'See meeting follow-ups', meeting: true }
  },
  {
    id: 'report', title: 'Read the management position', subject: 'A report ready to present', role: 'No approval steps required · about 1 minute',
    instructions: [
      'Open the prepared approved edition. It brings together progress, next commitments, decisions and milestone forecasts.',
      'Compare it with an earlier edition to see the programme develop. Practice edits remain in the live workspace; the saved edition stays fixed.'
    ],
    outcome: 'A management conversation starts from one reviewed position, with the detail available when needed.',
    action: { label: 'Open the prepared report', page: 'reports?view=archive' },
    secondary: { label: 'See current weekly updates', page: 'reports' }
  }
];

export default function ShowcaseGuide({ state, onNavigate, onOpenItem, onOpenUseCase, onMeeting }: {
  state: HubState; onNavigate: (page: string) => void; onOpenItem: (id: string) => void;
  onOpenUseCase: (id: string) => void; onMeeting: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const step = steps[active];
  const targetItem = state.items.find(item => item.id === step.action.itemId);
  const useCase = state.workstreams.find(stream => stream.id === targetItem?.workstreamId);

  useEffect(() => {
    document.body.classList.add('showcase-mode');
    return () => document.body.classList.remove('showcase-mode');
  }, []);

  function close() { setOpen(false); toggleRef.current?.focus(); }
  function markVisited(id: string, checked: boolean) {
    setVisited(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id));
  }
  function follow(action: GuideAction) {
    if (action.itemId && !state.items.some(item => item.id === action.itemId)) return;
    markVisited(step.id, true);
    close();
    if (action.page) onNavigate(action.page);
    if (action.itemId) onOpenItem(action.itemId);
    if (action.meeting) onMeeting();
  }

  return <section className={`showcase-companion${open ? ' is-open' : ''}`} aria-label="Illustrative demonstration">
    <div className="showcase-banner">
      <div className="showcase-identity"><Compass size={17} aria-hidden="true" /><strong>Manager review <span aria-hidden="true">·</span> Illustrative data</strong></div>
      <span className="showcase-banner-hint">Month three of use · A populated programme to explore.</span>
      <button ref={toggleRef} className="showcase-toggle" aria-expanded={open} aria-controls="showcase-guide" onClick={() => setOpen(current => !current)}>
        <BookOpen size={16} aria-hidden="true" />5-minute tour<span className="showcase-visited-count" aria-label={`${visited.length} of ${steps.length} stops visited`}>{visited.length}/{steps.length}</span><ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    {open && <div id="showcase-guide" className="showcase-guide" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="showcase-guide-heading"><div><h2>Four stops, one programme</h2><p>A short review of the portfolio, work, decisions and reporting. Explore in any order; there is no need to complete every workflow.</p></div><button className="icon-button" aria-label="Close demo guide" onClick={close}><X size={18} /></button></div>
      <div className="showcase-guide-layout">
        <ol className="showcase-stops" aria-label="Guide stops">{steps.map((entry, index) => <li key={entry.id} className={active === index ? 'is-active' : ''}>
          <button className="showcase-stop" aria-current={active === index ? 'step' : undefined} onClick={() => setActive(index)}><span className="showcase-step-number">{index + 1}</span><span>{entry.title}</span><ChevronRight size={14} aria-hidden="true" /></button>
          <label className="showcase-check"><input type="checkbox" aria-label={`Mark ${entry.title.toLowerCase()} as visited`} checked={visited.includes(entry.id)} onChange={event => markVisited(entry.id, event.target.checked)} /></label>
        </li>)}</ol>
        <section className="showcase-stop-detail" aria-labelledby="showcase-stop-title" key={step.id}>
          <div className="showcase-stop-heading"><span>Stop {active + 1} of {steps.length} <span aria-hidden="true">/</span> {step.subject}</span><h3 id="showcase-stop-title">{step.title}</h3><p>{step.role}</p></div>
          <ol className="showcase-instructions">{step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>
          <div className="showcase-outcome"><strong>What this demonstrates</strong><p>{step.outcome}</p></div>
          {targetItem && <p className="showcase-current-state">Current record: <strong>{targetItem.stage}</strong>{targetItem.blocked && ' · Blocked'} · cycle {targetItem.cycle}</p>}
          <div className="showcase-guide-actions"><button className="button primary" disabled={Boolean(step.action.itemId && !targetItem)} onClick={() => follow(step.action)}>{step.action.label}<ArrowRight size={15} aria-hidden="true" /></button>
            {step.secondary && <button className="button secondary" disabled={Boolean(step.secondary.itemId && !state.items.some(item => item.id === step.secondary?.itemId))} onClick={() => follow(step.secondary!)}>{step.secondary.label}</button>}
            {useCase && step.id === 'work' && <button className="text-button" onClick={() => { markVisited(step.id, true); close(); onOpenUseCase(useCase.id); }}>View use case profile<ArrowRight size={14} aria-hidden="true" /></button>}
          </div>
          {step.action.itemId && !targetItem && <p className="showcase-unavailable">This example record is unavailable in the current scenario. Choose another guide stop.</p>}
          <p className="showcase-practice-note">This month-three scenario illustrates future use; it does not claim real project progress or approvals. Your practice changes are saved in this review workspace.</p>
        </section>
      </div>
    </div>}
  </section>;
}
