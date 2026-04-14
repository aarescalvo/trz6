import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Especie } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const especie = searchParams.get('especie')

    const dateFilter: Record<string, unknown> = {}
    if (fechaDesde) dateFilter.gte = new Date(fechaDesde)
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      dateFilter.lte = hasta
    }

    const romaneos = await db.romaneo.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { fecha: dateFilter }),
        ...(especie && especie !== 'todas' && { tropa: { especie: especie.toUpperCase() as Especie } }),
      },
      include: {
        tipificador: true,
        tropa: { include: { productor: true } },
      },
      orderBy: { fecha: 'desc' },
    })

    const rindesPorTropa = romaneos.reduce((acc, r) => {
      const codigo = r.tropaCodigo || 'SIN_TROPA'
      const existente = acc.find(a => a.tropaCodigo === codigo)
      if (existente) {
        existente.cantidad++
        existente.pesoVivoTotal += r.pesoVivo || 0
        existente.pesoCanalTotal += r.pesoTotal || 0
      } else {
        acc.push({
          tropaCodigo: codigo,
          productor: r.tropa?.productor?.nombre || '-',
          cantidad: 1,
          pesoVivoTotal: r.pesoVivo || 0,
          pesoCanalTotal: r.pesoTotal || 0,
          rinde: 0,
        })
      }
      return acc
    }, [] as { tropaCodigo: string; productor: string; cantidad: number; pesoVivoTotal: number; pesoCanalTotal: number; rinde: number }[])

    rindesPorTropa.forEach(t => {
      t.rinde = t.pesoVivoTotal > 0 ? Number(((t.pesoCanalTotal / t.pesoVivoTotal) * 100).toFixed(2)) : 0
    })

    rindesPorTropa.sort((a, b) => b.rinde - a.rinde)

    return NextResponse.json({ success: true, data: rindesPorTropa })
  } catch (error) {
    console.error('Error en reporte rinde tropa:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
