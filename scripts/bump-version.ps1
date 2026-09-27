param(
  [Parameter(Mandatory)]
  [string]$Version
)

$ErrorActionPreference = "Stop"
& node scripts/version.mjs $Version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Version and lockfiles bumped to $Version"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  git add -A"
Write-Host "  git commit -m 'chore: release $Version'"
Write-Host "  Follow docs/development-workflow.md to review and merge the version change."
Write-Host "  A tag push alone does not build installers; use Release Please or the Release workflow's tag input."
