# Arranca el servidor de desarrollo (sin usar npm.ps1).
# Uso: .\run-dev.ps1   o   powershell -ExecutionPolicy Bypass -File .\run-dev.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$node = "node"
$next = "node_modules\next\dist\bin\next"
$port = 3000

if (-not (Test-Path $next)) {
  Write-Host "No se encontró Next.js. Ejecuta: npm install" -ForegroundColor Red
  exit 1
}

Write-Host "Iniciando Next.js en http://localhost:$port ..." -ForegroundColor Cyan
& $node $next dev -p $port
