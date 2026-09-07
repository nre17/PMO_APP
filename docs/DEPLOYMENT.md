# Deployment readiness

This release is a **standalone local demonstrator**. It has application role checks and a demo persona selector, but it does not authenticate corporate identities. `APP_MODE=live` must refuse startup until real identity is implemented. Keep the demo on the local computer with synthetic data.

## Available now

- One Node server serves the API and built browser app.
- Local embedded PostgreSQL persistence uses PGlite; `DATABASE_URL` selects a standard PostgreSQL database.
- Version checks, transactions, and audit records support the demonstrated delivery workflows.
- AI is optional and runs through the server. Client drafting receives the selected client-safe report content.
- A Docker build packages the same server and built browser assets. The image defaults to live mode so running it without an explicit configuration cannot silently expose the unauthenticated demo.

Database compatibility and a container are preparation for deployment. They do not establish an approved hosting location, real identity, or permission to process project information.

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

The current store creates version-one control and entity tables and seeds fictional content only when the selected database is empty. Existing data persists across restart. Local demo reset archives the existing store before a fresh seed; it refuses external PostgreSQL and is not a migration procedure. Do not connect this demonstrator to a valuable database.

## Required before real project use

1. **Confirm the environment and data boundary.** Agree the company/client-approved hosting tenant, region, information classification, processing policy, and service owner. Hosting has not been chosen in this demonstrator.
2. **Implement corporate Entra OIDC.** Validate issuer, tenant, audience, signature, and token lifetime through the approved identity flow. Establish server-controlled sessions, sign-out and session expiry. Replace demo identity selection with authenticated membership mapping and authorization. Remove or disable all demo role-switch and reset paths in live mode. Test cross-role and unauthenticated requests directly against the API.
3. **Provision managed PostgreSQL.** Establish least-privilege database access, approved secret storage, migrations, backup retention, and a tested restore procedure. Move to an approved source-data import process; never carry synthetic people, decisions, or acceptances into a real project.
4. **Establish application operations.** Configure HTTPS, secure session cookies, ingress restrictions, logging and alerting, health checks, upgrade ownership, and dependency maintenance. Validate upload limits, report access, exports, record isolation, and recovery in the target environment.
5. **Approve optional AI processing.** Confirm the authorized provider, deployment/model, retention terms, and permitted fields before enabling a key. Keep manual workflows available. Evaluate factual grounding and client/internal content separation with representative approved test cases.
6. **Pilot the operating model.** Confirm who owns each workstream, who records the client response, who approves reports, and Thursday's cutoff. Run two reporting cycles with a small group, reconcile imported backlog rows, and measure update effort, ownership coverage, and report preparation time.

Complete those changes and verification before enabling live startup. Do not remove the startup guard simply to host the demo.
