@echo off
title Printer Bridge - Instalador - Solemar Alimentaria
echo ============================================================
echo   PRINTER BRIDGE - Solemar Alimentaria
echo   Instalador para Windows
echo ============================================================
echo.

:: Verificar que Node.js está instalado
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no está instalado.
    echo.
    echo Descargalo de: https://nodejs.org/
    echo Elegí la version LTS (Recommended for Most Users)
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado:
node --version
echo.

:: Verificar que npm está instalado
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm no encontrado.
    pause
    exit /b 1
)

echo [OK] npm encontrado:
npm --version
echo.

:: Crear carpeta de instalación
set INSTALL_DIR=C:\SolemarAlimentaria\printer-bridge
echo Instalando en: %INSTALL_DIR%
echo.

if not exist "C:\SolemarAlimentaria" mkdir "C:\SolemarAlimentaria"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copiar archivos
echo Copiando archivos...
copy /Y "%~dp0index.ts" "%INSTALL_DIR%\index.ts" >nul
copy /Y "%~dp0package.json" "%INSTALL_DIR%\package.json" >nul
copy /Y "%~dp0tsconfig.json" "%INSTALL_DIR%\tsconfig.json" >nul
copy /Y "%~dp0start.bat" "%INSTALL_DIR%\start.bat" >nul
copy /Y "%~dp0install-service.bat" "%INSTALL_DIR%\install-service.bat" >nul
copy /Y "%~dp0uninstall-service.bat" "%INSTALL_DIR%\uninstall-service.bat" >nul

echo [OK] Archivos copiados.
echo.

:: Instalar dependencias
echo Instalando dependencias...
cd /d "%INSTALL_DIR%"
call npm install --production

echo.
echo [OK] Dependencias instaladas.
echo.

:: Mostrar impresoras detectadas
echo Detectando impresoras...
powershell -Command "Get-Printer | Select-Object Name, PortName, DriverName | Format-Table -AutoSize"
echo.

:: Preguntar nombre de impresora
echo ============================================================
echo   CONFIGURACION
echo ============================================================
echo.
echo Escribi el nombre EXACTO de la impresora tal como aparece arriba.
echo.
set /p PRINTER_NAME="Nombre de la impresora (ej: Zebra ZT230): "

if "%PRINTER_NAME%"=="" (
    echo [ERROR] No ingresaste un nombre.
    pause
    exit /b 1
)

:: Guardar configuración
echo {"printerName":"%PRINTER_NAME%","tcpPort":9100,"httpPort":9101,"logLevel":"info","autoStart":true} > "%INSTALL_DIR%\printer-config.json"

echo.
echo [OK] Configuracion guardada.
echo.

:: Obtener IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo ============================================================
echo   INSTALACION COMPLETADA
echo ============================================================
echo.
echo   Impresora: %PRINTER_NAME%
echo   Puerto TCP: 9100 (para recibir datos del sistema)
echo   Panel Web:  http://%LOCAL_IP%:9101
echo.
echo   ARCHIVOS EN: %INSTALL_DIR%
echo.
echo ============================================================
echo   PROXIMOS PASOS:
echo ============================================================
echo.
echo   1. Ejecuta START.BAT para iniciar el bridge
echo   2. Abri http://localhost:9101 en el navegador
echo   3. Hace clic en "Imprimir prueba" para verificar
echo   4. En el sistema (Configuracion -^> Impresoras) configura:
echo      - Puerto: RED
echo      - IP: %LOCAL_IP%
echo      - Puerto TCP: 9100
echo.
echo ============================================================

pause
