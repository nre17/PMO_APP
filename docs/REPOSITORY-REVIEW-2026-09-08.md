# Repository review — 8 September 2026

This combines the UI/configuration and parallel backend/shared audits performed during the use-case portfolio revision. It does not certify production readiness or replace browser testing.

## Scope inspected

- UI: App, Dashboard, Delivery, Reports, Registers, Meetings, MyWork, ProjectSettings, ui, api, main, delivery-model, overview-model, and the shared/page CSS files. Portfolio, portfolio-model, and OverviewExtras implementation belong to a separate review lane.
- Configuration: package manifest and lockfile importer alignment, Vite, TypeScript, HTML entry, Dockerfile, Docker ignores, environment template, Git ignores, Windows launcher, CI workflow, PR template, and issue forms.
- Tests: backend, cadence, delivery presentation model, overview model, portfolio API, and portfolio model suites. The name `presentation.test.ts` refers to delivery-model tests, not browser rendering.
- Documentation and public assets: README, DESIGN, contribution/review/deployment/demo guidance, design provenance, research notes, validation records, favicon, and the now-removed historical mockup.
- Server/shared implementation and the new portfolio lifecycle API were reviewed in the parallel backend lane. No credentials, ignored databases, or Git state were changed by this audit.

## Findings corrected

| Priority | Location | Trigger and correction |
| --- | --- | --- |
| P1 | `src/Meetings.tsx:11` | An open notes form could receive a newer record version during background refresh while retaining old text. It now captures the editing record/version/links, preserves unsaved text on conflict, and advances its version only after a successful save or capture. |
| P1 | `src/App.tsx:50` | A successful write followed by a failed refresh was reported as a failed write, encouraging duplicate creation. The write result now survives refresh failure, with the separate refresh warning retained. |
| P2 | `src/App.tsx:45` | Overlapping bootstrap requests could replace newer UI state with an older response. A request-generation check ignores superseded responses. |
| P2 | `src/ProjectSettings.tsx:4` | Settings previously lacked a concurrent-edit precondition. The form now captures the opening version, sends `expectedVersion`, and excludes the persisted version field from editable data. The backend rejects stale settings writes. |
| P2 | `server/app.ts:202`, `server/domain.ts:180` | Settings edits could overwrite one another and leave an already-drafted report apparently current. Settings now have a persisted optimistic version (legacy default 1), require `expectedVersion`, and participate in report-source freshness. Rejected stale writes do not change the audit or stored state. |
| P2 | `shared/reporting.ts:92`, `server/domain.ts:217`, `server/imports.ts:82` | Blank target dates could appear overdue, including in report attention, and an omitted import date could become a fabricated commitment. Undated work is excluded from overdue/reminder calculations; import leaves omitted dates blank and establishes a baseline only from a supplied commitment. |
| P2 | `server/imports.ts:94` | An invalid import row could reserve a duplicate key and suppress a subsequent valid row for that work. Only valid rows now consume duplicate keys. |
| P2 | `server/domain.ts:59`, `server/domain.ts:131`, `shared/reporting.ts:109` | Moving linked artifacts or work between use cases could leave inconsistent associations or a stale confirmation marked current. Association checks reject incompatible linked work/milestones, deliverables participate in freshness, and a scope change invalidates both former and new use-case confirmations. |
| P2 | `server/reset.ts:14`, `server/db.ts:45` | Reset could race an opening server between its owner check and archive. Reset now holds the same ownership claim as startup until archiving finishes; live or unknown owners fail closed, while confirmed-dead ownership can be recovered without discarding records. |
| P2 | `src/Delivery.tsx:234` | A failed second upload could leave the first valid import preview available. Selecting a new file or refreshing a preview now clears the old preview; FileReader errors are handled and selection is locked while reading. |
| P2 | `src/Reports.tsx:10` | Expanded report-source tracking needed readable deliverable and project-settings entries. The review view now names those sources and shows their context when a draft becomes stale. Presentation content remains isolated from these internal review records. |
| P2 | `src/Registers.tsx:82` | Type filters claimed ARIA tab semantics without tab panels or tab keyboard behavior. They now use a pressed-button filter group. |
| P2 | `src/Registers.tsx:110` | A weekend commitment could be labelled “Due next working day.” The label now says “Due soon” beside its actual target date. |
| P2 | `src/Meetings.tsx:20`, `src/Registers.tsx:21`, `src/Delivery.tsx:145` | A user explicitly assigned as a use-case lead could be allowed by the server but excluded from creation controls when their membership list was empty. Meeting follow-up, register, work-item, and deliverable creation now recognize that lead assignment without inventing memberships. |
| P3 | Repository cleanup | Removed the obsolete public design-study page and completed planning document; preserved dated validation evidence and repaired documentation links. Removed unreferenced UI helpers, unused Radix dropdown/tabs packages, and old overview-only selectors. Docker context now excludes ignored reference artifacts. |

User-facing labels use “Use case”; existing API paths, storage keys, and workflow stage contracts retain their identifiers.

## Data and permission checks

The portfolio seed records the ten confirmed use-case names without inventing lifecycle phase, lead, scope, delivery status, commitments, or acceptance evidence. Generic preview roles exercise permission boundaries; they do not represent authenticated team identities. The default `.data/portfolio` is separate from the earlier `.data/pmo` fixture. An explicit `DATA_DIR` or external `DATABASE_URL` still controls which existing store opens; changing profiles is not a migration.

Existing tests check CSV/XLSX row validation, retained imported stages, duplicate handling, idempotent commit, no manufactured acceptance evidence, optimistic rollback, test/rework gates, approved-report immutability, internal-content exclusion, and local ownership/recovery. Portfolio coverage adds lifecycle validation and clearing, profile isolation and persistence, artifact associations/evidence, role boundaries, report/confirmation freshness after moves and artifact edits, blank-date/import behavior, and concurrent settings rejection. The final full suite passed 62 of 62 tests with zero failures or skips (45 existing, 13 portfolio API, 4 portfolio model), as recorded in [the validation index](VALIDATION.md).

The final compiled main application opened the separate fresh portfolio store with ten confirmed names and no fabricated project work or lifecycle assignments. Comparing the earlier `.data/pmo` store with its pre-switch capture preserved thirty work items, two reports, and three example use cases. Current browser checks covered the profile/artifact/work flow, search and lifecycle filters, executive read-only controls, meeting-conflict recovery, card/list navigation, and the purple desktop layout at 1280×800 and 1440×900. No document-level horizontal overflow or main-browser errors were observed. The validation index records the exact boundaries of those checks.

CI retains locked installation, tests, and build on Windows and Linux with read-only repository permissions. Its action majors and cache inputs were rechecked against the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), and [pnpm action](https://github.com/pnpm/action-setup) documentation. No hosted CI result is inferred from local execution.

## Dependency maintenance

The dependency review updated Drizzle to 0.45.2, the patched version identified in its [official advisory](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9), and resolved `@fastify/static` 10.1.3, whose [compatibility table](https://raw.githubusercontent.com/fastify/fastify-static/v10.1.3/README.md) supports Fastify 5. ExcelJS 4.4.0 receives a narrowly scoped UUID 11.1.1 override; its use of CommonJS `v4()` was checked against the installed consumer and validated with an extended-conditional-formatting XLSX round-trip.

After these changes, the full suite passed 62 of 62 tests, the build passed, and `pnpm audit --prod --json` exited successfully with zero known advisories at all severities (previously two high and four moderate findings). A static-server smoke check also passed: the built entry, referenced asset, and deep link returned 200; an unknown API route returned 404. This is evidence about known production advisories and the tested dependency paths; development dependencies and cloud deployment were not covered by that audit.

## Remaining limits

- Unsaved form input is not durably stored. Some modal exits can discard a draft; meeting conflict recovery preserves current text but is not autosave.
- The meeting refresh-conflict interaction passed an explicit browser check, including preserved unsaved text and repeated successful saves after reload. The failed-second-upload interaction has not been exercised in the browser. Existing server/model suites do not exercise these React state transitions; earlier temporary render checks covered escaped report text and excluded internal metadata, but they are not committed browser automation.
- Earlier dated browser reports describe the version reviewed on that occasion. They do not establish complete visual, keyboard, print-pagination, or performance coverage for the later portfolio/purple revision.
- Corporate identity, shared hosting, actual AI-provider execution, standard PostgreSQL deployment, Docker execution, backups/restore operations, and team usability testing remain separate rollout work. Live startup stays disabled; local preview roles must not be exposed as shared authentication.

No claim is made that the repository is free of all defects, that real project data has been approved for processing, or that accessibility has been certified.
