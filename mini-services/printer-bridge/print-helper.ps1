<#
.SYNOPSIS
    Helper para enviar datos RAW a impresora Windows via Win32 Spooler API.
    Usado por Printer Bridge (index.js).
.PARAMETER PrinterName
    Nombre exacto de la impresora en Windows.
.PARAMETER FilePath
    Path al archivo temporal con los datos a imprimir.
.OUTPUTS
    OK:1234        (exitos, 1234 bytes escritos)
    ERROR:mensaje  (error con descripcion)
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

try {
    # Cargar Win32 Spooler API
    $code = @'
using System;
using System.Runtime.InteropServices;

public class WinSpool
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOC_INFO_1
    {
        public string pDocName;
        public string pOutputFile;
        public string pDatatype;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOC_INFO_1 pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("kernel32.dll")]
    public static extern uint GetLastError();
}
'@

    Add-Type -TypeDefinition $code -Language CSharp | Out-Null

} catch {
    Write-Output "ERROR:Cargando Win32 API: $_"
    exit 1
}

# Verificar archivo existe
if (-not (Test-Path $FilePath)) {
    Write-Output "ERROR:Archivo no encontrado: $FilePath"
    exit 1
}

# Verificar tamaño
$fileSize = (Get-Item $FilePath).Length
if ($fileSize -eq 0) {
    Write-Output "ERROR:Archivo vacio: $FilePath"
    exit 1
}

$docInfo = New-Object WinSpool+DOC_INFO_1
$docInfo.pDocName = "PrinterBridge"
$docInfo.pOutputFile = $null
$docInfo.pDatatype = "RAW"

$hPrinter = [IntPtr]::Zero

# Abrir impresora
$result = [WinSpool]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
if (-not $result) {
    $errCode = [WinSpool]::GetLastError()
    $errMsg = switch ($errCode) {
        5    { "Acceso denegado. Ejecuta como Administrador." }
        1801 { "Impresora '$PrinterName' no encontrada. Verifica el nombre exacto." }
        3015 { "La impresora esta pausada." }
        13   { "Permiso insuficiente." }
        2    { "Impresora no encontrada." }
        default { "Error de Windows $errCode al abrir impresora." }
    }
    Write-Output "ERROR:$errMsg (codigo: $errCode)"
    exit 1
}

try {
    $data = [System.IO.File]::ReadAllBytes($FilePath)
    $written = 0

    # Iniciar documento de impresion
    $result = [WinSpool]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)
    if (-not $result) {
        $errCode = [WinSpool]::GetLastError()
        Write-Output "ERROR:StartDocPrinter fallo (codigo: $errCode)"
        exit 1
    }

    # Iniciar pagina
    $result = [WinSpool]::StartPagePrinter($hPrinter)
    if (-not $result) {
        $errCode = [WinSpool]::GetLastError()
        Write-Output "ERROR:StartPagePrinter fallo (codigo: $errCode)"
        [WinSpool]::EndDocPrinter($hPrinter) | Out-Null
        exit 1
    }

    # Escribir datos
    $result = [WinSpool]::WritePrinter($hPrinter, $data, $data.Length, [ref]$written)
    if (-not $result) {
        $errCode = [WinSpool]::GetLastError()
        Write-Output "ERROR:WritePrinter fallo (codigo: $errCode)"
        [WinSpool]::EndPagePrinter($hPrinter) | Out-Null
        [WinSpool]::EndDocPrinter($hPrinter) | Out-Null
        exit 1
    }

    # Finalizar pagina y documento
    [WinSpool]::EndPagePrinter($hPrinter) | Out-Null
    [WinSpool]::EndDocPrinter($hPrinter) | Out-Null

    Write-Output "OK:$written"

} catch {
    Write-Output "ERROR:Excepcion: $($_.Exception.Message)"
} finally {
    if ($hPrinter -ne [IntPtr]::Zero) {
        [WinSpool]::ClosePrinter($hPrinter) | Out-Null
    }
}
