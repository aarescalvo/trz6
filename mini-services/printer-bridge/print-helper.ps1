<#
.SYNOPSIS
    Helper para enviar datos RAW a impresora Windows via Win32 API.
    Usado por Printer Bridge (index.js).
.PARAMETER PrinterName
    Nombre exacto de la impresora en Windows.
.PARAMETER FilePath
    Path al archivo temporal con los datos a imprimir.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

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
}
'@

Add-Type -TypeDefinition $code -Language CSharp

# Verificar archivo
if (-not (Test-Path $FilePath)) {
    Write-Error "Archivo no encontrado: $FilePath"
    exit 1
}

$docInfo = New-Object WinSpool+DOC_INFO_1
$docInfo.pDocName = "PrinterBridge"
$docInfo.pOutputFile = $null
$docInfo.pDatatype = "RAW"

$hPrinter = [IntPtr]::Zero

if (-not [WinSpool]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Error "No se pudo abrir la impresora '$PrinterName' (error $err). Verificá que el nombre sea exacto."
    exit 1
}

try {
    $data = [System.IO.File]::ReadAllBytes($FilePath)
    $written = 0

    if (-not [WinSpool]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)) {
        Write-Error "StartDocPrinter falló"
        exit 1
    }

    if (-not [WinSpool]::StartPagePrinter($hPrinter)) {
        Write-Error "StartPagePrinter falló"
        exit 1
    }

    if (-not [WinSpool]::WritePrinter($hPrinter, $data, $data.Length, [ref]$written)) {
        Write-Error "WritePrinter falló"
        exit 1
    }

    [WinSpool]::EndPagePrinter($hPrinter) | Out-Null
    [WinSpool]::EndDocPrinter($hPrinter) | Out-Null

    Write-Output "OK:$written"
}
finally {
    if ($hPrinter -ne [IntPtr]::Zero) {
        [WinSpool]::ClosePrinter($hPrinter) | Out-Null
    }
}
