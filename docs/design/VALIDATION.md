# Delivery Desk redesign review

Reviewed on 7 September 2026 using fictional data in a separate local store. The original demonstration store was preserved.

Historical design pass: its fonts, layout, and test count are superseded. See the [validation index](../VALIDATION.md) for the current review.

## Implemented experience

- Overview: separate software/general pipelines, exact stage drill-down, intervention queue, register exceptions, weekly freshness, baseline/forecast milestone markers, and item distributions with explicit units.
- Delivery: full work titles and next actions, next-action-owner filters, distinct canonical boards, responsive task rows, and progressive Backlog capture.
- Item workspace: a persistent drawer, accountable/current ownership, explicit unmet prerequisites, and inline checks, handovers, resolution, rework, and client responses.
- Reporting: current-period confirmation, draft review, approval and presentation; earlier editions have a separate archive. Internal approval explanations remain outside the client edition.
- Shared system: locally bundled Manrope and Source Sans 3, neutral/cobalt tokens, keyboard focus, labelled controls, responsive navigation, project search, and refresh on focus/visible-minute intervals.

## Verification performed

`pnpm test`: **36 passed**, comprising 15 backend tests, 11 cadence tests, and 10 presentation-model tests. `pnpm build`: TypeScript and the optimized Vite build passed.

The new model tests check canonical board stages; exact workflow/stage drill-downs; current-action ownership; exclusions for historical closed records; search/filter/sort combinations; due-today and next-working-day attention; current-cycle stage evidence; unresolved earlier findings; capture/deployment prerequisites; and honest imported-closure wording.

Browser walkthroughs verified:

- UAT pipeline selection opened only the three matching software items in the original fixture.
- A blocking UAT item displayed its unresolved finding and missing passing check. Inline rework updated the same record to Development, cycle two, and reporting identified the changed source.
- Minimal phone capture saved a general Backlog item with title/workstream, increasing the QA store from 30 to 31 items.
- The phone board selected a canonical stage; its full-screen record preserved ownership and stage context. Saving a passing UAT check made the release handover available.
- Reconfirming Assistant changed current confirmation coverage from zero to one after rework. A client draft was prepared, the executive persona approved it with an explicit reason for two outstanding confirmations, and the approved route displayed a fixed edition.
- The approved route contained no workspace navigation or internal-only sentinel text; later QA work did not rewrite its content.
- Desktop and phone screenshots were inspected for hierarchy, long titles, operational text, responsive tables/drawers, and document layout. Inspected page and drawer widths did not overflow the viewport.
- The wireframe study switched screens and toggled grayscale and phone modes.
- The built app was inspected at 762px panel width. The keyboard skip link focused the main content while retaining the Delivery page. The pipeline was adjusted to four columns at this width so stage labels have more room.

## Review findings resolved

Independent static review caught stale workstream filters behind Overview links, mismatched attention definitions, misleading pending-check wording, missing shared CSS for import/report components, read-only settings that still looked editable, and a workstream editor using a refreshed version with an older form. Fixes also restored report bullets, preserved keyboard skip navigation, reset scroll on page changes, surfaced register exceptions, and aligned milestone connectors with displayed actual dates.

## Limits

This is agent-led browser and code review, not a usability study with the delivery team or a full accessibility certification. This redesign did not exercise an actual external AI service, corporate identity, shared hosting, email/Teams delivery, or real client data. Earlier backend/browser validation remains documented in [the baseline validation](BASELINE-VALIDATION-2026-09-07.md). GitHub CI results are tracked on the pull request; local checks alone do not establish a hosted CI result.
