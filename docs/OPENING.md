# Open the local PMO workspace

Double-click **Open PMO.cmd** in the project folder to open the full project workspace at `http://127.0.0.1:4310/#overview`. It uses the saved `.data/client` store. Double-click **Open Demo.cmd** for the populated synthetic demonstration at `http://127.0.0.1:4311/#overview`, using `.data/showcase`.

The launcher starts the server in the background when needed, waits until it responds, then opens your default browser. A healthy server is reused only after its application marker and database-owning process match the selected workspace. Closing the launcher or browser does not stop the server. Windows restart stops it; double-click the launcher again to continue with your saved data.

A slow first start may show **still starting** after 50 seconds. The server keeps starting in the background. Double-click the same launcher again to wait for that recorded process; this does not start a competing server. The browser opens once the workspace is ready.

An **illustrative evidence** page is a separate sample attachment. Its return link opens the workspace. When moving between browsers, use the full workspace URL above; copying an evidence-page URL opens that same attachment.

The launchers use Node.js 24 or later, PowerShell 7.5 or later, and the existing installed project dependencies. They find installed or Codex bundled runtimes without changing PowerShell execution policy. If the compiled app is absent, the launcher runs the existing build script once. After changing application code, rebuild with `scripts/start.ps1 -Task build` and restart the relevant server: the running server registered its asset paths at startup.

To start or verify a workspace without opening a browser, run in PowerShell 7:

```powershell
./scripts/open-hub.ps1 -NoBrowser
./scripts/open-hub.ps1 -Showcase -NoBrowser
```

The result includes the exact workspace URL and process ID. Startup logs and process details stay in ignored `artifacts/runtime/`. If a port belongs to another service, the launcher stops with an explanation and leaves that process alone. It never resets the database.

Each server receives its profile, local storage path, loopback address and an empty external database setting in its own process. Your `.env` file and terminal environment remain unchanged. These are local launchers; they do not publish or host the application on Replit.
