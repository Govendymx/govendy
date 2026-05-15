# Script para verificar logs del servidor y estado del sistema
# Ejecuta: .\verificar-logs.ps1

Write-Host "=== VERIFICACION DEL SISTEMA ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar procesos de Node.js
Write-Host "1. Procesos de Node.js activos:" -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Select-Object Id, ProcessName, StartTime, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet64/1MB,2)}} | Format-Table
} else {
    Write-Host "   No hay procesos de Node.js corriendo" -ForegroundColor Red
}
Write-Host ""

# 2. Verificar puertos
Write-Host "2. Puertos en uso:" -ForegroundColor Yellow
$port3000 = netstat -ano | findstr :3000
$port3001 = netstat -ano | findstr :3001

if ($port3000) {
    Write-Host "   Puerto 3000: ACTIVO" -ForegroundColor Green
    $firstLine3000 = ($port3000 -split "`n")[0]
    Write-Host "   $firstLine3000" -ForegroundColor Gray
} else {
    Write-Host "   Puerto 3000: NO ACTIVO" -ForegroundColor Red
}

if ($port3001) {
    Write-Host "   Puerto 3001: ACTIVO" -ForegroundColor Green
    $firstLine3001 = ($port3001 -split "`n")[0]
    Write-Host "   $firstLine3001" -ForegroundColor Gray
} else {
    Write-Host "   Puerto 3001: NO ACTIVO" -ForegroundColor Red
}
Write-Host ""

# 3. Verificar archivos de codigo recientes
Write-Host "3. Archivos modificados recientemente:" -ForegroundColor Yellow
if (Test-Path "app\api\questions") {
    $recentFiles = Get-ChildItem -Path "app\api\questions" -Recurse -File | 
        Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-2) } | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 5 Name, LastWriteTime

    if ($recentFiles) {
        $recentFiles | Format-Table
    } else {
        Write-Host "   No hay archivos modificados en las ultimas 2 horas" -ForegroundColor Gray
    }
} else {
    Write-Host "   Directorio app\api\questions no encontrado" -ForegroundColor Red
}
Write-Host ""

# 4. Verificar cache de Next.js
Write-Host "4. Estado del cache:" -ForegroundColor Yellow
if (Test-Path ".next-dev") {
    $cacheSize = (Get-ChildItem -Path ".next-dev" -Recurse -ErrorAction SilentlyContinue | 
        Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "   Cache encontrado: $([math]::Round($cacheSize, 2)) MB" -ForegroundColor Green
    Write-Host "   Recomendacion: Si hay problemas, ejecuta: Remove-Item -Recurse -Force .next-dev" -ForegroundColor Gray
} else {
    Write-Host "   No hay cache (esto es normal si no se ha compilado)" -ForegroundColor Gray
}
Write-Host ""

# 5. Instrucciones
Write-Host "=== INSTRUCCIONES ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para ver los logs del servidor en tiempo real:" -ForegroundColor Yellow
Write-Host '  1. Abre la terminal donde esta corriendo npm run dev' -ForegroundColor White
Write-Host '  2. Busca los logs que empiezan con [LIST QUESTIONS]' -ForegroundColor White
Write-Host ""
Write-Host "Para reiniciar el servidor:" -ForegroundColor Yellow
Write-Host '  .\verificar-servidor.ps1' -ForegroundColor White
Write-Host ""
Write-Host "Para limpiar cache y reiniciar:" -ForegroundColor Yellow
Write-Host '  Remove-Item -Recurse -Force .next-dev' -ForegroundColor White
Write-Host '  npm run dev' -ForegroundColor White
Write-Host ""
