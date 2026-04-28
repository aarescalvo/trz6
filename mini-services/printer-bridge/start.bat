@echo off
chcp 65001 >nul
title Printer Bridge - Start - Solemar Alimentaria
echo ============================================================
echo   PRINTER BRIDGE v2.0 - Iniciando...
echo ============================================================
echo.

cd /d "C:\SolemarAlimentaria\printer-bridge"

if not exist "printer-config.json" (
    echo [ERROR] No encuentro printer-config.json
    echo.
    echo Primero configura la impresora. Ejecuta:
    echo   node index.js
    echo Luego abre http://localhost:9101 en el navegador.
    echo.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de: https://nodejs.org/ ^(version LTS^)
    pause
    exit /b 1
)

if not exist "print-helper.ps1" (
    echo [ERROR] No encuentro print-helper.ps1
    echo Descarga todos los archivos de nuevo desde GitHub.
    pause
    exit /b 1
)

echo Iniciando Printer Bridge...
echo Presiona Ctrl+C para detener.
echo.

node index.js

pause
