# Workaround for "fatal: unable to write new index file" (when Cursor locks .git)
# Usage: .\git-add-fix.ps1 [path]
#   .\git-add-fix.ps1 .        - add all files
#   .\git-add-fix.ps1 src/     - add src folder

param([string]$Path = ".")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$tempIndex = Join-Path $env:TEMP "git-index-$([guid]::NewGuid().ToString('N'))"
$env:GIT_INDEX_FILE = $tempIndex

try {
    # Only read existing tree if we have commits (avoids error on initial commit)
    $prevErrPref = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    git rev-parse --verify HEAD 2>$null | Out-Null
    $hasCommits = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prevErrPref
    if ($hasCommits) { git read-tree HEAD | Out-Null }
    $ErrorActionPreference = 'Continue'
    $addResult = git add $Path 2>&1
    $ErrorActionPreference = $prevErrPref
    $addResult | Where-Object { $_ -notmatch "^warning:" } | ForEach-Object { Write-Host $_ }
    Copy-Item $tempIndex .git/index -Force
    Write-Host "Staged successfully." -ForegroundColor Green
    git status --short
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item $tempIndex -ErrorAction SilentlyContinue
    $env:GIT_INDEX_FILE = $null
}
