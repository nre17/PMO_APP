# Local walkthroughs

The portfolio and the fictional demonstration use separate profiles. Both use local preview roles, not corporate sign-in. Use synthetic business details while testing; the confirmed use-case names do not establish scope, ownership, delivery progress, or evidence.

## Start with the portfolio

The default `SEED_PROFILE=portfolio` opens `.data/portfolio`. It contains the ten confirmed use-case names, generic local preview roles, and no work items, deliverables, milestones, confirmations, or reports. Leads and lifecycle positions begin unassigned. Existing local data is preserved on restart.

1. Open Use cases and select a confirmed name. Record an agreed purpose, scope, lifecycle phase, priority, and next gate when those facts are known. Assign a lead explicitly; a preview persona is only a local role for exercising the UI.
2. Add a deliverable definition to that use case. Set its lifecycle phase and review status independently from technical work-item stages. Accepted deliverables require evidence.
3. Capture a work item, then agree ownership, a target, next action, and acceptance criteria before starting delivery. Link it to the deliverable.
4. Add a milestone with a baseline and current forecast. Link contributing use cases and deliverables explicitly. An association does not claim a critical path.
5. Review progress from Overview and Project meetings. Save discovery, working-session, or delivery-review notes and add a reviewed follow-up with an owner and date. Later edits retain version conflicts and linked records.
6. Review and confirm each use case's reporting position, prepare a draft for its audience, and use the appropriate preview role to exercise approval. An approved brief is a fixed edition; corrections preserve the original.

Leave unknown fields unassigned. A useful empty state is the correct result until work is recorded.

## Exercise the fictional workflow fixture

To use populated examples without changing the portfolio, stop the running server and start a separate local store:

```powershell
$env:SEED_PROFILE = 'demo'
$env:DATA_DIR = '.data/demo-walkthrough'
pnpm dev
```

These process environment values take precedence over `.env`. For the preserved earlier demonstration, explicitly choose `.data/pmo` instead. Changing the seed profile never rewrites a nonempty store. To return to the portfolio, stop the server and set `SEED_PROFILE=portfolio` and `DATA_DIR=.data/portfolio`.

A fresh fictional fixture contains Northstar's ten fictional people, three example use cases, thirty work items, and two historical client briefs. Dates are relative to store creation, so exact overdue counts change with the day of review.

- As Nadia Rahman, review finance access, the assistant pilot forecast, and current/stale/missing confirmations. Accountable ownership and the next action owner are distinct.
- Move **Use the agreed font across answer cards** (`work-assistant-03`) from Development to UAT. Record a passing UAT check, hand over for release, supply deployment evidence, and record a passing production-verification check. Then record an explicit client response. Acceptance closes the item; rejection starts a new cycle on the same record.
- Open **Keep citation links in the current answer** (`work-assistant-01`). Its blocking UAT finding prevents advancement until resolution and current-cycle evidence are recorded. Rework preserves earlier findings.
- Review `reg-finance-access` and its actual item/milestone links. Capture a follow-up in Project meetings; it becomes one linked project record.
- Confirm the example use cases, prepare a client draft, and review the wording. Switch to Omar Haddad to approve. Outstanding confirmations require a reason; that internal explanation is excluded from the presentation.
- Open either historical client brief. Its content and period remain fixed when current work changes. Create a correction to revise an approved edition.

The fixture includes `INTERNAL-ONLY-COMMERCIAL-NOTE` in internal support details. It must stay outside generated client report content and client AI requests. Do not manually copy internal material into client report fields. AI is optional; manual reporting and follow-up capture remain available without a key.

Software work follows Backlog → Development → UAT → Ready for production → Production verification → Awaiting client acceptance → Closed. General work follows Backlog → In progress → Review → Closed. Any delivery teammate can record checks and routine handovers; PMO approval is not required for each technical step.

## Restart and reset

Ordinary restart preserves records. `pnpm demo:reset` is a legacy command name: it archives the selected embedded store, and the next start seeds that profile again. Check `DATA_DIR` and `SEED_PROFILE`, and stop the server before using it. Use an isolated fixture directory for demonstrations instead of resetting the portfolio.
