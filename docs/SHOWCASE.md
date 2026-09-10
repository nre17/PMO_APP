# Five-minute manager screen-share

This fictional scenario shows what a populated programme could look like in its third month of using the hub. The ten use-case names are the portfolio's public names; briefs, people, work, decisions, dates and evidence are illustrative. The team has fictional names and consulting roles, with work assigned across programme management, delivery leads, engineering, analysis and assurance. The scenario does not represent three months of actual client progress or approvals.

Double-click **Open Demo.cmd**, select the **PMO** profile in the person switcher, and open the **5-minute tour** in the **Manager review · Illustrative data** banner. The guide shows the PMO's current name. The four stops below let you add an action, record a test and prepare a report without switching roles or completing every workflow. Reopen the guide between actions. See [opening the hub](OPENING.md) for launcher setup.

## The walkthrough

| Time | Action | What to check |
| --- | --- | --- |
| 0–1 min | **See the whole programme.** Open **Portfolio** and select a use case. | Read its outcome, accountable lead, lifecycle phase and next gate. Show its artifacts and connected work. The populated portfolio spans discovery, engineering and adoption; lifecycle phase remains separate from a work item's delivery stage. |
| 1–3 min | **Add work and record a test.** Choose **Add a work item** in the guide. Enter **Prepare the next Budget Companion discovery session**, select **Budget Companion** and **General work**, then **Capture work**. Reopen the guide and choose **Record a UAT check** to open **Validate readable card density at narrow widths** (`showcase-mi-density`). Use **Checks & evidence → Record check**, enter an outcome, notes and an illustrative evidence reference, then **Save check**. | The action is saved in Backlog. Ownership and dates can be agreed after capture. The test is recorded with its author, stage, cycle, result and evidence. This example already starts in UAT, so there is no setup handoff or release to complete. |
| 3–4 min | **See what needs your help.** Open **Reconcile synthetic holdings against the authorised sample** (`showcase-ppi-blocker`) through the guide or **Work → Needs attention**. Open its existing escalation. | The escalation already names the decision needed, recipient and response date. Follow the linked context and, if useful, open the meeting follow-ups. This is a concrete management decision, not just an attention count. |
| 4–5 min | **Prepare a management report.** Choose **Prepare a report** in the guide, then **New draft**. Select **Client** or **Internal**, then **Prepare draft**. Review the newly saved report; use **Edit wording** and **Save draft** to make a change. For the final presentation, the guide's **Open prepared edition** button leads to **Month three · Programme review** in **Previous editions**. | Creating the draft captures current reporting sources for review; it does not approve them. **Internal** includes full project context, while **Client** uses selected client-safe wording. The prepared approved edition remains ready to present, with its original **10/10 fresh confirmations** preserved. |

The guide's checkboxes record which stops you have visited; they do not complete project work. Practice changes are saved in the demonstration workspace and may make current confirmations or an earlier draft stale. Reconfirm changed use cases before a later approval and prepare a fresh draft after source changes. You can create and review a draft during this tour without approving it. The prepared approved edition (`showcase-report-reviewed`) stays fixed.

For a quick test entry, use clearly fictional notes such as **Illustrative rehearsal: card titles and actions remained readable at the tested width**, with an evidence reference such as **Illustrative manager rehearsal · card-density check**. Choose the result you want to rehearse. A blocking failure recorded in UAT prevents advancement until its resolution and a passing check are recorded. Use **Start rework** when implementation needs another cycle; doing so does not resolve an outstanding finding.

The guide's **Open discovery example** link keeps **Synthesize the budget-review discovery interviews** (`showcase-budget-discovery`) available for inspecting a consulting brief and its Review step. For a longer rehearsal, try the software handoff on **Keep keyboard focus on the selected intelligence card** (`showcase-mi-release`), client acceptance on **Explain why a synthetic journal line fails validation** (`showcase-accounting-acceptance`), the separate Budget scope follow-up (`showcase-budget-scope`), source reconciliation or report approval. General work closes after its review; software still requires production verification and an explicit client response. A client rejection starts a new delivery cycle, and earlier-cycle passes do not satisfy its gates.

## Open the supporting evidence

Click a prepared evidence reference from a work record or artifact. In the showcase, stored `example.invalid/synthetic-demo/` references open the same-origin **`/evidence/:id`** page: a contextual specimen with the recorded owner, position, review criteria, observations, next action and connected work. Its **Manager review · Illustrative evidence** label remains visible when using **Print specimen**. Opening it does not approve an artifact, pass a check or change work.

Use **Back to workspace** to return to the hub. These specimens are fictional supporting records, not proof of client delivery. Copied placeholder URLs do not resolve outside the hub; the actual `/evidence/:id` page is available while the local showcase is running. Unrecognised references do not generate invented evidence.

## Fixture inventory and boundaries

- 42 initial work items: four concrete scenarios per use case plus two source-intake actions; walkthrough item IDs are stable. Capturing work adds to this total.
- 20 artifacts, including accepted artifacts with labelled synthetic evidence; nine milestones retain separate baseline and forecast dates.
- Eight RAID entries, three linked meetings and 30 submissions across three illustrative reporting periods. All ten current use cases start freshly confirmed.
- Five reports: three approved client editions (**Month one**, **Month two** and **Month three · Programme review**), plus **Month three · Working programme brief** and **Month three · Internal delivery check-in** drafts.
- Two synthetic source documents: a tracker and a month-three portfolio brief. Four tracker rows retain their original statuses and show owned actions, a reconciled contradiction, completed work and excluded scope. Their fingerprints identify generated example text, not uploaded client files.
- The PMO manages programme records; delivery leads own their assigned use cases; engineers, analysts and QA own concrete next actions. The engagement director approves reports and remains read-only for delivery work. Names and assignments are fictional, and the guide resolves names from the current team records.

No outbound messages, live client responses, real acceptance evidence or AI-generated claims are required. Meeting notes are already linked to records so repeated capture is unnecessary. Optional AI assistance is outside the five-minute path.

The scenario builder is `createShowcaseState(now)` in `server/showcase-seed.ts`. It reads no client files, validates references and constructs forward workflow gates through the existing domain transition rules. Dates are relative to creation time; an existing demonstration continues to age normally. The inventory above describes a fresh store, not a migration of an earlier rehearsal. UI verification and deployment readiness are recorded separately in [validation](VALIDATION.md).

## Start again after a rehearsal

Ordinary restart keeps your changes. To start a fresh demonstration, stop only the showcase server first, then run the following in its terminal. The reset archives the old demonstration store to a timestamped backup; it does not target the sourced project on port 4310. Use this explicit reset if an older saved rehearsal still contains the previous fixture.

```powershell
$env:SEED_PROFILE = 'showcase'
$env:DATA_DIR = '.data/showcase'
$env:DATABASE_URL = ''
pnpm demo:reset
pnpm showcase
```

The local launcher and evidence routing use the same app services and browser origin as the hub. They do not remove the localhost/authentication guards or establish a shared Replit deployment.
