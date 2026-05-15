# Script para iniciar el servidor - Agrega Node.js al PATH
# Ejecuta: .\INICIAR_SERVIDOR.ps1

$ErrorActionPreference = "Stop"

try {
    # Agregar Node.js al PATH
    $nodePath = "C:\Program Files\nodejs"
    if (Test-Path "$nodePath\node.exe") {
        $env:Path = "$nodePath;$env:Path"
        Write-Host "Node.js agregado al PATH" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Node.js no encontrado en $nodePath" -ForegroundColor Red
        Write-Host "Por favor instala Node.js desde: https://nodejs.org" -ForegroundColor Yellow
        pause
        exit 1
    }

    # Verificar que funciona
    Write-Host "Verificando Node.js y npm..." -ForegroundColor Yellow
    $nodeVersion = & "$nodePath\node.exe" --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo ejecutar node.exe"
    }
    
    $npmVersion = & "$nodePath\npm.cmd" --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo ejecutar npm.cmd"
    }

    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "npm: $npmVersion" -ForegroundColor Green
    Write-Host ""

    # Cambiar al directorio del proyecto
    Set-Location $PSScriptRoot
    Write-Host "Directorio de trabajo: $(Get-Location)" -ForegroundColor Gray
    Write-Host ""

    # Verificar que existe package.json
    if (-not (Test-Path "package.json")) {
        throw "No se encontró package.json en el directorio del proyecto"
    }

    # Verificar que existe node_modules (opcional, pero útil)
    if (-not (Test-Path "node_modules")) {
        Write-Host "ADVERTENCIA: node_modules no encontrado. Ejecuta 'npm install' primero." -ForegroundColor Yellow
        Write-Host "¿Deseas instalar dependencias ahora? (S/N): " -NoNewline -ForegroundColor Yellow
        $response = Read-Host
        if ($response -eq "S" -or $response -eq "s") {
            Write-Host "Instalando dependencias..." -ForegroundColor Cyan
            & "$nodePath\npm.cmd" install
            if ($LASTEXITCODE -ne 0) {
                throw "Error al instalar dependencias"
            }
        }
    }

    Write-Host ""
    Write-Host "=== INICIANDO SERVIDOR ===" -ForegroundColor Cyan
    Write-Host "Abre http://localhost:3000 en tu navegador" -ForegroundColor Yellow
    Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Gray
    Write-Host ""

    # Iniciar servidor usando npm.cmd para evitar problemas de política de ejecución
    & "$nodePath\npm.cmd" run dev
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detalles: $($_.Exception)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Si el problema persiste, intenta:" -ForegroundColor Yellow
    Write-Host "1. Ejecutar: .\LIMPIAR_Y_REINICIAR.ps1" -ForegroundColor Yellow
    Write-Host "2. Verificar que Node.js esté instalado correctamente" -ForegroundColor Yellow
    Write-Host "3. Ejecutar 'npm install' manualmente" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}
