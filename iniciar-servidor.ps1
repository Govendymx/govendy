# Script para iniciar el servidor de desarrollo Pocket
# Ejecuta: .\iniciar-servidor.ps1

# Agregar Node.js al PATH si no está
$nodeFound = $false
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $nodePaths = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        "$env:APPDATA\npm",
        "$env:LOCALAPPDATA\Programs\nodejs"
    )
    
    foreach ($path in $nodePaths) {
        if (Test-Path $path) {
            $env:Path = "$path;$env:Path"
            Write-Host "Node.js encontrado en: $path" -ForegroundColor Green
            $nodeFound = $true
            break
        }
    }
    
    # Verificar nuevamente
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Node.js no encontrado. Por favor instálalo desde https://nodejs.org" -ForegroundColor Red
        exit 1
    }
} else {
    $nodeFound = $true
}

# Verificar npm también
if ($nodeFound -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $npmPaths = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs"
    )
    
    foreach ($path in $npmPaths) {
        if (Test-Path "$path\npm.cmd") {
            $env:Path = "$path;$env:Path"
            Write-Host "npm encontrado en: $path" -ForegroundColor Green
            break
        }
    }
}

# Limpiar cache si se pasa el parámetro -clean
if ($args -contains "-clean" -or $args -contains "--clean") {
    Write-Host "Limpiando cache de Next.js..." -ForegroundColor Yellow
    if (Test-Path ".next-dev") {
        Remove-Item -Recurse -Force ".next-dev"
        Write-Host "Cache limpiado" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Green
Write-Host "Abre http://localhost:3000 en tu navegador" -ForegroundColor Yellow
Write-Host ""

npm run dev
