# Quick commit & push - run from external terminal (close Cursor first)
# Usage: .\git-commit-push.ps1 "Your message"

param([string]$Message = "Update")

Set-Location $PSScriptRoot
git add .
git commit -m $Message
git branch -M main 2>$null
git push -u origin main
