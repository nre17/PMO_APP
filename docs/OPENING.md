# Open the local PMO workspace

Double-click **Open PMO.cmd** in the project folder to open the full project workspace at `http://127.0.0.1:4310/#overview`. It uses the saved `.data/client` store. Double-click **Open Demo.cmd** for the populated synthetic demonstration at `http://127.0.0.1:4311/#overview`, using `.data/showcase`.

You already have the complete project in this `PMO_APP` folder; no GitHub ZIP is needed to open it. **Open Demo.cmd** reopens the saved review and its edits. It does not recreate the demonstration each time.

The launcher starts the server in the background when needed, waits until it responds, then opens your default browser. A healthy server is reused only after its application marker and database-owning process match the selected workspace. Closing the launcher or browser does not stop the server. Shutting down or restarting Windows stops it, but the build and saved data remain on disk. Double-click the launcher after startup to continue. Sleep usually suspends the running process; after waking, use the launcher again if the workspace does not respond.

## What the folders do

Keep the **whole project folder** together. `src/` is one part of the app:

| File or folder | Purpose |
| --- | --- |
| `src/` | The browser interface. `.tsx` files define React screens and controls using TypeScript; `.ts` files hold interface logic; `.css` files control appearance. |
| `server/` | TypeScript code run by Node.js: the API, permissions, workflows and access to saved data. |
| `shared/` | Data definitions and rules used by both the interface and server. |
| `package.json` | The project's dependency list and commands such as `build`, `start` and `test`. Installed dependencies live in `node_modules/`. |
| `dist/client/` | Generated browser files from the build. These stay on disk until rebuilt or removed. |
| `.data/` | Local saved workspaces, including the project and demonstration databases. |
| `docs/` and `.md` files | Human-readable Markdown guides and project documentation. |
| `.github/` | GitHub issue/PR templates and `.yml`/YAML configuration for automated checks. These do not run the local app. |

The browser talks to the Node server, which reads and saves the selected database. **Build** checks the TypeScript and packages the browser interface into `dist/client/`; **run** starts the server so the browser can use it. The server still needs the project code and installed dependencies.

GitHub's website displays and stores the code; browsing a repository folder does not run this app. A GitHub ZIP or clean clone contains the tracked source, without installed dependencies, build output or local saved data. It therefore is not an exact copy of this populated local review. A new copy needs dependencies and a build before running, and starts from its selected seed unless saved data is supplied separately.

## Open and present

A slow first start may show **still starting** after 50 seconds. The server keeps starting in the background. Double-click the same launcher again to wait for that recorded process; this does not start a competing server. The browser opens once the workspace is ready.

For a manager screen-share, open the demo as **Maya Haddad · PMO**, a fictional team member, and choose **5-minute tour** in its **Manager review · Illustrative data** banner. Four stops cover the portfolio, adding work and a UAT check, an escalation, and report preparation. **Reports → New draft** starts a new brief even when prepared reports already exist. The saved **Month three · Programme review** remains available in **Reports → Previous editions**. The scenario starts with **10/10 fresh use-case confirmations**; practice changes can require reconfirmation. Follow the [five-minute walkthrough](SHOWCASE.md) for the exact sequence.

Prepared evidence references open contextual **`/evidence/:id`** specimens in the showcase. They contain illustrative review details and connected work, with **Back to workspace** and **Print specimen** actions. Opening a specimen does not change the work or record approval. When moving between browsers, use the full workspace URL above to present the hub; an evidence-page URL opens that specimen.

The launchers use Node.js 24 or later, PowerShell 7.5 or later, and the existing installed project dependencies. They find installed or Codex bundled runtimes without changing PowerShell execution policy. If the compiled app is absent, the launcher runs the existing build script once. After changing application code, rebuild with `scripts/start.ps1 -Task build` and restart the relevant server: the running server registered its asset paths at startup.

To start or verify a workspace without opening a browser, run in PowerShell 7:

```powershell
./scripts/open-hub.ps1 -NoBrowser
./scripts/open-hub.ps1 -Showcase -NoBrowser
```

The result includes the exact workspace URL and process ID. Startup logs and process details stay in ignored `artifacts/runtime/`. If a port belongs to another service, the launcher stops with an explanation and leaves that process alone. It never resets the database.

Each server receives its profile, local storage path, loopback address and an empty external database setting in its own process. Your `.env` file and terminal environment remain unchanged. These are local launchers; they do not publish or host the application on Replit.
