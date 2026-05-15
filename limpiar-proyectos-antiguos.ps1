# Script para limpiar proyectos antiguos de los puertos de forma segura
Write-Host "=== Limpiador de Proyectos Antiguos ===" -ForegroundColor Cyan
Write-Host "Este script solo detiene procesos de desarrollo local" -ForegroundColor Yellow
Write-Host "NO afecta tu app en Vercel ni tu configuracion" -ForegroundColor Green
Write-Host ""

# Buscar procesos Node.js en puertos 3000-3099
$puertosEncontrados = @()

for ($puerto = 3000; $puerto -le 3099; $puerto++) {
    $conexiones = netstat -ano | Select-String ":$puerto" | Select-String "LISTENING"
    
    if ($conexiones) {
        foreach ($linea in $conexiones) {
            $partes = $linea -split '\s+'
            $pid = $partes[-1]
            
            if ($pid -match '^\d+$') {
                try {
                    $proceso = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($proceso -and $proceso.ProcessName -eq "node") {
                        $ruta = $proceso.Path
                        
                        # Verificar que no sea Cursor, Adobe u otros procesos del sistema
                        if ($ruta -notlike "*cursor*" -and 
                            $ruta -notlike "*adobe*" -and
                            $ruta -notlike "*Creative*" -and
                            $ruta -like "*nodejs*" -or $ruta -like "*node.exe*") {
                            
                            $info = [PSCustomObject]@{
                                Puerto = $puerto
                                PID = $pid
                                Proceso = $proceso.ProcessName
                                Ruta = $ruta
                            }
                            $puertosEncontrados += $info
                        }
                    }
                } catch {
                    # Ignorar errores
                }
            }
        }
    }
}

if ($puertosEncontrados.Count -eq 0) {
    Write-Host "✓ No se encontraron proyectos de desarrollo en los puertos 3000-3099" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Proyectos encontrados en puertos:" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($info in $puertosEncontrados) {
        Write-Host "Puerto: $($info.Puerto) | PID: $($info.PID) | Proceso: $($info.Proceso)" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "¿Deseas detener TODOS estos procesos? (S/N): " -NoNewline -ForegroundColor Yellow
    $respuesta = Read-Host
    
    if ($respuesta -eq "S" -or $respuesta -eq "s" -or $respuesta -eq "Y" -or $respuesta -eq "y") {
        $detenidos = 0
        foreach ($info in $puertosEncontrados) {
            try {
                Stop-Process -Id $info.PID -Force -ErrorAction Stop
                Write-Host "✓ Puerto $($info.Puerto) (PID $($info.PID)) liberado" -ForegroundColor Green
                $detenidos++
            } catch {
                Write-Host "✗ Error al detener PID $($info.PID): $_" -ForegroundColor Red
            }
        }
        Write-Host ""
        Write-Host "✓ $detenidos proceso(s) detenido(s)" -ForegroundColor Green
    } else {
        Write-Host "→ Procesos mantenidos" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Verificacion Final ===" -ForegroundColor Cyan
Write-Host "Puertos comunes ahora:" -ForegroundColor Yellow

$puertosComunes = @(3000, 3001, 3002, 3003, 3011, 8080)
foreach ($p in $puertosComunes) {
    $enUso = netstat -ano | Select-String ":$p" | Select-String "LISTENING"
    if ($enUso) {
        Write-Host "  Puerto $p : EN USO" -ForegroundColor Red
    } else {
        Write-Host "  Puerto $p : DISPONIBLE" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✓ Limpieza completada de forma segura" -ForegroundColor Green
Write-Host "✓ Tu app Pocket-App NO se ve afectada" -ForegroundColor Green
