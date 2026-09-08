# Phase Two — Delivery Desk

The app helps a small delivery team know what needs attention, who acts next, and what can be said confidently to the client. Design for a working PMO and contributors, with an executive review mode. Preserve the existing backend and its evidence, role, freshness and approval rules.

## Chosen direction

The user selected **Direction A as the main workspace**, with **Direction B's editorial treatment for Reports** and **Direction C's linked context for selected work**, on 8 September 2026. The supplied Claude mockups are design references. The application keeps its existing data model, authorization, evidence, handoff, and reporting rules.

Overview leads with a compact operational table and a clear distinction between intervention and upcoming work. Context follows the selected record. The earlier dark pipeline hero is superseded; workflow stages remain useful in Delivery and item details. Reports remain composed documents with an explicit audience and publication state. This is a project-specific design choice, not a claim of demonstrated usability improvement.

## Visual contract

- Main UI: locally bundled Atkinson Hyperlegible Next, 15px body default and approximately 25–28px page titles. Fira Code is reserved for compact references, numbers, and metadata. Working content should remain at least 13px; small secondary identifiers must not carry the only essential instruction. Use sentence case, tabular numeric values, and full task titles.
- Canvas `#fbfbfa`; surfaces `#ffffff`; ink `#16191d`; muted text `#626b73`; border `#e2e4e6`; primary teal `#0f7378`; primary hover `#095a5e`. Use quiet rules and whitespace to distinguish sections instead of a dominant colored hero.
- Semantic color: success `#1d6f42`, attention `#8a5a00`, danger `#a8271f`. Pair every color with text or a meaningful symbol. Person avatars use neutral initials, not status-like colors. Pending confirmation is distinct from an overdue commitment or delivery risk.
- Shared CSS variables: `--primary`, `--primary-dark`, `--border`, `--muted`, `--ink`, `--green`, `--amber`, `--red`, `--radius`, `--surface`, `--canvas`, `--heading-font`, `--body-font`, `--mono-font`.
- Space in multiples of 4px, typically 8/12/16/24/32. Controls 40px minimum by default, icon targets 36px minimum; use 44px on touch layouts. Shared panels and controls use restrained 2–3px corners. Avoid nested cards and decorative drop shadows.
- A quiet navigation rail, approximately 216px on a full desktop, leaves the working surface dominant. One clear primary action per action group, descriptive secondary actions, visible keyboard focus, and reduced-motion support.
- Prefer practical density over tiny text. Tables have explicit headings and readable rows. On narrow screens, use task rows and stacked content rather than shrinking the desktop canvas.

## Four wireframes

### 1. Overview

```
Navigation | Project / Overview                 Updated as of…    Add work
           | Delivery overview                              Run daily review
           | Active work · Interventions · Escalations · Awaiting client
           | Interventions table                   | Selected work context
           | Work / why now / owner / target       | Next action and evidence
           | Select a row to inspect context       | Linked register entries
           |                                      | Milestones + link provenance
           | Due soon: today + configured reminders | Reporting readiness
           | Separate upcoming-work queue          | Confirmation deadlines
           | Milestone baseline / forecast / calendar variance
           | Workstream health and recorded rationale
```

Interventions include active blocked work, overdue work, and work awaiting client acceptance. Rank escalation first, then blocked, overdue, and client response, with target dates breaking ties. An item with several reasons appears once. Due-soon work is active, due today or covered by the existing next-working-day reminder rule, and excluded from interventions. Counters and Delivery shortcuts use the same selectors; overlapping blocked/overdue/client counts are not additive.

Selected-work context uses explicit register links and item-to-deliverable-to-milestone membership. Label each association's provenance; never imply a critical path, causal dependency, or milestone impact from shared workstream alone. Show unresolved register exceptions separately from work-item counts. Keep blocked duration separate from overdue duration.

On narrow screens, prioritize interventions, reveal selected context without shrinking the table, and stack upcoming work and reporting sections. Completion counts distinguish recorded closures from imported historical closure. Milestone variance means calendar days between recorded baseline and forecast; it is not a count of changes this week. Any stage distribution remains a count of records, not an effort-complete percentage.

### 2. Delivery

```
Delivery                                                Add work   Import/export
Work items | Milestones | Deliverables
Search / workstream / owner / state                      List | Board
All workflows | Software | General work
Work title + next action | stage | action owner | target | priority
```

The list can contain both workflows. A board always displays one canonical workflow. Keep filter context when opening a task. Show full titles and useful next actions; identifiers are secondary. Quick capture asks for title/workstream first, with other definition available progressively. Fields needed to start work are explained before handoff.

### 3. Item workspace

```
Reference · Delivery cycle                                Close
Work title
Stage / target / accountable owner / next action owner
Next step — stage-specific prerequisites and missing evidence
Primary handoff action / contextual testing action
Summary | Checks & evidence | History
Contextual form, displayed in the same workspace
```

Use a right-hand drawer on desktop and a full-screen workspace on mobile. Avoid nested dialogs for rework and finding resolution. Explain disabled actions. Preserve captured version/stage/cycle checks and actionable conflict errors. General review and client acceptance remain different operations. Imported closure keeps its provenance; do not invent acceptance.

### 4. Weekly report

```
Weekly report                     Week ending…       Previous editions
Confirm workstreams → Review draft → Approve & present
Current step content / report canvas          Review checklist
                                              Audience
                                              Freshness / missing confirmations
                                              Information as of / approval
```

Use Direction B's editorial hierarchy: a clear title, period, summary, restrained section rules, and readable report text. Separate preparing this period from browsing historical editions. Keep audience obvious. Show stale source context for work, registers and milestones. Preserve approved snapshots and historical corrections. AI assists wording through reviewable proposals; it never silently changes records or approves an edition.

## Review contract

Test: locate the top blocker, distinguish intervention from upcoming work, follow a count into Delivery, inspect linked context, capture work, hand over ownership, record failed UAT, resolve/rework, record client response, confirm a stream, and prepare/approve/present a brief. Evaluate identity, hierarchy, clarity, working density, interaction state, and accessibility separately. Include a synthetic zero-intervention state and mobile/keyboard review. A different agent reviews the implementation. Do not claim actual user-study results, accessibility certification, or browser checks that have not been run.

The accepted A/B/C reference, provenance, audited data corrections, and acceptance plan are in [Claude integration](docs/design/CLAUDE-INTEGRATION.md). Earlier research remains in [the source synthesis](docs/design/report-source.md); `public/design-study.html` and the 7 September validation describe the previous design pass, not final validation of this integration.
