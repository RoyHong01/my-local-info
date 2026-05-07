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
# Auto-amend postbuild artifacts (search-index.json, sitemap.xml) into the last commit
POSTBUILD_FILES='public/data/search-index.json public/sitemap.xml'
AMENDED=0
for f in \$POSTBUILD_FILES; do
  STATUS=\$(git status --porcelain -- "\$f" 2>/dev/null)
  if [ -n "\$STATUS" ]; then
    git add "\$f"
    AMENDED=1
  fi
done
if [ "\$AMENDED" = "1" ]; then
  git commit --amend --no-edit --no-verify --quiet
fi
npm run check:worktree:strict
"@

Set-Content -Path $preCommitHookPath -Value $preCommitContent -NoNewline
Set-Content -Path $prePushHookPath -Value $prePushContent -NoNewline

Write-Host "Installed pre-commit hook at $preCommitHookPath"
Write-Host "Installed pre-push hook at $prePushHookPath"