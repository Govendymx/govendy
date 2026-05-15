# Script para probar la actualización de pagos y ver los logs
# Este script hace una petición de prueba a la API de pagos offline

Write-Host "=== PRUEBA DE ACTUALIZACIÓN DE PAGOS ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
$port3000 = netstat -ano | findstr ":3000" | Select-Object -First 1
if (-not $port3000) {
    Write-Host "❌ El servidor no está corriendo en el puerto 3000" -ForegroundColor Red
    Write-Host "   Inicia el servidor con: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Servidor activo en puerto 3000" -ForegroundColor Green
Write-Host ""

Write-Host "📋 INSTRUCCIONES PARA VER LOS LOGS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Abre la terminal donde corre 'npm run dev'" -ForegroundColor White
Write-Host "2. Marca un pago como pagado desde la interfaz web" -ForegroundColor White
Write-Host "3. Busca estos logs en la terminal del servidor:" -ForegroundColor White
Write-Host ""
Write-Host "   [admin/offline-update] start { ... }" -ForegroundColor Cyan
Write-Host "   [admin/offline-update] update result { ... }" -ForegroundColor Cyan
Write-Host "   [admin/offline-update] verified { ... }" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. También revisa la consola del navegador (F12) para ver:" -ForegroundColor White
Write-Host ""
Write-Host "   [admin/pagos] Enviando actualización: { ... }" -ForegroundColor Cyan
Write-Host "   [admin/pagos] Respuesta recibida: { ... }" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Comparte los logs completos para diagnosticar el problema" -ForegroundColor White
Write-Host ""

Write-Host "🔍 QUÉ BUSCAR EN LOS LOGS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "En [admin/offline-update] start:" -ForegroundColor White
Write-Host "  - action: debería ser 'mark_paid'" -ForegroundColor Gray
Write-Host "  - nextStatus: debería ser 'paid'" -ForegroundColor Gray
Write-Host ""
Write-Host "En [admin/offline-update] update result:" -ForegroundColor White
Write-Host "  - hasError: debería ser false" -ForegroundColor Gray
Write-Host "  - dataCount: debería ser mayor que 0" -ForegroundColor Gray
Write-Host ""
Write-Host "En [admin/offline-update] verified:" -ForegroundColor White
Write-Host "  - verifiedStatus: debería ser 'paid'" -ForegroundColor Gray
Write-Host "  - nextStatus: debería ser 'paid'" -ForegroundColor Gray
Write-Host "  - matches: debería ser true" -ForegroundColor Gray
Write-Host ""
Write-Host "En [admin/pagos] Respuesta recibida:" -ForegroundColor White
Write-Host "  - action: debería ser 'mark_paid'" -ForegroundColor Gray
Write-Host "  - expectedStatus: debería ser 'paid'" -ForegroundColor Gray
Write-Host "  - receivedStatus: debería ser 'paid'" -ForegroundColor Gray
Write-Host "  - matches: debería ser true" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  Si 'matches' es false o 'receivedStatus' es 'pending', hay un problema" -ForegroundColor Red
Write-Host ""
