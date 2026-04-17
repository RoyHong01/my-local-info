param()

$ErrorActionPreference = "Stop"

$hookDir = ".git/hooks"
$hookPath = Join-Path $hookDir "pre-push"

if (-not (Test-Path $hookDir)) {
    New-Item -ItemType Directory -Path $hookDir | Out-Null
}

$content = @"
#!/bin/sh
npm run check:worktree:strict
"@

Set-Content -Path $hookPath -Value $content -NoNewline

Write-Host "Installed pre-push hook at $hookPath"