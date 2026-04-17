import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const tropaCodigo = searchParams.get('tropaCodigo')

    // Build where clause for ListasFaena
    const listaFaenaWhere: any = {}
    if (fechaDesde || fechaHasta) {
      listaFaenaWhere.fecha = {}
      if (fechaDesde) listaFaenaWhere.fecha.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        listaFaenaWhere.fecha.lte = hasta
      }
    }

    // Find all ListasFaena in the date range
    const listasFaena = await db.listaFaena.findMany({
      where: listaFaenaWhere,
      include: {
        tropas: {
          include: {
            tropa: {
              include: {
                productor: true,
                usuarioFaena: true,
                animales: true,
              }
            }
          }
        },
        asignaciones: {
          include: {
            romaneoRef: {
              include: {
                mediasRes: {
                  include: {
                    despachoItems: {
                      include: {
                        despacho: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    // If tropaCodigo filter is specified, filter the results
    const filteredListas = tropaCodigo
      ? listasFaena.map(lf => ({
          ...lf,
          tropas: lf.tropas.filter(t => t.tropa.codigo.toLowerCase().includes(tropaCodigo.toLowerCase()))
        })).filter(lf => lf.tropas.length > 0)
      : listasFaena

    // Build the result array - one row per tropa
    const result: any[] = []

    for (const lista of filteredListas) {
      for (const listaTropa of lista.tropas) {
        const tropa = listaTropa.tropa

        // Get romaneos for this tropa via asignaciones
        const romaneosDeTropa = lista.asignaciones
          .filter(a => a.tropaCodigo === tropa.codigo)
          .map(a => a.romaneoRef)
          .filter(Boolean)

        // Also fetch romaneos directly by tropaCodigo
        const romaneos = romaneosDeTropa.length > 0
          ? romaneosDeTropa
          : await db.romaneo.findMany({
              where: { tropaCodigo: tropa.codigo },
              include: {
                mediasRes: {
                  include: {
                    despachoItems: {
                      include: {
                        despacho: true
                      }
                    }
                  }
                }
              }
            })

        // Get all medias for this tropa
        const allMedias = romaneos.flatMap((r: any) => r.mediasRes || [])

        const totalMedias = allMedias.length
        const mediasDespachadas = allMedias.filter((m: any) => m.estado === 'DESPACHADO').length
        const mediasEnCamara = allMedias.filter((m: any) => m.estado === 'EN_CAMARA').length
        const mediasFacturadas = allMedias.filter((m: any) => m.facturado).length

        const totalKgFaenados = allMedias.reduce((sum: number, m: any) => sum + (m.peso || 0), 0)
        const totalKgDespachados = allMedias
          .filter((m: any) => m.estado === 'DESPACHADO')
          .reduce((sum: number, m: any) => sum + (m.peso || 0), 0)
        const totalKgFacturados = allMedias
          .filter((m: any) => m.facturado)
          .reduce((sum: number, m: any) => sum + (m.peso || 0), 0)

        // Find facturas related to this tropa
        const facturasFromDetalles = await db.factura.findMany({
          where: {
            detalles: {
              some: {
                tropaCodigo: tropa.codigo
              }
            }
          },
          include: {
            pagos: true
          }
        })

        const facturasFromDespacho = await db.factura.findMany({
          where: {
            detalles: {
              some: {
                tropaCodigo: tropa.codigo
              }
            }
          },
          include: {
            pagos: true
          }
        })

        // Combine and deduplicate facturas
        const allFacturas = [...facturasFromDetalles, ...facturasFromDespacho]
        const uniqueFacturas = Array.from(
          new Map(allFacturas.map((f: any) => [f.id, f])).values()
        )

        const montoFacturado = uniqueFacturas.reduce((sum: number, f: any) => sum + (f.total || 0), 0)
        const montoCobrado = uniqueFacturas
          .filter((f: any) => f.estado === 'PAGADA')
          .reduce((sum: number, f: any) => sum + (f.total || 0), 0)

        const porcentajeCicloCerrado = totalMedias > 0
          ? Math.round((mediasFacturadas / totalMedias) * 10000) / 100
          : 0

        result.push({
          tropaCodigo: tropa.codigo,
          tropaId: tropa.id,
          fechaFaena: lista.fecha,
          productorNombre: tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-',
          usuarioFaenaNombre: tropa.usuarioFaena?.nombre || '-',
          totalCabezas: tropa.cantidadCabezas,
          totalMedias,
          mediasDespachadas,
          mediasEnCamara,
          mediasFacturadas,
          totalKgFaenados: Math.round(totalKgFaenados * 100) / 100,
          totalKgDespachados: Math.round(totalKgDespachados * 100) / 100,
          totalKgFacturados: Math.round(totalKgFacturados * 100) / 100,
          montoFacturado: Math.round(montoFacturado * 100) / 100,
          montoCobrado: Math.round(montoCobrado * 100) / 100,
          porcentajeCicloCerrado,
          facturas: uniqueFacturas.map((f: any) => ({
            id: f.id,
            numero: f.numero,
            estado: f.estado,
            total: f.total,
            saldo: f.saldo,
            fecha: f.fecha
          }))
        })
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error en conciliacion-faena-factura:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte de conciliación' },
      { status: 500 }
    )
  }
}
