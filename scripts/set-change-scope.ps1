param(
    [string[]]$Patterns,
    [switch]$Clear,
    [string]$ScopeFile = ".git/change-scope-allowlist.txt"
)

$ErrorActionPreference = "Stop"

if ($Clear) {
    if (Test-Path -LiteralPath $ScopeFile) {
        Remove-Item -LiteralPath $ScopeFile -Force
        Write-Host "Cleared scope file: $ScopeFile"
    } else {
        Write-Host "Scope file does not exist: $ScopeFile"
    }
    exit 0
}

if (-not $Patterns -or $Patterns.Count -eq 0) {
    Write-Host "Usage:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/set-change-scope.ps1 -Patterns \"path/glob1\",\"path/glob2\""
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/set-change-scope.ps1 -Clear"
    exit 1
}

# 쉘/호출기 별 파싱 차이로 ","가 포함된 단일 문자열이 들어오는 경우를 보정한다.
$expandedPatterns = @()
foreach ($entry in $Patterns) {
    $value = [string]$entry
    if (-not $value) { continue }
    $parts = $value.Split(',')
    foreach ($part in $parts) {
        $expandedPatterns += $part
    }
}

if ($expandedPatterns.Count -gt 0) {
    $Patterns = $expandedPatterns
}

$dir = Split-Path -Path $ScopeFile -Parent
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}

$normalized = @()
foreach ($pattern in $Patterns) {
    $value = [string]$pattern
    if (-not $value) { continue }
    $trimmed = $value.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith('#')) { continue }
    if ($trimmed.EndsWith('/')) { $trimmed = "$trimmed*" }
    $normalized += $trimmed
}

if ($normalized.Count -eq 0) {
    Write-Host "No valid patterns provided."
    exit 1
}

Set-Content -LiteralPath $ScopeFile -Value ($normalized -join "`n") -NoNewline
Write-Host "Updated scope file: $ScopeFile"
$normalized | ForEach-Object { Write-Host "  allow: $_" }
