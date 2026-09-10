# Phase Two · PMO Hub

A desktop workspace connecting an AI consulting engagement's use-case portfolio to discovery, delivery, assurance and adoption. The portfolio is the starting point; work, risks, decisions, milestones and weekly reporting stay connected to it.

The default portfolio profile starts with ten confirmed names: Performance Portfolio Intelligence, Investment Companion, Legal Companion, Market Intelligence, Accounting Validation, Benchmark, AI Based Treasury Liquidity Management, Spreadsheet Intelligence, Public Finance and Budget Companion. Leads, priorities, phases, scope, dates and outcomes are **not yet set**. No project commitments or reports are invented. The separate showcase profile below provides an explicitly fictional, populated rehearsal.

**Deployment target: Replit**, confirmed on 8 September 2026. The existing React interface, Node API and PostgreSQL store form the hosted application. The [Replit deployment plan](docs/DEPLOYMENT.md#replit-deployment-target) records the remaining hosting integration; the current release still runs as a local preview. [replit.md](replit.md) provides the project handoff for work in Replit.

## What is connected

- **Use case portfolio:** searchable cards and list, lifecycle filters, editable brief, accountable lead, intended outcome, scope and next gate.
- **Lifecycle artifacts:** proposal, discovery, design, evaluation and handover records, with owner, phase, recorded status and evidence links. These reuse deliverables, so tasks and milestones link to the same records. Artifact status is a recorded assessment, not a fabricated formal approval.
- **Work:** one destination for the work list, attention queue, personal assignments, milestones and artifacts. Selected work shows its next action, both owners and linked context. The queue focuses on the commitments that need intervention.
- **Escalations:** raise a linked issue from a work record, name the person taking it, request a decision and set a response target. Track monitoring and resolution in Risks & decisions. Raising an escalation preserves the work's stage and blocker.
- **Delivery workflows:** separate software and general flows, linked deliverables, testing, evidence, handoffs and client acceptance. A use-case phase does not change a task's workflow stage.
- **Reporting:** lead confirmation → reviewed draft → approved edition. Client and internal content remain separate; approved editions are immutable snapshots.

The consulting lifecycle is **Shaping → Discovery → Design → Build → Assurance → Release → Adoption**, covering RFP/proposals, prioritisation, current and target state, scope, semantics and architecture, engineering, QA, production and sustained outcomes. Phases can be revisited; the ribbon does not claim a calculated critical path or percentage complete.

## Run locally

On Windows, double-click **Open PMO.cmd** for the project or **Open Demo.cmd** for the populated rehearsal. These launch the full workspace in your default browser and keep its server running in the background. See [opening the hub](docs/OPENING.md) for setup and troubleshooting.

Use Node.js 24 and pnpm:

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Open [the PMO hub](http://127.0.0.1:4310). The new portfolio uses **PMO preview**. Role switching is a local demonstration capability, not corporate authentication. The app remains restricted to localhost; team use requires the identity and hosting work in [deployment readiness](docs/DEPLOYMENT.md).

If Node or pnpm is not on PATH, the Windows launcher checks the Codex bundled runtime:

```powershell
.\scripts\start.ps1 -Install
.\scripts\start.ps1 -Task check
.\scripts\start.ps1 -Task test
.\scripts\start.ps1 -Task build
.\scripts\start.ps1 -Task start
```

Stop a server with Ctrl+C. Build before serving compiled assets; restart a compiled server after rebuilding. The launcher's PATH changes are confined to its process.

## Data profiles

| Setting | Meaning |
| --- | --- |
| `SEED_PROFILE=portfolio` | Default. Seeds ten names into a new `.data/portfolio` store. |
| `SEED_PROFILE=demo` | Opens the original `.data/pmo` synthetic Northstar scenario. |
| `SEED_PROFILE=project` | Opens the isolated `.data/client` project store. Reviewed local intake supplies its records. |
| `SEED_PROFILE=showcase` | Opens `.data/showcase`, a populated scenario illustrating month three of programme use. |
| `DATA_DIR` | Optional local storage path; overrides the profile's default path. |
| `DATABASE_URL` | Optional PostgreSQL connection; the profile only seeds an empty database. |
| `APP_MODE=demo` | Required local preview mode; non-demo startup is blocked. |
| `HOST` / `PORT` | `127.0.0.1` / `4310` by default. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional server-side drafting configuration; manual operation works without AI. |

**A profile selects a seed and default path, not a migration.** Existing stores and saved reports are preserved. Explicit `DATA_DIR` or `DATABASE_URL` wins; changing only the seed profile does not rewrite an existing database. Previous fictional records remain in `.data/pmo`, separate from the named portfolio.

PGlite supplies local PostgreSQL storage. Restarts preserve edits and dates. Ownership locks prevent concurrent local servers opening the same store; a stale lock is reclaimed only after confirming its process exited.

`pnpm demo:reset` archives the selected local store to a timestamped sibling backup. Stop its server and check `SEED_PROFILE` and `DATA_DIR` first. It refuses external PostgreSQL and paths outside the workspace. See [the walkthrough](docs/DEMO.md) for synthetic workflow examples.

## Present the five-minute manager review

Double-click **Open Demo.cmd**, or run `pnpm showcase` and open `http://127.0.0.1:4311`, for the populated, explicitly labelled demonstration. It can run alongside the sourced project on port 4310. The launcher selects `.data/showcase` and overrides any external database setting for that process. `pnpm showcase --production` serves compiled assets after `pnpm build`.

Start as **Demo PMO** and open **5-minute tour** in the **Manager review · Illustrative data** banner. Four stops cover the portfolio, one piece of work, an escalation and reporting. The ten use cases show a mature, fictional month-three programme with discovery, engineering, assurance and adoption work, connected artifacts, milestones, decisions and meetings. One optional handoff demonstrates the workflow; there is no need to complete a release or switch approvers during the screen-share.

Open **Reports → Previous editions → Month three · Programme review** for the prepared approved presentation. A fresh showcase has **10/10 fresh use-case confirmations** and five reports: approved month-one, month-two and month-three editions, plus current client and internal drafts. The approved editions stay fixed as practice edits change the live workspace. This history illustrates future use and does not represent actual project progress or approvals.

Prepared evidence links open contextual **`/evidence/:id`** specimens with recorded review details, connected work and a **Print specimen** action. Evidence and approved presentation views retain their illustrative labels. Ordinary restart preserves the rehearsal; the [showcase walkthrough](docs/SHOWCASE.md) includes the four-stop sequence, optional deeper rehearsals and a safe reset for a fresh fixture.

## Reviewed project intake

The portfolio supports overlapping business groups, sourced briefs and separate tracker positions. **Project sources** retains source rows, original statuses, owner text, dates, comments and file fingerprints. Active rows enter delivery as intake; ambiguous statuses create confirmation actions. Source-reported completion remains separate from tests or acceptance recorded in the hub. Missing operational facts remain unset.

Private extraction and reviewed bundles belong under ignored `artifacts/`; project records live under ignored `.data/client`. Keep them out of commits and public assets. The local intake command previews by default:

```powershell
pnpm exec tsx server/intake-cli.ts artifacts/reviewed-bundle.json .data/client
pnpm exec tsx server/intake-cli.ts artifacts/reviewed-bundle.json .data/client --apply
```

Stop any server using that store before applying. The command preserves a local JSON backup. Stable document/row keys prevent duplicates; source revisions retain human edits in linked work and flag reconciliation. Source profiles fill missing fields and preserve conflicting edits. Set `SEED_PROFILE=project` and remove an old `DATA_DIR` override (or point it to `.data/client`) to open the project workspace. This imports snapshots; it does not connect to Teams or live Excel.

## Review and validation

```powershell
pnpm check
pnpm test
pnpm build
```

[DESIGN.md](DESIGN.md) defines the desktop design. [Validation](docs/VALIDATION.md) and the [repository review](docs/REPOSITORY-REVIEW-2026-09-08.md) record coverage and boundaries. [Contribution guidance](docs/CONTRIBUTING.md) and the [review checklist](docs/REVIEW-CHECKLIST.md) describe the GitHub process.

Current work is on [`codex/design-overhaul`](https://github.com/nre17/PMO_APP/tree/codex/design-overhaul), in [PR #1](https://github.com/nre17/PMO_APP/pull/1). Design tools should use this branch during review. Superseded standalone wireframes remain in Git history rather than shipping with the app.
