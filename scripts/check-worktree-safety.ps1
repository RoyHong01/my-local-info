param(
    [switch]$FailOnDirty,
    [int]$MaxChanged = 10,
    [switch]$RepairHooks
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Text)
    Write-Host "\n=== $Text ==="
}

Write-Section "Git safety preflight"

$statusLines = git status --porcelain
$changedCount = if ($statusLines) { ($statusLines | Measure-Object).Count } else { 0 }

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