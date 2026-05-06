#Requires -Version 5.1
<#
.SYNOPSIS
  Workaround for Windows "fatal: unable to write new index file" / "couldn't set 'refs/heads/main'"
  when Git cannot atomically rename files under .git (same class of issue as Next.js EBUSY on E:).

.DESCRIPTION
  1) Creates a git bundle from this repo (read-mostly; usually works on the same drive)
  2) Clones it under $env:TEMP (often C:), where ref writes succeed
  3) Robocopies your working tree over the clone (excluding .git)
  4) Commits and pushes to origin

.PARAMETER Message
  Commit message (required). Commits in temp clone if there are working tree changes.

.PARAMETER Branch
  Branch to push (default: main)

.PARAMETER SkipPush
  Only prepare temp repo and commit; do not push

.EXAMPLE
  cd "E:\My project\singapore\singapore_food"
  .\scripts\git-push-from-temp.ps1 -Message "fix: dashboard layout"
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $Message,
  [string] $Branch = "main",
  [switch] $SkipPush
)

$ErrorActionPreference = "Stop"
Remove-Item Env:GIT_TRACE -ErrorAction SilentlyContinue

$GitExe = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $GitExe)) {
  $GitExe = "git"
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$RemoteUrl = (& $GitExe -C $RepoRoot config --get remote.origin.url).Trim()
if (-not $RemoteUrl) {
  throw "No remote.origin.url in this repo. Add origin first: git remote add origin <url>"
}

# Best-effort: stale lock from a crashed git
$lock = Join-Path $RepoRoot ".git\index.lock"
if (Test-Path $lock) {
  Write-Warning "Removing stale .git/index.lock"
  Remove-Item -Force $lock
}

$bundle = Join-Path $env:TEMP ("sf-push-{0}.bundle" -f ([guid]::NewGuid().ToString("N").Substring(0, 8)))
$dest = Join-Path $env:TEMP ("sf_github_push_{0}" -f (Get-Random))

try {
  Write-Host ">> bundle -> $bundle"
  & $GitExe bundle create $bundle --all
  if ($LASTEXITCODE -ne 0) { throw "git bundle create failed" }

  Write-Host ">> clone bundle -> $dest"
  & $GitExe clone $bundle $dest
  if ($LASTEXITCODE -ne 0) { throw "git clone (bundle) failed" }

  Write-Host ">> robocopy working tree (exclude .git)"
  robocopy $RepoRoot $dest /E /XD .git /NFL /NDL /NJH /NS /NC | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -ge 8) { throw "robocopy failed (exit $rc)" }

  Set-Location $dest
  & $GitExe remote remove origin 2>$null
  & $GitExe remote add origin $RemoteUrl
  & $GitExe checkout -B $Branch
  & $GitExe add -A
  $st = & $GitExe status --porcelain
  if (-not $st) {
    Write-Host "Nothing to commit after sync."
  } else {
    & $GitExe commit -m $Message
    if ($LASTEXITCODE -ne 0) { throw "git commit failed in temp clone" }
  }

  if (-not $SkipPush) {
    & $GitExe fetch origin
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
    & $GitExe rebase ("origin/{0}" -f $Branch)
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Rebase failed (diverged?). In $dest run: git pull --rebase origin $Branch ; git push"
      throw "rebase origin/$Branch failed"
    }
    & $GitExe push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    Write-Host ">> Pushed to $RemoteUrl ($Branch)"
  }

  Write-Host ""
  Write-Host "Next: sync your real folder (no new commit):"
  Write-Host ('  cd "{0}"' -f $RepoRoot)
  Write-Host "  .\scripts\git-sync-from-fetch.ps1"
  Write-Host ""
  Write-Host "Or if refs work normally: git fetch origin && git reset --hard origin/main"
}
finally {
  Remove-Item $bundle -Force -ErrorAction SilentlyContinue
  Write-Host ('Temp clone: {0} (delete when done)' -f $dest)
}
