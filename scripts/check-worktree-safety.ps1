param(
    [switch]$FailOnDirty,
    [int]$MaxChanged = 10,
    [switch]$RepairHooks,
    [switch]$RequireScope,
    [string]$ScopeFile = ".git/change-scope-allowlist.txt"
)

if (-not $PSBoundParameters.ContainsKey('MaxChanged') -and $env:WORKTREE_MAX_CHANGED) {
    $environmentMaxChanged = 0
    if ([int]::TryParse($env:WORKTREE_MAX_CHANGED, [ref]$environmentMaxChanged) -and $environmentMaxChanged -ge 1) {
        $MaxChanged = $environmentMaxChanged
    }
}

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Text)
    Write-Host "\n=== $Text ==="
}

function Get-NormalizedScopePatterns {
    param([string[]]$Lines)

    $patterns = @()
    foreach ($line in $Lines) {
        $value = [string]$line
        if (-not $value) { continue }
        $trimmed = $value.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed.StartsWith('#')) { continue }
        if ($trimmed.EndsWith('/')) {
            $trimmed = "$trimmed*"
        }
        $patterns += $trimmed
    }
    return $patterns
}

function Test-PathMatchesScope {
    param(
        [string]$Path,
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        $wildcard = New-Object System.Management.Automation.WildcardPattern($pattern, [System.Management.Automation.WildcardOptions]::IgnoreCase)
        if ($wildcard.IsMatch($Path)) {
            return $true
        }
    }
    return $false
}

function Get-CommitsForPushValidation {
    $upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $upstream) {
        return @("HEAD")
    }

    $commits = @(git rev-list "$upstream..HEAD")
    if (-not $commits -or $commits.Count -eq 0) {
        return @()
    }

    return $commits
}

function Test-IsDocsOnlyPath {
    param([string]$Path)

    if (-not $Path) { return $false }

    $docsPatterns = @(
        '*.md',
        '*.MD',
        '.github/*',
        '.github/**',
        'docs/*',
        'docs/**',
        'README',
        'README.*',
        'SECURITY',
        'SECURITY.*',
        'LICENSE',
        'LICENSE.*'
    )

    return Test-PathMatchesScope -Path $Path -Patterns $docsPatterns
}

function Get-CommitFileList {
    param([string]$Commit)

    return @(git diff-tree --no-commit-id --name-only --diff-filter=d -r $Commit)
}

function Test-BlobExistsInCommit {
    param(
        [string]$Commit,
        [string]$Path
    )

    git cat-file -e "$Commit`:$Path" 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Validate-PushCommitGuards {
    param([string[]]$Commits)

    $violations = @()
    $allowChoiceInputCommit = ("$($env:ALLOW_CHOICE_INPUT_COMMIT)".Trim().ToLower() -eq 'true')

    foreach ($commit in $Commits) {
        $subject = (git log -1 --pretty=%s $commit)
        $files = Get-CommitFileList -Commit $commit
        $docsLikeCommit = $subject -match '^(docs|docs\(|chore\(docs\))\s*:'

        if ($docsLikeCommit) {
            $nonDocsFiles = @($files | Where-Object { -not (Test-IsDocsOnlyPath -Path $_) })
            if ($nonDocsFiles.Count -gt 0) {
                $violations += "[$commit] docs 커밋에 비문서 파일 포함: $($nonDocsFiles -join ', ')"
            }
        }

        if ((@($files | Where-Object { $_ -eq 'scripts/choice-input.latest.json' }).Count -gt 0) -and -not $allowChoiceInputCommit) {
            $violations += "[$commit] scripts/choice-input.latest.json 커밋은 기본 차단입니다. 필요 시 ALLOW_CHOICE_INPUT_COMMIT=true로 허용하세요."
        }

        $choicePostFiles = @($files | Where-Object { $_ -like 'src/content/life/*-choice-*.md' })
        foreach ($choicePost in $choicePostFiles) {
            $contentLines = @(git show "$commit`:$choicePost" 2>$null)
            $content = ($contentLines -join "`n")
            if ($LASTEXITCODE -ne 0 -or -not $content) {
                $violations += "[$commit] 초이스 포스트 검증 실패(파일 읽기 불가): $choicePost"
                continue
            }

            if ($content -notmatch '(?m)^\s*coupang_link:\s*"?.+"?\s*$') {
                $violations += "[$commit] 초이스 포스트 frontmatter에 coupang_link 누락: $choicePost"
            }

            $imageMatches = [regex]::Matches($content, '!\[[^\]]*\]\((/images/choice/[^)\s]+)\)')
            if ($imageMatches.Count -eq 0) {
                $violations += "[$commit] 초이스 포스트 본문에 /images/choice 기반 이미지 누락: $choicePost"
                continue
            }

            $imagePaths = @($imageMatches | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -Unique)
            foreach ($imagePath in $imagePaths) {
                $repoPath = "public$imagePath"
                if (-not (Test-BlobExistsInCommit -Commit $commit -Path $repoPath)) {
                    $violations += "[$commit] 초이스 포스트 이미지 파일 없음: $repoPath (포스트: $choicePost)"
                }
            }
        }
    }

    return $violations
}

Write-Section "Git safety preflight"

$statusLines = git status --porcelain
$changedCount = if ($statusLines) { ($statusLines | Measure-Object).Count } else { 0 }
$stagedFiles = @(git diff --cached --name-only)

if ($changedCount -gt 0) {
    Write-Host "Changed files: $changedCount"
    $statusLines | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Working tree is clean."
}

$zeroByteFiles = @()
git ls-files | ForEach-Object {
    try {
        if (Test-Path -LiteralPath $_) {
            $item = Get-Item -LiteralPath $_ -ErrorAction SilentlyContinue
            if ($item -and -not $item.PSIsContainer -and $item.Length -eq 0) {
                $zeroByteFiles += $_
            }
        }
    } catch {
        Write-Host "Skipping unreadable path: $_"
    }
}

Write-Section "Zero-byte tracked files"
if ($zeroByteFiles.Count -eq 0) {
    Write-Host "None"
} else {
    $zeroByteFiles | ForEach-Object { Write-Host "  $_" }
}

$hookPath = ".git/hooks/pre-push"
$hookInvalid = $false

Write-Section "pre-push hook health"
if (Test-Path $hookPath) {
    $hookItem = Get-Item $hookPath
    if ($hookItem.Length -le 0) {
        Write-Host "pre-push exists but is empty (invalid)."
        $hookInvalid = $true
    } else {
        Write-Host "pre-push exists and is non-empty."
    }
} else {
    Write-Host "pre-push is missing."
    $hookInvalid = $true
}

if ($RepairHooks -and $hookInvalid) {
    Write-Host "Repairing pre-push hook..."
    $hookContent = "#!/bin/sh`nexit 0`n"
    Set-Content -Path $hookPath -Value $hookContent -NoNewline
    Write-Host "pre-push hook repaired."
    $hookInvalid = $false
}

$shouldFail = $false

if ($RequireScope) {
    Write-Section "Allowed change scope"

    if (-not (Test-Path -LiteralPath $ScopeFile)) {
        Write-Host "ERROR: Scope file is required but missing: $ScopeFile"
        Write-Host "Create it with one glob per line (example: src/content/posts/2026-05-08-*.md)."
        $shouldFail = $true
    } else {
        $scopeRaw = Get-Content -LiteralPath $ScopeFile -ErrorAction SilentlyContinue
        $scopePatterns = Get-NormalizedScopePatterns -Lines $scopeRaw

        if ($scopePatterns.Count -eq 0) {
            Write-Host "ERROR: Scope file exists but has no valid patterns: $ScopeFile"
            $shouldFail = $true
        } else {
            Write-Host "Scope file: $ScopeFile"
            $scopePatterns | ForEach-Object { Write-Host "  allow: $_" }

            $violations = @()
            foreach ($file in $stagedFiles) {
                if (-not (Test-PathMatchesScope -Path $file -Patterns $scopePatterns)) {
                    $violations += $file
                }
            }

            if ($violations.Count -gt 0) {
                Write-Host "ERROR: Staged files outside allowed scope detected."
                $violations | ForEach-Object { Write-Host "  blocked: $_" }
                $shouldFail = $true
            } else {
                Write-Host "All staged files are within allowed scope."
            }
        }
    }
}

$stagedChoiceInput = @($stagedFiles | Where-Object { $_ -eq 'scripts/choice-input.latest.json' })
if ($stagedChoiceInput.Count -gt 0) {
    $allowChoiceInputCommit = ("$($env:ALLOW_CHOICE_INPUT_COMMIT)".Trim().ToLower() -eq 'true')
    if (-not $allowChoiceInputCommit) {
        Write-Host "ERROR: scripts/choice-input.latest.json 스테이징은 기본 차단입니다."
        Write-Host "       필요 시 ALLOW_CHOICE_INPUT_COMMIT=true 환경변수로 임시 허용하세요."
        $shouldFail = $true
    }
}

if ($zeroByteFiles.Count -gt 0) {
    Write-Host "ERROR: Zero-byte tracked files detected."
    $shouldFail = $true
}

if ($changedCount -gt $MaxChanged) {
    Write-Host "ERROR: Changed file count ($changedCount) exceeds MaxChanged ($MaxChanged)."
    $shouldFail = $true
}

if ($FailOnDirty -and $changedCount -gt 0) {
    Write-Host "ERROR: Working tree is dirty and -FailOnDirty is set."
    $shouldFail = $true
}

if ($FailOnDirty) {
    Write-Section "Push commit guards"

    $commitsForGuard = Get-CommitsForPushValidation
    if ($commitsForGuard.Count -eq 0) {
        Write-Host "No new commits to validate against upstream."
    } else {
        $guardViolations = Validate-PushCommitGuards -Commits $commitsForGuard
        if ($guardViolations.Count -gt 0) {
            Write-Host "ERROR: Push commit guard violation(s) detected."
            $guardViolations | ForEach-Object { Write-Host "  $_" }
            $shouldFail = $true
        } else {
            Write-Host "Push commit guards passed."
        }
    }
}

if ($hookInvalid) {
    Write-Host "ERROR: pre-push hook is invalid."
    $shouldFail = $true
}

if ($shouldFail) {
    exit 1
}

Write-Host "Preflight checks passed."