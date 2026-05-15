# Script para ejecutar todos los SQL en Supabase
# Opciones:
#   1. Si tienes psql configurado, ejecuta directamente
#   2. Si no, te da instrucciones para copiar y pegar en SQL Editor

param(
    [switch]$UsarPsql = $false,
    [string]$ConnectionString = ""
)

Write-Host "Ejecutando scripts SQL de Pocket App" -ForegroundColor Green
Write-Host ""

# Verificar si existe el archivo consolidado
$consolidadoPath = Join-Path $PSScriptRoot "TODOS_LOS_SQL_CONSOLIDADOS.sql"
if (-not (Test-Path $consolidadoPath)) {
    Write-Host "ERROR: No se encontro el archivo consolidado." -ForegroundColor Red
    Write-Host "   Ejecuta primero: node consolidar-sql.js" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: Archivo consolidado encontrado: $consolidadoPath" -ForegroundColor Green
Write-Host ""

if ($UsarPsql -and $ConnectionString) {
    Write-Host "Intentando ejecutar con psql..." -ForegroundColor Yellow
    
    # Verificar si psql esta disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "ERROR: psql no esta disponible en el PATH." -ForegroundColor Red
        Write-Host "   Instala PostgreSQL o agrega psql al PATH." -ForegroundColor Yellow
        Write-Host ""
        $UsarPsql = $false
    } else {
        Write-Host "OK: psql encontrado: $($psqlPath.Source)" -ForegroundColor Green
        Write-Host "Ejecutando SQL..." -ForegroundColor Yellow
        Write-Host ""
        
        try {
            Get-Content $consolidadoPath | & $psqlPath.Source $ConnectionString
            Write-Host ""
            Write-Host "OK: SQL ejecutado correctamente" -ForegroundColor Green
            exit 0
        } catch {
            Write-Host "ERROR ejecutando con psql: $_" -ForegroundColor Red
            Write-Host ""
            $UsarPsql = $false
        }
    }
}

if (-not $UsarPsql) {
    Write-Host "INSTRUCCIONES PARA EJECUTAR MANUALMENTE:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Abre tu proyecto en Supabase Dashboard" -ForegroundColor White
    Write-Host "   https://supabase.com/dashboard/project/[tu-proyecto]" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Ve a 'SQL Editor' en el menu lateral" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Abre el archivo:" -ForegroundColor White
    Write-Host "   $consolidadoPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "4. Copia TODO el contenido del archivo" -ForegroundColor White
    Write-Host ""
    Write-Host "5. Pegalo en el SQL Editor de Supabase" -ForegroundColor White
    Write-Host ""
    Write-Host "6. Haz clic en 'Run' o presiona Ctrl+Enter" -ForegroundColor White
    Write-Host ""
    Write-Host "7. Espera a que termine la ejecucion (puede tardar unos minutos)" -ForegroundColor White
    Write-Host ""
    Write-Host "TIP: La mayoria de scripts son idempotentes, asi que puedes" -ForegroundColor Cyan
    Write-Host "   ejecutarlos multiples veces sin problemas." -ForegroundColor Cyan
    Write-Host ""
    
    # Preguntar si quiere abrir el archivo
    $abrir = Read-Host "Quieres abrir el archivo consolidado ahora? (S/n)"
    if ($abrir -ne "n" -and $abrir -ne "N") {
        Start-Process notepad.exe -ArgumentList $consolidadoPath
        Write-Host ""
        Write-Host "Archivo abierto en Notepad" -ForegroundColor Green
    }
}
