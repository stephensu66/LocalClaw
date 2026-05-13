$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

function Ensure-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Missing required command: $Name"
  }
}

function Get-NodeMajor {
  try {
    $version = node -p "process.versions.node"
  } catch {
    return $null
  }

  if (-not $version) {
    return $null
  }

  return [int]($version.Split('.')[0])
}

$requiredNodeMajor = if ($env:NODE_REQUIRED_MAJOR) { [int]$env:NODE_REQUIRED_MAJOR } else { 24 }

if ($env:OS -ne "Windows_NT") {
  Fail "Windows packaging must be executed on a Windows host."
}

Ensure-Command "node"
Ensure-Command "pnpm"
Ensure-Command "cargo"

$nodeMajor = Get-NodeMajor
if ($nodeMajor -ne $requiredNodeMajor) {
  Fail "Node.js $requiredNodeMajor.x is required. Current version: $(node -v)"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $desktopDir)
$tauriDir = Join-Path $desktopDir "src-tauri"

if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  Push-Location $repoRoot
  try {
    pnpm install
  } finally {
    Pop-Location
  }
}

Push-Location $tauriDir
try {
  cargo tauri build --ci --bundles nsis,msi --no-sign
} finally {
  Pop-Location
}

$bundleRoot = Join-Path $tauriDir "target\release\bundle"
$nsisDir = Join-Path $bundleRoot "nsis"
$msiDir = Join-Path $bundleRoot "msi"

$nsisArtifacts = @()
$msiArtifacts = @()

if (Test-Path $nsisDir) {
  $nsisArtifacts = Get-ChildItem -Path $nsisDir -Recurse -File | Where-Object { $_.Extension -eq ".exe" }
}

if (Test-Path $msiDir) {
  $msiArtifacts = Get-ChildItem -Path $msiDir -Recurse -File | Where-Object { $_.Extension -eq ".msi" }
}

Write-Host ""
Write-Host "[release] Windows build complete."
if ($nsisArtifacts.Count -gt 0) {
  Write-Host "[release] NSIS:"
  $nsisArtifacts | ForEach-Object { Write-Host "  $($_.FullName)" }
}
if ($msiArtifacts.Count -gt 0) {
  Write-Host "[release] MSI:"
  $msiArtifacts | ForEach-Object { Write-Host "  $($_.FullName)" }
}
if ($nsisArtifacts.Count -eq 0 -and $msiArtifacts.Count -eq 0) {
  Fail "Build finished but no Windows installer artifacts were found under $bundleRoot"
}
