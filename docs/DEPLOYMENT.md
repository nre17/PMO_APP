# Replit deployment plan

**Replit is the selected deployment target**, confirmed by the project owner on 8 September 2026. The desktop design, portfolio model, workflows and reporting continue from this repository. Choosing Replit does not require a product rewrite.

This release is a **standalone local preview**. It has application role checks and a local persona selector, but it does not authenticate corporate identities. `APP_MODE=live` refuses startup until real identity is implemented. The confirmed use-case names are not an assertion of ownership, scope, delivery progress, or permission to process client information.

## Available now

- One Node server serves the API and built browser app.
- Local embedded PostgreSQL persistence uses PGlite; `DATABASE_URL` selects a standard PostgreSQL database. The default `SEED_PROFILE=portfolio` uses `.data/portfolio`; `SEED_PROFILE=demo` uses the separate `.data/pmo` fixture store unless `DATA_DIR` is explicitly set.
- Version checks, transactions, and audit records support the demonstrated delivery workflows.
- AI is optional and runs through the server. Client drafting receives the selected client-safe report content.
- A Docker build packages the same server and built browser assets. The image defaults to live mode so running it without an explicit configuration cannot silently expose the unauthenticated demo.

Database compatibility and a container are preparation for deployment. They do not establish an approved hosting location, real identity, or permission to process project information.

## Replit deployment target

The implementation target is the existing Node server serving both the built React app and `/api` from one origin. GitHub remains the source of reviewed code. Import the current review branch, `codex/design-overhaul`, until PR #1 is merged; then use `main`. This section describes planned integration, not an already tested Replit deployment.

| Area | Replit integration |
| --- | --- |
| Runtime | Keep Node.js 24 and pnpm 11.19.0. Verify those versions in the Replit project environment. Install with `pnpm install --frozen-lockfile`, build with `pnpm build`, run with `pnpm start`. The start command currently needs development dependencies, including `tsx`, so do not prune them from the runtime installation. |
| Web hosting | Plan for Autoscale after shared state is implemented. Static hosting cannot run this API. Reserved VM is an alternative if an always-on process becomes necessary. |
| Network | Add an authenticated hosted mode that binds to `0.0.0.0`, uses `PORT`, and validates the configured app origin. If explicit port mapping is used, map local port `4310` to external port `80`. Both the localhost bind guard in `server/index.ts` and API host/origin checks in `server/app.ts` need deliberate hosted implementations. |
| Records | Use a dedicated PostgreSQL database through the existing `DATABASE_URL` adapter. Replit's SQL database is a candidate. Keep development and production databases separate; validate transactions, concurrent edits and restore against the selected service. Local `.data` files are not production storage. |
| Identity | Replace preview personas with verified team identities and server-side PMO role membership. Entra OIDC remains a candidate; choose the actual connection with the project owner. Replit private access can provide an additional entry restriction, but the app still needs to identify who performs and approves each action. |
| Shared state | Replace in-memory sessions, import previews and AI rate-limit counters with shared, expiring state or an appropriate stateless design before Autoscale. An import must remain bound to its authenticated creator across requests. |
| Configuration | Set database and identity credentials in the published environment's Secrets. Keep optional AI credentials server-side. Add HTTPS session-cookie settings, a lightweight health endpoint and a controlled first-user provisioning path. |
| Documents | Current artifacts store evidence links; they do not upload files. If attachments are added, use object storage. Keep local source ZIPs out of the repository and deployment bundle. |

Replit documents [deployment types](https://docs.replit.com/features/publishing/deployment-types), [host/port, production Secrets and non-persistent deployment files](https://docs.replit.com/build/troubleshooting), and [SQL storage](https://docs.replit.com/features/data-and-storage/sql-database). Its [private access settings](https://docs.replit.com/features/publishing/private-deployments) control who can open an app. App-level corporate SSO is a separate integration; Replit also documents an [Entra-compatible Clerk route](https://docs.replit.com/features/auth-and-identity/single-sign-on). No authentication provider has been provisioned or selected by this hosting decision. Sources checked 8 September 2026.

The next implementation slice is **hosted identity + PostgreSQL + shared request state + Replit startup configuration**, followed by a small team pilot. Verify sign-in, role restrictions, restart persistence, import continuity, concurrent updates and approved report access on the actual Replit URL. Add the executable `.replit` configuration with that slice so it describes a working hosted mode. The present localhost and live-mode guards remain in place until then.

## Local build

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm start
```

Use Node.js 24 and the repository's pnpm lockfile. The default browser address is `http://127.0.0.1:4310`. Keep `HOST=127.0.0.1` for the demonstrator. Never publish its port with a tunnel or reverse proxy to make a demo persona act as live authentication.

To package the application:

```powershell
docker build -t phase-two-delivery-hub:demo .
```

The image runs as an unprivileged user and includes the TypeScript runtime required by `server/index.ts`. Its default `APP_MODE=live` is intentionally rejected by the present server. The supported local demonstration path is the loopback Node process above; the image is a build artifact for the later approved deployment work.

## Standard PostgreSQL configuration

For an isolated development database, set `DATABASE_URL` to its connection string before starting the server. Use environment variables or a local ignored `.env`; do not commit credentials or bake them into an image. Follow the database provider's approved TLS configuration for the eventual shared environment.

The current store creates its control and entity tables and seeds only when the selected database is empty. The portfolio profile starts with the ten confirmed use-case names and generic preview roles; ownership, lifecycle facts, and delivery records remain unassigned. The demo profile supplies the fictional Northstar walkthrough. Neither profile replaces existing data. Existing `DATA_DIR` values in `.env` or the process environment override the profile's default path; check them when changing profiles.

Local reset archives the selected embedded store before a fresh seed; it refuses external PostgreSQL and is not a migration procedure. The earlier `.data/pmo` store is preserved separately from `.data/portfolio`. Do not connect the preview to a valuable database. `DATABASE_URL` selects one external database, so two different seed-profile values do not isolate records when the connection string is the same.

## Required before real project use

1. **Configure the selected Replit environment.** Confirm the company/client workspace, region, information classification, processing policy, and service owner for the team rollout. The hosting platform is chosen; these workspace and access details remain to be established.
2. **Implement corporate identity.** Use the agreed provider, with Entra OIDC as the current candidate. Validate issuer, tenant, audience, signature, and token lifetime through the approved identity flow. Establish server-controlled sessions, sign-out and session expiry. Replace demo identity selection with authenticated membership mapping and authorization. Remove or disable all demo role-switch and reset paths in live mode. Test cross-role and unauthenticated requests directly against the API.
3. **Provision managed PostgreSQL.** Establish least-privilege database access, approved secret storage, migrations, backup retention, and a tested restore procedure. Move to an approved source-data import process; never carry synthetic people, decisions, or acceptances into a real project.
4. **Establish application operations.** Configure HTTPS, secure session cookies, ingress restrictions, logging and alerting, health checks, upgrade ownership, and dependency maintenance. Validate upload limits, report access, exports, record isolation, and recovery in the target environment.
5. **Approve optional AI processing.** Confirm the authorized provider, deployment/model, retention terms, and permitted fields before enabling a key. Keep manual workflows available. Evaluate factual grounding and client/internal content separation with representative approved test cases.
6. **Pilot the operating model.** Confirm who owns each workstream, who records the client response, who approves reports, and Thursday's cutoff. Run two reporting cycles with a small group, reconcile imported backlog rows, and measure update effort, ownership coverage, and report preparation time.

Complete those changes and verification before enabling live startup. Do not remove the startup guard simply to host the demo.
