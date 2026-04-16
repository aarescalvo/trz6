import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener configuración de balanza
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    let config = await db.configuracionBalanza.findFirst({
      where: { activa: true }
    })

    if (!config) {
      // Crear configuración por defecto
      config = await db.configuracionBalanza.create({
        data: {
          nombre: 'Balanza Principal',
          puerto: 'COM1',
          baudRate: 9600,
          dataBits: 8,
          parity: 'none',
          stopBits: 1,
          protocolo: 'TOLEDO',
          activa: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error fetching balanza config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener configuración'
    }, { status: 500 })
  }
}

// PUT - Actualizar configuración
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const data = await request.json()
    const { id, ...updateData } = data

    const config = await db.configuracionBalanza.update({
      where: { id },
      data: {
        ...updateData,
        ultimoTest: updateData.probarConexion ? new Date() : undefined
      }
    })

    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error updating balanza config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar configuración'
    }, { status: 500 })
  }
}

// POST - Crear nueva configuración
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const data = await request.json()

    const config = await db.configuracionBalanza.create({
      data: {
        nombre: data.nombre || 'Nueva Balanza',
        puerto: data.puerto || 'COM1',
        baudRate: data.baudRate || 9600,
        dataBits: data.dataBits || 8,
        parity: data.parity || 'none',
        stopBits: data.stopBits || 1,
        protocolo: data.protocolo || 'TOLEDO',
        activa: true
      }
    })

    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error creating balanza config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear configuración'
    }, { status: 500 })
  }
}
