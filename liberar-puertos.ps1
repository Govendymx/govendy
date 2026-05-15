# Script seguro para liberar puertos de desarrollo
# Este script solo afecta procesos de desarrollo local, NO afecta tu app en producción

Write-Host "=== Liberador Seguro de Puertos ===" -ForegroundColor Cyan
Write-Host ""

# Puertos comunes de desarrollo
$puertos = @(3000, 3001, 3002, 3003, 8080, 5000)

Write-Host "Buscando procesos en puertos de desarrollo..." -ForegroundColor Yellow
Write-Host ""

$procesosEncontrados = $false

foreach ($puerto in $puertos) {
    # Buscar procesos usando el puerto
    $conexiones = netstat -ano | Select-String ":$puerto" | Select-String "LISTENING"
    
    if ($conexiones) {
        $procesosEncontrados = $true
        Write-Host "Puerto $puerto está en uso:" -ForegroundColor Yellow
        
        foreach ($linea in $conexiones) {
            $pid = ($linea -split '\s+')[-1]
            if ($pid -match '^\d+$') {
                try {
                    $proceso = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($proceso) {
                        Write-Host "  - PID: $pid | Proceso: $($proceso.ProcessName) | Ruta: $($proceso.Path)" -ForegroundColor White
                        
                        # Verificar si es un proceso de desarrollo seguro de detener
                        $esSeguro = $false
                        if ($proceso.Path -like "*nodejs*" -or 
                            $proceso.Path -like "*node.exe*" -or
                            $proceso.ProcessName -eq "node") {
                            
                            # Verificar que no sea Cursor o Adobe
                            if ($proceso.Path -notlike "*cursor*" -and 
                                $proceso.Path -notlike "*adobe*" -and
                                $proceso.Path -notlike "*Creative*") {
                                $esSeguro = $true
                            }
                        }
                        
                        if ($esSeguro) {
                            Write-Host "    ✓ Proceso de desarrollo detectado (seguro de detener)" -ForegroundColor Green
                            Write-Host "    ¿Deseas detener este proceso? (S/N): " -NoNewline -ForegroundColor Yellow
                            $respuesta = Read-Host
                            
                            if ($respuesta -eq "S" -or $respuesta -eq "s" -or $respuesta -eq "Y" -or $respuesta -eq "y") {
                                try {
                                    Stop-Process -Id $pid -Force -ErrorAction Stop
                                    Write-Host "    ✓ Proceso $pid detenido correctamente" -ForegroundColor Green
                                } catch {
                                    Write-Host "    ✗ Error al detener proceso: $_" -ForegroundColor Red
                                }
                            } else {
                                Write-Host "    → Proceso mantenido" -ForegroundColor Gray
                            }
                        } else {
                            Write-Host "    ⚠ Proceso del sistema (NO se detendrá automáticamente)" -ForegroundColor Magenta
                        }
                    }
                } catch {
                    Write-Host "  - PID: $pid (proceso no encontrado o ya terminado)" -ForegroundColor Gray
                }
            }
        }
        Write-Host ""
    }
}

if (-not $procesosEncontrados) {
    Write-Host "✓ No se encontraron procesos en los puertos de desarrollo comunes" -ForegroundColor Green
    Write-Host "  Los puertos 3000-3003, 8080, 5000 están disponibles" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Resumen ===" -ForegroundColor Cyan
Write-Host "✓ Este script solo afecta procesos de desarrollo local" -ForegroundColor Green
Write-Host "✓ Tu app en Vercel NO se ve afectada" -ForegroundColor Green
Write-Host "✓ Tu código en GitHub NO se ve afectado" -ForegroundColor Green
Write-Host "✓ Tu base de datos Supabase NO se ve afectada" -ForegroundColor Green
Write-Host ""
Write-Host "Para usar un puerto específico en tu proyecto:" -ForegroundColor Yellow
Write-Host "  npm run dev -- -p 3001" -ForegroundColor White
Write-Host ""
