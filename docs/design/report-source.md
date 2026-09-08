# Designing a PMO people can actually use

Design research for Nicholas Habr · 7 September 2026

Historical research synthesis. Its original visual recommendation predates the later design choices. Use the current [design contract](../../DESIGN.md) for implementation; retain the sources below as background evidence.

## Recommendation

Build **Delivery Desk**: an operational workspace with a readable delivery pipeline, prioritized exceptions, contextual item actions, and a guided weekly report. Establish its typography, spacing, status language and interaction rules once, then review real workflows independently. This is our synthesis for the existing PMO app, not a measured user-study result.

The current app already has substantive governance. Its weaknesses are hierarchy and interaction: useful actions follow repeated summary cards, the board mixes two stage sequences, item work involves modal changes, and draft preparation competes with historical browsing. The redesign addresses those specific conditions.

## What the research changes

1. **Define purpose and direction.** Anthropic's design work describes explicit aesthetic guidance; its later evaluation work separates coherence, originality, craft and functionality. We use these as distinct review questions, not proof of usability. [Frontend guidance](https://claude.com/blog/improving-frontend-design-through-skills), [independent evaluation](https://www.anthropic.com/engineering/harness-design-long-running-apps).
2. **Let work receive the emphasis.** Linear describes reducing competing navigation, colors and ornamental structure while retaining density. We adopt the hierarchy principle and build our own identity. [Linear's 2026 refresh](https://linear.app/now/behind-the-latest-design-refresh).
3. **Use a real work surface.** Carbon supports deliberate table density, headings, search/filter controls and contextual expansion. Delivery will favor full titles and next actions, with an item workspace that has room for evidence. [Carbon data tables](https://carbondesignsystem.com/components/data-table/usage/).
4. **Preserve context.** NNGroup's complex-application guidance addresses interruptions, contextual learning and secondary information. Filters should survive opening an item; release prerequisites should appear beside the action. [Complex application design](https://www.nngroup.com/articles/complex-application-design/).
5. **Make navigation predictable.** Atlassian describes progressive disclosure and stable global actions while acknowledging that identical navigation does not suit every product. We use five shallow destinations and shared search/create controls. [Atlassian navigation](https://www.atlassian.com/blog/how-we-build/designing-atlassians-new-navigation).
6. **Make visuals answer a delivery question.** Operational dashboards need rapid interpretation. Our pipeline shows counts by canonical stage; milestone markers show date movement. Neither invents effort completion, velocity or productivity scores. [Dashboard interpretation](https://www.nngroup.com/articles/dashboards-preattentive/).
7. **Use language with status color.** GOV.UK documents task-status confusion and distinguishes outstanding work from completed tasks. Our action names and statuses remain explicit; mandatory release sequencing stays enforced. [Task-list guidance](https://design-system.service.gov.uk/components/task-list/).
8. **Build in accessibility.** Apply contrast and target-size guidance, visible focus, semantic controls, field labels and reduced motion. Our target is generally 40px, 44px on touch layouts. These choices are not a full WCAG certification. [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Practitioner signals

Original Reddit discussions suggest explicit scenarios, references, a durable design-decision document, and review of rendered interfaces. These are useful process inputs, not controlled evidence; some posters promote tools. [Scenario-first discussion](https://www.reddit.com/r/ClaudeAI/comments/1swf8hx/how_do_you_get_ai_to_generate_ui_that_actually/), [project-specific design rules](https://www.reddit.com/r/ClaudeAI/comments/1t24gan/few_months_of_frontenddesign_uiuxpromaxskill/).

A dashboard critique identifies a mismatch between urgent-response work and an aggregate-chart opening. We apply that question to the PMO: can someone find the next intervention immediately? Its attached design was not independently inspected. [Original critique](https://www.reddit.com/r/UI_Design/comments/1raxdd6/request_for_review_educrest_crm_dashboard_design/).

X articles by sysls and Kaxil Naik advocate checking actual behavior and using review artifacts. Their indexed article text was readable; direct live retrieval was blocked or unavailable. Both are self-reported practitioner accounts. [sysls](https://x.com/systematicls/status/2038241033755168959), [Kaxil Naik](https://x.com/kaxil/status/2037503513350005134).

Impeccable distinguishes product context, visual direction, critique, technical audit and polish. We adopt that workflow distinction without treating its marketing as independent effectiveness evidence. No detector package was installed. [Original project](https://github.com/pbakaus/impeccable).

Instagram searches yielded no usable original posts and direct access redirected to login. No reels, visuals or comments were reviewed. Public discussions also disagree on what looks generic; novelty is not a substitute for task success.

## Decision and validation

Delivery Desk was selected over Release Room, which overemphasized engineering, and Weekly Journal, which subordinated daily delivery to reporting. The direction uses Manrope headings, Source Sans 3 reading text, quiet light navigation, ink-blue surfaces, cobalt actions and semantic status colors. Fonts are bundled locally.

The contract is in `DESIGN.md`. Four responsive wireframes precede implementation. Review uses actual tasks: find a blocker; capture work; change responsibility; record/resolve failed UAT; record client feedback; confirm workstreams; create and approve a brief. Preserve backend tests and inspect desktop, embedded-panel and mobile layouts. Report observed testing scope instead of implying certification.

## Scope and stopping point

The audience is a small internal data/AI delivery team and managers preparing a Thursday client discussion. Discovery and targeted follow-up covered aesthetic direction, density, navigation, operational dashboards, evidence-preserving workflows and critique loops. Original articles, product documentation, standards and practitioner discussions were used in that order of confidence.

The main tension is between visually distinctive AI demonstrations and usable daily software. We adopt explicit direction and independent critique while rejecting irrelevant spectacle. Sources sufficiently support the decisions above; further broad searches were repeating advice or inaccessible posts. No adoption, time-saving or real-user preference claims have been established.

## Claim-to-source ledger

| Source | Date | Evidence and limitation |
| --- | --- | --- |
| Anthropic frontend guidance | 2025; exact day not relied on | Original article read; reported prompting method, not PMO study |
| Prithvi Rajasekaran, Anthropic harness design | 24 March 2026 | Original experiments read; model/task-specific |
| Charlie Aufmann and Maxime Heckel, Linear | 12 March 2026 | Original rationale read; vendor self-report |
| IBM Carbon | Living documentation, accessed 7 September 2026 | Component guidance read; team density untested |
| Kate Kaplan, NNGroup complex applications | 8 November 2020 | Full article read by worker; transfer is inference |
| Atlassian navigation team | 17 December 2024 | Original account read by worker; not independent outcome evidence |
| Page Laubheimer, NNGroup dashboards | 18 June 2017 | Full article read by worker after access retry |
| GOV.UK Task list | Living guidance, accessed 7 September 2026 | Includes outstanding research questions |
| W3C WAI WCAG pages | Accessed 7 September 2026 | Published guidance; no certification claimed |
| Reddit discussions linked above | 2026; exact dates vary | Original text/replies read; no videos; anecdotes and some promotion |
| sysls on X | 29 March 2026 | Indexed article text; direct page 403 |
| Kaxil Naik on X | 27 March 2026 | Indexed article text; self-reported practice |
| Paul Bakaus, Impeccable | Accessed 7 September 2026 | Original README/docs; tool description, not proof |
| Instagram | Attempted 7 September 2026 | No substantive evidence beyond login boundary |
