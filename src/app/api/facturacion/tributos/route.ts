import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List tributos for a factura
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')
    
    const where: any = {}
    if (facturaId) where.facturaId = facturaId
    
    const tributos = await db.facturaTributo.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({ success: true, data: tributos })
  } catch (error) {
    console.error('Error fetching tributos:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener tributos' }, { status: 500 })
  }
}

// POST - Add tributo to a factura
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { facturaId, tributoId, descripcion, baseImponible, alicuota, importe } = body
    
    if (!facturaId || !descripcion) {
      return NextResponse.json({ success: false, error: 'Factura y descripción son requeridos' }, { status: 400 })
    }
    
    const tributo = await db.facturaTributo.create({
      data: { 
        facturaId, 
        tributoId: tributoId || 1, 
        descripcion, 
        baseImponible: baseImponible || 0, 
        alicuota: alicuota || 0, 
        importe: importe || 0 
      }
    })
    
    // Update factura importeTributos
    const allTributos = await db.facturaTributo.findMany({ where: { facturaId } })
    const totalTributos = allTributos.reduce((sum, t) => sum + t.importe, 0)
    await db.factura.update({ where: { id: facturaId }, data: { importeTributos: totalTributos } })
    
    return NextResponse.json({ success: true, data: tributo })
  } catch (error) {
    console.error('Error creating tributo:', error)
    return NextResponse.json({ success: false, error: 'Error al crear tributo' }, { status: 500 })
  }
}

// DELETE - Remove tributo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    
    const tributo = await db.facturaTributo.delete({ where: { id } })
    
    // Recalculate total
    const allTributos = await db.facturaTributo.findMany({ where: { facturaId: tributo.facturaId } })
    const totalTributos = allTributos.reduce((sum, t) => sum + t.importe, 0)
    await db.factura.update({ where: { id: tributo.facturaId }, data: { importeTributos: totalTributos } })
    
    return NextResponse.json({ success: true, message: 'Tributo eliminado' })
  } catch (error) {
    console.error('Error deleting tributo:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar tributo' }, { status: 500 })
  }
}
