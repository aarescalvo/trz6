import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List notas de crédito/débito
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')
    const tipo = searchParams.get('tipo')
    
    const where: any = {}
    if (facturaId) where.facturaId = facturaId
    if (tipo) where.tipo = tipo
    
    const notas = await db.notaCreditoDebito.findMany({
      where,
      include: { 
        factura: { 
          select: { id: true, numero: true, clienteNombre: true } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ success: true, data: notas })
  } catch (error) {
    console.error('Error fetching notas:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener notas' }, { status: 500 })
  }
}

// POST - Create nota de crédito/débito
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { facturaId, tipo, motivo, descripcion, subtotal, iva, total, operadorId } = body
    
    if (!facturaId || !tipo || !motivo) {
      return NextResponse.json(
        { success: false, error: 'Factura, tipo y motivo son requeridos' }, 
        { status: 400 }
      )
    }
    
    // Get numerador for notas
    const numerador = await db.numerador.upsert({
      where: { nombre: 'NOTA_CREDITO_DEBITO' },
      update: { ultimoNumero: { increment: 1 } },
      create: { nombre: 'NOTA_CREDITO_DEBITO', ultimoNumero: 1 }
    })
    
    // Determine tipoComprobante AFIP code based on factura type
    const factura = await db.factura.findUnique({ where: { id: facturaId } })
    let tipoComprobante = 3 // Default: Nota Crédito A
    if (tipo === 'DEBITO') tipoComprobante = 2 // Nota Débito A
    if (factura?.tipoComprobante === 'FACTURA_B') {
      tipoComprobante = tipo === 'CREDITO' ? 8 : 7 // Nota Crédito B / Nota Débito B
    }
    if (factura?.tipoComprobante === 'FACTURA_C') {
      tipoComprobante = tipo === 'CREDITO' ? 13 : 12 // Nota Crédito C / Nota Débito C
    }
    
    const nota = await db.notaCreditoDebito.create({
      data: {
        tipo,
        tipoComprobante,
        facturaId,
        numero: numerador.ultimoNumero,
        puntoVenta: factura?.puntoVenta || 1,
        motivo,
        descripcion,
        subtotal: subtotal || 0,
        iva: iva || 0,
        total: total || 0,
        operadorId
      }
    })
    
    return NextResponse.json({ success: true, data: nota })
  } catch (error) {
    console.error('Error creating nota:', error)
    return NextResponse.json({ success: false, error: 'Error al crear nota' }, { status: 500 })
  }
}
