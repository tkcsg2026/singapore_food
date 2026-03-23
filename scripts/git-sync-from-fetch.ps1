#Requires -Version 5.1
<#
  After `git fetch origin`, if Windows blocks updating refs (couldn't set refs/heads/main),
  point refs/heads/main at FETCH_HEAD and reset the working tree.
  Run from repo root:  .\scripts\git-sync-from-fetch.ps1
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$GitExe = if (Test-Path "C:\Program Files\Git\bin\git.exe") { "C:\Program Files\Git\bin\git.exe" } else { "git" }

& $GitExe fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

$line = Get-Content (Join-Path $RepoRoot ".git\FETCH_HEAD") -TotalCount 1
$hash = ($line -split "\s+")[0]
if (-not $hash -or $hash.Length -lt 7) { throw "Could not read commit hash from FETCH_HEAD" }

$mainRef = Join-Path $RepoRoot ".git\refs\heads\main"
Set-Content -Path $mainRef -Value $hash -NoNewline -Encoding ascii
Write-Host "Wrote $hash -> $mainRef"

& $GitExe reset --hard HEAD
if ($LASTEXITCODE -ne 0) { throw "git reset --hard failed" }
Write-Host "Synced to:" (& $GitExe log -1 --oneline)
