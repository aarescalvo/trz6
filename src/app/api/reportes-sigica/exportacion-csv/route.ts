import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ExportacionSIGICA')

// Mapeo TipoAnimal -> código SIGICA
const TIPO_ANIMAL_SIGICA: Record<string, string> = {
  TO: 'TO',
  VA: 'VA',
  VQ: 'VQ',
  MEJ: 'MEJ',
  NO: 'NO',
  NT: 'NT',
  PADRILLO: 'PADRILLO',
  POTRILLO: 'POTRILLO',
  YEGUA: 'YEGUA',
  CABALLO: 'CABALLO',
  MULA: 'MULA',
  BURRO: 'BURRO',
}

// Mapeo denticion -> prefijo SIGICA (ej: "2" -> "2D", "4" -> "4D")
function denticionToPrefix(denticion: string | null | undefined): string {
  if (!denticion) return ''
  const num = denticion.replace(/\D/g, '') // extraer solo numeros
  if (num) return `${num}D`
  return ''
}

// Armar clasificacion: "2D - VQ"
function buildClasificacion(denticion: string | null | undefined, tipoAnimal: string | null | undefined): string {
  const prefix = denticionToPrefix(denticion)
  const tipo = tipoAnimal ? (TIPO_ANIMAL_SIGICA[tipoAnimal] || tipoAnimal) : ''
  if (prefix && tipo) return `${prefix} - ${tipo}`
  if (tipo) return tipo
  return ''
}

// GET /api/reportes-sigica/exportacion-csv?fecha=2026-04-22
// Genera el CSV plano para importar a SIGICA
export async function GET(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeReportes')
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha') // YYYY-MM-DD
    const destino = searchParams.get('destino') || '106' // default: consumo interno
    const tropaIds = searchParams.get('tropaIds') // opcional: "165,166,167"

    if (!fecha) {
      return NextResponse.json(
        { success: false, error: 'Fecha de faena obligatoria (param: fecha, formato YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const operadorId = request.headers.get('x-operador-id')

    // Parsear fecha (zona horaria Argentina)
    const fechaInicio = new Date(`${fecha}T00:00:00`)
    const fechaFin = new Date(`${fecha}T23:59:59`)

    // Buscar tropas faenadas en esa fecha
    const tropasWhere: any = {
      fechaFaena: { gte: fechaInicio, lte: fechaFin },
      estado: { in: ['FAENADO', 'DESPACHADO'] }
    }

    // Filtrar por especie BOVINO (equinos se dejan de lado por ahora)
    tropasWhere.especie = 'BOVINO'

    // Filtrar por tropas específicas si se pasaron
    if (tropaIds) {
      const ids = tropaIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      if (ids.length > 0) {
        tropasWhere.numero = { in: ids }
      }
    }

    const tropas = await db.tropa.findMany({
      where: tropasWhere,
      include: {
        usuarioFaena: { select: { id: true, nombre: true } }
      },
      orderBy: { numero: 'asc' }
    })

    if (tropas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron tropas bovinas faenadas en esa fecha', tropasEncontradas: 0 },
        { status: 404 }
      )
    }

    const tropaCodigos = tropas.map(t => t.codigo)

    // Buscar romaneos confirmados de esas tropas
    const romaneos = await db.romaneo.findMany({
      where: {
        tropaCodigo: { in: tropaCodigos },
        estado: 'CONFIRMADO'
      },
      include: {
        mediasRes: {
          include: {
            camara: { select: { id: true, nombre: true } }
          },
          orderBy: { lado: 'asc' } // IZQUIERDA primero, DESPUÉS DERECHA
        }
      },
      orderBy: [
        { tropaCodigo: 'asc' },
        { garron: 'asc' }
      ]
    })

    // Armar filas del CSV
    // Cada romaneo con medias res genera filas: 1 fila por cada media res
    const filas: string[][] = []

    // Header CSV
    filas.push(['Tropa', 'Especie', 'Fecha', 'Periodo', 'Clasificacion', 'Despiece', 'Garón', 'Kilos', 'Camara', 'Destino', '', '', ''])

    for (const rom of romaneos) {
      const tropa = tropas.find(t => t.codigo === rom.tropaCodigo)
      const tropaNum = tropa?.numero || parseInt(rom.tropaCodigo || '0')
      const especie = tropa?.especie === 'BOVINO' ? '1' : '6'
      const fechaFaena = tropa?.fechaFaena || rom.fecha
      const fechaStr = formatFecha(fechaFaena)
      const periodo = String(fechaFaena.getFullYear())
      const clasificacion = buildClasificacion(rom.denticion, rom.tipoAnimal)
      const despiece = '2' // 1/2 res por defecto

      if (rom.mediasRes.length === 0) {
        // Sin medias res: usar pesoMediaIzq y pesoMediaDer del romaneo
        if (rom.pesoMediaIzq) {
          filas.push([String(tropaNum), especie, fechaStr, periodo, clasificacion, despiece, String(rom.garron), String(rom.pesoMediaIzq), '', destino, '', '', ''])
        }
        if (rom.pesoMediaDer) {
          filas.push([String(tropaNum), especie, fechaStr, periodo, clasificacion, despiece, String(rom.garron), String(rom.pesoMediaDer), '', destino, '', '', ''])
        }
      } else {
        // Con medias res: usar los datos de cada media
        for (const media of rom.mediasRes) {
          const camaraNum = extractCamaraNumber(media.camara?.nombre)
          filas.push([
            String(tropaNum),
            especie,
            fechaStr,
            periodo,
            clasificacion,
            despiece,
            String(rom.garron),
            String(media.peso),
            camaraNum,
            destino,
            '', '', ''
          ])
        }
      }
    }

    // Generar CSV
    const csvContent = filas.map(row => row.join(',')).join('\n')

    // Registrar auditoría
    if (operadorId) {
      await db.auditoria.create({
        data: {
          operadorId,
          modulo: 'REPORTES_SIGICA',
          accion: 'EXPORT',
          entidad: 'ExportacionCSV',
          descripcion: `Exportación SIGICA CSV - Fecha: ${fecha}, Tropas: ${tropas.map(t => t.numero).join(',')}, Registros: ${filas.length - 1}`,
        }
      })
    }

    // Armar nombre de archivo
    const fechaLimpia = fecha.replace(/-/g, '')
    const tropasNums = tropas.map(t => 't' + t.numero).join('')
    const filename = `Importacion_Faena_${tropasNums}_${fechaLimpia}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    })
  } catch (error) {
    logger.error('Error generando exportación SIGICA CSV', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar exportación CSV' },
      { status: 500 }
    )
  }
}

// POST - Preview de datos (sin descargar, para mostrar tabla en frontend)
export async function POST(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeReportes')
    if (authError) return authError

    const body = await request.json()
    const { fecha, destino, tropaIds } = body

    if (!fecha) {
      return NextResponse.json(
        { success: false, error: 'Fecha de faena obligatoria' },
        { status: 400 }
      )
    }

    const operadorId = request.headers.get('x-operador-id')

    // Parsear fecha
    const fechaInicio = new Date(`${fecha}T00:00:00`)
    const fechaFin = new Date(`${fecha}T23:59:59`)

    // Buscar tropas
    const tropasWhere: any = {
      fechaFaena: { gte: fechaInicio, lte: fechaFin },
      estado: { in: ['FAENADO', 'DESPACHADO'] },
      especie: 'BOVINO'
    }

    if (tropaIds && tropaIds.length > 0) {
      tropasWhere.numero = { in: tropaIds }
    }

    const tropas = await db.tropa.findMany({
      where: tropasWhere,
      include: {
        usuarioFaena: { select: { id: true, nombre: true } },
        _count: { select: { romaneos: true } }
      },
      orderBy: { numero: 'asc' }
    })

    if (tropas.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          tropas: [],
          registros: [],
          totalMedias: 0,
          totalKg: 0
        }
      })
    }

    // Contar romaneos confirmados por tropa
    const tropasConResumen = await Promise.all(tropas.map(async (tropa) => {
      const romaneos = await db.romaneo.findMany({
        where: {
          tropaCodigo: tropa.codigo,
          estado: 'CONFIRMADO'
        },
        include: {
          mediasRes: {
            include: {
              camara: { select: { id: true, nombre: true } }
            },
            orderBy: { lado: 'asc' }
          }
        },
        orderBy: { garron: 'asc' }
      })

      const registros = romaneos.flatMap(rom => {
        return rom.mediasRes.map(media => ({
          tropa: tropa.numero,
          tropaCodigo: tropa.codigo,
          especie: tropa.especie,
          fecha: formatFecha(tropa.fechaFaena || rom.fecha),
          periodo: String((tropa.fechaFaena || rom.fecha).getFullYear()),
          clasificacion: buildClasificacion(rom.denticion, rom.tipoAnimal),
          despiece: '2',
          garon: rom.garron,
          kilos: media.peso,
          camara: extractCamaraNumber(media.camara?.nombre),
          camaraNombre: media.camara?.nombre || '-',
          destino: destino || '106',
          tipoAnimal: rom.tipoAnimal || '-',
          denticion: rom.denticion || '-',
        }))
      })

      // Si no hay medias pero sí hay pesos en el romaneo
      if (registros.length === 0) {
        romaneos.forEach(rom => {
          if (rom.pesoMediaIzq) {
            registros.push({
              tropa: tropa.numero,
              tropaCodigo: tropa.codigo,
              especie: tropa.especie,
              fecha: formatFecha(tropa.fechaFaena || rom.fecha),
              periodo: String((tropa.fechaFaena || rom.fecha).getFullYear()),
              clasificacion: buildClasificacion(rom.denticion, rom.tipoAnimal),
              despiece: '2',
              garon: rom.garron,
              kilos: rom.pesoMediaIzq,
              camara: '',
              camaraNombre: '-',
              destino: destino || '106',
              tipoAnimal: rom.tipoAnimal || '-',
              denticion: rom.denticion || '-',
            })
          }
          if (rom.pesoMediaDer) {
            registros.push({
              tropa: tropa.numero,
              tropaCodigo: tropa.codigo,
              especie: tropa.especie,
              fecha: formatFecha(tropa.fechaFaena || rom.fecha),
              periodo: String((tropa.fechaFaena || rom.fecha).getFullYear()),
              clasificacion: buildClasificacion(rom.denticion, rom.tipoAnimal),
              despiece: '2',
              garon: rom.garron,
              kilos: rom.pesoMediaDer,
              camara: '',
              camaraNombre: '-',
              destino: destino || '106',
              tipoAnimal: rom.tipoAnimal || '-',
              denticion: rom.denticion || '-',
            })
          }
        })
      }

      return {
        tropaId: tropa.id,
        tropaNumero: tropa.numero,
        tropaCodigo: tropa.codigo,
        usuarioFaena: tropa.usuarioFaena?.nombre || '-',
        cantidadCabezas: tropa.cantidadCabezas,
        romaneosConfirmados: romaneos.length,
        registros,
        totalKg: registros.reduce((sum, r) => sum + (r.kilos || 0), 0),
      }
    }))

    const todosRegistros = tropasConResumen.flatMap(t => t.registros)
    const totalMedias = todosRegistros.length
    const totalKg = todosRegistros.reduce((sum, r) => sum + (r.kilos || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        tropas: tropasConResumen,
        registros: todosRegistros,
        totalMedias,
        totalKg: Math.round(totalKg * 10) / 10
      }
    })
  } catch (error) {
    logger.error('Error generando preview exportación SIGICA', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar preview' },
      { status: 500 }
    )
  }
}

// === Funciones auxiliares ===

function formatFecha(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// Extraer numero de cámara: "Cámara 1" -> "01", "Camara 2" -> "02"
function extractCamaraNumber(nombre: string | null | undefined): string {
  if (!nombre) return ''
  // Buscar numeros en el nombre
  const match = nombre.match(/\d+/)
  if (match) {
    return String(parseInt(match[0])).padStart(2, '0')
  }
  return ''
}
