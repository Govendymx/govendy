# Script para leer los logs del servidor automáticamente
# Uso: .\leer-logs.ps1 -Prefix "admin/offline-update" -Limit 50

param(
    [string]$Prefix = "",
    [int]$Limit = 100
)

Write-Host "=== LEYENDO LOGS DEL SERVIDOR ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
$port3000 = netstat -ano | findstr ":3000" | Select-Object -First 1
if (-not $port3000) {
    Write-Host "ERROR: El servidor no esta corriendo en el puerto 3000" -ForegroundColor Red
    Write-Host "   Inicia el servidor con: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: Servidor activo en puerto 3000" -ForegroundColor Green
Write-Host ""

# Construir URL
$url = "http://localhost:3000/api/debug/logs"
$params = @()
if ($Prefix) {
    $params += "prefix=$Prefix"
}
if ($Limit) {
    $params += "limit=$Limit"
}
if ($params.Count -gt 0) {
    $url += "?" + ($params -join "&")
}

Write-Host "Consultando: $url" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method GET -ErrorAction Stop
    
    if ($response.ok) {
        Write-Host "OK: Logs encontrados: $($response.count)" -ForegroundColor Green
        Write-Host ""
        
        if ($response.count -eq 0) {
            Write-Host "ADVERTENCIA: No hay logs que coincidan con los filtros" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Filtros aplicados:" -ForegroundColor Cyan
            Write-Host "  Prefix: $($response.filters.prefix)" -ForegroundColor White
            Write-Host "  Level: $($response.filters.level)" -ForegroundColor White
            Write-Host "  Limit: $($response.filters.limit)" -ForegroundColor White
            Write-Host ""
            Write-Host "Intenta:" -ForegroundColor Yellow
            Write-Host "  1. Marca un pago como pagado desde /admin/pagos" -ForegroundColor White
            Write-Host "  2. Ejecuta este script de nuevo" -ForegroundColor White
        } else {
            Write-Host "=== ULTIMOS LOGS ===" -ForegroundColor Cyan
            Write-Host ""
            
            foreach ($log in $response.logs) {
                $color = switch ($log.level) {
                    "error" { "Red" }
                    "warn" { "Yellow" }
                    "info" { "Green" }
                    "debug" { "Gray" }
                    default { "White" }
                }
                
                $timestamp = [DateTime]::Parse($log.timestamp).ToString("HH:mm:ss")
                Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
                Write-Host "[$($log.prefix)] " -NoNewline -ForegroundColor Cyan
                Write-Host "$($log.message)" -ForegroundColor $color
                
                if ($log.data) {
                    $jsonData = $log.data | ConvertTo-Json -Depth 5 -Compress
                    Write-Host "  Data: $jsonData" -ForegroundColor DarkGray
                }
                Write-Host ""
            }
        }
    } else {
        Write-Host "ERROR: Error al obtener logs: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Error al conectar con el servidor: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica que:" -ForegroundColor Yellow
    Write-Host "  1. El servidor este corriendo (npm run dev)" -ForegroundColor White
    Write-Host "  2. El endpoint /api/debug/logs este disponible" -ForegroundColor White
}
