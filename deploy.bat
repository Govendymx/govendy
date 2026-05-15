@echo off
echo ============================================
echo   DESPLEGANDO A PRODUCCION - GoPocket
echo ============================================
echo.
cd /d "%~dp0"
echo Subiendo archivos a Vercel...
echo.
vercel --prod --yes
echo.
if %ERRORLEVEL% EQU 0 (
    echo ============================================
    echo   DEPLOY EXITOSO! 
    echo   Tu sitio ya esta actualizado en:
    echo   https://www.gopocket.com.mx
    echo ============================================
) else (
    echo ============================================
    echo   ERROR EN EL DEPLOY
    echo   Revisa los errores arriba
    echo ============================================
)
echo.
pause