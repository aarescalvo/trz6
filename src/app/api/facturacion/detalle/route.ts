import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET: Obtener detalles de una factura
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const facturaId = searchParams.get('facturaId')
    const tropaId = searchParams.get('tropaId')

    if (facturaId) {
      // Obtener detalles de una factura específica
      const detalles = await db.detalleFacturaServicio.findMany({
        where: { facturaId },
        include: {
          tropa: {
            include: {
              usuarioFaena: {
                select: {
                  id: true,
                  nombre: true,
                  cuit: true,
                }
              }
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: detalles
      })
    }

    if (tropaId) {
      // Verificar si una tropa ya está facturada
      const detalle = await db.detalleFacturaServicio.findFirst({
        where: { tropaId },
        include: {
          factura: {
            include: {
              cliente: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: detalle
      })
    }

    // Obtener todos los detalles
    const detalles = await db.detalleFacturaServicio.findMany({
      include: {
        tropa: {
          select: {
            id: true,
            codigo: true,
            cantidadCabezas: true,
          }
        },
        factura: {
          select: {
            id: true,
            numero: true,
            estado: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: detalles
    })
  } catch (error) {
    console.error('Error fetching detalles:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener detalles' },
      { status: 500 }
    )
  }
}

// POST: Agregar detalle (tropa) a factura
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      facturaId,
      tropaId,
      cantidadAnimales,
      servicioDespostada = 0,
      ventaMenudencia = 0,
      ventaHueso = 0,
      ventaGrasa = 0,
      ventaCuero = 0,
      conRecupero = false,
    } = body

    // Verificar que la factura existe y está pendiente
    const factura = await db.facturaServicio.findUnique({
      where: { id: facturaId },
      include: { cliente: true }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 400 }
      )
    }

    if (factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden agregar detalles a facturas pendientes' },
        { status: 400 }
      )
    }

    // Verificar que la tropa no esté ya facturada
    const detalleExistente = await db.detalleFacturaServicio.findFirst({
      where: { tropaId }
    })

    if (detalleExistente) {
      return NextResponse.json(
        { success: false, error: 'Esta tropa ya está facturada' },
        { status: 400 }
      )
    }

    // Obtener datos de la tropa
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId }
    })

    if (!tropa) {
      return NextResponse.json(
        { success: false, error: 'Tropa no encontrada' },
        { status: 400 }
      )
    }

    // Calcular KG gancho
    const romaneos = await db.romaneo.findMany({
      where: {
        tropaCodigo: tropa.codigo,
        estado: 'CONFIRMADO'
      }
    })

    const kgGancho = romaneos.reduce((sum, r) => sum + (r.pesoTotal || 0), 0)

    // Determinar precio según tipo de recupero
    const precioPorKg = conRecupero 
      ? (factura.cliente.precioServicioConRecupero || 0)
      : (factura.cliente.precioServicioSinRecupero || 0)

    const servicioFaena = kgGancho * precioPorKg
    const subtotal = servicioFaena + servicioDespostada - ventaMenudencia

    // Crear detalle
    const detalle = await db.detalleFacturaServicio.create({
      data: {
        facturaId,
        tropaId,
        tropaCodigo: tropa.codigo,
        cantidadAnimales: cantidadAnimales || tropa.cantidadCabezas,
        kgGancho,
        servicioFaena,
        servicioDespostada,
        ventaMenudencia,
        ventaHueso,
        ventaGrasa,
        ventaCuero,
        subtotal,
      },
      include: {
        tropa: true
      }
    })

    // Actualizar totales de la factura
    const todosDetalles = await db.detalleFacturaServicio.findMany({
      where: { facturaId }
    })

    const nuevoSubtotal = todosDetalles.reduce((sum, d) => sum + d.subtotal, 0) + subtotal
    const nuevoIva = nuevoSubtotal * 0.21
    const nuevoTotal = nuevoSubtotal + nuevoIva

    await db.facturaServicio.update({
      where: { id: facturaId },
      data: {
        subtotal: nuevoSubtotal,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      data: detalle
    })
  } catch (error) {
    console.error('Error creating detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear detalle: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// PUT: Actualizar detalle
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      id,
      cantidadAnimales,
      servicioDespostada,
      ventaMenudencia,
      ventaHueso,
      ventaGrasa,
      ventaCuero,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de detalle requerido' },
        { status: 400 }
      )
    }

    // Obtener detalle actual
    const detalleActual = await db.detalleFacturaServicio.findUnique({
      where: { id },
      include: { factura: true }
    })

    if (!detalleActual) {
      return NextResponse.json(
        { success: false, error: 'Detalle no encontrado' },
        { status: 400 }
      )
    }

    if (detalleActual.factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden modificar detalles de facturas pendientes' },
        { status: 400 }
      )
    }

    // Calcular nuevo subtotal
    const nuevoSubtotal = 
      detalleActual.servicioFaena + 
      (servicioDespostada ?? detalleActual.servicioDespostada) - 
      (ventaMenudencia ?? detalleActual.ventaMenudencia)

    // Actualizar detalle
    const detalle = await db.detalleFacturaServicio.update({
      where: { id },
      data: {
        cantidadAnimales: cantidadAnimales ?? detalleActual.cantidadAnimales,
        servicioDespostada: servicioDespostada ?? detalleActual.servicioDespostada,
        ventaMenudencia: ventaMenudencia ?? detalleActual.ventaMenudencia,
        ventaHueso: ventaHueso ?? detalleActual.ventaHueso,
        ventaGrasa: ventaGrasa ?? detalleActual.ventaGrasa,
        ventaCuero: ventaCuero ?? detalleActual.ventaCuero,
        subtotal: nuevoSubtotal,
      }
    })

    // Recalcular totales de la factura
    const todosDetalles = await db.detalleFacturaServicio.findMany({
      where: { facturaId: detalleActual.facturaId }
    })

    const nuevoSubtotalFactura = todosDetalles.reduce((sum, d) => sum + d.subtotal, 0)
    const nuevoIva = nuevoSubtotalFactura * 0.21
    const nuevoTotal = nuevoSubtotalFactura + nuevoIva

    await db.facturaServicio.update({
      where: { id: detalleActual.facturaId },
      data: {
        subtotal: nuevoSubtotalFactura,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      data: detalle
    })
  } catch (error) {
    console.error('Error updating detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar detalle' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar detalle
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de detalle requerido' },
        { status: 400 }
      )
    }

    // Obtener detalle actual
    const detalleActual = await db.detalleFacturaServicio.findUnique({
      where: { id },
      include: { factura: true }
    })

    if (!detalleActual) {
      return NextResponse.json(
        { success: false, error: 'Detalle no encontrado' },
        { status: 400 }
      )
    }

    if (detalleActual.factura.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden eliminar detalles de facturas pendientes' },
        { status: 400 }
      )
    }

    const facturaId = detalleActual.facturaId

    // Eliminar detalle
    await db.detalleFacturaServicio.delete({
      where: { id }
    })

    // Recalcular totales de la factura
    const detallesRestantes = await db.detalleFacturaServicio.findMany({
      where: { facturaId }
    })

    const nuevoSubtotal = detallesRestantes.reduce((sum, d) => sum + d.subtotal, 0)
    const nuevoIva = nuevoSubtotal * 0.21
    const nuevoTotal = nuevoSubtotal + nuevoIva

    await db.facturaServicio.update({
      where: { id: facturaId },
      data: {
        subtotal: nuevoSubtotal,
        iva: nuevoIva,
        total: nuevoTotal
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Detalle eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting detalle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar detalle' },
      { status: 500 }
    )
  }
}
