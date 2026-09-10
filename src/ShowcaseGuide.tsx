import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, Compass, X } from 'lucide-react';
import type { HubState } from '../shared/types';
import './showcase.css';

type GuideAction = { label: string; page?: string; itemId?: string; meeting?: boolean; createWork?: boolean };
type GuideStep = {
  id: string; title: string; subject: string; role: string; instructions: string[];
  outcome: string; action: GuideAction; secondary?: GuideAction; reference?: GuideAction;
};

function guideSteps(state: HubState): GuideStep[] {
  const pmoName = state.members.find(member => member.id === 'demo-pmo')?.name;
  const pmoProfile = pmoName ? `PMO profile · ${pmoName}` : 'PMO profile';
  return [
  {
    id: 'portfolio', title: 'See the whole programme', subject: 'Ten use cases', role: `${pmoProfile} · about 1 minute`,
    instructions: [
      'Open a use case. Read its outcome, accountable lead, lifecycle phase and next gate.',
      'Look at its artifacts and connected work. Discovery, engineering and adoption each have a place.'
    ],
    outcome: 'One programme view replaces separate status slides and scattered trackers.',
    action: { label: 'Explore the portfolio', page: 'overview' }
  },
  {
    id: 'work', title: 'Add work and record a test', subject: 'Try the real controls', role: `${pmoProfile} · about 2 minutes`,
    instructions: [
      'Choose Add a work item. Enter “Prepare the next Budget Companion discovery session”, select Budget Companion and General work, then Capture work. Ownership and dates can be agreed after capture.',
      'Reopen this stop and choose Record a UAT check. On the Market Intelligence record, open Checks & evidence → Record check. Select Passed or Failed, enter what you checked and an illustrative evidence reference, then Save check.',
      'Use Open discovery example to inspect a consulting brief and its Review step. There is no need to complete a software release.'
    ],
    outcome: 'Your action is saved and ready to assign. Your test records its author, result and evidence against the current delivery cycle.',
    action: { label: 'Add a work item', page: 'work', createWork: true },
    secondary: { label: 'Record a UAT check', page: 'work', itemId: 'showcase-mi-density' },
    reference: { label: 'Open discovery example', page: 'work', itemId: 'showcase-budget-discovery' }
  },
  {
    id: 'decision', title: 'See what needs your help', subject: 'Performance Portfolio Intelligence', role: `${pmoProfile} · about 1 minute`,
    instructions: [
      'Open the blocked reconciliation work. Its escalation names the decision needed, the person taking it and the response date.',
      'Follow the escalation to its linked record. Meeting notes and affected milestones explain why the decision matters.'
    ],
    outcome: 'Management sees a specific decision to make, with an owner and a delivery consequence.',
    action: { label: 'Open the decision context', page: 'work?view=attention', itemId: 'showcase-ppi-blocker' },
    secondary: { label: 'See meeting follow-ups', meeting: true }
  },
  {
    id: 'report', title: 'Prepare a management report', subject: 'From current work to a saved draft', role: `${pmoProfile} · about 1 minute`,
    instructions: [
      'Choose Prepare a report, then New draft. Select Client or Internal, then Prepare draft. Review the saved report and use Edit wording to change its text.',
      'Your work changes can make use-case confirmations stale. Reconfirm the changed cases before a later approval; creating a draft does not approve it.',
      'For the presentation, open the prepared “Month three · Programme review” edition. It stays fixed while you practise; earlier editions remain available for comparison.'
    ],
    outcome: 'A new draft captures the current reporting sources for review. The prepared approved edition remains ready to present.',
    action: { label: 'Prepare a report', page: 'reports' },
    secondary: { label: 'Open prepared edition', page: 'reports?view=archive' }
  }
];
}

export default function ShowcaseGuide({ state, onNavigate, onOpenItem, onMeeting, onAddWork }: {
  state: HubState; onNavigate: (page: string) => void; onOpenItem: (id: string) => void;
  onMeeting: () => void; onAddWork?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const steps = guideSteps(state);
  const step = steps[active];
  const targetId = step.action.itemId || step.secondary?.itemId;
  const targetItem = state.items.find(item => item.id === targetId);

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
    if (action.createWork && !onAddWork) return;
    markVisited(step.id, true);
    close();
    if (action.page) onNavigate(action.page);
    if (action.createWork) onAddWork?.();
    if (action.itemId) onOpenItem(action.itemId);
    if (action.meeting) onMeeting();
  }
  function unavailable(action: GuideAction) {
    return Boolean((action.itemId && !state.items.some(item => item.id === action.itemId)) || (action.createWork && !onAddWork));
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
      <div className="showcase-guide-heading"><div><h2>Four stops, one programme</h2><p>Explore the portfolio, capture an action, record a test and prepare a report. Reopen this guide between actions; there is no need to complete every workflow.</p></div><button className="icon-button" aria-label="Close demo guide" onClick={close}><X size={18} /></button></div>
      <div className="showcase-guide-layout">
        <ol className="showcase-stops" aria-label="Guide stops">{steps.map((entry, index) => <li key={entry.id} className={active === index ? 'is-active' : ''}>
          <button className="showcase-stop" aria-current={active === index ? 'step' : undefined} onClick={() => setActive(index)}><span className="showcase-step-number">{index + 1}</span><span>{entry.title}</span><ChevronRight size={14} aria-hidden="true" /></button>
          <label className="showcase-check"><input type="checkbox" aria-label={`Mark ${entry.title.toLowerCase()} as visited`} checked={visited.includes(entry.id)} onChange={event => markVisited(entry.id, event.target.checked)} /></label>
        </li>)}</ol>
        <section className="showcase-stop-detail" aria-labelledby="showcase-stop-title" key={step.id}>
          <div className="showcase-stop-heading"><span>Stop {active + 1} of {steps.length} <span aria-hidden="true">/</span> {step.subject}</span><h3 id="showcase-stop-title">{step.title}</h3><p>{step.role}</p></div>
          <ol className="showcase-instructions">{step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>
          <div className="showcase-outcome"><strong>What this demonstrates</strong><p>{step.outcome}</p></div>
          {targetItem && <p className="showcase-current-state">{step.id === 'work' ? 'Test example' : 'Current record'}: <strong>{targetItem.stage}</strong>{targetItem.blocked && ' · Blocked'} · cycle {targetItem.cycle}</p>}
          <div className="showcase-guide-actions"><button className="button primary" disabled={unavailable(step.action)} onClick={() => follow(step.action)}>{step.action.label}<ArrowRight size={15} aria-hidden="true" /></button>
            {step.secondary && <button className="button secondary" disabled={unavailable(step.secondary)} onClick={() => follow(step.secondary!)}>{step.secondary.label}</button>}
            {step.reference && <button className="text-button" disabled={unavailable(step.reference)} onClick={() => follow(step.reference!)}>{step.reference.label}<ArrowRight size={14} aria-hidden="true" /></button>}
          </div>
          {targetId && !targetItem && <p className="showcase-unavailable">This example record is unavailable in the current scenario. Choose another guide stop.</p>}
          <p className="showcase-practice-note">This month-three scenario illustrates future use; it does not claim real project progress or approvals. Your practice changes are saved in this review workspace.</p>
        </section>
      </div>
    </div>}
  </section>;
}
