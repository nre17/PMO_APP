# Review checklist

Apply the checks relevant to the change and record what was actually verified. A screenshot supports visual review; it does not establish that saving or approval works.

- [ ] The change solves the stated user problem, with a clear primary action and understandable labels.
- [ ] Contributor, lead, PMO, and executive views expose the appropriate actions; server permissions remain authoritative.
- [ ] Delivery changes preserve test evidence, current-cycle gates, client acceptance, rework history, and optimistic version conflicts.
- [ ] Reporting changes respect the project timezone/cutoff, source freshness, immutable approved snapshots, and client-safe presentation data.
- [ ] Import changes retain row validation, explicit mapping, provenance, duplicate handling, and the absence of manufactured completion evidence.
- [ ] Edited flows work with keyboard navigation, visible focus, labelled controls, and usable contrast. Status meaning is not conveyed by colour alone.
- [ ] Relevant desktop and narrow layouts were inspected with real synthetic content, including long titles, empty results, and error states.
- [ ] Dialogs/drawers open and close predictably, protect unsaved work where needed, and restore focus appropriately.
- [ ] Successful actions have clear feedback; failures and stale edits provide a usable next step without silently losing input.
- [ ] UI evidence shows the rendered result, and critical actions were exercised through to their persisted outcome.
- [ ] `pnpm test` and `pnpm build` pass; documentation matches the final behaviour.
- [ ] The diff and attachments contain no client data, secrets, local database files, or generated exports.
