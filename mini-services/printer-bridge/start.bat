@echo off
title Printer Bridge - Solemar Alimentaria
echo ============================================================
echo   PRINTER BRIDGE - Iniciando...
echo ============================================================
echo.

cd /d "C:\SolemarAlimentaria\printer-bridge"

:: Verificar config
if not exist "printer-config.json" (
    echo [ERROR] No encontré printer-config.json
    echo Ejecuta install.bat primero.
    pause
    exit /b 1
)

:: Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no está instalado.
    echo Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)

:: Verificar paquete printer
if not exist "node_modules\printer" (
    echo [ADVERTENCIA] Paquete "printer" no encontrado. Intentando reinstalar...
    call npm install --production
    echo.
)

echo Iniciando Printer Bridge...
echo Presiona Ctrl+C para detener.
echo.

node index.ts

pause
