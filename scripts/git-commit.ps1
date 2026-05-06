# Git commit workaround for "fatal: unable to write new index file"
# Run from project root: .\scripts\git-commit.ps1 -Message "Your commit message"

param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

$indexFile = "$env:TEMP\git-index-$([Guid]::NewGuid().ToString('N'))"
$env:GIT_INDEX_FILE = $indexFile

try {
  git add -A
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  git commit -m $Message
  $exitCode = $LASTEXITCODE
  if ($exitCode -eq 0 -and (Test-Path $indexFile)) {
    Copy-Item $indexFile .git\index -Force
  }
  exit $exitCode
} finally {
  if (Test-Path $indexFile) { Remove-Item $indexFile -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
}
