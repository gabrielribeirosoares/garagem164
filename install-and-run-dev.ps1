<#
PowerShell helper script: install-and-run-dev.ps1

Usage:
  Open PowerShell in the project root and run:
    powershell -ExecutionPolicy Bypass -File .\install-and-run-dev.ps1
  or, if policies permit:
    .\install-and-run-dev.ps1

What it does:
  - Checks if 'npm' is available on PATH. If yes, runs 'npm install'.
  - If 'npm' is not on PATH, tries to locate 'node.exe' in common locations and looks for npm-cli.js
    relative to that installation (node_dir\node_modules\npm\bin\npm-cli.js).
  - Executes dependency installation via 'node.exe npm-cli.js install' when possible.
  - When node_modules exists, starts the Vite dev server using:
      node.exe node_modules\vite\bin\vite.js dev

Notes:
  - If PowerShell blocks script execution, run with -ExecutionPolicy Bypass.
  - The script tries common nvm and Program Files paths; adjust manually if needed.
#>

param(
    [string] $ProjectPath = (Get-Location).Path
)

function Write-Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Set-Location -Path $ProjectPath
Write-Info "Project: $ProjectPath"

# Helper to run a command and show output
function Run-Command($exe, $args) {
    Write-Info "Running: $exe $args"
    & $exe $args
    return $LASTEXITCODE
}

# 1) Try npm directly
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Info "npm found on PATH. Running 'npm install'..."
    $code = Run-Command npm "install"
    if ($code -ne 0) { Write-Warn "npm install returned code $code" }
} else {
    Write-Warn "npm not found on PATH. Searching for node.exe and npm-cli.js..."

    # Try to find node.exe
    $nodePaths = @()
    # Prefer the user's nvm node (if commonly installed)
    $nodePaths += 'C:\Users\eduar\AppData\Local\nvm\v22.19.0\node.exe'
    # other common locations
    $nodePaths += 'C:\nvm4w\nodejs\node.exe'
    $nodePaths += 'C:\Program Files\nodejs\node.exe'

    # Look under user's AppData Local nvm folders (common for nvm-windows)
    try {
        $nvmRoot = Join-Path $env:USERPROFILE 'AppData\Local\nvm'
        if (Test-Path $nvmRoot) {
            $nodePaths += Get-ChildItem -Path $nvmRoot -Filter node.exe -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
        }
    } catch {}

    # Also try 'node' on PATH if present
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodePaths += $nodeCmd.Source }

    # Deduplicate and only keep existing paths
    $nodePaths = $nodePaths | Where-Object { Test-Path $_ } | Select-Object -Unique

    Write-Info "Candidate node.exe paths (existing):"
    $nodePaths | ForEach-Object { Write-Info " - $_" }


    if ($nodePaths.Count -eq 0) {
        Write-Err "Could not locate node.exe. Install Node.js or add npm to PATH and try again."
        exit 2
    }

    $nodeExe = $nodePaths[0]
    Write-Info "Using node: $nodeExe"

    # Try to locate npm-cli.js relative to node installation
    $npmCliCandidates = @()
    $nodeDir = Split-Path -Parent $nodeExe
    $npmCliCandidates += Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
    $npmCliCandidates += Join-Path (Split-Path $nodeDir -Parent) 'node_modules\npm\bin\npm-cli.js'
    $npmCliCandidates += 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
    # Also try the other known nvm installation
    $npmCliCandidates += 'C:\Users\eduar\AppData\Local\nvm\v22.19.0\node_modules\npm\bin\npm-cli.js'

    # Search a bit under nodeDir
    try {
        $found = Get-ChildItem -Path $nodeDir -Recurse -Filter npm-cli.js -ErrorAction SilentlyContinue | Select-Object -First 5
        if ($found) { $npmCliCandidates += $found | ForEach-Object { $_.FullName } }
    } catch {}

    Write-Info "npm-cli candidate paths (before filtering):"
    $npmCliCandidates | ForEach-Object { Write-Info " - $_" }

    $npmCliCandidates = $npmCliCandidates | Where-Object { Test-Path $_ } | Select-Object -Unique

    Write-Info "npm-cli candidate paths (existing):"
    if ($npmCliCandidates.Count -eq 0) {
        Write-Warn "(none found)"
    } else {
        $npmCliCandidates | ForEach-Object { Write-Info " - $_" }
    }

    if ($npmCliCandidates.Count -eq 0) {
        Write-Warn "npm-cli.js not found automatically. Trying fallback using node -e to run 'npm install'..."
        try {
            & $nodeExe -e "require('child_process').execSync('npm install', { stdio: 'inherit' })"
            if ($LASTEXITCODE -ne 0) { Write-Warn "Fallback via node -e returned code $LASTEXITCODE" }
        } catch {
            Write-Err "Fallback failed. Could not run npm install automatically. Please install npm or run 'npm install' manually in the project directory."
            exit 3
        }
    } else {
        # Prefer npm-cli located under the user's nvm v22.19.0 if present
        $preferred = $npmCliCandidates | Where-Object { $_ -like '*v22.19.0*' } | Select-Object -First 1
        if ($preferred) { $npmCli = $preferred } else { $npmCli = $npmCliCandidates[0] }
        Write-Info "npm-cli chosen: $npmCli"
        # Run npm install via node and npm-cli (pass args as separate params)
        Write-Info "Running: $nodeExe $npmCli install"
        # Ensure the node directory is on PATH so subprocesses calling 'node' can find it
        $nodeDirForPath = Split-Path -Parent $nodeExe
        Write-Info "Prepending node dir to PATH: $nodeDirForPath"
        $env:PATH = "$nodeDirForPath;$env:PATH"
        & $nodeExe $npmCli install
        $code = $LASTEXITCODE
        if ($code -ne 0) { Write-Warn "Install via npm-cli.js returned code $code" }
    }
}

# Verify node_modules exists
if (-not (Test-Path (Join-Path $ProjectPath 'node_modules'))) {
    Write-Err "node_modules does not exist after install attempt. Check errors above and run 'npm install' manually."
    exit 4
}

# Start Vite dev server
$viteJs = Join-Path $ProjectPath 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteJs)) {
    Write-Err "vite not found in node_modules (expected at: $viteJs). Verify installation succeeded."
    exit 5
}

Write-Info "Starting Vite dev server... (Ctrl+C to stop)"
# Run in the current console so the user can see logs
& $nodeExe $viteJs dev

Write-Info "Vite process exited."