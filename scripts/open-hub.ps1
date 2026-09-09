#Requires -Version 7.5
param(
    [switch]$Showcase,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$launchProfile = if ($Showcase) { 'showcase' } else { 'project' }
$port = if ($Showcase) { 4311 } else { 4310 }
$label = if ($Showcase) { 'Illustrative demonstration' } else { 'PMO project' }
$url = "http://127.0.0.1:$port/#overview"
$dataDir = Join-Path $projectRoot $(if ($Showcase) { '.data/showcase' } else { '.data/client' })
$ownershipPath = "$dataDir.pmo-lock"
$runtimeDir = Join-Path $projectRoot 'artifacts/runtime'
[System.IO.Directory]::CreateDirectory($runtimeDir) | Out-Null
$processRecordPath = Join-Path $runtimeDir "$launchProfile-process.json"

function Test-Listening {
    return @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $port }).Count -gt 0
}

function Read-Bootstrap {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/bootstrap" -NoProxy -TimeoutSec 2 -MaximumRedirection 0
}

function Confirm-Service($bootstrap) {
    if ($bootstrap.demoMode -ne $true -or -not $bootstrap.state.settings.projectName -or -not $bootstrap.currentUserId -or -not $bootstrap.state.members) {
        throw "Port $port does not provide the expected PMO application. Its process was left untouched."
    }
    $marker = $bootstrap.state.settings.demoScenario
    if (($Showcase -and $marker -ne 'consulting-lifecycle') -or (-not $Showcase -and $marker)) {
        throw "Port $port is serving a different workspace. Its process was left untouched."
    }
    if (-not (Test-Path -LiteralPath $ownershipPath -PathType Leaf)) {
        throw "Port $port is not verified as the selected local $launchProfile store. Its process was left untouched."
    }
    try {
        $owner = Get-Content -LiteralPath $ownershipPath -Raw | ConvertFrom-Json
        $ownerPid = [int]$owner.pid
        if ($ownerPid -le 0) { throw 'Invalid database owner.' }
        $listenerPids = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
    } catch {
        throw "Unable to verify which process owns port $port and the selected local store. No process was stopped."
    }
    if ($listenerPids.Count -ne 1 -or $listenerPids[0] -ne $ownerPid) {
        throw "Port $port belongs to a different process from the selected local store. No process was stopped."
    }
    return $ownerPid
}

function Save-ProcessRecord($record) {
    $temporaryPath = "$processRecordPath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText($temporaryPath, ($record | ConvertTo-Json))
        [System.IO.File]::Move($temporaryPath, $processRecordPath, $true)
    } finally {
        if ([System.IO.File]::Exists($temporaryPath)) { [System.IO.File]::Delete($temporaryPath) }
    }
}

function Read-PendingProcess {
    if (-not (Test-Path -LiteralPath $processRecordPath -PathType Leaf)) { return $null }
    try { $record = Get-Content -LiteralPath $processRecordPath -Raw | ConvertFrom-Json } catch {
        throw "The launcher process record cannot be read: $processRecordPath. Check the startup logs before retrying; no second server was started."
    }
    if ($record.profile -ne $launchProfile -or $record.port -ne $port -or $record.dataDir -ne $dataDir -or $record.projectRoot -ne $projectRoot) {
        throw 'The saved launcher record belongs to a different workspace. No second server was started.'
    }
    # A launcher interrupted between reserving this record and saving its PID
    # must not permit another launch while the first child may be starting.
    if ($record.status -eq 'launching') {
        throw "A previous launch was interrupted before its process could be recorded. Check $runtimeDir before retrying; no second server was started."
    }
    if ($record.launcherPid) {
        $pendingProcess = Get-Process -Id ([int]$record.launcherPid) -ErrorAction SilentlyContinue
        if ($pendingProcess) {
            $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($pendingProcess.Id)" -ErrorAction Stop
            $expectedEntry = '"' + (Join-Path $projectRoot 'server/index.ts') + '"'
            if ($pendingProcess.ProcessName -ne 'cmd' -or $pendingProcess.StartTime.ToUniversalTime().Ticks.ToString() -ne $record.launcherStartedTicks -or -not $processInfo.CommandLine.Contains($expectedEntry)) {
                throw 'The saved launcher PID no longer identifies the expected process. No process was stopped or started.'
            }
            foreach ($logPath in @($record.stdout, $record.stderr)) {
                if (-not $logPath -or [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($logPath)) -ne $runtimeDir) {
                    throw 'The saved startup log path is invalid. No second server was started.'
                }
            }
            return @{ process = $pendingProcess; record = $record }
        }
    }
    if ($record.pid -and (Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue)) {
        throw 'The recorded server is still running but is not listening yet. No second server was started; try opening the workspace again shortly.'
    }
    return $null
}

function Confirm-StoreAvailable {
    if (-not (Test-Path -LiteralPath $ownershipPath -PathType Leaf)) { return }
    try {
        $owner = Get-Content -LiteralPath $ownershipPath -Raw | ConvertFrom-Json
        $ownerPid = [int]$owner.pid
        if ($ownerPid -le 0) { throw 'Invalid owner PID.' }
    } catch { throw 'The selected database ownership record cannot be verified. No second server was started.' }
    if (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue) {
        throw 'The selected database is already owned by a running process. No second server was started; check the existing startup logs.'
    }
    # The server itself safely recovers a dead database owner; the launcher
    # never removes, replaces, or bypasses a database ownership lock.
}

# The OS releases this lock even if the launcher window closes unexpectedly.
$launcherLock = $null
try {
    try {
        $launcherLock = [System.IO.File]::Open((Join-Path $runtimeDir "open-$launchProfile.lock"), [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        throw "Another launcher is already opening the $label. Wait for it to finish, then try again."
    }

    $serverPid = $null
    $started = $false
    $stdoutPath = $null
    $stderrPath = $null
    if (Test-Listening) {
        try { $bootstrap = Read-Bootstrap } catch { throw "Port $port is occupied but the PMO application is not responding. Its process was left untouched." }
        $serverPid = Confirm-Service $bootstrap
    } else {
        $pending = Read-PendingProcess
        if ($pending) {
            $child = $pending.process
            $record = $pending.record
            $stdoutPath = $record.stdout
            $stderrPath = $record.stderr
            Write-Host "Waiting for the existing $label startup (launcher PID $($child.Id))..."
        } else {
        Confirm-StoreAvailable
        $runtimeRoot = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $runtimeRoot 'node/bin/node.exe' }
        if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
            throw 'Node.js was not found. Install Node.js 24 or use the Codex bundled runtime.'
        }
        $nodeVersion = & $nodePath --version
        if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 24) {
            throw 'This launcher requires Node.js 24 or later.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/tsx/package.json') -PathType Leaf)) {
            throw 'Project dependencies are missing. Run scripts/start.ps1 -Install -Task build first.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/client/index.html') -PathType Leaf)) {
            Write-Host 'Building the application for its first launch...'
            & (Join-Path $PSScriptRoot 'start.ps1') -Task build
        }

        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $stdoutPath = Join-Path $runtimeDir "$launchProfile-$stamp.stdout.log"
        $stderrPath = Join-Path $runtimeDir "$launchProfile-$stamp.stderr.log"
        $entryPath = Join-Path $projectRoot 'server/index.ts'
        # Start-Process joins arguments into a Windows command line. Quote the
        # verified entry path explicitly; all other arguments are fixed literals.
        if ($entryPath.Contains('"')) { throw 'The application path contains an unsupported quote.' }
        $childEnvironment = @{
            APP_MODE = 'demo'; HOST = '127.0.0.1'; PORT = [string]$port
            SEED_PROFILE = $launchProfile; DATA_DIR = $dataDir; DATABASE_URL = ''
        }
        # Native redirection keeps log handles in the detached process, rather
        # than leaving PowerShell's redirect-copy threads attached to the caller.
        # PowerShell 7.5+ retains an explicitly empty process environment value.
        $savedEnvironment = @{}
        $record = [pscustomobject]@{ status = 'launching'; profile = $launchProfile; launcherPid = $null; launcherStartedTicks = $null; pid = $null; port = $port; dataDir = $dataDir; projectRoot = $projectRoot; startedAt = (Get-Date).ToUniversalTime().ToString('o'); stdout = $stdoutPath; stderr = $stderrPath }
        try {
            foreach ($key in $childEnvironment.Keys) {
                $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
                [Environment]::SetEnvironmentVariable($key, $childEnvironment[$key], 'Process')
            }
            foreach ($fixedPath in @($nodePath, $entryPath, $stdoutPath, $stderrPath)) {
                if ($fixedPath -match '["%!\r\n]') { throw 'The application path contains characters unsupported by this Windows launcher.' }
            }
            $command = '""' + $nodePath + '" --import tsx "' + $entryPath + '" --production >"' + $stdoutPath + '" 2>"' + $stderrPath + '" <NUL"'
            Save-ProcessRecord $record
            try {
                $child = Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList @('/d', '/s', '/c', $command) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
            } catch {
                $record.status = 'failed'
                Save-ProcessRecord $record
                throw
            }
            $record.launcherPid = $child.Id
            $record.launcherStartedTicks = $child.StartTime.ToUniversalTime().Ticks.ToString()
            $record.status = 'starting'
            Save-ProcessRecord $record
        } finally {
            foreach ($key in $savedEnvironment.Keys) {
                # PowerShell otherwise converts $null to an empty .NET string.
                $originalValue = if ($null -eq $savedEnvironment[$key]) { [NullString]::Value } else { $savedEnvironment[$key] }
                [Environment]::SetEnvironmentVariable($key, $originalValue, 'Process')
            }
        }
        $started = $true
        Write-Host "Starting $label in the background (launcher PID $($child.Id))..."
        }
        $clock = [System.Diagnostics.Stopwatch]::StartNew()
        do {
            $child.Refresh()
            if ($child.HasExited) {
                throw "The server stopped before it was ready. See $stderrPath and $stdoutPath. No data was reset."
            }
            $bootstrap = $null
            try { $bootstrap = Read-Bootstrap } catch { }
            if ($bootstrap) {
                $serverPid = Confirm-Service $bootstrap
                $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction Stop
                if ($serverProcess.ParentProcessId -ne $child.Id) { throw 'Another process acquired the port during startup. No process was stopped.' }
                break
            }
            Start-Sleep -Milliseconds 500
        } while ($clock.Elapsed.TotalSeconds -lt 50)
        if (-not $serverPid) {
            Write-Host "$label is still starting in the background. Double-click its launcher again to wait for the same process."
            Write-Host "Startup logs: $stderrPath and $stdoutPath"
            [pscustomobject]@{ Status = 'starting'; Profile = $launchProfile; Url = $url; LauncherProcessId = $child.Id; Started = $started; Stdout = $stdoutPath; Stderr = $stderrPath }
            if (-not $NoBrowser) { exit 2 }
            return
        }
        $record.pid = $serverPid
        $record.status = 'ready'
        Save-ProcessRecord $record
    }

    Write-Host "$label is ready: $url (PID $serverPid)"
    if (-not $NoBrowser) { Start-Process -FilePath $url | Out-Null }
    [pscustomobject]@{ Status = 'ready'; Profile = $launchProfile; Url = $url; ProcessId = $serverPid; Started = $started; Stdout = $stdoutPath; Stderr = $stderrPath }
} finally {
    if ($launcherLock) { $launcherLock.Dispose() }
}
