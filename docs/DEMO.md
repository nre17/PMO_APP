# Demonstration walkthrough

Allow about ten minutes. Start with a newly seeded local store if you want the exact states below; the app otherwise preserves previous edits. All names, work items, and evidence links are fictional.

## 1. Start with the decisions, not the tracker

As **Nadia Rahman**, show the command center across Knowledge assistant, Data foundation, and Evaluation & assurance. Explain three visible exceptions:

- Finance source access is overdue and blocks ingestion validation.
- The assistant pilot forecast has moved while its original baseline remains visible.
- Weekly confirmation is fresh for Assistant, stale for Data, and missing for Evaluation. Evaluation's old green health is not a fresh confirmation.

Show that each item has a delivery owner and a current action owner. The PMO identifies exceptions and helps resolve ownership; the PMO is not the approver for every technical step.

## 2. Walk a normal handoff

Open **Use the agreed font across answer cards** (`work-assistant-03`). It starts in Development with Yusuf as the current owner and Leila as the delivery owner. Assign UAT to a delivery teammate and advance to UAT.

Record a passing UAT result with a synthetic evidence URL, then move to Ready for production and name the release owner. Enter deployment evidence when moving to Production verification. A production verifier records a pass before the item moves to Awaiting client acceptance.

The app is internal only. An internal owner records the actual client response and its evidence. Accepting closes the item. This is not automatic approval inferred from a test result or a meeting note.

## 3. Show a failed test and client rejection

Open **Keep citation links in the current answer** (`work-assistant-01`). Its blocking UAT failure remains unresolved. Attempting to advance should explain the unmet condition. Record the resolution and a valid current-cycle pass before progressing, or return it to Development with a reason and assigned owner.

Open **Improve the source freshness label** (`work-assistant-07`). Its first cycle passed internal checks, but the client rejected the wording. The same item is in Development, cycle two. Its prior evidence remains visible; it must complete the whole delivery and acceptance cycle again.

Open **Capture answer feedback with an optional reason** (`work-assistant-02`). It has passed internal production verification and is waiting for client acceptance. Use this to explain why "deployed," "verified," and "closed" must remain distinct in reporting.

## 4. Follow a blocker to its consequence

Open **Finance source access is overdue** (`reg-finance-access`). It links to both the access action and the blocked pipeline item, plus the at-risk UAT milestone. Arjun owns the next action; the next step is to obtain a dated access commitment.

Show the daily delivery meeting. Its linked actions and decisions are the same live records seen elsewhere. Meeting notes do not create a separate action tracker.

## 5. Confirm a workstream and prepare Thursday's brief

Switch to the relevant workstream lead and review the current weekly update. Confirm Data or Evaluation after reviewing its live facts. A later change to a relevant delivery record makes that confirmation stale again.

Switch back to Nadia to prepare a client-safe draft. Review completed work, next plans, dependencies, milestone forecasts, and confirmation coverage. The client draft uses client summaries, not internal descriptions or meeting notes.

The synthetic phrase `INTERNAL-ONLY-COMMERCIAL-NOTE` appears in the internal pilot support details (`work-assistant-05`, `reg-support-coverage`). It must not appear in a generated client draft, client export, or client AI request. Do not manually paste internal content into client report fields.

If optional AI is configured, request a wording proposal and inspect it before applying it. Otherwise edit the draft directly. Switch to **Omar Haddad**, the report approver, for publication. Incomplete confirmations require the explicit reason supported by the review workflow.

Open one of the two historical approved client reports. Its content and publication time stay fixed after live records change. Corrections should create a new report version linked to the approved snapshot.

## 6. Show nonsoftware work

Open **Accept the benchmark sampling approach** (`work-evaluation-01`) or **Baseline missing-value rates for priority fields** (`work-data-05`). Both are completed general work with review evidence. They use review and acceptance criteria without artificial deployment stages.

## Demo reference

| Persona / record | ID |
| --- | --- |
| Nadia, default PMO | `pmo-nadia` |
| Omar, report approver | `exec-omar` |
| Assistant lead / workstream | `lead-leila` / `ws-assistant` |
| Data lead / workstream | `lead-arjun` / `ws-data` |
| Evaluation lead / workstream | `lead-sara` / `ws-evaluation` |
| Closed software with recorded client acceptance | `work-assistant-09` |
| Current assistant / data confirmations | `submission-assistant-current` / `submission-data-current` |
| Historical approved client snapshots | `report-client-1` / `report-client-2` |

The walkthrough is a demo script, not a claim that a live service has been approved or that placeholder evidence has been independently verified.
