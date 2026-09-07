# Phase Two — Delivery Desk

The app helps a small delivery team know what needs attention, who acts next, and what can be said confidently to the client. Design for a working PMO and contributors, with an executive review mode. Preserve the existing backend and its evidence, role, freshness and approval rules.

## Chosen direction

Delivery Desk combines a structured working surface with a visible delivery pipeline and a composed report page. Release Room was considered but overemphasizes engineering. Weekly Journal was considered but puts reporting before daily execution. This is a deliberate design choice for this project, not a finding that one aesthetic is universally superior.

## Visual contract

- Body: locally bundled Source Sans 3, 15px default; headings: locally bundled Manrope, 30–34px page title, 19–22px section title. Working labels are at least 13px. Use sentence case, tabular numeric values and full task titles.
- Canvas `#f3f5f8`; surfaces `#ffffff`; ink `#16283f`; muted text `#53657b`; border `#dbe2eb`; primary cobalt `#2458d3`; primary hover `#1847b6`; dark focus surface `#172c46`.
- Semantic color: success `#167052`, attention `#925700`, danger `#af3347`. Pair every color with text or a meaningful symbol. Person avatars use neutral initials, not status-like colors.
- Shared CSS variables: `--primary`, `--primary-dark`, `--border`, `--muted`, `--ink`, `--green`, `--amber`, `--red`, `--radius`, `--surface`, `--canvas`, `--heading-font`, `--body-font`.
- Space in multiples of 4px, typically 8/12/16/24/32. Controls 40px minimum by default, icon targets 36px minimum; use 44px on touch layouts. Panels 12px radius, controls 7px. Avoid nested panels and decorative drop shadows.
- Light 208px navigation rail. Working surfaces receive the visual emphasis. One clear primary action per action group, descriptive secondary actions, visible keyboard focus, reduced-motion support.
- Prefer practical density over tiny text. Tables have explicit headings and readable rows. On narrow screens, use task rows and stacked content rather than shrinking the desktop canvas.

## Four wireframes

### 1. Overview

```
Navigation | Project / All workstreams                 Search   Create
           | Delivery overview                         Run daily review
           | [Software changes | General work]
           | [Backlog → Development → UAT → Ready → Verify → Client → Closed]
           | [   n           n         n       n        n        n        n  ]
           | Action queue (why now, owner, next move) | This Thursday
           | 4–6 prioritized rows                     | Confirmation checklist
           | Workstream position                     | Milestone outlook
           | Lead / health rationale / actual counts | Baseline / forecast / actual
```

Pipeline stages are equal width, with current item counts. They are not a funnel or effort-complete percentage. The software/general toggle uses canonical separate workflows. Clicking a stage filters the delivery list. Blocked items are a subset of stage counts. Mobile places the action queue before a compact pipeline and stacks the remaining sections. Workstream bars show labeled item distributions, separating imported historical closure from recorded acceptance.

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

Separate preparing this period from browsing historical editions. Keep audience obvious. Show stale source context for work, registers and milestones. Preserve approved snapshots and historical corrections. AI assists wording through reviewable proposals; it never silently changes records or approves an edition.

## Review contract

Test: locate the top blocker, capture work, hand over ownership, record failed UAT, resolve/rework, record client response, confirm a stream, prepare/approve/present a brief. Evaluate identity, hierarchy, clarity, working density, interaction state, and accessibility separately. A different agent reviews the implementation. Do not claim actual user-study results or accessibility certification from this internal evaluation.

Reference synthesis and access limitations are in `docs/design/report-source.md`; the visual study is `public/design-study.html`.
