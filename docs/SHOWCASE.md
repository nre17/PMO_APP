# Ten-minute consulting lifecycle demonstration

This scenario is fictional. The ten use-case names are the portfolio's public names; briefs, people, work, decisions, dates and evidence are generated examples. Every person is labelled **Demo**. Stored `example.invalid/synthetic-demo/` references open a same-origin illustrative evidence pack when clicked inside the showcase. The pack is a working demonstration template, not proof of real delivery; copied placeholder URLs do not resolve outside the hub.

The scenario builder is `createShowcaseState(now)` in `server/showcase-seed.ts`. It reads no client files and does not alter an existing store. Dates are relative to the creation time; an existing demonstration continues to age normally. Run `pnpm showcase` for the isolated demonstration on port 4311 while the sourced project stays on port 4310. The launcher fixes its local store to `.data/showcase` and overrides any external database configuration for that process.

## The walkthrough

| Time | Action | What to check |
| --- | --- | --- |
| 0–1 min | As **Demo PMO**, open Overview and the portfolio. | All ten use cases are present. Public Finance is in shaping, Budget Companion in discovery, Legal Companion in design, and other cases span build, assurance, release and adoption. Lifecycle phase is separate from individual delivery stage. |
| 1–3 min | Open **Synthesize the budget-review discovery interviews** (`showcase-budget-discovery`). Advance from **In progress** to **Review**, assigning **Demo lead**. As Demo lead or Demo QA, record a passing Review result with notes explicitly labelled “Synthetic demonstration review”. Then advance to **Closed**. | General consulting work has review evidence and a closure timestamp; it does not need a software release. The linked **Agree the first Budget Companion scope boundary** (`showcase-budget-scope`) remains a separate Backlog decision follow-up. Completing discovery does not silently accept the scope. |
| 3–5 min | Open **Keep keyboard focus on the selected intelligence card** (`showcase-mi-release`). Advance Development → UAT, assigning **Demo QA**. Record a synthetic passing UAT result. Advance to Ready for production. Advance to Production verification with `https://example.invalid/synthetic-demo/mi-walkthrough-deployment`, assigning Demo QA. Record a synthetic production-verification pass, then advance to Awaiting client acceptance, assigning Demo lead. | Each handoff names the next action owner. Passing UAT is separate from deployment, production verification and client acceptance. The item remains open. |
| 5–6 min | Open **Explain why a synthetic journal line fails validation** (`showcase-accounting-acceptance`). Review its existing synthetic UAT and production-verification evidence. Record an **accepted** simulated client response, with “Synthetic client-role acceptance” and an `example.invalid` evidence reference. | Only the explicit client response closes the software item. For an alternative run, choose rejected and assign Demo engineer: the same item returns to Development in a new cycle, and prior-cycle passes do not satisfy the new gates. |
| 6–7 min | Open **Reconcile synthetic holdings against the authorised sample** (`showcase-ppi-blocker`) and its linked sample-access dependency. | The critical blocked item needs immediate escalation. The dependency names a decision, owner, next action and affected milestone. A source association is not an automatically calculated critical path. Try advancing while blocked to see the guard. Only clear it after recording a synthetic resolution. |
| 7–8 min | Open Sources and the synthetic demonstration tracker. Compare its four source rows and linked work. | An active row creates intake work, a contradictory “Done” row creates a general status-confirmation action, and completed/excluded rows create no delivery item. One revised source row is flagged for reconciliation; the existing work is preserved. Literal tracker labels are not workflow approvals. |
| 8–10 min | Open weekly Reports as Demo PMO. Review current, stale and missing confirmations. Reconfirm Performance Portfolio Intelligence and Benchmark; confirm Public Finance and Budget Companion. Create a fresh client draft after these changes. Switch to **Demo approver** to approve and present it. | Source edits make the earlier draft stale, so it must be regenerated and reviewed. The client brief uses client-safe summaries. The archive is an immutable earlier snapshot. An incomplete draft can only be approved with an explicit explanation of its missing confirmations. |

For an immediate presentation, open Approved briefs and choose **Demonstration reviewed edition** (`showcase-report-reviewed`). It contains the current synthetic progress, next steps, dependencies and milestones, with four confirmation gaps explicitly disclosed. Compare it with **Demonstration archive** to show the earlier shaping position. Both approved editions stay fixed as you practise changes.

If time is short, complete either the discovery flow or the software flow, then present the ready-made reviewed edition. To demonstrate report preparation, use the separate current draft: it starts with six fresh, two stale and two missing use-case confirmations. Your edits intentionally change that position, and you can still reconfirm, create a fresh draft and approve normally.

## Fixture inventory and boundaries

- 42 work items: four concrete scenarios per use case plus two source-intake actions; all five walkthrough item IDs are stable.
- 20 artifacts, including accepted artifacts with labelled synthetic evidence; seven milestones retain separate baseline and forecast dates.
- Eight RAID entries, three linked meetings and eight current-period submissions. Three report editions: two approved client briefs (a rich current-period edition and an earlier historical comparison) plus one editable current client draft.
- Four synthetic source rows illustrate active, needs-review, completed and excluded dispositions. The document hash identifies generated example text, not an uploaded workbook.
- Demo PMO manages programme records; Demo lead owns the cases; Demo engineer and Demo QA can act on delivery handoffs; Demo approver approves reports. The approver persona remains read-only for delivery work.

No outbound messages, live client responses, real acceptance evidence or AI-generated claims are required. Meeting notes are already linked to records so repeated capture is unnecessary. Optional AI assistance is outside the ten-minute path.

The seed validates references and constructs forward workflow gates through the existing domain transition rules. UI walkthrough verification and deployment readiness must be reported from actual checks; the fixture itself is not a claim that those checks have run.

## Start again after a rehearsal

Ordinary restart keeps your changes. To start a fresh demonstration, stop only the showcase server first, then run the following in its terminal. The reset archives the old demonstration store to a timestamped backup; it does not target the sourced project on port 4310.

```powershell
$env:SEED_PROFILE = 'showcase'
$env:DATA_DIR = '.data/showcase'
$env:DATABASE_URL = ''
pnpm demo:reset
pnpm showcase
```

The local launcher and evidence routing use the same app services and browser origin as the hub. They do not remove the localhost/authentication guards or establish a shared Replit deployment.
