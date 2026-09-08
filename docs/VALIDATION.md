# Validation index

This index separates current automated coverage from dated historical browser evidence. A passing source/model test does not establish visual correctness or corporate deployment readiness.

## Current coverage

The active suite includes backend storage and permission invariants; exact reporting cutoffs and source freshness; delivery/overview filters and handover prerequisites; portfolio lifecycle, profile separation, artifact associations and permission boundaries. Client-report tests check internal-content exclusion and immutable approved snapshots. Import tests use real CSV/XLSX content and preserve stages without manufacturing completion evidence.

The final full `pnpm test` run on 8 September, repeated after the dependency updates, passed **62 of 62 tests**, with zero failures or skips: 45 existing tests, 13 portfolio API tests, and 4 portfolio model tests. This result covers the use-case portfolio revision; the dated records below retain their earlier counts.

Run `pnpm test` for the suite and `pnpm build` for TypeScript checking plus optimized browser assets. A passing test run does not establish that every later source change was built or browser-tested.

The [8 September repository audit](REPOSITORY-REVIEW-2026-09-08.md) records corrected defects, source/configuration coverage, cleanup, and remaining limitations. Automated server/model tests supplement the observed browser scenarios below.

Dependency maintenance was followed by a successful build, zero known production-dependency advisories from `pnpm audit --prod --json`, an XLSX conditional-formatting round-trip, and static asset/deep-link/API-fallback checks. The audit document records the exact resolved versions and compatibility evidence.

## Current browser observations

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
