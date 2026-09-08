# Contributing

This repository contains the local PMO demonstrator. `main` is the reviewable baseline; the redesign is developed on `codex/design-overhaul` and reviewed through a pull request into `main`. Future changes use a focused `codex/<description>` branch from the current baseline. Keep each pull request small enough to explain and verify.

Use Node.js 24 and pnpm 11.19.0, matching CI. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The app runs on loopback with generic local preview roles and persistent local data. The default portfolio contains the confirmed use-case names with no invented scope, ownership, or delivery evidence. `SEED_PROFILE=demo` selects the separate fictional Northstar fixture. Follow [the README](../README.md) for configuration and restart behaviour. Use `pnpm demo:reset` only when intentionally archiving the selected local store; ordinary restarts preserve edits.

1. Describe the user problem and acceptance examples in an issue or the pull request.
2. Make the change on the appropriate branch. Follow the current [design contract](../DESIGN.md) and its linked references for UI work.
3. Run `pnpm test` and `pnpm build`. The build includes TypeScript checking. Add regression coverage when behaviour or a domain invariant changes; use browser review for layout and interaction changes.
4. Complete the relevant [review checks](REVIEW-CHECKLIST.md). Include screenshots and the scenarios actually exercised for UI changes.
5. Open a pull request into `main`, describe remaining limitations, and resolve review feedback before merging. CI runs the locked installation, tests, and build on Linux and Windows.

Keep local databases, exports, `.env` values, credentials, and client information out of commits and issue attachments. Dependency changes should include the updated lockfile. CI validates the application; it does not deploy it or establish corporate approval for live data.

The workflow uses the documented action majors from [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node), and [pnpm/action-setup](https://github.com/pnpm/action-setup), rechecked on 8 September 2026. Keep the pnpm version here and in CI aligned when changing the package manager.
