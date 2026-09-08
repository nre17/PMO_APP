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
    id: 'portfolio', title: 'See the whole programme', subject: 'Use case portfolio', role: 'Start with the PMO persona',
    instructions: [
      'Choose a use case to see its intended outcome, lifecycle phase, next gate, and supporting artifacts.',
      'Use the lifecycle and group filters to compare discovery, engineering, and adoption work.'
    ],
    outcome: 'A single view of the illustrative programme, with each use case at its own stage.',
    action: { label: 'Explore the portfolio', page: 'overview' }
  },
  {
    id: 'discovery', title: 'Turn discovery into a plan', subject: 'Budget Companion', role: 'Try the lead or PMO persona',
    instructions: [
      'Read the discovery work’s acceptance criteria, next action, and accountable owner. Open its use case profile for the wider scope.',
      'Inspect the separate scope follow-up. A captured Backlog action can be defined and assigned before it starts.'
    ],
    outcome: 'Consulting work has a clear outcome and review step, alongside the software delivery workflow.',
    action: { label: 'Open discovery work', page: 'delivery', itemId: 'showcase-budget-discovery' },
    secondary: { label: 'Open scope follow-up', page: 'delivery', itemId: 'showcase-budget-scope' }
  },
  {
    id: 'blocker', title: 'Make the handoff visible', subject: 'Performance Portfolio Intelligence', role: 'Try the PMO persona',
    instructions: [
      'Read the blocker, help needed, and next action owner. Follow recorded links to the related concern and milestone.',
      'Use the work record to update the action or handoff when the dependency is addressed. Review the resulting history.'
    ],
    outcome: 'The person accountable for the outcome and the person needed next are both explicit.',
    action: { label: 'Open blocked work', page: 'operations', itemId: 'showcase-ppi-blocker' }
  },
  {
    id: 'engineering', title: 'Move through QA and release', subject: 'Market Intelligence', role: 'Try engineer, then QA, using “Preview as”',
    instructions: [
      'Follow the prerequisite checklist to hand development over to UAT. Record checks with clearly illustrative notes and evidence references.',
      'Try recording a blocking UAT failure, then return the item for rework. Record the finding’s resolution and, after handing over again, add a passing check in the new cycle.',
      'Continue through Ready to deploy and production verification. Deployment evidence and a passing production check precede client acceptance.'
    ],
    outcome: 'Each handoff retains its owner, evidence, and delivery cycle. Passing QA alone does not close software work.',
    action: { label: 'Open engineering work', page: 'delivery', itemId: 'showcase-mi-release' }
  },
  {
    id: 'acceptance', title: 'Close with a client response', subject: 'Accounting Companion', role: 'Try the PMO persona',
    instructions: [
      'Inspect the recorded internal checks, then use the client-response action.',
      'Try an illustrative acceptance with a reference, or a rejection with a rework owner and reason. Keep any entered evidence explicitly synthetic.'
    ],
    outcome: 'Acceptance closes the item. Rejection keeps the same item and sends it into another delivery cycle.',
    action: { label: 'Open acceptance work', page: 'delivery', itemId: 'showcase-accounting-acceptance' }
  },
  {
    id: 'meeting', title: 'Leave a meeting with an action', subject: 'Meeting notes and follow-ups', role: 'Try the PMO persona',
    instructions: [
      'Choose an existing illustrative meeting to review its notes and linked follow-ups, or save a new practice meeting.',
      'Add a follow-up manually, give it a use case and owner, then find it in delivery. You can also inspect the prepared scope action.'
    ],
    outcome: 'A discussion and its next action stay connected after the meeting ends.',
    action: { label: 'Open project meetings', meeting: true },
    secondary: { label: 'Inspect prepared follow-up', page: 'delivery', itemId: 'showcase-budget-scope' }
  },
  {
    id: 'report', title: 'Confirm, draft, and approve', subject: 'Weekly report', role: 'PMO prepares; approver approves',
    instructions: [
      'Review and confirm use case updates after your practice changes. Prepare a client draft and check its wording.',
      'Use “Preview as” to select the approver and approve the illustrative edition. Any confirmation gaps require an explanation.',
      'If sources changed after drafting, prepare a fresh draft before approval.'
    ],
    outcome: 'Approval saves a fixed illustrative snapshot with its reporting position and reviewed wording.',
    action: { label: 'Open weekly report', page: 'reports' }
  },
  {
    id: 'history', title: 'Present the saved position', subject: 'Approved briefs', role: 'Keep the approver persona, or return to PMO',
    instructions: [
      'Choose an approved edition, then open its presentation. The demonstration label stays visible in print and PDF.',
      'Compare it with current work. Later changes do not rewrite a saved edition; a correction preserves the original.'
    ],
    outcome: 'A client conversation can use one stable report, while the live delivery records continue to evolve.',
    action: { label: 'Open approved briefs', page: 'approved-briefs' }
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
      <div className="showcase-identity"><Compass size={17} aria-hidden="true" /><strong>Demonstration <span aria-hidden="true">·</span> Illustrative data</strong></div>
      <span className="showcase-banner-hint">Explore the consulting lifecycle with synthetic records.</span>
      <button ref={toggleRef} className="showcase-toggle" aria-expanded={open} aria-controls="showcase-guide" onClick={() => setOpen(current => !current)}>
        <BookOpen size={16} aria-hidden="true" />Demo guide<span className="showcase-visited-count" aria-label={`${visited.length} of ${steps.length} stops visited`}>{visited.length}/{steps.length}</span><ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    {open && <div id="showcase-guide" className="showcase-guide" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="showcase-guide-heading"><div><h2>A guided walk through the hub</h2><p>Choose a stop, try the workflow, then return here. Checkmarks track the stops you have visited.</p></div><button className="icon-button" aria-label="Close demo guide" onClick={close}><X size={18} /></button></div>
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
            {useCase && step.id === 'discovery' && <button className="text-button" onClick={() => { markVisited(step.id, true); close(); onOpenUseCase(useCase.id); }}>View use case profile<ArrowRight size={14} aria-hidden="true" /></button>}
          </div>
          {step.action.itemId && !targetItem && <p className="showcase-unavailable">This example record is unavailable in the current scenario. Choose another guide stop.</p>}
          <p className="showcase-practice-note">All records, checks, and approvals in this workspace are illustrative. Changes you make are saved in this demonstration.</p>
        </section>
      </div>
    </div>}
  </section>;
}
