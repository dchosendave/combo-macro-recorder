param(
  [Parameter(Mandatory)]
  [string]$Version
)

$ErrorActionPreference = "Stop"

$files = @(
  "src-tauri\Cargo.toml",
  "src-tauri\tauri.conf.json",
  "package.json"
)

foreach ($file in $files) {
  $content = Get-Content $file -Raw
  # Update version fields in JSON and TOML
  $content = $content -replace '^version = ".*"', "version = `"$Version`""
  $content = $content -replace '"version": ".*"', "`"version`": `"$Version`""
  Set-Content $file -NoNewline -Value $content
  Write-Host "  ✓ Updated $file"
}

Write-Host ""
Write-Host "Version bumped to $Version"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  git add -A"
Write-Host "  git commit -m 'chore: bump version to $Version'"
Write-Host "  git tag v$Version"
Write-Host "  git push origin main --tags"
