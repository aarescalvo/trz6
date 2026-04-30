@echo off
chcp 65001 >nul
title Printer Bridge v3.0 - Instalador Python - Solemar Alimentaria
echo ============================================================
echo   PRINTER BRIDGE v3.0 (PYTHON) - Solemar Alimentaria
echo   Instalador para Windows 7
echo ============================================================
echo.

:: Verificar Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python no esta instalado.
    echo.
    echo   Windows 7 requiere Python 3.8.10 (ultima version compatible).
    echo.
    echo   PASOS PARA INSTALAR:
    echo   1. Desde otra PC con internet, descarga:
    echo      https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe
    echo   2. Copia el archivo a esta PC (pendrive, red, etc.)
    echo   3. Ejecuta python-3.8.10.exe
    echo   4. IMPORTANTE: Marca "Add Python 3.8 to PATH" en el instalador
    echo   5. Click en "Install Now"
    echo   6. Cuando termine, volve a ejecutar este install.bat
    echo.
    pause
    exit /b 1
)

:: Verificar version de Python (3.8+)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo [OK] Python encontrado: %PYVER%

:: Verificar que sea 3.8+
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Python %PYVER% no es compatible.
    echo   Se requiere Python 3.8 o superior para Windows 7.
    echo   Descarga: https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe
    echo.
    pause
    exit /b 1
)
echo.

:: Verificar pywin32
python -c "import win32print; print('OK: pywin32 instalado')" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] pywin32 no esta instalado. Instalando...
    echo.

    :: Intentar instalar con pip
    pip install pywin32 2>nul

    if %ERRORLEVEL% neq 0 (
        :: Intentar con python -m pip
        python -m pip install pywin32 2>nul

        if %ERRORLEVEL% neq 0 (
            echo.
            echo [ERROR] No se pudo instalar pywin32 automaticamente.
            echo.
            echo   Opcion 1 - Con internet:
            echo     pip install pywin32
            echo.
            echo   Opcion 2 - Sin internet (Windows 7):
            echo     1. Desde otra PC, descarga el .whl desde:
            echo        https://github.com/mhammond/pywin32/releases
            echo     2. Busca el archivo para Python 3.8, Windows 7, 32-bit:
            echo        pywin32-301.win32-py3.8.exe
            echo     3. Copialo y ejecuta en esta PC
            echo.
            pause
            exit /b 1
        )
    )

    :: Verificar que se instalo
    python -c "import win32print; print('OK: pywin32 instalado correctamente')" 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pywin32 no se pudo verificar. Intenta reiniciar.
        pause
        exit /b 1
    )
)
echo.

:: Crear carpeta
set INSTALL_DIR=C:\SolemarAlimentaria\printer-bridge
echo Instalando en: %INSTALL_DIR%
echo.

if not exist "C:\SolemarAlimentaria" mkdir "C:\SolemarAlimentaria"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\temp" mkdir "%INSTALL_DIR%\temp"

:: Copiar archivos
echo Copiando archivos...
copy /Y "%~dp0index.py" "%INSTALL_DIR%\index.py" >nul 2>&1
copy /Y "%~dp0requirements.txt" "%INSTALL_DIR%\requirements.txt" >nul 2>&1
copy /Y "%~dp0start.bat" "%INSTALL_DIR%\start.bat" >nul 2>&1
echo [OK] Archivos copiados.
echo.

:: Mostrar impresoras detectadas
echo ============================================================
echo   IMPRESORAS DETECTADAS
echo ============================================================
echo.
python -c "
import sys
try:
    import win32print
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    printers = []
    for (f, desc, name, *_) in win32print.EnumPrinters(flags, None, 2):
        printers.append((name, desc))
    if printers:
        for i, (name, desc) in enumerate(printers):
            print('  [{}] {} ({})'.format(i, name, desc))
    else:
        print('  No se encontraron impresoras.')
        print('  Verifica que la Datamax este conectada por USB.')
except ImportError:
    print('  ERROR: pywin32 no disponible')
except Exception as e:
    print('  ERROR: {}'.format(e))
"
echo.

:: Pedir nombre de impresora
echo ============================================================
echo   CONFIGURACION
echo ============================================================
echo.
echo Escribi el nombre EXACTO de la impresora Datamax tal como aparece arriba.
echo.
set /p PRINTER_NAME="Nombre de la impresora: "

if "%PRINTER_NAME%"=="" (
    echo [ERROR] No ingresaste un nombre.
    pause
    exit /b 1
)

:: Guardar configuracion
echo {"printerName":"%PRINTER_NAME%","tcpPort":9100,"httpPort":9101,"logLevel":"info","autoStart":true,"copyCount":1} > "%INSTALL_DIR%\printer-config.json"
echo.
echo [OK] Configuracion guardada.
echo.

:: Firewall
echo ============================================================
echo   CONFIGURACION DEL FIREWALL
echo ============================================================
echo.

netsh advfirewall firewall show rule name="Printer Bridge TCP 9100" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="Printer Bridge TCP 9100" dir=in action=allow protocol=TCP localport=9100 >nul 2>&1
    echo [OK] Puerto TCP 9100 abierto.
) else (
    echo [OK] Puerto TCP 9100 ya estaba abierto.
)

netsh advfirewall firewall show rule name="Printer Bridge TCP 9101" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="Printer Bridge TCP 9101" dir=in action=allow protocol=TCP localport=9101 >nul 2>&1
    echo [OK] Puerto HTTP 9101 abierto.
) else (
    echo [OK] Puerto HTTP 9101 ya estaba abierto.
)
echo.

:: Obtener IP local
set LOCAL_IP=desconocida
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
echo   Impresora:   %PRINTER_NAME%
echo   Puerto TCP:  9100 (recibe datos de TrazAlan)
echo   Panel Web:   http://%LOCAL_IP%:9101
echo   Archivos:    %INSTALL_DIR%
echo.
echo   PROXIMOS PASOS:
echo   1. Ejecuta start.bat para iniciar el bridge
echo   2. Abri http://localhost:9101 en el navegador
echo   3. Hace clic en "Imprimir prueba"
echo   4. En TrazAlan configurar impresora con:
echo      IP: %LOCAL_IP%
echo      Puerto: 9100
echo      Marca: DATAMAX
echo      Modelo: Mark II
echo.
echo ============================================================
echo.
echo   Para iniciar el bridge como servicio de Windows (auto-inicio):
echo   Ejecuta install-service.bat como Administrador.
echo.

pause
