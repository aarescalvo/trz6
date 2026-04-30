import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar precios por cliente
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const productoVendibleId = searchParams.get('productoVendibleId')

    const where: any = {}
    if (clienteId) where.clienteId = clienteId
    if (productoVendibleId) where.productoVendibleId = productoVendibleId

    const precios = await db.precioCliente.findMany({
      where,
      include: {
        cliente: {
          select: { id: true, nombre: true, cuit: true }
        },
        productoVendible: {
          select: { id: true, codigo: true, nombre: true, precioBase: true }
        }
      },
      orderBy: [
        { cliente: { nombre: 'asc' } },
        { productoVendible: { nombre: 'asc' } }
      ]
    })

    return NextResponse.json({
      success: true,
      data: precios
    })
  } catch (error) {
    console.error('Error obteniendo precios por cliente:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener precios por cliente' },
      { status: 500 }
    )
  }
}

// POST - Crear/actualizar precio por cliente
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { clienteId, productoVendibleId, precioEspecial, moneda, fechaHasta } = body

    if (!clienteId || !productoVendibleId || precioEspecial === undefined) {
      return NextResponse.json(
        { success: false, error: 'Cliente, producto y precio son requeridos' },
        { status: 400 }
      )
    }

    // Verificar si ya existe un precio para este cliente/producto
    const existente = await db.precioCliente.findFirst({
      where: {
        clienteId,
        productoVendibleId,
        activo: true
      }
    })

    let precio
    if (existente) {
      // Actualizar existente
      precio = await db.precioCliente.update({
        where: { id: existente.id },
        data: {
          precioEspecial,
          moneda: moneda || 'ARS',
          fechaHasta: fechaHasta ? new Date(fechaHasta) : null
        },
        include: {
          cliente: { select: { id: true, nombre: true } },
          productoVendible: { select: { id: true, nombre: true } }
        }
      })
    } else {
      // Crear nuevo
      precio = await db.precioCliente.create({
        data: {
          clienteId,
          productoVendibleId,
          precioEspecial,
          moneda: moneda || 'ARS',
          fechaHasta: fechaHasta ? new Date(fechaHasta) : null
        },
        include: {
          cliente: { select: { id: true, nombre: true } },
          productoVendible: { select: { id: true, nombre: true } }
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: precio,
      message: `Precio especial guardado: ${precio.cliente.nombre} - ${precio.productoVendible.nombre} = ${precioEspecial} ${moneda || 'ARS'}`
    })
  } catch (error) {
    console.error('Error guardando precio por cliente:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar precio por cliente' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar precio por cliente
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, precioEspecial, moneda, fechaHasta, activo } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const precio = await db.precioCliente.update({
      where: { id },
      data: {
        precioEspecial,
        moneda,
        fechaHasta: fechaHasta ? new Date(fechaHasta) : null,
        activo
      }
    })

    return NextResponse.json({
      success: true,
      data: precio,
      message: 'Precio actualizado'
    })
  } catch (error) {
    console.error('Error actualizando precio por cliente:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar precio' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar/desactivar precio por cliente
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // En lugar de eliminar, desactivamos
    await db.precioCliente.update({
      where: { id },
      data: { activo: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Precio desactivado'
    })
  } catch (error) {
    console.error('Error eliminando precio por cliente:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar precio' },
      { status: 500 }
    )
  }
}
