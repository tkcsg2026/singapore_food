# Workaround for "fatal: unable to write new index file" / Permission denied on .git
# (often when the IDE or antivirus keeps handles under .git). Git writes the index to
# %TEMP% then copies it back.
#
# Usage:
#   .\git-add-fix.ps1              - stage all changes (git add -A)
#   .\git-add-fix.ps1 src/         - stage paths (passed through to git add)
#   .\git-add-fix.ps1 --dry-run    - show what would be added

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GitAddArgs = @()
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($GitAddArgs.Count -eq 0) {
    $GitAddArgs = @("-A")
}

$tempIndex = Join-Path $env:TEMP "singapore_food-git-index"
Copy-Item -Force ".git\index" $tempIndex
$env:GIT_INDEX_FILE = $tempIndex

try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $addResult = & git add @GitAddArgs 2>&1
    $exit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    $addResult | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message }
        else { $_ }
    } | Where-Object { $_ -notmatch "^warning: in the working copy" } | ForEach-Object { Write-Host $_ }

    if ($exit -ne 0) {
        exit $exit
    }

    Copy-Item -Force $tempIndex ".git\index"
    Write-Host "Index synced to .git\index" -ForegroundColor Green
    git status --short
}
finally {
    Remove-Item $tempIndex -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
}
