@echo off
echo ============================================
echo LIMPIAR CACHE COMPLETO - Pocket App
echo ============================================
echo.

echo [1/4] Deteniendo servidor si esta corriendo...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Eliminando carpeta .next (cache de Next.js)...
if exist .next (
    rmdir /s /q .next
    echo    Carpeta .next eliminada
) else (
    echo    Carpeta .next no existe
)

echo [3/4] Eliminando node_modules (opcional)...
echo    Presiona Ctrl+C si NO quieres eliminar node_modules
timeout /t 3 /nobreak >nul
if exist node_modules (
    rmdir /s /q node_modules
    echo    node_modules eliminado
) else (
    echo    node_modules no existe
)

echo [4/4] Reinstalando dependencias...
call npm install

echo.
echo ============================================
echo CACHE LIMPIADO COMPLETAMENTE
echo ============================================
echo.
echo Ahora ejecuta: npm run dev
echo.
pause
