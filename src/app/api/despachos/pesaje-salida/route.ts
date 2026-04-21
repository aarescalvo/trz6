import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Registrar pesaje de salida para un despacho
import { checkPermission } from '@/lib/auth-helpers'
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { despachoId, pesoBruto, pesoTara, operadorId } = body

    if (!despachoId || pesoBruto === undefined || pesoTara === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    const pesoNeto = pesoBruto - pesoTara

    // Obtener el despacho
    const despacho = await db.despacho.findUnique({
      where: { id: despachoId },
      include: {
        cliente: true,
        lineas: true
      }
    })

    if (!despacho) {
      return NextResponse.json(
        { success: false, error: 'Despacho no encontrado' },
        { status: 404 }
      )
    }

    // Crear el pesaje de camión de salida
    const numerador = await db.numerador.upsert({
      where: { nombre: 'TICKET_SALIDA' },
      update: { ultimoNumero: { increment: 1 } },
      create: { nombre: 'TICKET_SALIDA', ultimoNumero: 1 }
    })

    const pesajeCamion = await db.pesajeCamion.create({
      data: {
        tipo: 'SALIDA_MERCADERIA',
        numeroTicket: numerador.ultimoNumero,
        patenteChasis: despacho.patenteChasis || '',
        patenteAcoplado: despacho.patenteAcoplado || '',
        choferNombre: despacho.choferNombre || '',
        choferDni: despacho.choferDni,
        pesoBruto,
        pesoTara,
        pesoNeto,
        estado: 'CERRADO',
        operadorId
      }
    })

    // Actualizar el despacho con el pesaje y cambiar estado
    const despachoActualizado = await db.despacho.update({
      where: { id: despachoId },
      data: {
        pesajeCamionId: pesajeCamion.id,
        estado: 'DESPACHADO',
        fechaDespacho: new Date()
      },
      include: {
        cliente: true,
        lineas: { include: { camaraOrigen: true } } as any
      }
    })

    // Registrar auditoría
    await db.auditoria.create({
      data: {
        operadorId,
        modulo: 'DESPACHO',
        accion: 'PESAJE_SALIDA',
        entidad: 'Despacho',
        entidadId: despachoId,
        descripcion: `Pesaje de salida registrado: Bruto ${pesoBruto}kg, Tara ${pesoTara}kg, Neto ${pesoNeto.toFixed(1)}kg`
      }
    })

    // Actualizar estado de las medias res despachadas
    for (const linea of despacho.lineas) {
      if (linea.mediaResId) {
        await db.mediaRes.update({
          where: { id: linea.mediaResId },
          data: { estado: 'DESPACHADO' }
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        despacho: despachoActualizado,
        pesaje: pesajeCamion
      }
    })
  } catch (error) {
    console.error('Error registrando pesaje de salida:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pesaje de salida' },
      { status: 500 }
    )
  }
}
