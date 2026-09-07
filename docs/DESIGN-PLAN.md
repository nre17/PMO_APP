# PMO experience redesign

Owner: Nicholas Habr. Design and implementation: Codex with focused research, UX, and review agents.

## Scope and assumptions

Redesign the existing local PMO demonstrator for a small internal data/AI delivery team. Preserve its tested workflow and reporting rules. Improve visual identity, navigation, guidance, dense work review, item handoffs, and the client brief. Produce wireframes before implementation and a source-backed design rationale. Establish a baseline commit, a separate design branch, CI, and a reviewable GitHub change.

## Work sequence

1. **Complete — discovery and audit.** Inspect GitHub; research original AI design guidance, mature product patterns, and practitioner posts on Reddit, X, and Instagram. Record access limitations and separate anecdotes from evidence.
2. **Complete — synthesis and wireframes.** Resolve conflicting guidance, select a visual direction, define tokens and interaction contracts, and produce responsive wireframes grounded in the actual seeded project.
3. **Complete — implementation.** Redesign shared components and the five views, preserving backend behavior and explicit authorization.
4. **Complete — independent review.** Inspect real browser workflows, desktop/panel/mobile layouts, keyboard access, and the approved report route; correct observed defects.
5. **In progress — GitHub handoff.** Verify the intended repository visibility, publish a baseline and reviewable design change, and record tests and remaining limitations.

## Evidence and success criteria

Primary source classes: original Anthropic design research, product/design-system documentation, accessibility standards, and original practitioner posts. Social posts are discovery signals, not proof of general effectiveness. Do not infer unseen social content from login screens.

An unfamiliar team member should identify the urgent issue and its next action, capture work without a long form, understand release prerequisites, and prepare a client brief without guessing. Small text, hover-only essentials, contradictory workflow ordering, decorative data, and inaccessible controls fail review. Visual assessment considers identity, hierarchy, typography, density, consistency, and interaction quality separately.

The planning tool is unavailable in this session; this document records the live plan instead. Research workers own distinct source lanes and report provenance to the coordinating agent. Implementation and final critique have separate ownership.
