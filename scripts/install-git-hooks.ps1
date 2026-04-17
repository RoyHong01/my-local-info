param()

$ErrorActionPreference = "Stop"

$hookDir = ".git/hooks"
$preCommitHookPath = Join-Path $hookDir "pre-commit"
$prePushHookPath = Join-Path $hookDir "pre-push"

if (-not (Test-Path $hookDir)) {
    New-Item -ItemType Directory -Path $hookDir | Out-Null
}

$preCommitContent = @"
#!/bin/sh
npm run check:worktree:commit
"@

$prePushContent = @"
#!/bin/sh
npm run check:worktree:strict
"@

Set-Content -Path $preCommitHookPath -Value $preCommitContent -NoNewline
Set-Content -Path $prePushHookPath -Value $prePushContent -NoNewline

Write-Host "Installed pre-commit hook at $preCommitHookPath"
Write-Host "Installed pre-push hook at $prePushHookPath"