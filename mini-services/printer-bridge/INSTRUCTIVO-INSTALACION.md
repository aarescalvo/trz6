# Guía de Instalación - Impresoras por Red (Printer Bridge)

## Solemar Alimentaria - Sistema Frigorífico

---

## Índice

1. [Resumen de la instalación](#resumen)
2. [Requisitos previos](#requisitos-previos)
3. [PC 1: Zebra ZT230 (Rótulos Media Res)](#pc-1-zebra-zt230)
4. [PC 2: Datamax Mark II 4206 (Rótulos Cuarto/Caja)](#pc-2-datamax-mark-ii-4206)
5. [Configurar impresoras en el sistema](#configurar-en-el-sistema)
6. [Imprimir plantillas (ej: Media Res)](#imprimir-plantillas)
7. [Solución de problemas](#solucion-de-problemas)
8. [Servicio Windows (arranque automático)](#servicio-windows)

---

## Resumen {#resumen}

### ¿Qué vamos a hacer?

```
┌─────────────────┐        TCP/IP         ┌──────────────────┐        USB        ┌──────────┐
│   Sistema       │  ──────────────────▶  │  PC 1 (Zebra)   │  ──────────────▶  │  Zebra   │
│   Frigorífico   │     Puerto 9100      │  192.168.x.10    │                   │  ZT230   │
│   (Next.js)     │                      │  Printer Bridge  │                   │  USB     │
└─────────────────┘                       └──────────────────┘                   └──────────┘

┌─────────────────┐        TCP/IP         ┌──────────────────┐        USB        ┌──────────┐
│   Sistema       │  ──────────────────▶  │  PC 2 (Datamax) │  ──────────────▶  │ Datamax  │
│   Frigorífico   │     Puerto 9100      │  192.168.x.20    │                   │ Mark II  │
│   (Next.js)     │                      │  Printer Bridge  │                   │  4206    │
└─────────────────┘                       └──────────────────┘                   └──────────┘
```

- **Cada PC con impresora** corre un programa chico ("Printer Bridge")
- El sistema envía las etiquetas por red (TCP puerto 9100) a cada PC
- Cada bridge recibe los datos y los manda a la impresora USB conectada
- Funciona con las plantillas de rótulos ya cargadas en el sistema (Media Res, Cuarto, etc.)

---

## Requisitos previos {#requisitos-previos}

### En CADA PC con impresora:

- [ ] **Windows 10 o 11** (las PCs donde están enchufadas las impresoras por USB)
- [ ] **Node.js** instalado → descargar desde https://nodejs.org/ (elegir **LTS**, la que dice "Recommended for Most Users")
  - Al instalar, dejar todo por defecto (Next → Next → Install → Finish)
- [ ] **Impresora instalada en Windows** con su driver
  - Zebra ZT230: https://www.zebra.com/us/en/software/printer-software/drivers.html
  - Datamax Mark II 4206: buscar "Datamax O'Neil driver" en Google o usar Windows Update
- [ ] **Impresora encendida** y con cable USB conectado
- [ ] **Ambas PCs en la misma red** (conectadas al mismo router/switch)

### Para verificar que Node.js está instalado:
Abrir **CMD** (Inicio → escribir "cmd" → Enter) y ejecutar:
```
node --version
```
Si muestra un número (ej: `v20.11.0`), está bien. Si dice "no se reconoce", Node.js no está instalado.

### Para verificar que la impresora está en Windows:
- Abrir **Panel de Control** → **Dispositivos e Impresoras** (o **Configuración** → **Bluetooth y dispositivos** → **Impresoras y escáneres**)
- La impresora debe aparecer ahí y estar "Lista"

---

## PC 1: Zebra ZT230 {#pc-1-zebra-zt230}

### Paso 1: Copiar los archivos a esta PC

Los archivos del Printer Bridge están en el repositorio, en la carpeta:
```
mini-services/printer-bridge/
```

Copiá **TODA esa carpeta** a la PC con la Zebra. Podés:
- Ponerla en el escritorio
- O copiarla a `C:\SolemarAlimentaria\printer-bridge\`

Los archivos que deben estar son:
```
printer-bridge/
├── index.ts              ← El programa principal
├── package.json          ← Dependencias
├── tsconfig.json         ← Configuración TypeScript
├── install.bat           ← Instalador
├── start.bat             ← Para iniciar
├── install-service.bat   ← Para arranque automático
├── uninstall-service.bat ← Para desinstalar servicio
└── README.md             ← Este instructivo
```

### Paso 2: Ejecutar el instalador

1. Abrí la carpeta `printer-bridge` en la PC
2. Hacé **doble clic** en `install.bat`
3. Se abre una ventana negra. Seguí las instrucciones:

```
============================================================
  PRINTER BRIDGE - Solemar Alimentaria
  Instalador para Windows
============================================================

[OK] Node.js encontrado: v20.11.0
[OK] npm encontrado: 10.2.4

Instalando en: C:\SolemarAlimentaria\printer-bridge
[OK] Archivos copiados.
Instalando dependencias...
[OK] Dependencias instaladas.

Detectando impresoras...

Name                  PortName          DriverName
----                  --------          ----------
Zebra ZT230           USB001            ZDesigner ZT230-203dpi ZPL
Microsoft Print to    PORTPROMPT:       Microsoft Print to Image
Microsoft XPS Doc...  PORTPROMPT:       Microsoft XPS Document Writer

Escribi el nombre EXACTO de la impresora tal como aparece arriba.

Nombre de la impresora (ej: Zebra ZT230): _
```

4. **Escribí el nombre exacto** de la Zebra tal como aparece en la lista.
   Por ejemplo: `Zebra ZT230` (copiá y pegá para evitar errores)
5. Presioná **Enter**

```
[OK] Configuracion guardada.

============================================================
  INSTALACION COMPLETADA
============================================================

  Impresora: Zebra ZT230
  Puerto TCP: 9100 (para recibir datos del sistema)
  Panel Web:  http://192.168.1.10:9101

  PROXIMOS PASOS:
  1. Ejecuta START.BAT para iniciar el bridge
  2. Abri http://localhost:9101 en el navegador
  3. Hace clic en "Imprimir prueba" para verificar
```

6. **Anotá la IP** que muestra (ej: `192.168.1.10`) — la vas a necesitar después
7. Presioná una tecla para cerrar

### Paso 3: Iniciar el bridge

1. Hacé **doble clic** en `start.bat`
2. Se abre una ventana negra que queda corriendo:

```
============================================================
         PRINTER BRIDGE - Solemar Alimentaria
============================================================
║  TCP:  192.168.1.10:9100 (recibe datos ZPL/DPL)
║  HTTP: http://192.168.1.10:9101 (panel de control)
║  Impresora: Zebra ZT230
============================================================

Abrí http://localhost:9101 en tu navegador para configurar
```

⚠️ **Esta ventana debe quedar abierta** mientras quieras imprimir. No la cierres.

### Paso 4: Probar que funciona

1. Abrí el navegador en esa PC
2. Entrá a **http://localhost:9101**
3. Se abre el panel de control del bridge
4. Verificá que diga "Zebra ZT230" en "Impresora"
5. Hacé clic en **"🖨️ Imprimir prueba"**
6. La Zebra debería imprimir una etiqueta que dice:
   ```
   ** PRUEBA **
   Zebra ZT230 - Bridge OK
   [fecha y hora]
   Solemar Alimentaria
   ```

✅ **Si imprimió → la PC 1 está lista.** Pasá a la PC 2.
❌ **Si no imprimió → mirá la sección [Solución de problemas](#solucion-de-problemas)**

---

## PC 2: Datamax Mark II 4206 {#pc-2-datamax-mark-ii-4206}

### Paso 1: Copiar los archivos

Mismo que la PC 1. Copiá la carpeta `printer-bridge/` completa a esta PC.

### Paso 2: Ejecutar el instalador

1. Doble clic en `install.bat`
2. Esperá a que detecte las impresoras:

```
Detectando impresoras...

Name                    PortName          DriverName
----                    --------          ----------
Datamax Mark II 4206    USB002            Datamax DMX-I-4206
```

3. Escribí el nombre exacto: `Datamax Mark II 4206`
4. Presioná Enter
5. **Anotá la IP** que muestra (ej: `192.168.1.20`)

### Paso 3: Iniciar el bridge

⚠️ **IMPORTANTE:** Como ambas PCs van a escuchar en el puerto 9100, y están en máquinas distintas, no hay conflicto. El puerto 9100 es LOCAL a cada PC.

1. Doble clic en `start.bat`
2. Verificá que muestre la IP y "Datamax Mark II 4206"

### Paso 4: Probar que funciona

1. Abrí **http://localhost:9101** en esta PC
2. Clic en **"🖨️ Imprimir prueba"**
3. La Datamax debería imprimir una etiqueta de prueba

✅ **Si imprimió → la PC 2 está lista.**

---

## Configurar en el sistema {#configurar-en-el-sistema}

Ahora vamos a decirle al sistema frigorífico dónde están las impresoras.

### Paso 1: Verificar que las PCs son accesibles desde el servidor

Desde la PC donde corre el sistema (o desde cualquier PC de la red), abrí CMD y ejecutá:

```
ping 192.168.1.10
ping 192.168.1.20
```

*(Reemplazá con las IPs reales de cada PC)*

Ambas deben responder. Si alguna no responde, verificá que estén en la misma red y que el firewall no bloquee.

### Paso 2: Configurar la Zebra ZT230

1. Ir al sistema → **Configuración → Impresoras**
2. Hacé clic en **"Agregar impresora"** o **"+"**
3. Completá los datos:

| Campo | Valor |
|-------|-------|
| **Nombre** | `Zebra ZT230 - Rótulos` |
| **Tipo de rótulo** | `MEDIA_RES` |
| **Marca** | `ZEBRA` |
| **Modelo** | `ZT230` |
| **Puerto** | `RED` |
| **Dirección IP** | `192.168.1.10` *(la IP de la PC 1)* |
| **Ancho etiqueta** | `100` mm |
| **Alto etiqueta** | `50` mm |
| **DPI** | `203` |
| **Activa** | ✅ |
| **Predeterminada** | ✅ (para tipo MEDIA_RES) |

4. Guardar

### Paso 3: Configurar la Datamax Mark II 4206

1. En el mismo pantalla de **Configuración → Impresoras**
2. Agregar otra impresora con estos datos:

| Campo | Valor |
|-------|-------|
| **Nombre** | `Datamax 4206 - Cuartos` |
| **Tipo de rótulo** | `CUARTO` (o el que uses) |
| **Marca** | `DATAMAX` |
| **Modelo** | `Mark II 4206` |
| **Puerto** | `RED` |
| **Dirección IP** | `192.168.1.20` *(la IP de la PC 2)* |
| **Ancho etiqueta** | `100` mm |
| **Alto etiqueta** | `50` mm |
| **DPI** | `203` |
| **Activa** | ✅ |
| **Predeterminada** | ✅ (para tipo CUARTO) |

3. Guardar

### Paso 4: Verificar las IPs de cada PC

Si no sabés la IP de una PC, abrí CMD en esa PC y ejecutá:

```
ipconfig
```

Buscá la que dice "Adaptador de Ethernet" o "Adaptador de Wi-Fi" → "IPv4".
Ejemplo: `192.168.1.10`

---

## Imprimir plantillas {#imprimir-plantillas}

### Imprimir una plantilla de Media Res (Zebra ZT230)

1. Ir a **Configuración → Rótulos** (o Diseñador de Etiquetas)
2. Seleccioná la plantilla de **Media Res**
3. Verificá que el tipo de impresora sea **ZEBRA**
4. Hacé clic en **"Imprimir"** o **"Probar"**
5. El sistema envía el ZPL a `192.168.1.10:9100`
6. El bridge de la PC 1 lo recibe y lo manda a la Zebra por USB
7. ✅ La etiqueta sale impresa

### Imprimir una plantilla de Cuarto (Datamax 4206)

1. Seleccioná la plantilla de **Cuarto**
2. Verificá que el tipo de impresora sea **DATAMAX**
3. Al imprimir, el sistema envía DPL a `192.168.1.20:9100`
4. El bridge de la PC 2 lo recibe y lo manda a la Datamax por USB
5. ✅ La etiqueta sale impresa

### Desde los módulos de trabajo

Cuando uses los módulos operativos (Ingreso a Cajón, Romaneo, etc.), el sistema automáticamente:
1. Toma la plantilla asignada (Media Res, Cuarto, etc.)
2. Reemplaza las variables con los datos reales (tropa, garrón, peso, etc.)
3. Envía a la impresora predeterminada para ese tipo de rótulo

---

## Solución de problemas {#solucion-de-problemas}

### ❌ "No imprime nada"

1. **¿El bridge está corriendo?**
   - La ventana negra de `start.bat` debe estar abierta
   - Si la cerraste, ejecutá `start.bat` de nuevo

2. **¿La impresora está encendida?**
   - Verificá que la luz de la impresora esté prendida
   - Verificá que tenga papel/etiquetas cargadas

3. **¿Funciona la prueba desde el panel web?**
   - Abrí http://localhost:9101 en la PC con la impresora
   - Hacé clic en "Imprimir prueba"
   - Si acá funciona pero desde el sistema no → es problema de red
   - Si acá tampoco funciona → es problema de la impresora

### ❌ "Error al conectar" (desde el sistema)

1. **¿La IP es correcta?**
   - Verificá la IP en el sistema vs la IP real de la PC
   - Ejecutá `ipconfig` en la PC para confirmar

2. **¿Hay firewall bloqueando?**
   - En la PC con el bridge: **Windows Defender Firewall** → **Configuración avanzada**
   - **Regla de entrada** → **Nueva regla** → **Puerto** → **TCP** → **9100**
   - **Permitir la conexión** → **Todas las redes** → Nombre: "Printer Bridge"
   - Hacer lo mismo para el puerto **9101** si querés acceder al panel desde otra PC

3. **¿Están en la misma red?**
   - Ejecutá `ping` desde la PC del sistema a la IP de la impresora
   - Si no responde, pueden estar en redes distintas (Wi-Fi vs cable, o VLANs)

### ❌ "Puerto 9100 ya está en uso"

- Ya hay algo escuchando en ese puerto
- Ejecutá en CMD: `netstat -ano | findstr :9100`
- Cerrá el programa que lo esté usando o cambiá el puerto en `printer-config.json`

### ❌ "No detecta la impresora" (en el panel web)

- Verificá que la impresora esté en **Panel de Control → Dispositivos e Impresoras**
- Si no aparece, instalá el driver:
  - Zebra: https://www.zebra.com/us/en/software/printer-software/drivers.html
  - Datamax: https://www.honeywellaidc.com/en-us/support/driver-downloads

### ❌ "La impresora arranca pero sale etiqueta en blanco"

- Probablemente es un problema de calor/densidad
- En las plantillas ZPL, el comando `~SD` controla la densidad (0-30)
- Probá con `~SD15` o `~SD20` para más oscuro

### ❌ "La etiqueta sale cortada o mal alineada"

- Verificá que el **ancho y alto** de etiqueta en el sistema coincidan con el papel físico
- Ancho estándar: 100mm (4 pulgadas)
- Alto estándar: 50mm o 25mm según la etiqueta

---

## Servicio Windows {#servicio-windows}

Para que el bridge se inicie automáticamente con Windows (sin tener que ejecutar `start.bat` a mano):

### Instalar como servicio

1. Clic derecho en `install-service.bat` → **"Ejecutar como administrador"**
2. Esperá a que termine
3. Listo, se inicia solo con Windows

### Verificar que está corriendo

- Abrí **Servicios** (Inicio → escribir "servicios" → Enter)
- Buscá **"PrinterBridge"**
- Estado debería ser **"En ejecución"**

### Comandos útiles

```
net stop PrinterBridge    ← Detener el servicio
net start PrinterBridge   ← Iniciar el servicio
```

### Desinstalar el servicio

1. Clic derecho en `uninstall-service.bat` → **"Ejecutar como administrador"**
2. Esperá a que termine

---

## Checklist final

### PC 1 (Zebra ZT230)
- [ ] Node.js instalado
- [ ] Zebra ZT230 instalada en Windows con driver
- [ ] Archivos del printer-bridge copiados
- [ ] `install.bat` ejecutado (nombre de impresora correcto)
- [ ] `start.bat` corriendo (ventana negra abierta)
- [ ] Prueba de impresión exitosa desde http://localhost:9101
- [ ] IP anotada (ej: 192.168.1.10)

### PC 2 (Datamax Mark II 4206)
- [ ] Node.js instalado
- [ ] Datamax 4206 instalada en Windows con driver
- [ ] Archivos del printer-bridge copiados
- [ ] `install.bat` ejecutado (nombre de impresora correcto)
- [ ] `start.bat` corriendo (ventana negra abierta)
- [ ] Prueba de impresión exitosa desde http://localhost:9101
- [ ] IP anotada (ej: 192.168.1.20)

### Sistema Frigorífico
- [ ] Zebra ZT230 configurada (Configuración → Impresoras → RED → IP PC1)
- [ ] Datamax 4206 configurada (Configuración → Impresoras → RED → IP PC2)
- [ ] Plantillas asignadas (Media Res → Zebra, Cuarto → Datamax)
- [ ] Firewall de Windows permitiendo puerto 9100 en ambas PCs

---

*Documentación preparada para Solemar Alimentaria - Sistema Frigorífico*
*Última actualización: $(date +%Y-%m-%d)*
