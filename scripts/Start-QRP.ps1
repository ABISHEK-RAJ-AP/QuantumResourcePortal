# Quantum Resource Portal — separate terminals for API (:8000) + Vite (:5176).
# From this repo root (quantum-resource-portal). Linux uses scripts/start-qrp.sh.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartSh = Join-Path $Root "scripts" "start-qrp.sh"

if ($IsLinux -or $IsMacOS -or (Get-Command bash -ErrorAction SilentlyContinue)) {
  if (-not (Test-Path $StartSh)) { throw "Missing $StartSh" }
  & bash $StartSh
  if ($LASTEXITCODE -ne 0) { Read-Host "Press Enter to close" }
  exit $LASTEXITCODE
}

Set-Location $Root
$venvPy = Join-Path $Root "backend" ".venv" "Scripts" "python.exe"
if (-not (Test-Path $venvPy)) {
  python -m venv (Join-Path $Root "backend" ".venv")
  & (Join-Path $Root "backend" ".venv" "Scripts" "pip.exe") install -q -r (Join-Path $Root "backend" "requirements-dev.txt")
}
if (-not (Test-Path (Join-Path $Root "backend" ".env"))) {
  Copy-Item (Join-Path $Root "backend" ".env.example") (Join-Path $Root "backend" ".env")
}

Write-Host "QRP Windows — API :8000 + UI :5176 in separate windows"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$Root\backend'; ..\backend\.venv\Scripts\Activate.ps1; uvicorn qre.main:app --reload --host 127.0.0.1 --port 8000"
)
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$Root\frontend'; npm run dev -- --host 127.0.0.1 --port 5176"
)
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5176/qrp"
Read-Host "Press Enter to close launcher (servers keep running)"
