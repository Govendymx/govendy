# Script simple para verificar estado de puertos
Write-Host "=== Estado de Puertos de Desarrollo ===" -ForegroundColor Cyan
Write-Host ""

$puertos = @(3000, 3001, 3002, 3003, 8080, 5000)

foreach ($puerto in $puertos) {
    $enUso = netstat -ano | Select-String ":$puerto" | Select-String "LISTENING"
    
    if ($enUso) {
        Write-Host "Puerto $puerto : " -NoNewline -ForegroundColor Yellow
        Write-Host "EN USO" -ForegroundColor Red
    } else {
        Write-Host "Puerto $puerto : " -NoNewline -ForegroundColor Yellow
        Write-Host "DISPONIBLE" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Los puertos disponibles pueden usarse para otros proyectos" -ForegroundColor Green
Write-Host "Esto NO afecta tu app en Vercel ni tu configuracion" -ForegroundColor Green
