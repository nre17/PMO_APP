# Phase Two · PMO Hub

A desktop workspace connecting an AI consulting engagement's use-case portfolio to discovery, delivery, assurance and adoption. The portfolio is the starting point; work, risks, decisions, milestones and weekly reporting stay connected to it.

The workspace starts with ten confirmed names: Performance Portfolio Intelligence, Investment Companion, Legal Companion, Market Intelligence, Accounting Validation, Benchmark, AI Based Treasury Liquidity Management, Spreadsheet Intelligence, Public Finance and Budget Companion. Leads, priorities, phases, scope, dates and outcomes are **not yet set**. No project commitments or reports are invented.

## What is connected

- **Use case portfolio:** searchable cards and list, lifecycle filters, editable brief, accountable lead, intended outcome, scope and next gate.
- **Lifecycle artifacts:** proposal, discovery, design, evaluation and handover records, with owner, phase, recorded status and evidence links. These reuse deliverables, so tasks and milestones link to the same records. Artifact status is a recorded assessment, not a fabricated formal approval.
- **Delivery overview:** interventions, upcoming work, register follow-ups, milestone variance and weekly confirmations. Selected work shows its next action, both owners and the provenance of linked context.
- **Delivery:** separate software and general workflows, linked deliverables, testing, evidence, handoffs and client acceptance. A use-case phase does not change a task's workflow stage.
- **Reporting:** lead confirmation → reviewed draft → approved edition. Client and internal content remain separate; approved editions are immutable snapshots.

The consulting lifecycle is **Shaping → Discovery → Design → Build → Assurance → Release → Adoption**, covering RFP/proposals, prioritisation, current and target state, scope, semantics and architecture, engineering, QA, production and sustained outcomes. Phases can be revisited; the ribbon does not claim a calculated critical path or percentage complete.

## Run locally

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
| `DATA_DIR` | Optional local storage path; overrides the profile's default path. |
| `DATABASE_URL` | Optional PostgreSQL connection; the profile only seeds an empty database. |
| `APP_MODE=demo` | Required local preview mode; non-demo startup is blocked. |
| `HOST` / `PORT` | `127.0.0.1` / `4310` by default. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional server-side drafting configuration; manual operation works without AI. |

**A profile selects a seed and default path, not a migration.** Existing stores and saved reports are preserved. Explicit `DATA_DIR` or `DATABASE_URL` wins; changing only the seed profile does not rewrite an existing database. Previous fictional records remain in `.data/pmo`, separate from the named portfolio.

PGlite supplies local PostgreSQL storage. Restarts preserve edits and dates. Ownership locks prevent concurrent local servers opening the same store; a stale lock is reclaimed only after confirming its process exited.

`pnpm demo:reset` archives the selected local store to a timestamped sibling backup. Stop its server and check `SEED_PROFILE` and `DATA_DIR` first. It refuses external PostgreSQL and paths outside the workspace. See [the walkthrough](docs/DEMO.md) for synthetic workflow examples.

## Review and validation

```powershell
pnpm check
pnpm test
pnpm build
```

[DESIGN.md](DESIGN.md) defines the desktop design. [Validation](docs/VALIDATION.md) and the [repository review](docs/REPOSITORY-REVIEW-2026-09-08.md) record coverage and boundaries. [Contribution guidance](docs/CONTRIBUTING.md) and the [review checklist](docs/REVIEW-CHECKLIST.md) describe the GitHub process.

Current work is on [`codex/design-overhaul`](https://github.com/nre17/PMO_APP/tree/codex/design-overhaul), in [PR #1](https://github.com/nre17/PMO_APP/pull/1). Design tools should use this branch during review. Superseded standalone wireframes remain in Git history rather than shipping with the app.
