# Script para revisar logs del servidor
# Este script te ayuda a acceder a los logs del servidor Next.js

Write-Host "=== REVISOR DE LOGS DEL SERVIDOR ===" -ForegroundColor Cyan
Write-Host ""

# Verificar procesos de Node.js
Write-Host "1. Procesos de Node.js activos:" -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Select-Object Id, ProcessName, StartTime, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet64/1MB,2)}} | Format-Table
    Write-Host ""
    Write-Host "   Los logs del servidor se muestran en la terminal donde ejecutaste 'npm run dev'" -ForegroundColor Green
    Write-Host "   Busca los logs que empiezan con:" -ForegroundColor Yellow
    Write-Host "   - [LIST QUESTIONS]" -ForegroundColor White
    Write-Host "   - [ANSWER API]" -ForegroundColor White
    Write-Host "   - [DEBUG QUESTIONS]" -ForegroundColor White
} else {
    Write-Host "   No hay procesos de Node.js corriendo" -ForegroundColor Red
    Write-Host "   Inicia el servidor con: npm run dev" -ForegroundColor Yellow
}
Write-Host ""

# Verificar puertos
Write-Host "2. Puertos activos:" -ForegroundColor Yellow
$port3000 = netstat -ano | findstr :3000 | Select-Object -First 1
$port3001 = netstat -ano | findstr :3001 | Select-Object -First 1

if ($port3000) {
    Write-Host "   Puerto 3000: ACTIVO" -ForegroundColor Green
    $portPid = ($port3000 -split '\s+')[-1]
    Write-Host "   PID del proceso: $portPid" -ForegroundColor Gray
} else {
    Write-Host "   Puerto 3000: NO ACTIVO" -ForegroundColor Red
}

if ($port3001) {
    Write-Host "   Puerto 3001: ACTIVO" -ForegroundColor Green
    $portPid1 = ($port3001 -split '\s+')[-1]
    Write-Host "   PID del proceso: $portPid1" -ForegroundColor Gray
} else {
    Write-Host "   Puerto 3001: NO ACTIVO" -ForegroundColor Red
}
Write-Host ""

# Instrucciones
Write-Host "=== COMO VER LOS LOGS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Los logs de Next.js se muestran en tiempo real en la consola donde corre el servidor." -ForegroundColor Yellow
Write-Host ""
Write-Host "Para ver los logs:" -ForegroundColor Yellow
Write-Host "1. Abre la terminal donde ejecutaste 'npm run dev'" -ForegroundColor White
Write-Host "2. Busca mensajes que empiecen con [LIST QUESTIONS]" -ForegroundColor White
Write-Host "3. Los logs importantes incluyen:" -ForegroundColor White
Write-Host "   - Consulta por seller_id" -ForegroundColor Gray
Write-Host "   - Consulta por listing_id" -ForegroundColor Gray
Write-Host "   - MERGE COMPLETADO" -ForegroundColor Gray
Write-Host "   - DESPUES DE FILTRAR" -ForegroundColor Gray
Write-Host "   - ENVIANDO RESPUESTA" -ForegroundColor Gray
Write-Host ""
Write-Host "Si no ves los logs, el servidor puede no estar corriendo o puede haber un error." -ForegroundColor Yellow
Write-Host ""

# Crear un script de prueba para generar logs
Write-Host "=== GENERAR LOGS DE PRUEBA ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para generar logs, puedes:" -ForegroundColor Yellow
Write-Host "1. Abrir http://localhost:3000/dashboard/preguntas en tu navegador" -ForegroundColor White
Write-Host "2. Abrir las herramientas de desarrollador (F12)" -ForegroundColor White
Write-Host "3. Ir a la pestaña Network" -ForegroundColor White
Write-Host "4. Buscar la peticion a /api/questions/list" -ForegroundColor White
Write-Host "5. Ver la respuesta y los logs en la consola del servidor" -ForegroundColor White
Write-Host ""
