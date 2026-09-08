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
  const evidence = (id: string) => `https://example.invalid/synthetic-demo/${id}`;
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
  Object.assign(state.settings, { projectName: 'AI programme · Demonstration', demoScenario: 'consulting-lifecycle' });
  const briefs: Record<keyof typeof ids, { phase: LifecyclePhase; group: string; outcome: string; scope: string; gate: string; health: 'green' | 'amber' | 'red'; note: string }> = {
    ppi: { phase: 'assurance', group: 'Investment insights', outcome: 'Explain portfolio movement with traceable synthetic holdings and calculations.', scope: 'Sample holdings, metric definitions, filter behaviour and reconciliation.', gate: 'Reconciliation sample accepted', health: 'red', note: 'Synthetic access dependency blocks reconciliation; one filter check needs retest.' },
    investment: { phase: 'adoption', group: 'Investment insights', outcome: 'Help pilot analysts use a cited research companion and measure useful adoption.', scope: 'Training, support, pilot feedback and adoption measures.', gate: 'Pilot adoption review', health: 'green', note: 'Training guide accepted; usage review and feedback triage are underway.' },
    legal: { phase: 'design', group: 'Professional services', outcome: 'Help reviewers retrieve clauses while protecting role-restricted documents.', scope: 'Permission design, redaction boundaries and review interaction prototypes.', gate: 'Design principles agreed', health: 'amber', note: 'A decision on review authority is needed before the prototype scope is fixed.' },
    mi: { phase: 'release', group: 'Investment insights', outcome: 'Deliver an accessible, clearly sourced daily intelligence reading experience.', scope: 'Synthetic article cards, keyboard interaction and repeatable release checks.', gate: 'Pilot release accepted', health: 'green', note: 'The keyboard fix is ready for a UAT handoff; release checks are staged separately.' },
    accounting: { phase: 'release', group: 'Finance operations', outcome: 'Explain validation exceptions and make accounting checks reviewable.', scope: 'Synthetic journal samples, rounding checks and exception explanation.', gate: 'Client response recorded', health: 'amber', note: 'An internally verified improvement awaits an explicit simulated client response.' },
    benchmark: { phase: 'assurance', group: 'Shared foundations', outcome: 'Make quality claims reproducible with an agreed sample and scoring rubric.', scope: 'Synthetic evaluation cases, metric definitions and disputed-label review.', gate: 'Evaluation protocol accepted', health: 'amber', note: 'Reviewers must settle disputed labels before the final run can be accepted.' },
    treasury: { phase: 'build', group: 'Finance operations', outcome: 'Make a liquidity forecast explain its inputs and uncertainty.', scope: 'Synthetic balances, time windows, stress cases and alert rules.', gate: 'Scenario demonstration ready', health: 'green', note: 'Watermark handling is in development; scenario review proceeds in parallel.' },
    spreadsheet: { phase: 'build', group: 'Shared foundations', outcome: 'Give users useful explanations of spreadsheet validation failures.', scope: 'Synthetic upload fixtures, formula mapping and accessible error messages.', gate: 'Upload validation accepted', health: 'green', note: 'Validation is in UAT and formula mapping is in development.' },
    finance: { phase: 'shaping', group: 'Public finance planning', outcome: 'Agree which public-finance question is valuable enough to investigate.', scope: 'Problem framing, candidate users, source feasibility and prioritisation.', gate: 'Discovery investment decision', health: 'amber', note: 'The brief is being shaped; scope and source feasibility remain open questions.' },
    budget: { phase: 'discovery', group: 'Public finance planning', outcome: 'Understand budget-review decisions before selecting an AI intervention.', scope: 'Stakeholder interviews, a review journey, success measures and scope options.', gate: 'Discovery findings reviewed', health: 'green', note: 'Interview synthesis is ready for review; a separate scope follow-up remains in Backlog.' },
  };
  for (const [key, id] of Object.entries(ids) as [keyof typeof ids, string][]) {
    const stream = state.workstreams.find(value => value.id === id)!, brief = briefs[key];
    Object.assign(stream, { description: `Demonstration scenario: ${brief.outcome}`, scope: brief.scope, leadId: lead.id, lifecyclePhase: brief.phase, phaseLabel: `Demonstration · ${brief.phase}`, groups: [brief.group], priority: key === 'ppi' ? 'High' : 'Medium', nextGate: brief.gate, gateDate: date(key === 'budget' ? 3 : 5), health: brief.health, statusNote: brief.note, clientSummary: `Synthetic scenario: ${brief.note}`, updatedAt: at(-240) });
    if (key === 'accounting') { stream.name = 'Accounting Companion'; stream.shortName = 'Accounting Companion'; }
  }
  const artifacts: [keyof typeof ids, string, string, 'planned' | 'draft' | 'in_review' | 'accepted'][] = [
    ['ppi', 'reconciliation', 'Portfolio reconciliation evidence pack', 'in_review'], ['ppi', 'dictionary', 'Portfolio metric dictionary', 'in_review'],
    ['investment', 'adoption', 'Pilot adoption review pack', 'draft'], ['investment', 'guide', 'Analyst quick-start guide', 'accepted'],
    ['legal', 'design', 'Permission and review design', 'in_review'], ['legal', 'prototype', 'Clause-review prototype brief', 'draft'],
    ['mi', 'release', 'Intelligence pilot release pack', 'in_review'], ['mi', 'reading', 'Accessible reading interaction specification', 'accepted'],
    ['accounting', 'release', 'Accounting validation acceptance pack', 'in_review'], ['accounting', 'operations', 'Exception-handling runbook', 'in_review'],
    ['benchmark', 'protocol', 'Evaluation protocol and rubric', 'in_review'], ['benchmark', 'labels', 'Synthetic reference-answer set', 'draft'],
    ['treasury', 'forecast', 'Forecast input and scenario specification', 'draft'], ['treasury', 'dictionary', 'Liquidity field dictionary', 'accepted'],
    ['spreadsheet', 'validation', 'Upload validation fixture pack', 'in_review'], ['spreadsheet', 'mapping', 'Formula interpretation map', 'draft'],
    ['finance', 'brief', 'Public-finance opportunity brief', 'draft'], ['finance', 'sources', 'Candidate source feasibility map', 'planned'],
    ['budget', 'discovery', 'Budget discovery synthesis', 'draft'], ['budget', 'scope', 'Budget scope and success measures', 'in_review'],
  ];
  for (const [key, suffix, title, status] of artifacts) state.deliverables.push({ ...v(`showcase-artifact-${key}-${suffix}`, -8), title, workstreamId: ids[key], ownerId: lead.id, description: `Synthetic demonstration artifact. ${briefs[key].scope}`, lifecyclePhase: briefs[key].phase, status, evidenceLinks: status === 'accepted' ? [evidence(`accepted-artifact-${key}-${suffix}`)] : [] });

  type ItemSpec = { id: string; key: keyof typeof ids; artifact: string; title: string; stage: Stage; kind?: WorkItem['kind']; category?: WorkItem['category']; due?: number; criteria: string; action: string; historical?: boolean };
  const specs: ItemSpec[] = [
    { id: 'showcase-ppi-blocker', key: 'ppi', artifact: 'reconciliation', title: 'Reconcile synthetic holdings against the authorised sample', stage: 'Development', category: 'data', due: -2, criteria: 'Explain every sampled variance and retain an approved synthetic input identifier.', action: 'Obtain the demo sample-access decision, then rerun reconciliation.' },
    { id: 'showcase-ppi-filter', key: 'ppi', artifact: 'reconciliation', title: 'Preserve entity filters when the portfolio view refreshes', stage: 'UAT', category: 'bug', due: 1, criteria: 'Selected entities persist across refresh and empty-result views.', action: 'Resolve the empty-result regression and record a new UAT result.' },
    { id: 'showcase-ppi-metrics', key: 'ppi', artifact: 'dictionary', title: 'Review the return and exposure metric definitions', kind: 'general', stage: 'Review', category: 'data', due: 2, criteria: 'A reviewer can reproduce each metric from the synthetic examples.', action: 'Record the metric-owner review and any definition changes.' },
    { id: 'showcase-ppi-profile', key: 'ppi', artifact: 'dictionary', title: 'Profile the synthetic holdings sample', kind: 'general', stage: 'Closed', category: 'data', criteria: 'Record row counts, missing fields and duplicate-key examples.', action: 'Use the accepted profile as the reconciliation baseline.' },
    { id: 'showcase-investment-guide', key: 'investment', artifact: 'guide', title: 'Publish the pilot analyst quick-start guide', kind: 'general', stage: 'Closed', criteria: 'The guide covers cited answers, uncertainty and the support route.', action: 'Use the accepted guide in the next pilot training session.' },
    { id: 'showcase-investment-adoption', key: 'investment', artifact: 'adoption', title: 'Review pilot usage against the agreed adoption measures', kind: 'general', stage: 'In progress', category: 'research', due: 3, criteria: 'Separate active use, task completion and qualitative feedback using synthetic examples.', action: 'Complete the first adoption readout and explain measurement limits.' },
    { id: 'showcase-investment-training', key: 'investment', artifact: 'adoption', title: 'Review the analyst training exercise', kind: 'general', stage: 'Review', due: 1, criteria: 'Participants can find a source and identify an unsupported answer.', action: 'Record reviewer findings on the training exercise.' },
    { id: 'showcase-investment-feedback', key: 'investment', artifact: 'adoption', title: 'Triage the next pilot feedback round', kind: 'general', stage: 'Backlog', due: 5, criteria: 'Each feedback item has a decision, owner and next action.', action: 'Select the sample feedback items for triage.' },
    { id: 'showcase-legal-permissions', key: 'legal', artifact: 'design', title: 'Review role-based clause access boundaries', kind: 'general', stage: 'Review', due: 2, criteria: 'The permission matrix covers allowed, denied and mixed-source retrieval.', action: 'Confirm the review authority and record the permission decision.' },
    { id: 'showcase-legal-redaction', key: 'legal', artifact: 'design', title: 'Define redaction behaviour for a restricted clause', kind: 'general', stage: 'In progress', category: 'research', due: 3, criteria: 'Examples distinguish omitted text from an unavailable source.', action: 'Complete three synthetic restriction examples for design review.' },
    { id: 'showcase-legal-prototype', key: 'legal', artifact: 'prototype', title: 'Prototype the clause comparison interaction', stage: 'Backlog', due: 6, criteria: 'The prototype separates source text, differences and reviewer notes.', action: 'Confirm the design decision before starting the prototype.' },
    { id: 'showcase-legal-journey', key: 'legal', artifact: 'prototype', title: 'Agree the reviewer journey and decision points', kind: 'general', stage: 'Closed', category: 'research', criteria: 'The journey identifies review authority and escalation decisions.', action: 'Carry the accepted journey into permission design.' },
    { id: 'showcase-mi-release', key: 'mi', artifact: 'release', title: 'Keep keyboard focus on the selected intelligence card', stage: 'Development', category: 'bug', due: 1, criteria: 'Tab order remains stable after selection, refresh and return from an article.', action: 'Hand the implemented fix to Demo QA for UAT.' },
    { id: 'showcase-mi-density', key: 'mi', artifact: 'reading', title: 'Validate readable card density at narrow widths', stage: 'UAT', due: 2, criteria: 'Synthetic cards remain readable without clipped actions at narrow widths.', action: 'Record the responsive reading checks in UAT.' },
    { id: 'showcase-mi-checklist', key: 'mi', artifact: 'release', title: 'Deploy the source-label release candidate', stage: 'Ready for production', due: 2, criteria: 'Source and publication labels match the synthetic release fixture.', action: 'Attach synthetic deployment evidence and assign production verification.' },
    { id: 'showcase-mi-selection', key: 'mi', artifact: 'reading', title: 'Show a clear selected state on intelligence cards', stage: 'Closed', criteria: 'Selection is visible using keyboard and pointer input.', action: 'Monitor the accepted interaction in the synthetic pilot.' },
    { id: 'showcase-accounting-acceptance', key: 'accounting', artifact: 'release', title: 'Explain why a synthetic journal line fails validation', stage: 'Awaiting client acceptance', due: 0, criteria: 'The explanation identifies the failed rule, affected field and review action.', action: 'Record the simulated client acceptance or rejection with explicit evidence.' },
    { id: 'showcase-accounting-rounding', key: 'accounting', artifact: 'release', title: 'Verify rounding behaviour in the released validation build', stage: 'Production verification', category: 'bug', due: 1, criteria: 'Positive, negative and boundary amounts match the agreed synthetic rounding cases.', action: 'Record the production-verification result for the boundary fixtures.' },
    { id: 'showcase-accounting-exceptions', key: 'accounting', artifact: 'release', title: 'Release the grouped validation-exception view', stage: 'Ready for production', due: 3, criteria: 'Grouping preserves the original row reference and exception count.', action: 'Record deployment evidence and hand over to Demo QA.' },
    { id: 'showcase-accounting-runbook', key: 'accounting', artifact: 'operations', title: 'Review the exception escalation runbook', kind: 'general', stage: 'Review', due: 2, criteria: 'Each exception class has an owner, decision route and response expectation.', action: 'Record operational review findings and approve the runbook if complete.' },
    { id: 'showcase-benchmark-rubric', key: 'benchmark', artifact: 'protocol', title: 'Review the evaluation scoring rubric', kind: 'general', stage: 'Review', category: 'evaluation', due: 1, criteria: 'Two reviewers can score the same synthetic answers consistently.', action: 'Compare reviewer scores and resolve rubric ambiguities.' },
    { id: 'showcase-benchmark-run', key: 'benchmark', artifact: 'protocol', title: 'Validate reproducible evaluation runs', stage: 'UAT', category: 'evaluation', due: 3, criteria: 'A run captures the synthetic dataset revision, scoring settings and output identifier.', action: 'Record the reproducibility test and review any differences.' },
    { id: 'showcase-benchmark-labels', key: 'benchmark', artifact: 'labels', title: 'Resolve disputed labels in the synthetic reference set', kind: 'general', stage: 'In progress', category: 'evaluation', due: -1, criteria: 'Every disputed label has an agreed rationale and reviewer.', action: 'Obtain the subject-matter review for the remaining three examples.' },
    { id: 'showcase-benchmark-sampling', key: 'benchmark', artifact: 'labels', title: 'Agree the synthetic evaluation sampling plan', kind: 'general', stage: 'Closed', category: 'evaluation', criteria: 'The plan names representative categories, exclusions and review limits.', action: 'Apply the accepted sampling plan to the reference set.' },
    { id: 'showcase-treasury-watermark', key: 'treasury', artifact: 'forecast', title: 'Distinguish stale balances from a failed forecast run', stage: 'Development', category: 'data', due: 2, criteria: 'The synthetic forecast displays input age and run status separately.', action: 'Complete the watermark implementation and prepare stale-input fixtures.' },
    { id: 'showcase-treasury-scenarios', key: 'treasury', artifact: 'forecast', title: 'Review liquidity stress-case assumptions', kind: 'general', stage: 'Review', category: 'research', due: 4, criteria: 'Each synthetic stress case explains its assumptions and expected directional effect.', action: 'Record treasury reviewer feedback on the scenario definitions.' },
    { id: 'showcase-treasury-alerts', key: 'treasury', artifact: 'forecast', title: 'Define a reviewable low-liquidity alert', stage: 'Backlog', due: 6, criteria: 'The alert explains threshold, input period and responsible review role.', action: 'Agree the alert threshold before implementation.' },
    { id: 'showcase-treasury-fields', key: 'treasury', artifact: 'dictionary', title: 'Review the synthetic liquidity field dictionary', kind: 'general', stage: 'Closed', category: 'data', criteria: 'Balance, currency and value-date fields have explicit definitions.', action: 'Use the accepted definitions in the forecast design.' },
    { id: 'showcase-spreadsheet-validation', key: 'spreadsheet', artifact: 'validation', title: 'Explain unsupported spreadsheet formulas at upload', stage: 'UAT', category: 'bug', due: 1, criteria: 'An unsupported formula reports its location and a useful next action.', action: 'Record validation results against the synthetic upload fixtures.' },
    { id: 'showcase-spreadsheet-mapping', key: 'spreadsheet', artifact: 'mapping', title: 'Map named ranges to the validation explanation', stage: 'Development', category: 'data', due: 3, criteria: 'Synthetic named ranges resolve to the correct cells and explanation labels.', action: 'Complete the mapping and provide a reproducible fixture.' },
    { id: 'showcase-spreadsheet-upload', key: 'spreadsheet', artifact: 'validation', title: 'Preserve the original row reference after upload', stage: 'Closed', criteria: 'Uploaded sample rows retain a stable original reference through validation.', action: 'Use the accepted upload behaviour in the next synthetic validation cycle.' },
    { id: 'showcase-spreadsheet-accessibility', key: 'spreadsheet', artifact: 'mapping', title: 'Add keyboard navigation to the formula explanation', stage: 'Backlog', due: 5, criteria: 'All explanation controls are reachable without a pointer.', action: 'Review the interaction design before implementation.' },
    { id: 'showcase-finance-framing', key: 'finance', artifact: 'brief', title: 'Frame the first public-finance planning question', kind: 'general', stage: 'In progress', category: 'research', due: 4, criteria: 'The brief names a user, a recurring decision and an observable pain point.', action: 'Compare candidate questions and identify the discovery sponsor.' },
    { id: 'showcase-finance-scope', key: 'finance', artifact: 'brief', title: 'Prioritise candidate public-finance scope options', kind: 'general', stage: 'Backlog', category: 'research', due: 7, criteria: 'Each option has a benefit hypothesis, a constraint and a reason for its ranking.', action: 'Prepare the option comparison for the shaping decision.' },
    { id: 'showcase-finance-sources', key: 'finance', artifact: 'sources', title: 'Check candidate source feasibility', kind: 'general', stage: 'Backlog', category: 'data', due: 6, criteria: 'Source candidates have an owner, access route and known limitation.', action: 'Identify the first source owner to consult during discovery.' },
    { id: 'showcase-finance-stakeholders', key: 'finance', artifact: 'brief', title: 'Identify the initial discovery stakeholders', kind: 'general', stage: 'Closed', category: 'research', historical: true, criteria: 'The fictional stakeholder map covers decision makers, users and source owners.', action: 'Use the accepted stakeholder map for the shaping interviews.' },
    { id: 'showcase-budget-discovery', key: 'budget', artifact: 'discovery', title: 'Synthesize the budget-review discovery interviews', kind: 'general', stage: 'In progress', category: 'research', due: 1, criteria: 'The synthesis separates observations, assumptions, open questions and an evidence-backed problem statement.', action: 'Hand the completed synthetic interview synthesis to Demo lead for Review.' },
    { id: 'showcase-budget-scope', key: 'budget', artifact: 'scope', title: 'Agree the first Budget Companion scope boundary', kind: 'general', stage: 'Backlog', category: 'action', due: 3, criteria: 'The scope decision names the first user group, included decision and explicit exclusions.', action: 'Use the discovery findings to prepare two scope options for decision.' },
    { id: 'showcase-budget-stakeholders', key: 'budget', artifact: 'discovery', title: 'Complete the synthetic budget stakeholder interview map', kind: 'general', stage: 'Closed', category: 'research', criteria: 'The map covers preparers, reviewers and approvers without assuming the solution.', action: 'Use the accepted map to explain discovery coverage.' },
    { id: 'showcase-budget-success', key: 'budget', artifact: 'scope', title: 'Review measurable budget-discovery success criteria', kind: 'general', stage: 'Review', category: 'research', due: 2, criteria: 'Each proposed measure has a baseline method and a decision it informs.', action: 'Review the proposed measures before confirming the scope boundary.' },
  ];
  const range = reportingPeriod(now, state.settings.timezone, state.settings.cutoffHour);
  const archiveTime = new Date(new Date(range.startAt).getTime() - 1);
  const currentCloseTime = new Date(now.getTime() - Math.max(1, Math.min(hour, (now.getTime() - new Date(range.startAt).getTime()) / 2))).toISOString();
  function pass(item: WorkItem, stamp: string) {
    const result = { id: `${item.id}-pass-${item.stage.toLowerCase().replaceAll(' ', '-')}`, itemId: item.id, cycle: item.cycle, stage: item.stage, result: 'pass' as const, blocking: false, notes: `Synthetic demonstration pass: ${item.acceptanceCriteria}`, evidence: `Synthetic example only: ${evidence(`${item.id}-${item.stage}`)}`, authorId: qa.id, createdAt: stamp };
    state.tests.push(result); touch(item, stamp);
    audit(state, qa, 'tests', result.id, 'test_recorded', 'Synthetic demonstration check; not real delivery evidence.', null, result, stamp);
  }
  for (const spec of specs) {
    const end = spec.historical ? new Date(archiveTime.getTime() - 2 * hour).toISOString() : spec.stage === 'Closed' ? currentCloseTime : at(-6);
    const endTime = new Date(end).getTime();
    const item: WorkItem = { ...itemSchema.parse({ title: spec.title, description: `Synthetic demonstration scenario. ${spec.criteria}`, workstreamId: ids[spec.key], deliverableId: `showcase-artifact-${spec.key}-${spec.artifact}`, kind: spec.kind ?? 'software', category: spec.category ?? (spec.kind === 'general' ? 'action' : 'feature'), priority: spec.id === 'showcase-ppi-blocker' ? 'Critical' : 'Medium', ownerId: lead.id, currentOwnerId: 'demo-engineer', baselineDate: date(spec.due ?? 2), dueDate: date(spec.due ?? 2), acceptanceCriteria: spec.criteria, evidenceLinks: [], blocked: false, blockReason: '', nextAction: spec.action, clientSummary: `Synthetic demonstration: ${spec.title}`, clientVisible: true, tags: ['Synthetic demonstration', briefs[spec.key].phase] }), id: spec.id, version: 1, createdAt: new Date(endTime - 8 * hour).toISOString(), updatedAt: new Date(endTime - 8 * hour).toISOString(), stage: 'Backlog', cycle: 1 };
    state.items.push(item);
    audit(state, pmo, 'items', item.id, 'created', 'Created synthetic demonstration work.', null, item, item.createdAt);
    const stages = item.kind === 'software' ? SOFTWARE_STAGES : GENERAL_STAGES;
    const target = item.kind === 'software' && spec.stage === 'Closed' ? 'Awaiting client acceptance' : spec.stage;
    const targetIndex = stages.indexOf(target as never);
    for (let index = 1; index <= targetIndex; index++) {
      const stamp = new Date(endTime - (targetIndex - index + (item.kind === 'software' && spec.stage === 'Closed' ? 1 : 0)) * hour).toISOString();
      if (['UAT', 'Production verification', 'Review'].includes(item.stage)) pass(item, new Date(new Date(stamp).getTime() - 60_000).toISOString());
      const nextStage = stages[index];
      transition(state, pmo, item.id, { version: item.version, stage: nextStage, currentOwnerId: ['UAT', 'Production verification'].includes(nextStage) ? qa.id : ['Review', 'Awaiting client acceptance', 'Closed'].includes(nextStage) ? lead.id : 'demo-engineer', ...(nextStage === 'Production verification' ? { evidence: evidence(`${item.id}-deployment`) } : {}) }, stamp);
    }
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
  const failed = { id: 'showcase-ppi-filter-failure', itemId: filter.id, cycle: 1, stage: 'UAT' as const, result: 'fail' as const, blocking: true, notes: 'Synthetic empty-result check: the selected filter resets on refresh.', evidence: 'Synthetic test case FILTER-03; demonstration only.', authorId: qa.id, createdAt: at(-4) };
  state.tests.push(failed); touch(filter, at(-4)); audit(state, qa, 'tests', failed.id, 'test_recorded', 'Synthetic blocking UAT finding requires resolution and retest.', null, failed, at(-4));

  const milestone = (id: string, title: string, keys: (keyof typeof ids)[], artifactIds: string[], baseline: number, forecast: number, status: 'planned' | 'at_risk' | 'complete' = 'planned') => ({ ...v(id), title, workstreamIds: keys.map(key => ids[key]), deliverableIds: artifactIds.map(value => `showcase-artifact-${value}`), ownerId: lead.id, baselineDate: date(baseline), forecastDate: date(forecast), status, notes: 'Synthetic demonstration commitment. Baseline and forecast are deliberately separate.', ...(status === 'complete' ? { actualDate: dateInTimezone(new Date(currentCloseTime), state.settings.timezone), updatedAt: currentCloseTime } : {}) });
  state.milestones = [
    milestone('showcase-milestone-ppi', 'Reconciliation sample accepted', ['ppi'], ['ppi-reconciliation'], 1, 4, 'at_risk'),
    milestone('showcase-milestone-release', 'Intelligence and accounting pilot acceptance', ['mi', 'accounting'], ['mi-release', 'accounting-release'], 3, 3),
    milestone('showcase-milestone-budget', 'Budget discovery findings reviewed', ['budget'], ['budget-discovery', 'budget-scope'], 3, 3),
    milestone('showcase-milestone-legal', 'Legal permission design agreed', ['legal'], ['legal-design'], 4, 6, 'at_risk'),
    milestone('showcase-milestone-quality', 'Shared evaluation and upload assurance', ['benchmark', 'spreadsheet'], ['benchmark-protocol', 'spreadsheet-validation'], 5, 5),
    milestone('showcase-milestone-treasury', 'Synthetic liquidity scenarios ready', ['treasury'], ['treasury-forecast'], 6, 6),
    milestone('showcase-milestone-adoption', 'Pilot quick-start guide accepted', ['investment'], ['investment-guide'], -2, -1, 'complete'),
  ];
  const register = (id: string, type: HubState['registers'][number]['type'], key: keyof typeof ids, title: string, items: string[], milestones: string[], action: string, detail: string, due = 2): HubState['registers'][number] => ({ ...v(id), type, title, detail: `Synthetic demonstration: ${detail}`, clientSummary: `Synthetic demonstration: ${title}`, clientVisible: true, workstreamId: ids[key], relatedItemIds: items, milestoneIds: milestones, ownerId: lead.id, dueDate: date(due), priority: 'High', probability: 'Medium', status: 'open', mitigation: 'Continue work against labelled synthetic fixtures while the decision is outstanding.', nextAction: action, impact: detail });
  state.registers = [
    { ...register('showcase-raid-access', 'dependency', 'ppi', 'Sample-access decision blocks portfolio reconciliation', ['showcase-ppi-blocker'], ['showcase-milestone-ppi'], 'Obtain the demo data-owner decision and record the next commitment.', 'Reconciliation cannot use the authorised synthetic sample until access is granted.', -2), priority: 'Critical', status: 'escalated' },
    register('showcase-raid-filter', 'issue', 'ppi', 'Portfolio filter resets for an empty result', ['showcase-ppi-filter'], ['showcase-milestone-ppi'], 'Resolve the linked failure and record a passing retest.', 'The synthetic empty-result regression prevents the UAT item advancing.', 1),
    register('showcase-raid-legal', 'decision', 'legal', 'Agree who can approve the permission design', ['showcase-legal-permissions', 'showcase-legal-prototype'], ['showcase-milestone-legal'], 'Choose the review authority and record the rationale.', 'Prototype scope depends on a clear permission-review authority.'),
    register('showcase-raid-budget', 'decision', 'budget', 'Choose the first budget-review scope boundary', ['showcase-budget-discovery', 'showcase-budget-scope'], ['showcase-milestone-budget'], 'Review discovery findings before selecting the first scope option.', 'The synthetic discovery outcome informs scope; the link does not imply discovery is already accepted.', 3),
    register('showcase-raid-client', 'dependency', 'accounting', 'Simulated client response is outstanding', ['showcase-accounting-acceptance'], ['showcase-milestone-release'], 'Record an explicit synthetic acceptance or rejection and supporting evidence.', 'Internal verification has passed; closure still requires the client-role response.', 0),
    register('showcase-raid-labels', 'risk', 'benchmark', 'Reviewer availability could delay reference labels', ['showcase-benchmark-labels'], ['showcase-milestone-quality'], 'Confirm a demo reviewer and review slot for disputed examples.', 'Late label decisions would delay the accepted evaluation reference set.', -1),
    { ...register('showcase-raid-window', 'assumption', 'treasury', 'Balance input window is sufficient for the forecast', ['showcase-treasury-watermark', 'showcase-treasury-scenarios'], ['showcase-milestone-treasury'], 'Validate the assumed input window against the synthetic scenarios.', 'Incorrect input-age assumptions change the interpretation of a forecast.', 4), status: 'monitoring' },
    { ...register('showcase-raid-internal', 'risk', 'investment', 'Internal pilot-support coverage needs confirmation', ['showcase-investment-adoption'], [], 'Confirm the demo support roster and escalation contact.', 'INTERNAL-ONLY-SHOWCASE-NOTE: fictional internal staffing discussion.', 3), clientVisible: false, clientSummary: '' },
  ];
  state.meetings = [
    { ...v('showcase-meeting-daily', -2), title: 'Demo daily delivery review', heldAt: at(-2), notes: 'Synthetic meeting: Demo lead follows up sample access. Demo engineer hands the keyboard fix to Demo QA. Demo PMO records the simulated accounting client response. Owners and next actions remain in the linked records.', linkedItemIds: ['showcase-ppi-blocker', 'showcase-mi-release', 'showcase-accounting-acceptance'], linkedRegisterIds: ['showcase-raid-access', 'showcase-raid-client'] },
    { ...v('showcase-meeting-discovery', -12), title: 'Demo discovery synthesis review', heldAt: at(-12), notes: 'Synthetic meeting: observations and assumptions are separated in the budget synthesis. The scope decision remains open. Capture any new follow-up only after checking the existing linked scope item.', linkedItemIds: ['showcase-budget-discovery', 'showcase-budget-scope'], linkedRegisterIds: ['showcase-raid-budget'] },
    { ...v('showcase-meeting-quality', -24), title: 'Demo assurance review', heldAt: at(-24), notes: 'Synthetic meeting: the empty-result filter check failed. Reviewer availability remains a risk for the reference labels. Resolve findings and record evidence before advancing the affected work.', linkedItemIds: ['showcase-ppi-filter', 'showcase-benchmark-labels'], linkedRegisterIds: ['showcase-raid-filter', 'showcase-raid-labels'] },
  ];

  const fileHash = createHash('sha256').update('Synthetic showcase source revision one; no workbook exists.').digest('hex');
  const intake: IntakeBundle = { version: 1, projectName: state.settings.projectName, documents: [{ id: 'showcase-source-tracker', name: 'Synthetic demonstration tracker (generated example)', kind: 'tracker', coverage: 'current', receivedAt: at(-10), fileHash, summary: 'Generated example rows, not an uploaded workbook. The hash identifies the synthetic source text.', warnings: ['All content and statuses are fictional. Source status is separate from delivery evidence.'] }], useCases: [], records: [
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-1', locator: 'Example rows · 1', workstreamId: ids.finance, title: 'Confirm the discovery source-owner contact', detail: 'Synthetic source row: clarify the first source-owner contact.', sourceStatus: 'Assigned in source', sourceOwner: 'Example source team', sourcePriority: '', sourceDates: '', resolutionNotes: '', disposition: 'active', mappingNote: 'Capture a general intake action without inferring an assigned person or delivery stage.', intake: { kind: 'general', category: 'action' } },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-2', locator: 'Example rows · 2', workstreamId: ids.finance, title: 'Reconcile contradictory discovery tracker remarks', detail: 'Synthetic source row marked done but containing an unresolved scope question.', sourceStatus: 'Done', sourceOwner: '', sourcePriority: '', sourceDates: '', resolutionNotes: 'The synthetic remark still asks for a scope decision.', disposition: 'needs_review', mappingNote: 'Create a status-confirmation action; do not treat the source label as accepted work.' },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-3', locator: 'Example rows · 3', workstreamId: ids.budget, title: 'Archive the synthetic interview invitation note', detail: 'Synthetic source-only completed note.', sourceStatus: 'Complete in source', sourceOwner: '', sourcePriority: '', sourceDates: '', resolutionNotes: '', disposition: 'completed', mappingNote: 'Retain source history without inventing a closed workflow item.' },
    { documentId: 'showcase-source-tracker', sourceKey: 'DEMO-4', locator: 'Example rows · 4', workstreamId: ids.budget, title: 'Exclude an illustrative out-of-scope request', detail: 'Synthetic request outside the demonstration scope.', sourceStatus: 'No action', sourceOwner: '', sourcePriority: '', sourceDates: '', resolutionNotes: 'Not selected for this example.', disposition: 'excluded', mappingNote: 'Keep the exclusion visible without creating active work.' },
  ] };
  applyIntake(state, intake, pmo.id, at(-10));
  const revised = structuredClone(intake); revised.records[0].sourceStatus = 'Source owner changed'; revised.records[0].sourceOwner = 'Another example source team';
  revised.documents[0].fileHash = createHash('sha256').update('Synthetic showcase source revision two; no workbook exists.').digest('hex');
  applyIntake(state, revised, pmo.id, at(-3));

  // The archived brief is built from a detached, earlier snapshot, not today's stages.
  const history = structuredClone(state);
  history.items = history.items.filter(item => item.id === 'showcase-finance-stakeholders');
  history.tests = history.tests.filter(test => history.items.some(item => item.id === test.itemId));
  history.deliverables = []; history.milestones = []; history.registers = []; history.submissions = []; history.reports = [];
  history.workstreams = history.workstreams.map(stream => ({ ...stream, lifecyclePhase: 'shaping', health: 'unknown', statusNote: 'Synthetic historical framing snapshot.', clientSummary: 'Synthetic historical framing snapshot.', updatedAt: at(-336) }));
  const archived = reportDraft(history, pmo, 'client', archiveTime.toISOString());
  Object.assign(archived, { id: 'showcase-report-approved', title: `Demonstration archive · ${archived.periodEnd}`, status: 'approved', version: 2, approvedBy: 'demo-approver', approvedAt: archiveTime.toISOString(), incompleteReason: 'Synthetic historical snapshot approved with unconfirmed workstreams explicitly disclosed.' });
  archived.body.summary = 'Synthetic demonstration archive: initial discovery stakeholders were identified; programme delivery remained in shaping.';
  state.reports.push(archived);
  audit(state, state.members[4], 'reports', archived.id, 'approved', 'Approved a synthetic historical example with confirmation gaps disclosed.', null, archived, archiveTime.toISOString());
  for (const [index, key] of (['ppi', 'investment', 'legal', 'mi', 'accounting', 'benchmark', 'treasury', 'spreadsheet'] as const).entries()) {
    const stream = state.workstreams.find(value => value.id === ids[key])!;
    const stale = index === 0 || key === 'benchmark';
    const confirmedAt = new Date(Math.max((new Date(range.startAt).getTime() + now.getTime()) / 2, now.getTime() - 15 * 60_000)).toISOString();
    const submission = { id: `showcase-submission-${key}`, version: 1, updatedAt: confirmedAt, workstreamId: stream.id, periodEnd: range.end, completed: 'Synthetic confirmation: review the actual closed items and evidence in this use case.', next: stream.nextGate ?? '', changes: stale ? 'This example deliberately predates a changed delivery fact; reconfirm it.' : 'Synthetic current facts reviewed for the demonstration.', blockers: key === 'ppi' ? 'Synthetic sample-access decision remains outstanding.' : '', health: stream.health, confirmedBy: lead.id, confirmedAt, sourceUpdatedAt: latestWorkstreamChange(state, stream.id) };
    state.submissions.push(submission);
    audit(state, lead, 'submissions', submission.id, 'confirmed', 'Synthetic workstream confirmation for the current reporting period.', null, submission, confirmedAt);
    if (stale) {
      const before = structuredClone(stream);
      stream.statusNote += key === 'ppi' ? ' New synthetic update: the access decision is now escalated for PMO review.' : ' New synthetic update: the reviewer slot needs rescheduling.';
      touch(stream, now.toISOString());
      audit(state, lead, 'workstreams', stream.id, 'updated', 'Synthetic source change after the captured confirmation; reconfirmation is required.', before, stream, now.toISOString());
    }
  }
  const draft = reportDraft(state, pmo, 'client', now.toISOString());
  draft.id = 'showcase-report-draft'; draft.title = `Demonstration weekly review · ${range.end}`;
  draft.body.summary = 'Synthetic demonstration: discovery, design, delivery, assurance and adoption progress together. Review the stale and missing confirmations before approval.';
  state.reports.push(draft); audit(state, pmo, 'reports', draft.id, 'draft_created', 'Created a synthetic client-safe draft; unresolved confirmation gaps remain visible.', null, draft, now.toISOString());
  const reviewed = structuredClone(draft);
  Object.assign(reviewed, {
    id: 'showcase-report-reviewed', title: `Demonstration reviewed edition · ${range.end}`, version: 2,
    status: 'approved', approvedBy: 'demo-approver', approvedAt: now.toISOString(), updatedAt: now.toISOString(),
    incompleteReason: 'Synthetic demonstration approval with four confirmation gaps disclosed: Performance Portfolio Intelligence and Benchmark are stale; Public Finance and Budget Companion are unconfirmed. This illustrative snapshot does not assert those updates have been reconfirmed.',
  });
  reviewed.body.summary = 'Synthetic programme review: stakeholder mapping, pilot guidance and selected interaction improvements are complete. Budget interview synthesis is ready for review; intelligence release work is moving through QA, and accounting validation awaits the simulated client response after internal verification. Portfolio reconciliation remains blocked by the sample-access decision. This illustrative edition is approved with four confirmation gaps explicitly retained: two stale updates and two missing updates.';
  state.reports.push(reviewed);
  audit(state, state.members[4], 'reports', reviewed.id, 'approved', 'Approved the ready-to-present synthetic current-period edition with its four stale or missing confirmations explicitly disclosed.', null, reviewed, now.toISOString());
  for (const collection of ['workstreams', 'deliverables', 'milestones', 'items', 'registers', 'meetings'] as const) for (const record of state[collection]) validateReferences(state, collection, record);
  // Domain helpers use UUIDs for live events; stable IDs make this fixture repeatable.
  state.events.forEach((event, index) => { event.id = `showcase-event-${String(index + 1).padStart(3, '0')}`; });
  return state;
}
