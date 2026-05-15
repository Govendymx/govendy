# Script para limpiar caché y reiniciar el servidor
# Ejecuta: .\LIMPIAR_Y_REINICIAR.ps1

Write-Host "=== LIMPIEZA Y REINICIO DEL SERVIDOR ===" -ForegroundColor Cyan
Write-Host ""

# Agregar Node.js al PATH
$nodePath = "C:\Program Files\nodejs"
if (Test-Path "$nodePath\node.exe") {
    $env:Path = "$nodePath;$env:Path"
    Write-Host "Node.js agregado al PATH" -ForegroundColor Green
} else {
    Write-Host "ERROR: Node.js no encontrado" -ForegroundColor Red
    pause
    exit 1
}

# Paso 1: Detener todos los procesos de Node.js
Write-Host "1. Deteniendo procesos de Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "   Procesos detenidos: $($nodeProcesses.Count)" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "   No hay procesos de Node.js corriendo" -ForegroundColor Gray
}
Write-Host ""

# Paso 2: Limpiar caché de Next.js
Write-Host "2. Limpiando caché de Next.js..." -ForegroundColor Yellow
$cacheDirs = @(".next", ".next-dev", "node_modules/.cache")
$cleaned = $false

foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        Write-Host "   Eliminado: $dir" -ForegroundColor Green
        $cleaned = $true
    }
}

if (-not $cleaned) {
    Write-Host "   No se encontraron directorios de caché" -ForegroundColor Gray
}
Write-Host ""

# Paso 3: Verificar Node.js y npm
Write-Host "3. Verificando Node.js y npm..." -ForegroundColor Yellow
$nodeVersion = & "$nodePath\node.exe" --version 2>&1
$npmVersion = & "$nodePath\npm.cmd" --version 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "   npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ERROR: No se pudo ejecutar node o npm" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# Paso 4: Iniciar servidor
Write-Host "4. Iniciando servidor..." -ForegroundColor Cyan
Write-Host "   Espera 30-60 segundos para que compile..." -ForegroundColor Yellow
Write-Host "   Abre http://localhost:3000 en tu navegador" -ForegroundColor Yellow
Write-Host "   Presiona Ctrl+C para detener" -ForegroundColor Gray
Write-Host ""

# Cambiar al directorio del proyecto
Set-Location $PSScriptRoot

# Iniciar servidor usando npm.cmd para evitar problemas de política de ejecución
& "$nodePath\npm.cmd" run dev
