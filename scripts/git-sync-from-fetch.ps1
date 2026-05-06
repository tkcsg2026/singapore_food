#Requires -Version 5.1
<#
  Sync to origin/main when this drive blocks updating remote-tracking refs.

  1) git fetch origin main (objects download even if updating origin/main ref fails on this drive)
  2) Read commit hash from FETCH_HEAD
  3) Write refs/heads/main manually
  4) git reset --hard HEAD

  Run:  .\scripts\git-sync-from-fetch.ps1
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$GitExe = if (Test-Path "C:\Program Files\Git\bin\git.exe") { "C:\Program Files\Git\bin\git.exe" } else { "git" }

$prevEa = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $GitExe fetch origin main
$ErrorActionPreference = $prevEa

$fetchHead = Join-Path $RepoRoot ".git\FETCH_HEAD"
if (-not (Test-Path $fetchHead)) { throw "No .git/FETCH_HEAD after fetch" }

$line = Get-Content $fetchHead -TotalCount 1
$hash = ($line -split "\s+")[0]
if (-not $hash -or $hash.Length -lt 7) { throw "Could not parse hash from FETCH_HEAD" }

& $GitExe cat-file -t $hash 2>$null
if ($LASTEXITCODE -ne 0) { throw "Commit $hash not in local repo after fetch (network error?)" }

$mainRef = Join-Path $RepoRoot ".git\refs\heads\main"
Set-Content -Path $mainRef -Value $hash -NoNewline -Encoding ascii
Write-Host "Set refs/heads/main -> $hash"

& $GitExe reset --hard HEAD
if ($LASTEXITCODE -ne 0) { throw "git reset --hard failed" }
Write-Host "Synced:" (& $GitExe log -1 --oneline)
