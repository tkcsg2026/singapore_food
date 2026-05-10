# Quick commit & push - run from external terminal (close Cursor first)
# Usage: .\git-commit-push.ps1 "Your message"

param([string]$Message = "Update")

Set-Location $PSScriptRoot
# Same-drive temp: Git renames temp files into .git; C: TEMP + E: repo breaks that on Windows.
$gitTmp = Join-Path $PSScriptRoot ".git\_wintemp"
New-Item -ItemType Directory -Force -Path $gitTmp | Out-Null
$env:TEMP = $gitTmp
$env:TMP = $gitTmp

git add .
git commit -m $Message
git branch -M main 2>$null
git push -u origin main
