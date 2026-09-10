import { createHash } from 'node:crypto';
import { createPortfolioState } from './portfolio-seed.js';
import { applyIntake, type IntakeBundle } from './intake.js';
import { audit, itemSchema, reportDraft, touch, transition, validateReferences } from './domain.js';
import { dateInTimezone, latestWorkstreamChange, reportingPeriod, shiftDate } from '../shared/reporting.js';
import { GENERAL_STAGES, SOFTWARE_STAGES, type HubState, type LifecyclePhase, type Member, type Stage, type WorkItem } from '../shared/types.js';

/** Explicitly fictional scenarios. No files, environment variables or client data are read. */
export function createShowcaseState(now = new Date()): HubState {
  if (!Number.isFinite(now.getTime())) throw new Error('A valid showcase date is required.');
  const state = createPortfolioState(now), hour = 3_600_000;
  const at = (hours: number) => new Date(now.getTime() + hours * hour).toISOString();
  const today = dateInTimezone(now, state.settings.timezone);
  const date = (days: number) => shiftDate(today, days);
  const v = (id: string, hours = -6) => ({ id, version: 1, updatedAt: at(hours) });
  const evidence = (id: string) => `https://example.invalid/synthetic-demo/${encodeURIComponent(id)}`;
  const ids = {
    ppi: 'uc-performance-portfolio-intelligence', investment: 'uc-investment-companion', legal: 'uc-legal-companion',
    mi: 'uc-market-intelligence', accounting: 'uc-accounting-validation', benchmark: 'uc-benchmark',
    treasury: 'uc-treasury-liquidity', spreadsheet: 'uc-spreadsheet-intelligence', finance: 'uc-public-finance', budget: 'uc-budget-companion',
  };
  const allStreams = Object.values(ids);
  const member = (id: string, name: string, role: Member['role'], initials: string): Member => ({
    id, name, role, initials, title: 'Synthetic demonstration role', color: '#8600d6', workstreamIds: allStreams, canApproveReports: role === 'executive',
  });
  state.members = [member('demo-pmo', 'Demo PMO', 'pmo', 'PM'), member('demo-lead', 'Demo lead', 'lead', 'DL'), member('demo-engineer', 'Demo engineer', 'contributor', 'DE'), member('demo-qa', 'Demo QA', 'contributor', 'QA'), member('demo-approver', 'Demo approver', 'executive', 'DA')];
  const pmo = state.members[0], lead = state.members[1], qa = state.members[3];
  Object.assign(state.settings, { projectName: 'AI programme · Demonstration', phaseName: 'Phase 2 · Illustrative month 3', demoScenario: 'consulting-lifecycle' });
  const briefs: Record<keyof typeof ids, { phase: LifecyclePhase; group: string; outcome: string; scope: string; gate: string; health: 'green' | 'amber' | 'red'; note: string }> = {
    ppi: { phase: 'assurance', group: 'Investment insights', outcome: 'Explain portfolio movement with traceable synthetic holdings and calculations.', scope: 'Sample holdings, metric definitions, filter behaviour and reconciliation.', gate: 'Reconciliation sample accepted', health: 'red', note: 'Synthetic access dependency blocks reconciliation; one filter check needs retest.' },
    investment: { phase: 'adoption', group: 'Investment insights', outcome: 'Help pilot analysts use a cited research companion and measure useful adoption.', scope: 'Training, support, pilot feedback and adoption measures.', gate: 'Pilot adoption review', health: 'green', note: 'Training guide accepted; usage review and feedback triage are underway.' },
    legal: { phase: 'design', group: 'Professional services', outcome: 'Help reviewers retrieve clauses while protecting role-restricted documents.', scope: 'Permission design, redaction boundaries and review interaction prototypes.', gate: 'Design principles agreed', health: 'amber', note: 'A decision on review authority is needed before the prototype scope is fixed.' },
    mi: { phase: 'release', group: 'Investment insights', outcome: 'Deliver an accessible, clearly sourced daily intelligence reading experience.', scope: 'Synthetic article cards, keyboard interaction and repeatable release checks.', gate: 'Pilot release accepted', health: 'green', note: 'The keyboard fix is ready for a UAT handoff; release checks are staged separately.' },
    accounting: { phase: 'release', group: 'Finance operations', outcome: 'Explain validation exceptions and make accounting checks reviewable.', scope: 'Synthetic journal samples, rounding checks and exception explanation.', gate: 'Client response recorded', health: 'amber', note: 'An internally verified improvement awaits an explicit simulated client response.' },
    benchmark: { phase: 'assurance', group: 'Investment insights', outcome: 'Compare portfolio performance against appropriate peers and reference indices.', scope: 'Synthetic peer groups, index selection, comparable periods and reproducible return calculations.', gate: 'Benchmark comparison pack accepted', health: 'amber', note: 'Two reference-index mappings need review before the comparison pack is accepted.' },
    treasury: { phase: 'build', group: 'Finance operations', outcome: 'Make a liquidity forecast explain its inputs and uncertainty.', scope: 'Synthetic balances, time windows, stress cases and alert rules.', gate: 'Scenario demonstration ready', health: 'green', note: 'Watermark handling is in development; scenario review proceeds in parallel.' },
    spreadsheet: { phase: 'build', group: 'Shared foundations', outcome: 'Give users useful explanations of spreadsheet validation failures.', scope: 'Synthetic upload fixtures, formula mapping and accessible error messages.', gate: 'Upload validation accepted', health: 'green', note: 'Validation is in UAT and formula mapping is in development.' },
    finance: { phase: 'shaping', group: 'Public finance planning', outcome: 'Agree which public-finance question is valuable enough to investigate.', scope: 'Problem framing, candidate users, source feasibility and prioritisation.', gate: 'Discovery investment decision', health: 'amber', note: 'The brief is being shaped; scope and source feasibility remain open questions.' },
    budget: { phase: 'discovery', group: 'Public finance planning', outcome: 'Understand budget-review decisions before selecting an AI intervention.', scope: 'Stakeholder interviews, a review journey, success measures and scope options.', gate: 'Discovery findings reviewed', health: 'green', note: 'Interview synthesis is ready for review; a separate scope follow-up remains in Backlog.' },
  };
  for (const [key, id] of Object.entries(ids) as [keyof typeof ids, string][]) {
    const stream = state.workstreams.find(value => value.id === id)!, brief = briefs[key];
    Object.assign(stream, { description: `Illustrative operating scenario: ${brief.outcome}`, scope: brief.scope, leadId: lead.id, lifecyclePhase: brief.phase, phaseLabel: `Illustrative month 3 · ${brief.phase}`, groups: key === 'mi' ? [brief.group, 'Strategy'] : [brief.group], priority: key === 'ppi' ? 'High' : 'Medium', nextGate: brief.gate, gateDate: date(key === 'budget' ? 3 : 5), health: brief.health, statusNote: brief.note, clientSummary: `Illustrative scenario: ${brief.note}`, updatedAt: at(-240) });
    if (key === 'accounting') { stream.name = 'Accounting Companion'; stream.shortName = 'Accounting Companion'; }
  }
  const artifacts: [keyof typeof ids, string, string, 'planned' | 'draft' | 'in_review' | 'accepted'][] = [
    ['ppi', 'reconciliation', 'Portfolio reconciliation evidence pack', 'in_review'], ['ppi', 'dictionary', 'Portfolio metric dictionary', 'in_review'],
    ['investment', 'adoption', 'Pilot adoption review pack', 'draft'], ['investment', 'guide', 'Analyst quick-start guide', 'accepted'],
    ['legal', 'design', 'Permission and review design', 'in_review'], ['legal', 'prototype', 'Clause-review prototype brief', 'draft'],
    ['mi', 'release', 'Intelligence pilot release pack', 'in_review'], ['mi', 'reading', 'Accessible reading interaction specification', 'accepted'],
    ['accounting', 'release', 'Accounting validation acceptance pack', 'in_review'], ['accounting', 'operations', 'Exception-handling runbook', 'in_review'],
    ['benchmark', 'protocol', 'Portfolio benchmark comparison pack', 'in_review'], ['benchmark', 'labels', 'Peer group and reference-index register', 'draft'],
    ['treasury', 'forecast', 'Forecast input and scenario specification', 'draft'], ['treasury', 'dictionary', 'Liquidity field dictionary', 'accepted'],
    ['spreadsheet', 'validation', 'Upload validation fixture pack', 'in_review'], ['spreadsheet', 'mapping', 'Formula interpretation map', 'draft'],
    ['finance', 'brief', 'Public-finance opportunity brief', 'draft'], ['finance', 'sources', 'Candidate source feasibility map', 'planned'],
    ['budget', 'discovery', 'Budget discovery synthesis', 'draft'], ['budget', 'scope', 'Budget scope and success measures', 'in_review'],
  ];
  const artifactContents: Record<string, string> = {
    'ppi-reconciliation': 'Five fictional holdings compared across source totals and dashboard metrics. Includes a variance log, filter regression and a sample-access decision awaiting resolution.',
    'ppi-dictionary': 'Definitions of exposure, return, time period and reporting currency, with one worked synthetic calculation for each metric.',
    'investment-adoption': 'Pilot readout structure covering active users, completed research tasks, source checking and three qualitative feedback themes. Counts are illustrative.',
    'investment-guide': 'Accepted training example covering a cited research answer, an unsupported answer, source verification and the support contact.',
    'legal-design': 'Permission matrix for reviewer, approver and restricted sources. Includes allowed, denied and mixed-source examples and the outstanding authority decision.',
    'legal-prototype': 'Annotated comparison interaction showing original clause, comparison text and reviewer comments. Scope remains subject to the permission decision.',
    'mi-release': 'Keyboard-focus regression fixture, UAT handoff note, release checklist, verifier assignment and rollback outline for the illustrative pilot.',
    'mi-reading': 'Accepted interaction specification covering selected cards, source labels, keyboard order and readable desktop density.',
    'accounting-release': 'Synthetic journal fixtures, rule explanations, rounding boundaries and internal verification results. Client-role acceptance remains an explicit open action.',
    'accounting-operations': 'Exception categories, triage owners, escalation route and response expectations. Operational review is recorded against the linked work item.',
    'benchmark-protocol': 'Side-by-side fictional portfolio, peer and index returns over matched periods. Documents currency, fee and timing assumptions and reproducible calculations.',
    'benchmark-labels': 'Three fictional peer groups and their reference indices, selection rationale and comparability limits. Two mappings remain subject to review.',
    'treasury-forecast': 'Three synthetic balance scenarios with input age, assumptions, expected directional changes and explanation limits. Supports the design review; no real forecast is asserted.',
    'treasury-dictionary': 'Accepted field definitions for balance, currency, value date and input window, with synthetic records and explicit missing-input behaviour.',
    'spreadsheet-validation': 'Synthetic upload fixtures for unsupported formulas, original row references and useful error explanations, with expected outcomes for QA.',
    'spreadsheet-mapping': 'Named-range examples linked to source cells and explanation labels, plus the keyboard interaction outline awaiting implementation.',
    'finance-brief': 'Working problem statement, candidate users, recurring planning decisions and an option-ranking table. Discovery investment has not been approved.',
    'finance-sources': 'Planned feasibility checklist and three illustrative source candidates with owner role, access question and known limitation. An outline exists; access is not claimed.',
    'budget-discovery': 'Interview coverage map, observed review pain points, assumptions and two alternative problem statements. This specimen is not an approved Budget Companion scope.',
    'budget-scope': 'Two illustrative scope options with target user, included decision, exclusions and proposed success measures. Selection depends on the discovery review.',
  };
  for (const [key, suffix, title, status] of artifacts) state.deliverables.push({ ...v(`showcase-artifact-${key}-${suffix}`, -8), title, workstreamId: ids[key], ownerId: lead.id, description: `Illustrative artifact. ${artifactContents[`${key}-${suffix}`]}`, lifecyclePhase: briefs[key].phase, status, evidenceLinks: [evidence(`artifact-${key}-${suffix}`)] });

  type ItemSpec = { id: string; key: keyof typeof ids; artifact: string; title: string; stage: Stage; kind?: WorkItem['kind']; category?: WorkItem['category']; due?: number; criteria: string; action: string; closedDaysAgo?: number };
  const specs: ItemSpec[] = [
    { id: 'showcase-ppi-blocker', key: 'ppi', artifact: 'reconciliation', title: 'Reconcile synthetic holdings against the authorised sample', stage: 'Development', category: 'data', due: -2, criteria: 'Explain every sampled variance and retain an approved synthetic input identifier.', action: 'Obtain the demo sample-access decision, then rerun reconciliation.' },
    { id: 'showcase-ppi-filter', key: 'ppi', artifact: 'reconciliation', title: 'Preserve entity filters when the portfolio view refreshes', stage: 'UAT', category: 'bug', due: 1, criteria: 'Selected entities persist across refresh and empty-result views.', action: 'Resolve the empty-result regression and record a new UAT result.' },
    { id: 'showcase-ppi-metrics', key: 'ppi', artifact: 'dictionary', title: 'Review the return and exposure metric definitions', kind: 'general', stage: 'Review', category: 'data', due: 2, criteria: 'A reviewer can reproduce each metric from the synthetic examples.', action: 'Record the metric-owner review and any definition changes.' },
    { id: 'showcase-ppi-profile', key: 'ppi', artifact: 'dictionary', title: 'Profile the synthetic holdings sample', kind: 'general', stage: 'Closed', category: 'data', criteria: 'Record row counts, missing fields and duplicate-key examples.', action: 'Use the accepted profile as the reconciliation baseline.' },
    { id: 'showcase-investment-guide', key: 'investment', artifact: 'guide', title: 'Publish the pilot analyst quick-start guide', kind: 'general', stage: 'Closed', closedDaysAgo: 12, criteria: 'The guide covers cited answers, uncertainty and the support route.', action: 'Use the accepted guide in the next pilot training session.' },
    { id: 'showcase-investment-adoption', key: 'investment', artifact: 'adoption', title: 'Review pilot usage against the agreed adoption measures', kind: 'general', stage: 'In progress', category: 'research', due: 3, criteria: 'Separate active use, task completion and qualitative feedback using synthetic examples.', action: 'Complete the first adoption readout and explain measurement limits.' },
    { id: 'showcase-investment-training', key: 'investment', artifact: 'adoption', title: 'Review the analyst training exercise', kind: 'general', stage: 'Review', due: 1, criteria: 'Participants can find a source and identify an unsupported answer.', action: 'Record reviewer findings on the training exercise.' },
    { id: 'showcase-investment-feedback', key: 'investment', artifact: 'adoption', title: 'Triage the next pilot feedback round', kind: 'general', stage: 'Backlog', due: 5, criteria: 'Each feedback item has a decision, owner and next action.', action: 'Select the sample feedback items for triage.' },
    { id: 'showcase-legal-permissions', key: 'legal', artifact: 'design', title: 'Review role-based clause access boundaries', kind: 'general', stage: 'Review', due: 2, criteria: 'The permission matrix covers allowed, denied and mixed-source retrieval.', action: 'Confirm the review authority and record the permission decision.' },
    { id: 'showcase-legal-redaction', key: 'legal', artifact: 'design', title: 'Define redaction behaviour for a restricted clause', kind: 'general', stage: 'In progress', category: 'research', due: 3, criteria: 'Examples distinguish omitted text from an unavailable source.', action: 'Complete three synthetic restriction examples for design review.' },
    { id: 'showcase-legal-prototype', key: 'legal', artifact: 'prototype', title: 'Prototype the clause comparison interaction', stage: 'Backlog', due: 6, criteria: 'The prototype separates source text, differences and reviewer notes.', action: 'Confirm the design decision before starting the prototype.' },
    { id: 'showcase-legal-journey', key: 'legal', artifact: 'prototype', title: 'Agree the reviewer journey and decision points', kind: 'general', stage: 'Closed', category: 'research', closedDaysAgo: 29, criteria: 'The journey identifies review authority and escalation decisions.', action: 'Carry the accepted journey into permission design.' },
    { id: 'showcase-mi-release', key: 'mi', artifact: 'release', title: 'Keep keyboard focus on the selected intelligence card', stage: 'Development', category: 'bug', due: 1, criteria: 'Tab order remains stable after selection, refresh and return from an article.', action: 'Hand the implemented fix to Demo QA for UAT.' },
    { id: 'showcase-mi-density', key: 'mi', artifact: 'reading', title: 'Validate readable card density at narrow widths', stage: 'UAT', due: 2, criteria: 'Synthetic cards remain readable without clipped actions at narrow widths.', action: 'Record the responsive reading checks in UAT.' },
    { id: 'showcase-mi-checklist', key: 'mi', artifact: 'release', title: 'Deploy the source-label release candidate', stage: 'Ready for production', due: 2, criteria: 'Source and publication labels match the synthetic release fixture.', action: 'Attach synthetic deployment evidence and assign production verification.' },
    { id: 'showcase-mi-selection', key: 'mi', artifact: 'reading', title: 'Show a clear selected state on intelligence cards', stage: 'Closed', criteria: 'Selection is visible using keyboard and pointer input.', action: 'Monitor the accepted interaction in the synthetic pilot.' },
    { id: 'showcase-accounting-acceptance', key: 'accounting', artifact: 'release', title: 'Explain why a synthetic journal line fails validation', stage: 'Awaiting client acceptance', due: 0, criteria: 'The explanation identifies the failed rule, affected field and review action.', action: 'Record the simulated client acceptance or rejection with explicit evidence.' },
    { id: 'showcase-accounting-rounding', key: 'accounting', artifact: 'release', title: 'Verify rounding behaviour in the released validation build', stage: 'Production verification', category: 'bug', due: 1, criteria: 'Positive, negative and boundary amounts match the agreed synthetic rounding cases.', action: 'Record the production-verification result for the boundary fixtures.' },
    { id: 'showcase-accounting-exceptions', key: 'accounting', artifact: 'release', title: 'Release the grouped validation-exception view', stage: 'Ready for production', due: 3, criteria: 'Grouping preserves the original row reference and exception count.', action: 'Record deployment evidence and hand over to Demo QA.' },
    { id: 'showcase-accounting-runbook', key: 'accounting', artifact: 'operations', title: 'Review the exception escalation runbook', kind: 'general', stage: 'Review', due: 2, criteria: 'Each exception class has an owner, decision route and response expectation.', action: 'Record operational review findings and approve the runbook if complete.' },
    { id: 'showcase-benchmark-rubric', key: 'benchmark', artifact: 'protocol', title: 'Review portfolio and index return comparability', kind: 'general', stage: 'Review', category: 'data', due: 1, criteria: 'Portfolio and reference returns use the same period, currency and fee convention.', action: 'Review the comparison assumptions and record any required adjustment.' },
    { id: 'showcase-benchmark-run', key: 'benchmark', artifact: 'protocol', title: 'Verify the portfolio benchmark comparison calculations', stage: 'UAT', category: 'data', due: 3, criteria: 'A reviewer can reproduce the fictional portfolio, peer median and reference-index returns from the supplied sample.', action: 'Record the reconciliation result and review differences before acceptance.' },
    { id: 'showcase-benchmark-labels', key: 'benchmark', artifact: 'labels', title: 'Confirm two outstanding reference-index mappings', kind: 'general', stage: 'In progress', category: 'data', due: 1, criteria: 'Each fictional portfolio has a suitable peer group, reference index and documented selection rationale.', action: 'Obtain the investment reviewer decision on the two remaining mappings.' },
    { id: 'showcase-benchmark-sampling', key: 'benchmark', artifact: 'labels', title: 'Agree the financial benchmark comparison periods', kind: 'general', stage: 'Closed', category: 'data', criteria: 'The comparison specifies matching periods, reporting currency and missing-observation treatment.', action: 'Apply the accepted period conventions to the comparison pack.' },
    { id: 'showcase-treasury-watermark', key: 'treasury', artifact: 'forecast', title: 'Distinguish stale balances from a failed forecast run', stage: 'Development', category: 'data', due: 2, criteria: 'The synthetic forecast displays input age and run status separately.', action: 'Complete the watermark implementation and prepare stale-input fixtures.' },
    { id: 'showcase-treasury-scenarios', key: 'treasury', artifact: 'forecast', title: 'Review liquidity stress-case assumptions', kind: 'general', stage: 'Review', category: 'research', due: 4, criteria: 'Each synthetic stress case explains its assumptions and expected directional effect.', action: 'Record treasury reviewer feedback on the scenario definitions.' },
    { id: 'showcase-treasury-alerts', key: 'treasury', artifact: 'forecast', title: 'Define a reviewable low-liquidity alert', stage: 'Backlog', due: 6, criteria: 'The alert explains threshold, input period and responsible review role.', action: 'Agree the alert threshold before implementation.' },
    { id: 'showcase-treasury-fields', key: 'treasury', artifact: 'dictionary', title: 'Review the synthetic liquidity field dictionary', kind: 'general', stage: 'Closed', category: 'data', closedDaysAgo: 22, criteria: 'Balance, currency and value-date fields have explicit definitions.', action: 'Use the accepted definitions in the forecast design.' },
    { id: 'showcase-spreadsheet-validation', key: 'spreadsheet', artifact: 'validation', title: 'Explain unsupported spreadsheet formulas at upload', stage: 'UAT', category: 'bug', due: 1, criteria: 'An unsupported formula reports its location and a useful next action.', action: 'Record validation results against the synthetic upload fixtures.' },
    { id: 'showcase-spreadsheet-mapping', key: 'spreadsheet', artifact: 'mapping', title: 'Map named ranges to the validation explanation', stage: 'Development', category: 'data', due: 3, criteria: 'Synthetic named ranges resolve to the correct cells and explanation labels.', action: 'Complete the mapping and provide a reproducible fixture.' },
    { id: 'showcase-spreadsheet-upload', key: 'spreadsheet', artifact: 'validation', title: 'Preserve the original row reference after upload', stage: 'Closed', criteria: 'Uploaded sample rows retain a stable original reference through validation.', action: 'Use the accepted upload behaviour in the next synthetic validation cycle.' },
    { id: 'showcase-spreadsheet-accessibility', key: 'spreadsheet', artifact: 'mapping', title: 'Add keyboard navigation to the formula explanation', stage: 'Backlog', due: 5, criteria: 'All explanation controls are reachable without a pointer.', action: 'Review the interaction design before implementation.' },
    { id: 'showcase-finance-framing', key: 'finance', artifact: 'brief', title: 'Frame the first public-finance planning question', kind: 'general', stage: 'In progress', category: 'research', due: 4, criteria: 'The brief names a user, a recurring decision and an observable pain point.', action: 'Compare candidate questions and identify the discovery sponsor.' },
    { id: 'showcase-finance-scope', key: 'finance', artifact: 'brief', title: 'Prioritise candidate public-finance scope options', kind: 'general', stage: 'Backlog', category: 'research', due: 7, criteria: 'Each option has a benefit hypothesis, a constraint and a reason for its ranking.', action: 'Prepare the option comparison for the shaping decision.' },
    { id: 'showcase-finance-sources', key: 'finance', artifact: 'sources', title: 'Check candidate source feasibility', kind: 'general', stage: 'Backlog', category: 'data', due: 6, criteria: 'Source candidates have an owner, access route and known limitation.', action: 'Identify the first source owner to consult during discovery.' },
    { id: 'showcase-finance-stakeholders', key: 'finance', artifact: 'brief', title: 'Identify the initial discovery stakeholders', kind: 'general', stage: 'Closed', category: 'research', closedDaysAgo: 57, criteria: 'The fictional stakeholder map covers decision makers, users and source owners.', action: 'Use the accepted stakeholder map for the shaping interviews.' },
    { id: 'showcase-budget-discovery', key: 'budget', artifact: 'discovery', title: 'Synthesize the budget-review discovery interviews', kind: 'general', stage: 'In progress', category: 'research', due: 1, criteria: 'The synthesis separates observations, assumptions, open questions and an evidence-backed problem statement.', action: 'Hand the completed synthetic interview synthesis to Demo lead for Review.' },
    { id: 'showcase-budget-scope', key: 'budget', artifact: 'scope', title: 'Agree the first Budget Companion scope boundary', kind: 'general', stage: 'Backlog', category: 'action', due: 3, criteria: 'The scope decision names the first user group, included decision and explicit exclusions.', action: 'Use the discovery findings to prepare two scope options for decision.' },
    { id: 'showcase-budget-stakeholders', key: 'budget', artifact: 'discovery', title: 'Complete the synthetic budget stakeholder interview map', kind: 'general', stage: 'Closed', category: 'research', criteria: 'The map covers preparers, reviewers and approvers without assuming the solution.', action: 'Use the accepted map to explain discovery coverage.' },
    { id: 'showcase-budget-success', key: 'budget', artifact: 'scope', title: 'Review measurable budget-discovery success criteria', kind: 'general', stage: 'Review', category: 'research', due: 2, criteria: 'Each proposed measure has a baseline method and a decision it informs.', action: 'Review the proposed measures before confirming the scope boundary.' },
  ];
  const range = reportingPeriod(now, state.settings.timezone, state.settings.cutoffHour);
  const currentCloseTime = new Date(now.getTime() - Math.max(1, Math.min(hour, (now.getTime() - new Date(range.startAt).getTime()) / 2))).toISOString();
  const startedDaysAgo: Record<keyof typeof ids, number> = { ppi: 75, investment: 90, legal: 70, mi: 66, accounting: 64, benchmark: 50, treasury: 52, spreadsheet: 48, finance: 90, budget: 18 };
  function pass(item: WorkItem, stamp: string) {
    const result = { id: `${item.id}-pass-${item.stage.toLowerCase().replaceAll(' ', '-')}`, itemId: item.id, cycle: item.cycle, stage: item.stage, result: 'pass' as const, blocking: false, notes: `Illustrative recorded pass: ${item.acceptanceCriteria}`, evidence: evidence(`${item.id}-${item.stage}`), authorId: qa.id, createdAt: stamp };
    state.tests.push(result); touch(item, stamp);
    audit(state, qa, 'tests', result.id, 'test_recorded', 'Synthetic demonstration check; not real delivery evidence.', null, result, stamp);
  }
  for (const spec of specs) {
    const end = spec.closedDaysAgo ? at(-24 * spec.closedDaysAgo) : spec.stage === 'Closed' ? currentCloseTime : at(-6);
    const endTime = new Date(end).getTime();
    const startedAt = at(-24 * startedDaysAgo[spec.key]);
    const targetDate = spec.stage === 'Closed' ? dateInTimezone(new Date(end), state.settings.timezone) : date(spec.due ?? 2);
    const ownerId = spec.id === 'showcase-budget-scope' ? pmo.id : lead.id;
    const item: WorkItem = { ...itemSchema.parse({ title: spec.title, description: `Illustrative work record. ${spec.criteria}`, workstreamId: ids[spec.key], deliverableId: `showcase-artifact-${spec.key}-${spec.artifact}`, kind: spec.kind ?? 'software', category: spec.category ?? (spec.kind === 'general' ? 'action' : 'feature'), priority: spec.id === 'showcase-ppi-blocker' ? 'Critical' : 'Medium', ownerId, currentOwnerId: spec.kind === 'general' ? ownerId : 'demo-engineer', baselineDate: targetDate, dueDate: targetDate, acceptanceCriteria: spec.criteria, evidenceLinks: [evidence(`work-${spec.id}`)], blocked: false, blockReason: '', nextAction: spec.action, clientSummary: spec.title, clientVisible: true, tags: ['Illustrative', briefs[spec.key].phase] }), id: spec.id, version: 1, createdAt: startedAt, updatedAt: startedAt, stage: 'Backlog', cycle: 1 };
    state.items.push(item);
    audit(state, pmo, 'items', item.id, 'created', 'Created synthetic demonstration work.', null, item, item.createdAt);
    const stages = item.kind === 'software' ? SOFTWARE_STAGES : GENERAL_STAGES;
    const target = item.kind === 'software' && spec.stage === 'Closed' ? 'Awaiting client acceptance' : spec.stage;
    const targetIndex = stages.indexOf(target as never);
    for (let index = 1; index <= targetIndex; index++) {
      const stepCount = targetIndex + (item.kind === 'software' && spec.stage === 'Closed' ? 1 : 0);
      const stamp = new Date(new Date(startedAt).getTime() + (endTime - new Date(startedAt).getTime()) * index / stepCount).toISOString();
      if (['UAT', 'Production verification', 'Review'].includes(item.stage)) pass(item, new Date(new Date(stamp).getTime() - 60_000).toISOString());
      const nextStage = stages[index];
      transition(state, pmo, item.id, { version: item.version, stage: nextStage, currentOwnerId: ['UAT', 'Production verification'].includes(nextStage) ? qa.id : item.kind === 'general' || ['Review', 'Awaiting client acceptance', 'Closed'].includes(nextStage) ? lead.id : 'demo-engineer', ...(nextStage === 'Production verification' ? { evidence: evidence(`${item.id}-deployment`) } : {}) }, stamp);
    }
    // Backlog records also received a recent owner review; age is not an abandoned assignment.
    if (item.stage === 'Backlog') { const before = structuredClone(item); touch(item, end); audit(state, lead, 'items', item.id, 'reviewed', 'Owner reviewed the next action and target date.', before, item, end); }
    if (item.kind === 'software' && spec.stage === 'Closed') {
      const before = structuredClone(item); item.stage = 'Closed'; item.closedAt = end; touch(item, end);
      audit(state, lead, 'items', item.id, 'client_accepted', `Synthetic client-role acceptance for demonstration only. Evidence: ${evidence(`${item.id}-client-response`)}`, before, item, end);
    }
  }
  const blocked = state.items.find(item => item.id === 'showcase-ppi-blocker')!;
  const priorBlocker = structuredClone(blocked);
  Object.assign(blocked, { blocked: true, blockedSince: at(-1), blockReason: 'Synthetic source access is awaiting the demo data-owner decision.', nextAction: 'Demo lead to obtain the sample-access decision and confirm a revised reconciliation date.' });
  touch(blocked, at(-1)); audit(state, lead, 'items', blocked.id, 'blocked', 'Synthetic access dependency prevents reconciliation.', priorBlocker, blocked, at(-1));
  const filter = state.items.find(item => item.id === 'showcase-ppi-filter')!;
  const failed = { id: 'showcase-ppi-filter-failure', itemId: filter.id, cycle: 1, stage: 'UAT' as const, result: 'fail' as const, blocking: true, notes: 'Illustrative check FILTER-03: the selected filter resets on refresh for an empty result.', evidence: evidence('showcase-ppi-filter-failed-FILTER-03'), authorId: qa.id, createdAt: at(-4) };
  state.tests.push(failed); touch(filter, at(-4)); audit(state, qa, 'tests', failed.id, 'test_recorded', 'Synthetic blocking UAT finding requires resolution and retest.', null, failed, at(-4));

  const milestone = (id: string, title: string, keys: (keyof typeof ids)[], artifactIds: string[], baseline: number, forecast: number, status: 'planned' | 'at_risk' | 'complete' = 'planned') => ({ ...v(id), title, workstreamIds: keys.map(key => ids[key]), deliverableIds: artifactIds.map(value => `showcase-artifact-${value}`), ownerId: lead.id, baselineDate: date(baseline), forecastDate: date(forecast), status, notes: 'Synthetic demonstration commitment. Baseline and forecast are deliberately separate.', ...(status === 'complete' ? { actualDate: dateInTimezone(new Date(currentCloseTime), state.settings.timezone), updatedAt: currentCloseTime } : {}) });
  state.milestones = [
    milestone('showcase-milestone-ppi', 'Reconciliation sample accepted', ['ppi'], ['ppi-reconciliation'], 1, 4, 'at_risk'),
    milestone('showcase-milestone-release', 'Intelligence and accounting pilot acceptance', ['mi', 'accounting'], ['mi-release', 'accounting-release'], 3, 3),
    milestone('showcase-milestone-budget', 'Budget discovery findings reviewed', ['budget'], ['budget-discovery', 'budget-scope'], 3, 3),
    milestone('showcase-milestone-legal', 'Legal permission design agreed', ['legal'], ['legal-design'], 4, 6, 'at_risk'),
    milestone('showcase-milestone-quality', 'Benchmark comparison and upload assurance', ['benchmark', 'spreadsheet'], ['benchmark-protocol', 'spreadsheet-validation'], 5, 5),
    milestone('showcase-milestone-treasury', 'Synthetic liquidity scenarios ready', ['treasury'], ['treasury-forecast'], 6, 6),
    milestone('showcase-milestone-adoption', 'Pilot adoption readout reviewed', ['investment'], ['investment-adoption'], 5, 5),
    milestone('showcase-milestone-finance', 'Public-finance discovery investment decision', ['finance'], ['finance-brief', 'finance-sources'], 7, 7),
    { ...milestone('showcase-milestone-guide', 'Pilot quick-start guide accepted', ['investment'], ['investment-guide'], -12, -12, 'complete'), actualDate: date(-12), updatedAt: at(-12 * 24) },
  ];
  for (const stream of state.workstreams) {
    const gate = state.milestones.find(value => value.status !== 'complete' && value.workstreamIds.includes(stream.id))!;
    stream.nextGate = gate.title; stream.gateDate = gate.forecastDate;
  }
  const register = (id: string, type: HubState['registers'][number]['type'], key: keyof typeof ids, title: string, items: string[], milestones: string[], action: string, detail: string, due = 2): HubState['registers'][number] => ({ ...v(id), type, title, detail, clientSummary: title, clientVisible: true, workstreamId: ids[key], relatedItemIds: items, milestoneIds: milestones, ownerId: lead.id, dueDate: date(due), priority: 'High', probability: 'Medium', status: 'open', mitigation: 'Continue unaffected work against labelled sample data while the decision is outstanding.', nextAction: action, impact: detail });
  state.registers = [
    { ...register('showcase-raid-access', 'dependency', 'ppi', 'Sample-access decision blocks portfolio reconciliation', ['showcase-ppi-blocker'], ['showcase-milestone-ppi'], 'Obtain the demo data-owner decision and record the next commitment.', 'Reconciliation cannot use the authorised synthetic sample until access is granted.', -2), priority: 'Critical', status: 'escalated' },
    register('showcase-raid-filter', 'issue', 'ppi', 'Portfolio filter resets for an empty result', ['showcase-ppi-filter'], ['showcase-milestone-ppi'], 'Resolve the linked failure and record a passing retest.', 'The synthetic empty-result regression prevents the UAT item advancing.', 1),
    register('showcase-raid-legal', 'decision', 'legal', 'Agree who can approve the permission design', ['showcase-legal-permissions', 'showcase-legal-prototype'], ['showcase-milestone-legal'], 'Choose the review authority and record the rationale.', 'Prototype scope depends on a clear permission-review authority.'),
    register('showcase-raid-budget', 'decision', 'budget', 'Choose the first budget-review scope boundary', ['showcase-budget-discovery', 'showcase-budget-scope'], ['showcase-milestone-budget'], 'Review discovery findings before selecting the first scope option.', 'The synthetic discovery outcome informs scope; the link does not imply discovery is already accepted.', 3),
    register('showcase-raid-client', 'dependency', 'accounting', 'Simulated client response is outstanding', ['showcase-accounting-acceptance'], ['showcase-milestone-release'], 'Record an explicit synthetic acceptance or rejection and supporting evidence.', 'Internal verification has passed; closure still requires the client-role response.', 0),
    register('showcase-raid-labels', 'risk', 'benchmark', 'Reference-index selection could delay comparable results', ['showcase-benchmark-labels'], ['showcase-milestone-quality'], 'Confirm the reviewer decision for the two remaining portfolio-to-index mappings.', 'An unsuitable reference index would make the comparison misleading.', 1),
    { ...register('showcase-raid-window', 'assumption', 'treasury', 'Balance input window is sufficient for the forecast', ['showcase-treasury-watermark', 'showcase-treasury-scenarios'], ['showcase-milestone-treasury'], 'Validate the assumed input window against the synthetic scenarios.', 'Incorrect input-age assumptions change the interpretation of a forecast.', 4), status: 'monitoring' },
    { ...register('showcase-raid-internal', 'risk', 'investment', 'Internal pilot-support coverage needs confirmation', ['showcase-investment-adoption'], [], 'Confirm the demo support roster and escalation contact.', 'The pilot support roster still needs a named backup for analyst training and first-line issue triage.', 3), clientVisible: false, clientSummary: '' },
  ];
  state.meetings = [
    { ...v('showcase-meeting-daily', -2), title: 'Demo daily delivery review', heldAt: at(-2), notes: 'Synthetic meeting: Demo lead follows up sample access. Demo engineer hands the keyboard fix to Demo QA. Demo PMO records the simulated accounting client response. Owners and next actions remain in the linked records.', linkedItemIds: ['showcase-ppi-blocker', 'showcase-mi-release', 'showcase-accounting-acceptance'], linkedRegisterIds: ['showcase-raid-access', 'showcase-raid-client'] },
    { ...v('showcase-meeting-discovery', -12), title: 'Demo discovery synthesis review', heldAt: at(-12), notes: 'Synthetic meeting: observations and assumptions are separated in the budget synthesis. The scope decision remains open. Capture any new follow-up only after checking the existing linked scope item.', linkedItemIds: ['showcase-budget-discovery', 'showcase-budget-scope'], linkedRegisterIds: ['showcase-raid-budget'] },
    { ...v('showcase-meeting-quality', -24), title: 'Assurance review', heldAt: at(-24), notes: 'Illustrative meeting: the empty-result filter check failed. Two benchmark reference-index mappings need an investment reviewer decision. Resolve findings and record evidence before advancing the affected work.', linkedItemIds: ['showcase-ppi-filter', 'showcase-benchmark-labels'], linkedRegisterIds: ['showcase-raid-filter', 'showcase-raid-labels'] },
  ];

  const fileHash = createHash('sha256').update('Synthetic showcase source revision one; no workbook exists.').digest('hex');
  const intake: IntakeBundle = { version: 1, projectName: state.settings.projectName, documents: [{ id: 'showcase-source-tracker', name: 'Illustrative tracker · reconciled intake', kind: 'tracker', coverage: 'current', sourceDate: date(-10), receivedAt: at(-240), fileHash, summary: 'Four generated source rows demonstrate active work, a resolved status contradiction, retained history and an exclusion. No real workbook is represented.', warnings: ['Illustrative records. Source labels are retained separately from checked delivery outcomes.'] }], useCases: [], records: [
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-1', locator: 'Example rows · 1', workstreamId: ids.finance, title: 'Confirm the discovery source-owner contact', detail: 'Clarify the first source-owner contact and agree the feasibility discussion.', sourceStatus: 'Assigned in source', sourceOwner: 'Example source team', sourcePriority: 'Medium', sourceDates: date(2), resolutionNotes: 'Contact handoff awaiting review at original intake.', disposition: 'active', mappingNote: 'Capture an owned general action without inferring a delivery stage from the source label.', intake: { kind: 'general', category: 'action', priority: 'Medium' } },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-2', locator: 'Example rows · 2', workstreamId: ids.finance, title: 'Reconcile contradictory discovery tracker remarks', detail: 'A source row says done while its remarks still ask a scope question.', sourceStatus: 'Done', sourceOwner: 'Example discovery lead', sourcePriority: 'Medium', sourceDates: date(-2), resolutionNotes: 'The original remark asks for a scope decision.', disposition: 'needs_review', mappingNote: 'Create a status-confirmation action; the source label does not prove accepted work.' },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-3', locator: 'Example rows · 3', workstreamId: ids.budget, title: 'Archive the interview invitation note', detail: 'Source-only completed administrative note.', sourceStatus: 'Complete in source', sourceOwner: 'Example workshop coordinator', sourcePriority: 'Low', sourceDates: date(-11), resolutionNotes: 'Invitations issued; no delivery commitment is implied.', disposition: 'completed', mappingNote: 'Retain source history without inventing a closed workflow item.' },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-4', locator: 'Example rows · 4', workstreamId: ids.budget, title: 'Exclude an out-of-scope scheduling request', detail: 'Administrative scheduling request outside the product scope.', sourceStatus: 'No action', sourceOwner: 'Example workshop coordinator', sourcePriority: 'Low', sourceDates: date(-10), resolutionNotes: 'Handled outside the use-case scope; no product work is required.', disposition: 'excluded', mappingNote: 'Retain the exclusion rationale without creating active work.' },
  ] };
  applyIntake(state, intake, pmo.id, at(-240));
  const revised = structuredClone(intake); revised.records[0].sourceStatus = 'Source owner changed'; revised.records[0].sourceOwner = 'Example source custodian';
  revised.documents[0].fileHash = createHash('sha256').update('Synthetic showcase source revision two; no workbook exists.').digest('hex');
  applyIntake(state, revised, pmo.id, at(-48));
  for (const row of state.sourceRecords!.filter(value => value.itemId)) {
    const item = state.items.find(value => value.id === row.itemId)!, before = structuredClone(item);
    Object.assign(item, { ownerId: lead.id, currentOwnerId: lead.id, priority: 'Medium', baselineDate: date(row.sourceKey === 'DEMO-1' ? 2 : -1), dueDate: date(row.sourceKey === 'DEMO-1' ? 2 : -1), deliverableId: `showcase-artifact-finance-${row.sourceKey === 'DEMO-1' ? 'sources' : 'brief'}`, acceptanceCriteria: row.sourceKey === 'DEMO-1' ? 'Record the agreed contact role, feasibility discussion and next owner action.' : 'A reviewer records the current scope position and resolves the contradictory source remarks.', evidenceLinks: [evidence(`work-${item.id}`)], nextAction: row.sourceKey === 'DEMO-1' ? 'Hold the source-feasibility discussion with the agreed source-owner role.' : 'Use the reviewed scope position in the opportunity brief.', clientVisible: true, clientSummary: row.title });
    touch(item, at(-24)); audit(state, pmo, 'items', item.id, 'intake-assigned', 'Assigned the reviewed source action, target, acceptance criteria and evidence.', before, item, at(-24));
    transition(state, pmo, item.id, { version: item.version, stage: 'In progress', currentOwnerId: lead.id }, at(-23));
    if (row.sourceKey === 'DEMO-2') {
      transition(state, pmo, item.id, { version: item.version, stage: 'Review' }, at(-22));
      pass(item, at(-21));
      transition(state, pmo, item.id, { version: item.version, stage: 'Closed' }, at(-20));
    }
    const sourceBefore = structuredClone(row);
    row.resolutionNotes = row.sourceKey === 'DEMO-1' ? 'PMO confirmed the new source custodian; Demo lead owns the feasibility discussion and target date in the linked work record.' : 'Review confirmed the framing question was answered. The linked status-confirmation action passed review and closed; the original source label remains unchanged.';
    row.mappingNote = 'PMO reconciliation recorded with a linked owned work item and review history.';
    row.disposition = row.sourceKey === 'DEMO-1' ? 'active' : 'completed';
    delete row.syncNote; touch(row, at(-19));
    audit(state, pmo, 'sourceRecords', row.id, 'source-reconciled', row.resolutionNotes, sourceBefore, row, at(-19));
  }
  const briefHash = createHash('sha256').update(JSON.stringify(briefs)).digest('hex');
  state.sourceDocuments!.push({ ...v('showcase-source-brief', -2), name: 'Month-three illustrative portfolio brief', kind: 'briefing', coverage: 'context', sourceDate: today, receivedAt: at(-2), fileHash: briefHash, summary: 'Independently authored fictional operating assumptions for all ten named use cases. These phases, owners and outcomes are examples, not confirmed client facts.', warnings: ['Budget scope options remain illustrative and unapproved. No client delivery claim is made.'] });
  for (const [key, streamId] of Object.entries(ids)) {
    const stream = state.workstreams.find(value => value.id === streamId)!, before = structuredClone(stream);
    stream.sources = [{ documentId: 'showcase-source-brief', locator: `Use-case brief · ${key}`, fileHash: briefHash }];
    touch(stream, at(-2)); audit(state, pmo, 'workstreams', stream.id, 'source-context-added', 'Linked the illustrative portfolio assumptions.', before, stream, at(-2));
  }

  // Historical editions use work snapshots reconstructed from dated audit events.
  // Current stages and recent failures must never leak backwards into the archives.
  const phases: Record<keyof typeof ids, [LifecyclePhase, LifecyclePhase]> = {
    ppi: ['discovery', 'build'], investment: ['design', 'release'], legal: ['shaping', 'design'], mi: ['design', 'assurance'], accounting: ['design', 'assurance'], benchmark: ['shaping', 'build'], treasury: ['shaping', 'build'], spreadsheet: ['shaping', 'build'], finance: ['shaping', 'shaping'], budget: ['shaping', 'shaping'],
  };
  for (const [index, daysAgo] of [56, 28].entries()) {
    const archiveAt = at(-24 * daysAgo), history = structuredClone(state);
    const itemSnapshots = new Map<string, WorkItem>();
    for (const event of [...state.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (event.entityType === 'items' && event.createdAt <= archiveAt && event.after) itemSnapshots.set(event.entityId, structuredClone(event.after) as WorkItem);
    history.items = [...itemSnapshots.values()];
    history.tests = history.tests.filter(result => result.createdAt <= archiveAt && itemSnapshots.has(result.itemId));
    history.deliverables = history.deliverables.filter(artifact => history.items.some(item => item.deliverableId === artifact.id)).map(artifact => ({ ...artifact, version: 1, status: history.items.filter(item => item.deliverableId === artifact.id).every(item => item.stage === 'Closed') ? 'accepted' : 'draft', updatedAt: archiveAt }));
    history.milestones = []; history.registers = []; history.submissions = []; history.reports = [];
    history.sourceDocuments = []; history.sourceRecords = [];
    history.events = history.events.filter(event => event.createdAt <= archiveAt);
    for (const [key, streamId] of Object.entries(ids) as [keyof typeof ids, string][]) {
      const stream = history.workstreams.find(value => value.id === streamId)!;
      Object.assign(stream, { version: 1, lifecyclePhase: phases[key][index], health: 'green', statusNote: `Illustrative month ${index + 1}: ${phases[key][index]} activities are the current focus.`, clientSummary: `Illustrative month ${index + 1}: ${phases[key][index]} activities are the current focus.`, sources: [], updatedAt: archiveAt });
      const historicalPeriod = reportingPeriod(new Date(archiveAt), history.settings.timezone, history.settings.cutoffHour);
      history.submissions.push({ id: `showcase-submission-month-${index + 1}-${key}`, version: 1, updatedAt: archiveAt, workstreamId: streamId, periodEnd: historicalPeriod.end, completed: stream.statusNote, next: `Review the next ${phases[key][index]} commitment.`, changes: 'Monthly illustrative scenario reviewed.', blockers: 'No unresolved decision represented in this historical example.', health: 'green', confirmedBy: lead.id, confirmedAt: archiveAt, sourceUpdatedAt: latestWorkstreamChange(history, streamId) });
    }
    const archived = reportDraft(history, pmo, 'client', archiveAt);
    Object.assign(archived, { id: index === 0 ? 'showcase-report-approved' : 'showcase-report-month-two', title: `Month ${index === 0 ? 'one' : 'two'} · Programme review`, status: 'approved', version: 2, approvedBy: 'demo-approver', approvedAt: archiveAt });
    archived.body.summary = index === 0 ? 'Illustrative first-month archive: the initial stakeholder map is complete. Portfolio discovery and companion design are underway, with early opportunities still being shaped. This is fictional operating history, not a record of client achievements.' : 'Illustrative second-month archive: the legal reviewer journey is agreed. Investment pilot preparation and intelligence assurance have progressed; the current month-three access escalation and UAT failure have not occurred in this historical snapshot.';
    for (const stream of archived.body.workstreams) {
      const profile = history.workstreams.find(value => value.name === stream.name)!;
      if (!stream.completed.length) stream.completed = ['No work closed in this reporting period.'];
      if (!stream.next.length) stream.next = [`Review the next ${profile.lifecyclePhase} commitment with the use-case lead.`];
      if (!stream.attention.length) stream.attention = ['No client-facing concern recorded in this illustrative edition.'];
    }
    archived.body.nextWeek = archived.body.workstreams.slice(0, 4).map(stream => `${stream.name}: ${stream.next[0]}`);
    state.submissions.push(...history.submissions);
    state.reports.push(archived);
    audit(state, state.members[4], 'reports', archived.id, 'approved', 'Approved an illustrative historical edition using only work snapshots available at its date.', null, archived, archiveAt);
  }
  for (const [key, streamId] of Object.entries(ids)) {
    const stream = state.workstreams.find(value => value.id === streamId)!;
    const completed = state.items.filter(item => item.workstreamId === streamId && item.closedAt && item.closedAt >= range.startAt);
    const submission = { id: `showcase-submission-${key}`, version: 1, updatedAt: now.toISOString(), workstreamId: stream.id, periodEnd: range.end, completed: completed.length ? completed.map(item => item.title).join('; ') : `No closures this period. ${stream.statusNote}`, next: stream.nextGate!, changes: stream.statusNote, blockers: key === 'ppi' ? 'The sample-access decision remains outstanding; PMO review is requested.' : 'No additional blocker beyond the linked register records.', health: stream.health, confirmedBy: lead.id, confirmedAt: now.toISOString(), sourceUpdatedAt: latestWorkstreamChange(state, stream.id) };
    state.submissions.push(submission); audit(state, lead, 'submissions', submission.id, 'confirmed', 'Lead reviewed the current illustrative work, dates and concerns for this reporting period.', null, submission, now.toISOString());
  }
  const draft = reportDraft(state, pmo, 'client', now.toISOString());
  draft.id = 'showcase-report-draft'; draft.title = 'Month three · Working programme brief';
  draft.body.summary = 'Illustrative month-three operating review. All ten use cases have confirmed updates. Discovery, delivery and adoption run in parallel: Budget findings need a scope decision, intelligence work is ready for a QA handoff, and portfolio reconciliation needs a sample-access decision. These are fictional operating examples, not asserted client achievements.';
  for (const stream of draft.body.workstreams) {
    if (!stream.completed.length) stream.completed = ['No work closed in this reporting period.'];
    if (!stream.attention.length) stream.attention = ['No client-facing concern recorded.'];
  }
  state.reports.push(draft); audit(state, pmo, 'reports', draft.id, 'draft_created', 'Prepared the current illustrative programme brief with all ten use cases confirmed.', null, draft, now.toISOString());
  const reviewed = structuredClone(draft);
  Object.assign(reviewed, { id: 'showcase-report-reviewed', title: 'Month three · Programme review', version: 2, status: 'approved', approvedBy: 'demo-approver', approvedAt: now.toISOString(), updatedAt: now.toISOString() });
  state.reports.push(reviewed);
  audit(state, state.members[4], 'reports', reviewed.id, 'approved', 'Approved the complete illustrative current-period edition; no confirmation waiver was required.', null, reviewed, now.toISOString());
  const internal = reportDraft(state, pmo, 'internal', now.toISOString());
  internal.id = 'showcase-report-internal'; internal.title = 'Month three · Internal delivery check-in';
  internal.body.summary = 'Illustrative internal check-in: PMO owns the Budget scope follow-up, the lead owns the portfolio access decision, and the engineer has a clear QA handoff for Market Intelligence. Confirm pilot-support coverage before the next adoption readout. All ten use-case updates have been reviewed.';
  state.reports.push(internal);
  audit(state, pmo, 'reports', internal.id, 'draft_created', 'Prepared the concise illustrative internal check-in, including the private support-coverage concern.', null, internal, now.toISOString());
  for (const collection of ['workstreams', 'deliverables', 'milestones', 'items', 'registers', 'meetings'] as const) for (const record of state[collection]) validateReferences(state, collection, record);
  // Domain helpers use UUIDs for live events; stable IDs make this fixture repeatable.
  state.events.forEach((event, index) => { event.id = `showcase-event-${String(index + 1).padStart(3, '0')}`; });
  return state;
}
