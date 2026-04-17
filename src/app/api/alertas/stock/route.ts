import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { checkPermission } from '@/lib/auth-helpers'

const logger = createLogger('API:AlertasStock')

// GET - Alertas de stock bajo y crítico
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError

  try {
    const alertas: any[] = []

    const hace15Dias = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    const mediasSinMovimiento = await db.mediaRes.count({
      where: {
        estado: 'EN_CAMARA',
        ingresoCamaraAt: { lte: hace15Dias }
      }
    })

    if (mediasSinMovimiento > 0) {
      alertas.push({
        producto: 'Medias de Res en cámara sin movimiento (>15d)',
        stockActual: mediasSinMovimiento,
        stockMinimo: 0,
        nivel: mediasSinMovimiento > 30 ? 'CRITICO' : 'ADVERTENCIA',
        tipo: 'MEDIAS_RES'
      })
    }

    const corrales = await db.corral.findMany({
      where: { activo: true },
      include: { _count: { select: { animales: true } } }
    })

    for (const corral of corrales) {
      const ocupacion = corral.capacidad > 0 ? (corral._count.animales / corral.capacidad) * 100 : 0
      if (ocupacion >= 90) {
        alertas.push({
          producto: `Corral: ${corral.nombre}`,
          stockActual: corral._count.animales,
          stockMinimo: corral.capacidad,
          nivel: ocupacion >= 100 ? 'CRITICO' : 'ADVERTENCIA',
          tipo: 'CORRAL'
        })
      }
    }

    const insumos = await db.insumo.findMany({
      where: { activo: true, stockMinimo: { gt: 0 } }
    })

    for (const insumo of insumos) {
      if (insumo.stockActual <= insumo.stockMinimo) {
        alertas.push({
          producto: `Insumo: ${insumo.nombre}`,
          stockActual: insumo.stockActual,
          stockMinimo: insumo.stockMinimo,
          nivel: insumo.stockActual === 0 ? 'CRITICO' : 'ADVERTENCIA',
          tipo: 'INSUMO'
        })
      }
    }

    const cajasDisponibles = await db.cajaEmpaque.count({
      where: { estado: 'DISPONIBLE' }
    })

    if (cajasDisponibles > 50) {
      alertas.push({
        producto: 'Cajas de Empaque en stock',
        stockActual: cajasDisponibles,
        stockMinimo: 10,
        nivel: 'ADVERTENCIA',
        tipo: 'CAJAS'
      })
    }

    return NextResponse.json({
      success: true,
      alertas
    })
  } catch (error) {
    logger.error('Error en alertas de stock', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener alertas de stock' },
      { status: 500 }
    )
  }
}
