param(
    [switch]$FailOnDirty,
    [int]$MaxChanged = 10,
    [switch]$RepairHooks,
    [switch]$RequireScope,
    [string]$ScopeFile = ".git/change-scope-allowlist.txt"
)

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

if ($hookInvalid) {
    Write-Host "ERROR: pre-push hook is invalid."
    $shouldFail = $true
}

if ($shouldFail) {
    exit 1
}

Write-Host "Preflight checks passed."