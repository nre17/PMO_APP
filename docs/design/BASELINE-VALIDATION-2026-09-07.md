# Demonstrator validation

Historical record of the original functional baseline. The counts and browser results below describe that pass only. See the [validation index](../VALIDATION.md) for later work and current coverage.

Validated locally on Windows with Node.js 24 on 7 September 2026.

## Automated checks

All 26 tests passed: 15 backend workflow/storage tests and 11 cadence tests. The final TypeScript check and browser build passed.

`pnpm test` covers software and general-work gates, blocking findings, rework, client acceptance, permission checks, optimistic concurrency rollback, confirmation freshness, immutable approved reports, client-content isolation, CSV/XLSX validation and export, idempotent imports, atomic meeting capture, database ownership and restart persistence.

Cadence tests cover exact Thursday cutoffs, Dubai midnight, daylight-saving changes in London, configurable working days, late submissions, critical-blocker escalation, and accepted-completion selection. Imported historical closure does not fabricate acceptance evidence or count as a newly accepted completion.

`pnpm build` checks TypeScript and builds the browser assets.

An abrupt-exit regression verifies that committed edits survive stale-lock recovery and that simultaneous restarts cannot both own the local database. Unknown ownership leaves the lock and database untouched. The main demo also recovered successfully after a stopped Windows process left a stale lock.

## Browser checks

The browser walkthrough used a separate fictional database so the main demonstration stays clean.

- Captured a Backlog item, supplied its delivery prerequisites, and handed it from Development to UAT with a new action owner.
- Recorded a blocking UAT failure and verified release advancement was disabled.
- Started rework and verified the same item retained the earlier finding and advanced to a new delivery cycle.
- Recorded client acceptance on an eligible item and verified it closed.
- Confirmed three workstreams, prepared a client draft, switched to the executive persona, and approved a fixed edition.
- Opened the separate presentation route and checked that internal-only sentinel content and workspace navigation were absent.
- Saved meeting notes and captured a reviewed action linked to the meeting.
- Verified the lead's My Actions queue shows an immediate critical-blocker escalation, an overdue commitment, a due-today item, a next-working-day reminder, and a stale workstream confirmation.
- Inspected phone, embedded app-panel, and desktop layouts at 390, 762, and 1440 pixels; the inspected pages did not overflow horizontally.
- No browser console errors were reported in the tested final walkthrough.

## Not exercised externally

Configured AI generation, standard PostgreSQL, Docker image execution, corporate sign-in, and hosted deployment were not tested against external services. AI controls remain disabled without a configured key. Corporate identity and an approved hosting environment remain subsequent implementation work.
