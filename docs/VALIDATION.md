# Validation index

This index separates current automated coverage from dated historical browser evidence. A passing source/model test does not establish visual correctness or corporate deployment readiness.

## Current coverage

The Work scope revision passed the **15 existing overview and showcase tests** and a production build on 10 September. It changes interface defaults and guidance; existing data, stored stages, API defaults and workflow gates remain intact.

The fictional-team revision passed **97 of 97 tests** and a production build on 10 September. Coverage checks ten named sample teammates, role-appropriate assignments, lead scope, attributed confirmations and checks, and continued exclusion of internal staffing notes from client reports. Preview switching drains pending refreshes, blocks overlapping switches and saves, and verifies the selected identity before restoring editing.

The manager-review revision passed **96 of 96 tests** and a production build on 10 September. Added coverage verifies complete illustrative profiles and connected records, three months of contemporaneous report history, ten current confirmations, and contextual evidence resolution for artifacts, work references and failed checks. Unknown references and non-demo workspaces cannot manufacture a specimen. Final copy polish retained explicit assertions that internal staffing details stay out of every client report.

The navigation and escalation revision passed **92 of 92 tests** and a production build on 9 September. New tests cover legacy-route compatibility, Work/report URL parsing, escalation permissions, concurrent/stale writes, duplicate prevention, legacy status history, resolution and re-escalation, source freshness, and preservation of work stages. Windows launcher checks covered detached startup, a 50-second soft timeout with reuse of the same slow-starting process, concurrent launch rejection, wrong-store refusal and environment preservation.

The active suite includes backend storage and permission invariants; exact reporting cutoffs and source freshness; delivery/overview filters and handover prerequisites; portfolio lifecycle, profile separation, artifact associations and permission boundaries. Client-report tests check internal-content exclusion and immutable approved snapshots. Import tests use real CSV/XLSX content and preserve stages without manufacturing completion evidence.

The portfolio revision passed **62 of 62 tests** on 8 September after the dependency updates. The reviewed-intake revision subsequently passed a full **74 of 74** run, followed by **17 of 17** focused intake tests after five additional regressions were added, bringing that revision to 79 tests. GitHub Actions runs the complete suite and build on Windows and Linux for each revision.

The intake tests use synthetic fixtures. They cover source dispositions, stable row identity, repeat imports, preservation of human edits, source revisions, pinned evidence, historical-source restrictions, permissions, validation, explicit general actions, storage defaults, persistence and rollback. The final local production build passed after the source screens were integrated.

Run `pnpm test` for the suite and `pnpm build` for TypeScript checking plus optimized browser assets. A passing test run does not establish that every later source change was built or browser-tested.

The [8 September repository audit](REPOSITORY-REVIEW-2026-09-08.md) records corrected defects, source/configuration coverage, cleanup, and remaining limitations. Automated server/model tests supplement the observed browser scenarios below.

Dependency maintenance was followed by a successful build, zero known production-dependency advisories from `pnpm audit --prod --json`, an XLSX conditional-formatting round-trip, and static asset/deep-link/API-fallback checks. The audit document records the exact resolved versions and compatibility evidence.

## Current browser observations

The Work scope revision was checked in the compiled manager review: new capture selected General work / Action; choosing Software change showed its UAT and release guidance; entering Board from All selected General work and showed discovery, scope and adoption examples. The 1440px document had no horizontal overflow. A fresh background tab loaded the workspace after correcting visibility-gated initial bootstrap. These checks saved no records, and both project and manager-review states matched their pre-change snapshots.

The fictional-team revision was exercised through the browser in a separate rehearsal store: a new Budget discovery action saved with Nadia Saleh accountable and Rami Khalil acting next; a UAT check saved under Priya Nair; and a new internal report saved edited wording. The persisted server records were checked, and changed sources correctly invalidated the affected confirmations. An overlapping preview-profile switch discovered during rehearsal was fixed and the named check then passed. The manager-review store was confirmed unchanged before installing its clean fictional-team fixture; rehearsal records were not included.

On 10 September, the manager review was checked at a 1440×900 laptop viewport with no horizontal document overflow. The four-stop guide opened populated discovery work, an enabled QA handoff form, blocked reconciliation work and its linked escalation, and the named month-three approved report. Current reporting showed ten of ten use cases confirmed. The report presentation and a record-specific discovery evidence specimen opened in separate tabs. Meeting notes and their linked follow-ups were populated. These browser checks left work and report records unchanged; the state-changing paths are covered by the integration suite. Private source context was prepared only in the ignored local review store, and the actual project state was verified unchanged.

On 9 September, the in-app browser verified the five primary destinations and all five Work views at laptop dimensions. A synthetic escalation was raised from a work item, opened as a linked register, and resolved with a response; the work remained in Development. A saved approved report opened directly before a showcase browser session existed. Report history gained its own URL and was checked after reload. Chrome was not connected to browser automation, so these observations do not claim a Chrome-specific run. Both local compiled servers were restarted after the final build and served its JavaScript assets successfully.

The populated consulting showcase adds four integration tests. The full local suite passed **83 of 83** after its integration. The new coverage exercises discovery review, gated UAT/release and rejection into a new cycle, explicit client acceptance, meeting capture, use-case confirmations, report approval and immutable labelled presentation, and storage/profile separation. The dedicated launcher was checked to retain its local-store and empty external-database overrides after environment loading. The final ready-to-present fixture edition is also included in the showcase tests.

Showcase browser checks opened a discovery record from the guide and its real handover form, reviewed accepted artifacts, opened an illustrative evidence pack on the same origin, switched into the approver's report view, and inspected the report history. The demonstration remains populated for rehearsal; these read-only browser checks do not claim that the full workflow was submitted through the UI. Those state-changing paths were exercised by API integration tests.

The reviewed-intake workspace was checked after a server restart: overlapping portfolio groups, original tracker statuses beside intake stages, linked status-confirmation actions, completed and deferred source filters, and source-file/row references. Counts persisted and a repeat intake preview produced no changes. The final browser error log was empty. Local documents and project records are excluded from this repository; these observations do not establish a live connection to the source systems.

These interactions were checked in an isolated local portfolio QA store on 8 September:

- Saved a use-case profile: outcome, scope, lead, priority, lifecycle phase, next gate, and target date.
- Saved an owned Discovery artifact in review with an evidence URL; linked a general research work item and observed the use-case active-work/artifact counts update to one each.
- Applied the Discovery filter and received the single matching case; global search opened Legal Companion and restored access to all ten cases.
- Opened the profile as the executive preview role: all edit fields were disabled and no save action appeared.
- Saved meeting notes, changed the record concurrently through the API, and allowed the automatic refresh. Unsaved notes stayed visible, save was disabled, and the conflict explanation appeared. Explicit reload followed by two consecutive UI saves succeeded.

The final compiled application was then checked on the main local port with the fresh portfolio store: ten confirmed names, four clearly labelled preview roles, and zero work items, artifacts, reports, lifecycle assignments, or leads. The earlier `.data/pmo` store was compared with its pre-switch capture and retained its thirty work items, two reports, and three example use cases. Equivalent ISO timestamp serialization was normalized for that comparison.

At 1280×800 and 1440×900, the document had no horizontal overflow, the navigation rail stayed visible, and use-case names appeared in the first screen. The long treasury name wrapped in full; four case names appeared in the first 1440px viewport. Card/list switching showed the same ten cases. Weekly reporting and Delivery rendered with the purple theme. The final main-browser error log was empty.

The failed-second-upload import interaction has not been exercised in the browser. Its source fix must not be mistaken for an end-to-end regression result.

## Historical evidence

| Record | Scope |
| --- | --- |
| [Functional baseline — 7 September](design/BASELINE-VALIDATION-2026-09-07.md) | Initial workflow, persistence, import, report isolation and browser walkthrough. |
| [First design pass — 7 September](design/VALIDATION.md) | Earlier Delivery Desk layout, item drawer, reporting workflow and narrow-screen checks. Its font/theme description is historical. |
| [A/B/C integration — 8 September](design/VALIDATION-2026-09-08.md) | Operational queue, linked context, editorial reporting and observed browser scenarios before the later portfolio revision. |

These records retain the counts and observations of their own runs. They are evidence, not instructions to keep obsolete interfaces.

## Not established by local validation

Corporate sign-in, shared hosting, a real AI provider, deployed standard PostgreSQL, Docker execution, a final PDF pagination review, accessibility certification, performance under a production workload, and usability with the actual delivery team have not been established by these local checks. Follow [deployment readiness](DEPLOYMENT.md) before planning shared use.
