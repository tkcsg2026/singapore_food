#Requires -Version 5.1
<#
  Sync working tree to origin/main when this drive blocks Git from updating refs
  ("couldn't set refs/heads/main" / "couldn't set refs/remotes/origin/main").

  Uses ls-remote (no local ref writes except refs/heads/main) then reset --hard.

  Run from repo root:  .\scripts\git-sync-from-fetch.ps1
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$GitExe = if (Test-Path "C:\Program Files\Git\bin\git.exe") { "C:\Program Files\Git\bin\git.exe" } else { "git" }

$remoteLine = & $GitExe ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or -not $remoteLine) { throw "git ls-remote failed" }

$hash = ($remoteLine.ToString().Trim() -split "\s+")[0]
if (-not $hash -or $hash.Length -lt 7) { throw "Could not parse commit hash from ls-remote" }

$mainRef = Join-Path $RepoRoot ".git\refs\heads\main"
Set-Content -Path $mainRef -Value $hash -NoNewline -Encoding ascii
Write-Host "Set main -> $hash"

& $GitExe reset --hard HEAD
if ($LASTEXITCODE -ne 0) { throw "git reset --hard failed" }
Write-Host "Synced:" (& $GitExe log -1 --oneline)
