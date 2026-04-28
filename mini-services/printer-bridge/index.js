/**
 * Printer Bridge Service v2.0 - Solemar Alimentaria
 *
 * Escucha en TCP puerto 9100 y redirige los datos (ZPL/DPL)
 * a una impresora conectada por USB en Windows.
 *
 * NO necesita dependencias npm. Usa PowerShell + Win32 API.
 *
 * Arquitectura:
 *   Sistema (Next.js) -> TCP/IP :9100 -> Este bridge -> PowerShell -> Impresora USB
 *
 * Uso:
 *   node index.js
 *
 * Config: editar printer-config.json o usar el panel web en :9101
 */

const net = require('net')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const { execSync, exec } = require('child_process')

// ============================================================
// Configuración
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'printer-config.json')
const PRINT_HELPER = path.join(__dirname, 'print-helper.ps1')
const TEMP_DIR = path.join(__dirname, 'temp')

const DEFAULT_CONFIG = {
  printerName: '',
  tcpPort: 9100,
  httpPort: 9101,
  logLevel: 'info',
  autoStart: true
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Error leyendo config:', e)
  }
  return DEFAULT_CONFIG
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

let config = loadConfig()

// Asegurar que existe la carpeta temp
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// ============================================================
// Logger
// ============================================================
function log(level, msg, data) {
  const levels = { error: 0, info: 1, debug: 2 }
  if (levels[level] <= levels[config.logLevel]) {
    const ts = new Date().toLocaleTimeString('es-AR')
    const prefix = level === 'error' ? 'X' : level === 'info' ? '>' : '?'
    console.log(`[${ts}] ${prefix} ${msg}`, data !== undefined ? JSON.stringify(data) : '')
  }
}

// ============================================================
// Impresión via PowerShell + Win32 API
// ============================================================
function listPrinters() {
  try {
    const result = execSync(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf-8', timeout: 10000 }
    )
    return result.trim().split('\n').map(s => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

function printRaw(printerName, data) {
  return new Promise((resolve) => {
    if (!printerName) {
      log('error', 'No hay impresora configurada')
      resolve(false)
      return
    }

    // Generar archivo temporal unico
    const jobId = Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    const tempFile = path.join(TEMP_DIR, `job-${jobId}.zpl`)

    try {
      // Escribir datos al archivo temp
      fs.writeFileSync(tempFile, data)

      log('info', `Enviando ${data.length} bytes a "${printerName}" via PowerShell`)

      // Ejecutar PowerShell helper
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${PRINT_HELPER}" -PrinterName "${printerName}" -FilePath "${tempFile}"`

      exec(psCmd, { timeout: 30000, encoding: 'utf-8' }, (error, stdout, stderr) => {
        // Limpiar archivo temp
        try { fs.unlinkSync(tempFile) } catch {}

        if (error) {
          log('error', `Error al imprimir: ${error.message}`)
          if (stderr) log('error', `stderr: ${stderr}`)
          resolve(false)
          return
        }

        const output = (stdout || '').trim()
        if (output.startsWith('OK:')) {
          log('info', `Impresion enviada correctamente (${output})`)
          resolve(true)
        } else {
          log('error', `Respuesta inesperada: ${output}`)
          resolve(false)
        }
      })
    } catch (err) {
      // Limpiar archivo temp si existe
      try { fs.unlinkSync(tempFile) } catch {}
      log('error', `Error: ${err.message}`)
      resolve(false)
    }
  })
}

// ============================================================
// Servidor TCP (puerto 9100)
// ============================================================
let printCount = 0
let lastPrintTime = ''

const tcpServer = net.createServer((socket) => {
  const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`
  log('info', `Conexion entrante desde ${remoteAddress}`)

  const chunks = []
  let totalBytes = 0

  socket.on('data', (chunk) => {
    chunks.push(chunk)
    totalBytes += chunk.length
    log('debug', `Recibidos ${chunk.length} bytes (${totalBytes} total)`)
  })

  socket.on('end', async () => {
    const data = Buffer.concat(chunks)

    if (totalBytes === 0) {
      log('info', 'Conexion cerrada sin datos')
      return
    }

    if (!config.printerName) {
      log('error', 'No hay impresora configurada. Usa el panel web en http://localhost:' + config.httpPort)
      socket.end()
      return
    }

    const success = await printRaw(config.printerName, data)
    printCount++
    lastPrintTime = new Date().toLocaleString('es-AR')

    if (success) {
      log('info', `Impresion #${printCount} exitosa`)
    } else {
      log('error', `Impresion #${printCount} fallida`)
    }

    socket.end()
  })

  socket.on('error', (err) => {
    log('error', `Error en socket: ${err.message}`)
  })

  socket.on('timeout', () => {
    log('error', 'Timeout en conexion TCP')
    socket.destroy()
  })

  socket.setTimeout(30000)
})

// ============================================================
// Servidor HTTP (puerto 9101) - Panel de control
// ============================================================
const httpServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // API: listar impresoras
  if (req.method === 'GET' && req.url === '/api/printers') {
    const printers = listPrinters()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ printers, configured: config.printerName }))
    return
  }

  // API: obtener config
  if (req.method === 'GET' && req.url === '/api/config') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ...config,
      printCount,
      lastPrintTime,
      status: 'running',
      uptime: Math.floor(process.uptime())
    }))
    return
  }

  // API: guardar config
  if (req.method === 'POST' && req.url === '/api/config') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body)
        if (newConfig.printerName !== undefined) config.printerName = newConfig.printerName
        if (newConfig.tcpPort !== undefined) config.tcpPort = parseInt(newConfig.tcpPort)
        if (newConfig.httpPort !== undefined) config.httpPort = parseInt(newConfig.httpPort)
        if (newConfig.logLevel !== undefined) config.logLevel = newConfig.logLevel
        saveConfig(config)
        res.end(JSON.stringify({ success: true, config }))
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'JSON invalido' }))
      }
    })
    return
  }

  // API: prueba de impresion
  if (req.method === 'POST' && req.url === '/api/test') {
    if (!config.printerName) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'No hay impresora configurada' }))
      return
    }

    const testZPL = `^XA
^FO50,50^A0N,40,40^FD** PRUEBA **^FS
^FO50,100^A0N,25,25^FDZebra ZT230 - Bridge OK^FS
^FO50,140^A0N,20,20^FD${new Date().toLocaleString('es-AR')}^FS
^FO50,180^A0N,20,20^FDSolemar Alimentaria^FS
^XZ`

    printRaw(config.printerName, testZPL).then((success) => {
      res.end(JSON.stringify({ success, message: success ? 'Prueba enviada' : 'Error en prueba' }))
    })
    return
  }

  // Dashboard HTML
  res.end(generateDashboard())
})

function generateDashboard() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Printer Bridge - Solemar Alimentaria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f4; color: #292524; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #1c1917; }
    .subtitle { color: #78716c; margin-bottom: 24px; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .status.online { background: #dcfce7; color: #166534; }
    .status .dot { width: 8px; height: 8px; border-radius: 50%; }
    .status.online .dot { background: #22c55e; }
    select { width: 100%; padding: 10px 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; margin-bottom: 12px; }
    select:focus { outline: none; border-color: #f59e0b; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #f59e0b; color: white; }
    .btn-primary:hover { background: #d97706; }
    .btn-secondary { background: #e7e5e4; color: #292524; }
    .btn-secondary:hover { background: #d6d3d1; }
    .btn-group { display: flex; gap: 8px; margin-top: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { padding: 12px; background: #fafaf9; border-radius: 8px; }
    .info-item .label { font-size: 12px; color: #78716c; margin-bottom: 4px; }
    .info-item .value { font-size: 18px; font-weight: 700; color: #1c1917; }
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; opacity: 0; transition: opacity 0.3s; }
    .toast.success { background: #22c55e; }
    .toast.error { background: #ef4444; }
    .instructions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; }
    .instructions h3 { color: #92400e; margin-bottom: 8px; }
    .instructions code { background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Printer Bridge</h1>
    <p class="subtitle">Solemar Alimentaria - Puente TCP -> Impresora USB</p>

    <div class="card">
      <h2>
        <span class="status online"><span class="dot"></span> Conectado</span>
      </h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Puerto TCP</div>
          <div class="value" id="tcpPort">${config.tcpPort}</div>
        </div>
        <div class="info-item">
          <div class="label">Impresiones</div>
          <div class="value" id="printCount">0</div>
        </div>
        <div class="info-item">
          <div class="label">Ultima impresion</div>
          <div class="value" id="lastPrint" style="font-size:14px">-</div>
        </div>
        <div class="info-item">
          <div class="label">Impresora</div>
          <div class="value" id="currentPrinter" style="font-size:14px">${config.printerName || 'Sin configurar'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Configurar Impresora</h2>
      <select id="printerSelect">
        <option value="">-- Seleccionar impresora --</option>
      </select>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="savePrinter()">Guardar</button>
        <button class="btn btn-secondary" onclick="loadPrinters()">Actualizar lista</button>
      </div>
    </div>

    <div class="card">
      <h2>Probar Impresion</h2>
      <p style="font-size:13px; color:#78716c; margin-bottom:12px">
        Imprime una etiqueta de prueba para verificar que funciona.
      </p>
      <button class="btn btn-primary" onclick="testPrint()">Imprimir prueba</button>
    </div>

    <div class="card">
      <h2>Configurar en el Sistema</h2>
      <div class="instructions">
        <h3>Para que el sistema imprima a esta PC:</h3>
        <p><strong>1.</strong> Verifica la IP de esta PC con <code>ipconfig</code> en CMD.</p>
        <p><strong>2.</strong> En el sistema ir a <strong>Configuracion - Impresoras</strong>.</p>
        <p><strong>3.</strong> Crear/editar impresora:</p>
        <p>&nbsp;&nbsp; Puerto: <strong>RED</strong></p>
        <p>&nbsp;&nbsp; IP: <strong>la IP de esta PC</strong> (ej: 192.168.1.50)</p>
        <p>&nbsp;&nbsp; Marca: ZEBRA | Modelo: ZT230 | DPI: 203</p>
        <p><strong>4.</strong> El puerto TCP es <strong>${config.tcpPort}</strong></p>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let config = ${JSON.stringify(config)};

    function showToast(msg, type) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      t.style.opacity = '1';
      setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    async function loadPrinters() {
      try {
        const res = await fetch('/api/printers');
        const data = await res.json();
        const sel = document.getElementById('printerSelect');
        sel.innerHTML = '<option value="">-- Seleccionar impresora --</option>';
        data.printers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          if (p === data.configured) opt.selected = true;
          sel.appendChild(opt);
        });
      } catch (e) {
        showToast('Error al cargar impresoras', 'error');
      }
    }

    async function savePrinter() {
      const printerName = document.getElementById('printerSelect').value;
      if (!printerName) {
        showToast('Selecciona una impresora', 'error');
        return;
      }
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printerName })
        });
        const data = await res.json();
        if (data.success) {
          config.printerName = printerName;
          document.getElementById('currentPrinter').textContent = printerName;
          showToast('Impresora configurada: ' + printerName, 'success');
        }
      } catch (e) {
        showToast('Error al guardar', 'error');
      }
    }

    async function testPrint() {
      if (!config.printerName) {
        showToast('Configura una impresora primero', 'error');
        return;
      }
      try {
        const res = await fetch('/api/test', { method: 'POST' });
        const data = await res.json();
        showToast(data.success ? 'Prueba enviada' : 'Error: ' + data.message, data.success ? 'success' : 'error');
      } catch (e) {
        showToast('Error de conexion', 'error');
      }
    }

    async function refreshStats() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        document.getElementById('printCount').textContent = data.printCount;
        document.getElementById('lastPrint').textContent = data.lastPrintTime || '-';
      } catch {}
    }

    loadPrinters();
    setInterval(refreshStats, 5000);
  </script>
</body>
</html>`
}

// ============================================================
// Inicio
// ============================================================
function start() {
  const nets = os.networkInterfaces()
  let localIP = 'localhost'
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        localIP = n.address
        break
      }
    }
    if (localIP !== 'localhost') break
  }

  // Verificar que print-helper.ps1 existe
  if (!fs.existsSync(PRINT_HELPER)) {
    console.error('ERROR: No encuentro print-helper.ps1 en ' + __dirname)
    console.error('Asegurate de tener todos los archivos descargados.')
    process.exit(1)
  }

  // Servidor TCP (puerto 9100)
  tcpServer.listen(config.tcpPort, '0.0.0.0', () => {
    console.log('========================================================')
    console.log('  PRINTER BRIDGE v2.0 - Solemar Alimentaria')
    console.log('========================================================')
    console.log('  TCP:  ' + localIP + ':' + config.tcpPort + ' (recibe datos ZPL/DPL)')
    console.log('  HTTP: http://' + localIP + ':' + config.httpPort + ' (panel de control)')
    console.log('  Impresora: ' + (config.printerName || '(sin configurar)'))
    console.log('========================================================')
    console.log('')
    console.log('Abri http://localhost:' + config.httpPort + ' en tu navegador para configurar')
    console.log('')
  })

  tcpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('ERROR: Puerto ' + config.tcpPort + ' ya esta en uso.')
    } else {
      console.error('ERROR TCP:', err.message)
    }
    process.exit(1)
  })

  // Servidor HTTP (panel de control)
  httpServer.listen(config.httpPort, '0.0.0.0', () => {
    log('debug', 'Panel web en http://localhost:' + config.httpPort)
  })

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('error', 'Puerto HTTP ' + config.httpPort + ' ya en uso')
    }
  })
}

start()
