# Phase Two · Delivery Desk

A local demonstrator for a small AI and data delivery team: one backlog, clear handoffs, connected blockers and decisions, and a Thursday briefing built from the same records.

The Delivery Desk redesign adds a visual pipeline with exact stage drill-downs, an intervention queue, separate register follow-ups, workstream and milestone context, readable delivery lists, distinct software/general boards, and one item drawer for checks and handovers. Weekly reporting follows confirmation → draft review → approval and presentation. The app refreshes on window focus and once per minute while visible; a failed refresh keeps the last records with a visible warning.

Explore [the interactive wireframe study](http://127.0.0.1:4310/design-study.html) while the local server is running. Its standalone source is [public/design-study.html](public/design-study.html). The four wireframes include phone and grayscale modes; they use illustrative fictional content. [DESIGN.md](DESIGN.md) records the visual system and chosen direction. [Contribution guidance](docs/CONTRIBUTING.md) and the [review checklist](docs/REVIEW-CHECKLIST.md) explain the GitHub workflow.

The fictional Northstar project contains 10 people, three workstreams, and 30 work items. It starts in **demo mode** with role switching, local persistence, and synthetic evidence links. It does not implement corporate sign-in and must not be used for real client information or exposed as a shared service.

## Run locally

Use Node.js 24 and pnpm. From this directory:

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Open [the local delivery hub](http://127.0.0.1:4310). The initial persona is Nadia Rahman, PMO. Stop the server with Ctrl+C.

On Windows, when Node or pnpm is not on PATH, the launcher also checks the Codex bundled runtime under the current user's profile:

```powershell
.\scripts\start.ps1 -Install
```

The launcher uses `node.exe` and `pnpm.cmd` from PATH first, then falls back to `.cache\codex-runtimes\codex-primary-runtime\dependencies`. It changes PATH only for the running script and child process. Its default task is `dev`.

```powershell
.\scripts\start.ps1 -Task check
.\scripts\start.ps1 -Task test
.\scripts\start.ps1 -Task build
.\scripts\start.ps1 -Task start
```

## What to demonstrate

- A software item moves through **Backlog → Development → UAT → Ready for production → Production verification → Awaiting client acceptance → Closed**. An internal team member records the client response and evidence. Rejection returns the same item to a complete rework cycle.
- Data, evaluation, research, and general actions use **Backlog → In progress → Review → Closed**.
- Delivery ownership remains visible while the current action owner changes immediately at each handoff. Any delivery teammate can record a test; routine delivery does not wait for PMO approval.
- Blockers, decisions, meetings, milestones, and weekly confirmations link to the delivery records. Baseline dates remain distinct from changing forecasts.
- Internal and client-safe reporting have separate content. Approved reports are saved snapshots; later delivery edits do not rewrite history.

Follow [the demonstration walkthrough](docs/DEMO.md) for a practical ten-minute session.

## Data and configuration

The server uses embedded PostgreSQL through PGlite by default, persisted in `.data/pmo`. Restarting preserves your edits. If a stopped process leaves its ownership lock behind, startup recovers it only after confirming that process has exited; it leaves the database intact. A running owner or unknown ownership still prevents a second server from opening the same store. A new empty store is populated with fictional dates relative to its creation time. The reporting period ends Thursday in `Asia/Dubai`, with submissions due at 10:00 and reporting cutoff at 12:00. Resetting the demo recreates dates relative to the reset time; normal restart does not silently move commitments.

To reset a disposable demo, stop its server first and run:

```powershell
pnpm demo:reset
```

This archives the current local store to a timestamped sibling backup; restarting then creates a fresh demonstration. Your previous edits are no longer shown in the fresh store. Check `DATA_DIR` before resetting. The command refuses external PostgreSQL and paths outside this workspace.

See `.env.example` for available settings:

| Setting | Default / purpose |
| --- | --- |
| `APP_MODE` | `demo`; live startup is blocked until corporate identity is implemented. |
| `HOST` | `127.0.0.1`; retain loopback binding for this demonstrator. |
| `PORT` | `4310` |
| `DATA_DIR` | `.data/pmo`, for embedded storage. |
| `DATABASE_URL` | Optional standard PostgreSQL connection string; database support does not enable live use. |
| `OPENAI_API_KEY` | Optional server-side key, only for an approved processing environment. |
| `OPENAI_MODEL` | `gpt-5.4-mini` by default; optional AI draft model. |

Without AI configuration, manual work, deterministic reporting, and editing remain available. AI produces reviewable proposals; it does not approve reports, accept client responses, or automatically create commitments. Evidence URLs under `example.com/demo/evidence/` are fictional placeholders, not real project documents.

## Validate and build

```powershell
pnpm check
pnpm test
pnpm build
pnpm start
```

`pnpm build` performs TypeScript checking and builds the browser app. `pnpm start` serves that build and the API from the same process. Build before starting production assets. The word "production" in the asset command does not activate corporate authentication or make demo mode safe for live use.

See [validation coverage](docs/VALIDATION.md) for the checks performed and [deployment readiness](docs/DEPLOYMENT.md) for the boundary between this local demonstrator and an approved shared installation.
