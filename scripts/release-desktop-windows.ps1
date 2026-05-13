$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$target = Join-Path $repoRoot "apps\desktop\scripts\release-windows.ps1"

powershell -ExecutionPolicy Bypass -File $target
exit $LASTEXITCODE
