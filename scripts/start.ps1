param(
    [ValidateSet('dev', 'build', 'start', 'check', 'test', 'demo:reset')]
    [string]$Task = 'dev',
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$originalPath = $env:PATH

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nodeCommand) {
    $nodePath = $nodeCommand.Source
} else {
    $nodePath = Join-Path $runtimeRoot 'node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
    throw 'Node.js was not found. Install Node.js 24 or use a Codex desktop runtime with Node available.'
}

$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pnpmCommand) {
    $pnpmPath = $pnpmCommand.Source
} else {
    $pnpmPath = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
}
if (-not (Test-Path -LiteralPath $pnpmPath -PathType Leaf)) {
    throw 'pnpm was not found. Install pnpm or use the Codex bundled runtime.'
}

try {
    $env:PATH = "$(Split-Path -Parent $nodePath);$(Split-Path -Parent $pnpmPath);$originalPath"
    $nodeVersion = & $nodePath --version
    if ($LASTEXITCODE -ne 0) { throw 'Unable to run Node.js.' }
    if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 24) {
        throw "Node.js 24 or later is required by this launcher. Found $nodeVersion."
    }
    Push-Location -LiteralPath $projectRoot
    try {
        if ($Install) {
            Write-Host 'Installing project dependencies with pnpm...'
            & $pnpmPath install
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        }
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
            throw 'Dependencies are not installed. Run this script with -Install first.'
        }
        Write-Host "Running pnpm $Task from $projectRoot"
        & $pnpmPath run $Task
        if ($LASTEXITCODE -ne 0) { throw "pnpm $Task exited with code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
} finally {
    $env:PATH = $originalPath
}
