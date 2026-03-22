# Push to GitHub - works even when Cursor locks .git (uses temp index workaround)
# Usage: .\git-full-push.ps1 "Your commit message"

param([string]$Message = "Initial commit: Singapore Food project")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$tempIndex = Join-Path $env:TEMP "git-index-$([guid]::NewGuid().ToString('N'))"
$tempIndex2 = Join-Path $env:TEMP "git-index-$([guid]::NewGuid().ToString('N'))"
$env:GIT_INDEX_FILE = $tempIndex

try {
    Write-Host "`n=== Push to GitHub ===" -ForegroundColor Cyan

    # 1. Stage using temp index (avoids .git/index lock)
    Write-Host "[1/4] Staging..." -ForegroundColor Yellow
    $prevErrPref = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    git rev-parse --verify HEAD 2>$null | Out-Null
    $hasCommits = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prevErrPref
    if ($hasCommits) { git read-tree HEAD | Out-Null }
    $ErrorActionPreference = 'Continue'
    $null = git add . 2>&1
    $ErrorActionPreference = $prevErrPref
    Copy-Item $tempIndex .git/index -Force -ErrorAction SilentlyContinue
    $env:GIT_INDEX_FILE = $null
    Remove-Item $tempIndex -ErrorAction SilentlyContinue

    $staged = git diff --cached --name-only
    if (-not $staged) {
        Write-Host "Nothing to commit." -ForegroundColor Gray
        exit 0
    }

    # 2. Commit using temp index (avoids .git/index lock)
    Copy-Item .git/index $tempIndex2 -Force
    $env:GIT_INDEX_FILE = $tempIndex2

    Write-Host "[2/4] Committing..." -ForegroundColor Yellow
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nIf you see 'unable to write' - double-click 'Push to GitHub.bat' in File Explorer (runs outside Cursor)." -ForegroundColor Red
        exit 1
    }
    Copy-Item $tempIndex2 .git/index -Force -ErrorAction SilentlyContinue
    $env:GIT_INDEX_FILE = $null
    Remove-Item $tempIndex2 -ErrorAction SilentlyContinue

    # 3. Branch
    Write-Host "[3/4] Setting main branch..." -ForegroundColor Yellow
    git branch -M main 2>$null

    # 4. Push
    Write-Host "[4/4] Pushing..." -ForegroundColor Yellow
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Push failed. Use GitHub Personal Access Token if prompted for password." -ForegroundColor Red
        exit 1
    }

    Write-Host "`nDone! https://github.com/tkcsg2026/singapore_food" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    $env:GIT_INDEX_FILE = $null
    Remove-Item $tempIndex, $tempIndex2 -ErrorAction SilentlyContinue
}
