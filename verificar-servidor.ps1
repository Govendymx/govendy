# Script para verificar y reiniciar el servidor
Write-Host "Deteniendo procesos de Node.js..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Limpiando cache..." -ForegroundColor Yellow
if (Test-Path ".next-dev") {
    Remove-Item -Recurse -Force ".next-dev"
    Write-Host "Cache limpiado" -ForegroundColor Green
}

Write-Host "Iniciando servidor..." -ForegroundColor Cyan
Write-Host "Espera 30 segundos para que compile..." -ForegroundColor Yellow
Write-Host ""

npm run dev
