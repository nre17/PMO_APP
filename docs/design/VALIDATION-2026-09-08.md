# A/B/C integration validation — 8 September 2026

This validates the implemented A workspace, B briefing, and C linked context. It supersedes the earlier visual direction, while the 7 September workflow evidence remains a historical record.

This is the historical A/B/C integration pass, before the use-case portfolio and purple workspace revision. Its observed counts and browser results are retained as evidence for that pass. See the [validation index](../VALIDATION.md) for subsequent coverage.

## Automated and structural checks

- All **45 tests pass**: 15 backend, 11 cadence, 10 delivery presentation model, and 9 overview selector/filter tests.
- TypeScript and the optimized Vite build pass. Fonts are bundled locally; the Claude Design runtime and external icon/font CDNs are not used.
- Five additional, temporary React server-render fixtures passed: fixed snapshot, no active work, empty records, long text with 450 interventions, and narrow initial state. Full titles/actions/owner text survive and are escaped. Actual link provenance is retained, baselines remain unchanged, and calm/empty views keep reporting available. These fixtures used a CSS-free render and do not establish visual scalability or accessibility.

## Browser walkthrough

Browser writes were confined to `.data/claude-design-qa` on port 4311. The main store on port 4310 was not edited. Its complete business-state SHA-256 matched before and after the production preview restart: 30 work items and 2 saved reports.

- Inspected Overview at 1440, 1280, 762, and 390 CSS pixels. No horizontal page overflow remained after the tablet correction. The phone overview starts without an automatically selected record. Its compact summary brings the queue higher on the page. Titles and actions wrap rather than truncate.
- Verified intervention and additional due-soon shortcuts against the visible Delivery lists: **6 and 5** in this newly created QA store. These are live values, distinct from the fixed historical fixture's 7 and 9. The model tests verify exact membership for all four new filters.
- Opened the finance concern directly from selected work into the actual register editor. Inspected register and deliverable routes to its associated milestones, with forecast variance explicitly in calendar days. Opened the Milestones section from Delivery at tablet width.
- Used Enter to select a work row on the phone layout. Focus moved to the selected-record heading. Escape closed the pane and restored focus to the originating row. The primary record action is visible in the context header.
- Opened the citation UAT record through the new context pane and saved its next action. The existing blocking finding and missing passing UAT check still prevented handover. The update marked the assistant workstream's confirmation stale.
- Reviewed sources and reconfirmed the assistant workstream, then prepared a client draft. Switched to the designated executive persona. Approval remained disabled until the two outstanding confirmations were acknowledged with a reason. The approved presentation excluded that internal reason and workspace navigation.
- Inspected the approved archive and editorial client presentation on desktop and phone. Existing approved content and reporting dates were retained.

## Limits

These are implementation checks on fictional records, not a usability study with the delivery team or an accessibility certification. The long-text/450-row fixtures received structural checks, not a performance benchmark. Print CSS was compiled; a final PDF pagination review was not performed in this pass. Corporate identity and shared hosting remain separate rollout work.
