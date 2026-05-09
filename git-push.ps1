# Push to GitHub - run in external terminal (outside Cursor) for best results
# Usage: .\git-push.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== Git Push to GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull with merge
Write-Host "[1/2] Pulling from origin/main..." -ForegroundColor Yellow
git pull origin main --no-rebase 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPull failed. You may need to resolve merge conflicts manually." -ForegroundColor Red
    exit 1
}

# Step 2: Push
Write-Host "`n[2/2] Pushing to origin/main..." -ForegroundColor Yellow
git push origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPush failed. Check your GitHub credentials and network." -ForegroundColor Red
    exit 1
}

Write-Host "`nDone! Successfully pushed to GitHub." -ForegroundColor Green
Write-Host ""
