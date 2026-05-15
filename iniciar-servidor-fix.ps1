# Script mejorado para iniciar el servidor con manejo de PATH
# Ejecuta: .\iniciar-servidor-fix.ps1

Write-Host "=== INICIANDO SERVIDOR POCKET ===" -ForegroundColor Cyan
Write-Host ""

# Buscar Node.js en ubicaciones comunes
$nodePaths = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "$env:APPDATA\npm",
    "$env:LOCALAPPDATA\Programs\nodejs",
    "$env:ProgramFiles\nodejs",
    "$env:ProgramFiles(x86)\nodejs"
)

$nodeFound = $false
$nodePath = $null

foreach ($path in $nodePaths) {
    if (Test-Path "$path\node.exe") {
        $nodePath = $path
        $nodeFound = $true
        Write-Host "Node.js encontrado en: $path" -ForegroundColor Green
        break
    }
}

if (-not $nodeFound) {
    Write-Host "ERROR: Node.js no encontrado." -ForegroundColor Red
    Write-Host "Por favor instala Node.js desde: https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "O si ya lo tienes instalado, agrega la ruta al PATH manualmente." -ForegroundColor Yellow
    pause
    exit 1
}

# Agregar Node.js al PATH de esta sesion
$env:Path = "$nodePath;$env:Path"

# Verificar que node funciona
$nodeVersion = & "$nodePath\node.exe" --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "ERROR: No se pudo ejecutar node.exe" -ForegroundColor Red
    pause
    exit 1
}

# Verificar que npm funciona
$npmVersion = & "$nodePath\npm.cmd" --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "ERROR: No se pudo ejecutar npm.cmd" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Cyan
Write-Host "Abre http://localhost:3000 en tu navegador" -ForegroundColor Yellow
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host ""

# Cambiar al directorio del proyecto
Set-Location $PSScriptRoot

# Iniciar el servidor
& "$nodePath\npm.cmd" run dev
