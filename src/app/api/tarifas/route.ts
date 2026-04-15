import { NextRequest, NextResponse } from 'next/server'
import { tarifasService } from '@/modules/facturacion/services/tarifas.service'
import { crearTarifaSchema } from '@/modules/facturacion/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modo = searchParams.get('modo') || 'vigentes'
    
    if (modo === 'vigentes') {
      const data = await tarifasService.getVigentes()
      return NextResponse.json({ success: true, data })
    }
    
    if (modo === 'historico') {
      const data = await tarifasService.getHistorico({
        tipoTarifaCodigo: searchParams.get('tipo') || undefined,
        clienteId: searchParams.get('clienteId') || undefined,
        especie: searchParams.get('especie') || undefined,
        desde: searchParams.get('desde') ? new Date(searchParams.get('desde')!) : undefined,
        hasta: searchParams.get('hasta') ? new Date(searchParams.get('hasta')!) : undefined,
      })
      return NextResponse.json({ success: true, data })
    }
    
    if (modo === 'vigente') {
      const tarifa = await tarifasService.getTarifaVigente({
        tipoTarifaCodigo: searchParams.get('tipo')!,
        fechaFaena: searchParams.get('fecha') ? new Date(searchParams.get('fecha')!) : new Date(),
        clienteId: searchParams.get('clienteId') || null,
        especie: searchParams.get('especie') || null,
        categoria: searchParams.get('categoria') || null,
      })
      return NextResponse.json({ success: true, data: tarifa })
    }
    
    if (modo === 'tipos') {
      const data = await tarifasService.getTiposActivos()
      return NextResponse.json({ success: true, data })
    }
    
    if (modo === 'seed') {
      const created = await tarifasService.seedTiposDefault()
      return NextResponse.json({ success: true, message: `${created} tipos de tarifa creados` })
    }
    
    return NextResponse.json({ success: false, error: 'Modo no válido' }, { status: 400 })
  } catch (error: any) {
    console.error('Error tarifas GET:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = crearTarifaSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors.map(e => e.message).join(', ') }, { status: 400 })
    }
    
    const data = await tarifasService.crearTarifa({
      ...parsed.data,
      vigenciaDesde: new Date(parsed.data.vigenciaDesde),
    })
    
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error tarifas POST:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
