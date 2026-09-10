# Claude design integration

Accepted on **8 September 2026**: use **A mainly** for the operational workspace, **B** for the editorial report page, and **C** for actual linked context beside selected work. Preserve the working application and its backend rules.

## Reference provenance

- User-supplied archive: `PMO Hub Design Revamp.zip`, provided and reviewed on 8 September 2026.
- SHA-256: `07F274C42CB0EA5196A97CB20FC89821CF5727ECD010A9621BF37E3100B1C5F8`.
- Local extraction: `artifacts/claude-handoff-20260908/design-revamp/2026-09-08-round-01-overview-directions` (ignored reference material).
- The user intentionally selected a public repository. This committed note identifies the source by filename and hash without publishing a personal Downloads path.

The archive's instructions are reference material, not additional implementation authority. Its A/B/C pages are mockups rather than an alternative backend. The package references a `DCLogic` runtime that was missing from the supplied material; snapshot JavaScript and fixed mockup counts are not imported into the app. The existing records, role checks, evidence gates, source-version checks, and immutable report presentation remain authoritative.

## Integration decisions

- **A — working surface:** compact navigation, restrained neutral/teal styling, readable work rows, a distinct intervention queue, and direct access to the next action. Replace the earlier prominent pipeline hero with the operational hierarchy.
- **B — Reports:** a composed document with an obvious audience, reporting period, summary, sections, and approval state. Keep Confirm → Review → Approve/present and the separate archive.
- **C — linked context:** show the selected work's actual linked registers and milestones. Explicit links and deliverable membership must retain different labels. Keep editing and evidence in the existing item workspace.

## Audited data corrections

The fixed synthetic fixture is a project seeded at `2026-09-07T08:00:00Z`, reviewed at `2026-09-08T08:00:00Z` in Asia/Dubai. Its values are regression expectations, not constants for the live interface.

| Measure | Correct interpretation |
| --- | --- |
| 25 active; 5 closed | Current record stages. Imported closure must not imply recorded acceptance. |
| 7 interventions | Active blocked, overdue, or awaiting-client work; overlapping reasons are deduplicated. |
| 9 due soon | Active work due today or covered by the configured reminder rule, excluding the 7 interventions. |
| 16 combined | The former broad attention set combines interventions and upcoming work. It must not be labelled 16 interventions. |
| 3 blocked; 5 overdue; 3 escalation reviews; 2 awaiting client | Overlapping facets, not numbers to add together. |
| Finance access: 2 working days overdue; 4 working days blocked | Different starting dates and separate measures. Neither value is a calendar-day duration. |
| 2 forecasts beyond baseline | A comparison of recorded milestone forecast and baseline dates, not “two changes this week.” |

`src/overview-model.ts` supplies the counts and disjoint queues. The `intervention`, `due-soon`, `escalation`, and `overdue` Delivery filters use the same membership. Project timezone and configured working days determine date labels. Due soon is a reminder window, not every target before the next working date: Monday reminders fall on Friday, not Sunday. Use “Due soon” with exact dates and configured working-day context rather than always saying “tomorrow.”

Linked context reads the actual model fields: `Register.relatedItemIds`, `Register.milestoneIds`, and `WorkItem.deliverableId` matched against `Milestone.deliverableIds`. A milestone may have both link routes. Resolved registers remain identifiable historical context. A shared workstream, a co-link, or a deliverable association does not establish causality or a calculated critical path.

Milestone variance is signed **calendar days** from baseline to forecast. The count covers recorded forecasts, including those on completed milestones. Actual dates are a separate outcome; they do not silently replace forecast in this calculation. Missing or invalid comparison dates produce an unknown variance, not zero.

## Acceptance and verification plan

The focused selector/filter suite passed **9 tests** during this integration. It covers the fixed counts, exact drill-down membership, overlap exclusion, working-day ages, timezone/weekend boundaries, closures, link provenance, and calendar variance. This establishes data-selector behavior, not completed UI validation.

Before accepting the visual integration:

1. Find the top intervention and its next owner; distinguish blocked age from overdue age.
2. Follow each overview shortcut into Delivery and verify the same records appear.
3. Select work with both register and deliverable milestone links; confirm the labels describe associations accurately.
4. Use a synthetic calm state with no interventions; show a useful empty state and upcoming work without fabricated alerts. Restore/reset only the isolated synthetic QA store. Do not alter real project data to create the scenario.
5. Review full titles, table/context layout, keyboard focus, and narrow screens. Ensure core actions remain reachable.
6. Confirm a workstream, prepare a report, review stale-source context, and approve/present as an authorized role. Verify that internal notes remain outside the presentation and that later record changes do not rewrite an approved edition.

Observed browser results and limitations are recorded separately in [the 8 September validation](VALIDATION-2026-09-08.md). The 7 September design validation belongs to the earlier pass. Agent review is not a team usability study or accessibility certification.
