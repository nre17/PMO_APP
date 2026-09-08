# Phase Two · Desktop PMO workspace

The portfolio comes first. A manager should immediately find the ten use cases, then understand their recorded phase, intended outcome, lead, scope, next gate and supporting work. Unknown facts remain visibly unset until confirmed. No synthetic progress bars or guessed health assessments.

## Information architecture

```
Programme                 Use case portfolio
  Use case portfolio        Compact masthead / actual record counts
  Delivery overview         Shaping → Discovery → Design → Build → Assurance → Release → Adoption
  My work                   Search / phase / ordering / cards or list
  Delivery                  Named use cases             Selected use case
Records                     Phase / lead / work          Brief | Artifacts | Work & records
  Risks & decisions                                      Outcome, scope, gate, owner
  Milestones                                             Linked delivery, milestones, RAID
  Meetings
Reporting
  Weekly report
  Approved briefs
```

Use-case phases describe the consulting engagement; task stages describe execution. Lifecycle artifacts reuse deliverables and their task/milestone links. Phase and artifact statuses are recorded assessments; neither implies formal approval without its own supporting record.

Shaping covers RFP response, proposals and prioritisation. Discovery covers current state, target state and scope. Design includes semantics, data architecture, solution and experience design. Build spans backend, frontend and AI engineering. Assurance includes testing, evaluations, QA and UAT. Release covers production and handover. Adoption covers operating use and outcomes. These are navigation guidance, not a claim about a client's contracted gates.

## Visual language

The user requested an Accenture-inspired identity. The palette and forward chevrons take cues from [Accenture's public brand](https://www.accenture.com/en) and its [description of the greater-than symbol](https://newsroom.accenture.com/news/2020/change-powers-accentures-biggest-brand-move-in-a-decade). This project-specific interpretation is not an approved internal brand kit or an assertion that this is an official Accenture product.

- Deep ink rail `#1d102e`, vivid accent `#a100ff`, primary action `#8600d6`, hover `#6500a3`, pale violet canvas `#f7f5fa`. White is the working surface.
- Locally bundled Atkinson Hyperlegible Next for UI; Fira Code for references and figures. Reports retain distinct editorial document typography.
- Strong shapes at orientation points: brand mark, masthead, lifecycle segments and selected-use-case state. Forms and tables stay restrained.
- Green, amber and red retain semantic meaning and accompanying words. Purple signals navigation and action, not delivery health.
- Desktop/laptop is the priority. Preserve the rail and useful multi-column workspaces at common laptop widths. Narrow panels remain readable; mobile is a basic fallback.
- Controls have real actions. Keyboard focus, dialog confinement, source freshness and error recovery are part of the interface.

## Existing operating controls

Direction A informs the delivery queue and item workspace. Direction B informs briefing documents. Direction C informs explicitly linked work, registers and milestones. The [Claude integration record](docs/design/CLAUDE-INTEGRATION.md) is historical provenance; this file is the current design contract.

Intervention counts deduplicate blocked, overdue and client-response work. Due-soon work is separate. Milestone variance compares recorded dates in calendar days; it is not a causal prediction. Reporting preserves client/internal separation, confirmation freshness and immutable approved editions. Evidence and current-cycle checks remain required by the underlying delivery workflow.
