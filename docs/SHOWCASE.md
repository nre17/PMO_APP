# Five-minute manager screen-share

This fictional scenario shows what a populated programme could look like in its third month of using the hub. The ten use-case names are the portfolio's public names; briefs, people, work, decisions, dates and evidence are illustrative. Every person is labelled **Demo**. The scenario does not represent three months of actual client progress or approvals.

Double-click **Open Demo.cmd**, then select **Demo PMO** and open the **5-minute tour** in the **Manager review · Illustrative data** banner. The four stops below work without switching roles or completing every workflow. See [opening the hub](OPENING.md) for launcher setup.

## The walkthrough

| Time | Action | What to check |
| --- | --- | --- |
| 0–1 min | **See the whole programme.** Open **Portfolio** and select a use case. | Read its outcome, accountable lead, lifecycle phase and next gate. Show its artifacts and connected work. The populated portfolio spans discovery, engineering and adoption; lifecycle phase remains separate from a work item's delivery stage. |
| 1–3 min | **Follow one piece of work.** Use the guide to open **Synthesize the budget-review discovery interviews** (`showcase-budget-discovery`). Then inspect **Keep keyboard focus on the selected intelligence card** (`showcase-mi-release`). Optionally hand the latter from Development to UAT, assigning **Demo QA**. | Discovery has a brief, owner, acceptance criteria and Review step. The software handoff gives the next action to a named person and records the change. One handoff is enough; there is no need to finish the release. |
| 3–4 min | **See what needs your help.** Open **Reconcile synthetic holdings against the authorised sample** (`showcase-ppi-blocker`) through the guide or **Work → Needs attention**. Open its existing escalation. | The escalation already names the decision needed, recipient and response date. Follow the linked context and, if useful, open the meeting follow-ups. This is a concrete management decision, not just an attention count. |
| 4–5 min | **Read the management position.** Open **Reports → Previous editions**, choose **Month three · Programme review**, then **Present approved edition**. Compare **Month two · Programme review** or **Month one · Programme review** if time permits. | The prepared approved edition brings together progress, next commitments, decisions and milestone forecasts. It was prepared with **10/10 fresh use-case confirmations**; no approval or waiver step is needed during the screen-share. Earlier editions show the programme's illustrative history. |

The guide's checkboxes record which stops you have visited; they do not complete project work. Practice changes are saved in the demonstration workspace. They may make current confirmations or a draft stale, while the prepared approved edition (`showcase-report-reviewed`) stays fixed.

For a longer rehearsal, explore client acceptance on **Explain why a synthetic journal line fails validation** (`showcase-accounting-acceptance`), the separate Budget scope follow-up (`showcase-budget-scope`), source reconciliation or weekly report preparation. Use clearly labelled synthetic evidence for any practice checks. General work closes after its review; software still requires production verification and an explicit client response. A client rejection starts a new delivery cycle, and earlier-cycle passes do not satisfy its gates.

## Open the supporting evidence

Click a prepared evidence reference from a work record or artifact. In the showcase, stored `example.invalid/synthetic-demo/` references open the same-origin **`/evidence/:id`** page: a contextual specimen with the recorded owner, position, review criteria, observations, next action and connected work. Its **Manager review · Illustrative evidence** label remains visible when using **Print specimen**. Opening it does not approve an artifact, pass a check or change work.

Use **Back to workspace** to return to the hub. These specimens are fictional supporting records, not proof of client delivery. Copied placeholder URLs do not resolve outside the hub; the actual `/evidence/:id` page is available while the local showcase is running. Unrecognised references do not generate invented evidence.

## Fixture inventory and boundaries

- 42 work items: four concrete scenarios per use case plus two source-intake actions; all five walkthrough item IDs are stable.
- 20 artifacts, including accepted artifacts with labelled synthetic evidence; nine milestones retain separate baseline and forecast dates.
- Eight RAID entries, three linked meetings and 30 submissions across three illustrative reporting periods. All ten current use cases start freshly confirmed.
- Five reports: three approved client editions (**Month one**, **Month two** and **Month three · Programme review**), plus **Month three · Working programme brief** and **Month three · Internal delivery check-in** drafts.
- Two synthetic source documents: a tracker and a month-three portfolio brief. Four tracker rows retain their original statuses and show owned actions, a reconciled contradiction, completed work and excluded scope. Their fingerprints identify generated example text, not uploaded client files.
- Demo PMO manages programme records; Demo lead owns the cases; Demo engineer and Demo QA can act on delivery handoffs; Demo approver approves reports. The approver persona remains read-only for delivery work.

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
