import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Obtener precio sugerido para un cliente y producto
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const productoVendibleId = searchParams.get('productoVendibleId')
    const codigoProducto = searchParams.get('codigoProducto')

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }

    // Si se proporciona código de producto, buscar por código
    let productoVendibleIdFinal = productoVendibleId
    let producto: Awaited<ReturnType<typeof db.productoVendible.findUnique>> | null = null
    if (codigoProducto && !productoVendibleIdFinal) {
      producto = await db.productoVendible.findUnique({
        where: { codigo: codigoProducto }
      })
      if (!producto) {
        return NextResponse.json(
          { success: false, error: 'Producto no encontrado' },
          { status: 404 }
        )
      }
      productoVendibleIdFinal = producto.id
    }

    if (!productoVendibleIdFinal) {
      return NextResponse.json(
        { success: false, error: 'productoVendibleId o codigoProducto es requerido' },
        { status: 400 }
      )
    }

    // Si no tenemos el producto, buscarlo
    if (!producto) {
      producto = await db.productoVendible.findUnique({
        where: { id: productoVendibleIdFinal! }
      })
    }

    if (!producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // PRIORIDAD 1: Precio cliente específico vigente
    const precioCliente = await db.precioCliente.findFirst({
      where: {
        clienteId,
        productoVendibleId: productoVendibleIdFinal,
        activo: true,
        OR: [
          { fechaHasta: null },
          { fechaHasta: { gte: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    if (precioCliente) {
      return NextResponse.json({
        success: true,
        data: {
          precio: precioCliente.precioEspecial,
          moneda: precioCliente.moneda,
          fuente: 'PRECIO_CLIENTE',
          fuenteDescripcion: 'Precio especial acordado con el cliente',
          precioId: precioCliente.id,
          vigenciaDesde: precioCliente.fechaDesde,
          vigenciaHasta: precioCliente.fechaHasta
        }
      })
    }

    // PRIORIDAD 2: Último precio facturado a este cliente
    const ultimoPrecioFacturado = await db.detalleFactura.findFirst({
      where: {
        facturaId: { not: undefined },
      },
      include: {
        factura: {
          select: {
            fecha: true,
            numero: true,
            clienteId: true
          }
        }
      },
      orderBy: { factura: { fecha: 'desc' } }
    })

    if (ultimoPrecioFacturado) {
      return NextResponse.json({
        success: true,
        data: {
          precio: ultimoPrecioFacturado.precioUnitario,
          moneda: 'ARS',
          fuente: 'ULTIMA_FACTURA',
          fuenteDescripcion: `Último precio facturado (Factura ${ultimoPrecioFacturado.factura.numero})`,
          fechaUltimaFactura: ultimoPrecioFacturado.factura?.fecha,
          facturaId: ultimoPrecioFacturado.facturaId
        }
      })
    }

    // PRIORIDAD 3: Precio base del producto (último histórico)
    const ultimoPrecioHistorico = await db.historicoPrecioProducto.findFirst({
      where: { productoVendibleId: productoVendibleIdFinal },
      orderBy: { fechaVigencia: 'desc' }
    })

    if (ultimoPrecioHistorico) {
      return NextResponse.json({
        success: true,
        data: {
          precio: ultimoPrecioHistorico.precioNuevo,
          moneda: ultimoPrecioHistorico.moneda,
          fuente: 'LISTA_BASE',
          fuenteDescripcion: 'Precio de lista base',
          fechaVigencia: ultimoPrecioHistorico.fechaVigencia
        }
      })
    }

    // PRIORIDAD 4: Precio base directo del producto
    if (producto.precioBase) {
      return NextResponse.json({
        success: true,
        data: {
          precio: producto.precioBase,
          moneda: producto.moneda,
          fuente: 'PRECIO_BASE',
          fuenteDescripcion: 'Precio base del producto'
        }
      })
    }

    // Sin precio disponible
    return NextResponse.json({
      success: true,
      data: {
        precio: 0,
        moneda: 'ARS',
        fuente: 'SIN_PRECIO',
        fuenteDescripcion: 'No hay precio registrado - debe ingresar manualmente'
      }
    })
  } catch (error) {
    console.error('Error obteniendo precio sugerido:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener precio sugerido' },
      { status: 500 }
    )
  }
}
