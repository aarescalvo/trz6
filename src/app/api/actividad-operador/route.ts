import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener actividades de operadores
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const operadorId = searchParams.get('operadorId')
    const modulo = searchParams.get('modulo')
    const tipo = searchParams.get('tipo')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const limite = parseInt(searchParams.get('limite') || '100')

    const where: Record<string, unknown> = {}

    if (operadorId) {
      where.operadorId = operadorId
    }
    if (modulo) {
      where.modulo = modulo
    }
    if (tipo) {
      where.tipo = tipo
    }
    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) {
        where.fecha = { ...where.fecha as object, gte: new Date(fechaDesde) }
      }
      if (fechaHasta) {
        where.fecha = { ...where.fecha as object, lte: new Date(fechaHasta) }
      }
    }

    const actividades = await db.actividadOperador.findMany({
      where,
      include: {
        operador: {
          select: {
            id: true,
            nombre: true,
            usuario: true,
            rol: true
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      },
      take: limite
    })

    // Estadísticas
    const estadisticas = await db.actividadOperador.groupBy({
      by: ['operadorId'],
      where: operadorId ? { operadorId } : {},
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    // Obtener nombres de operadores para estadísticas
    const operadorIds = estadisticas.map(e => e.operadorId).filter(Boolean) as string[]
    const operadores = await db.operador.findMany({
      where: { id: { in: operadorIds } },
      select: { id: true, nombre: true, usuario: true, rol: true }
    })

    const estadisticasConOperador = estadisticas.map(e => ({
      operador: operadores.find(o => o.id === e.operadorId),
      totalActividades: e._count.id
    }))

    // Actividades por módulo
    const porModulo = await db.actividadOperador.groupBy({
      by: ['modulo'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    // Actividades por tipo
    const porTipo = await db.actividadOperador.groupBy({
      by: ['tipo'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: actividades,
      estadisticas: {
        porOperador: estadisticasConOperador,
        porModulo: porModulo.map(m => ({ modulo: m.modulo, total: m._count.id })),
        porTipo: porTipo.map(t => ({ tipo: t.tipo, total: t._count.id }))
      }
    })
  } catch (error) {
    console.error('Error al obtener actividades:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener actividades' },
      { status: 500 }
    )
  }
}

// POST - Registrar nueva actividad
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      operadorId,
      tipo,
      modulo,
      descripcion,
      entidad,
      entidadId,
      datos,
      ip,
      userAgent,
      sessionId
    } = body

    if (!operadorId || !tipo || !modulo || !descripcion) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: operadorId, tipo, modulo, descripcion' },
        { status: 400 }
      )
    }

    const actividad = await db.actividadOperador.create({
      data: {
        operadorId,
        tipo,
        modulo,
        descripcion,
        entidad,
        entidadId,
        datos: datos ? JSON.stringify(datos) : null,
        ip,
        userAgent,
        sessionId
      }
    })

    return NextResponse.json({
      success: true,
      data: actividad
    })
  } catch (error) {
    console.error('Error al registrar actividad:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar actividad' },
      { status: 500 }
    )
  }
}
