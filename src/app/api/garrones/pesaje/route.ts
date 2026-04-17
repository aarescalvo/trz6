import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Pesaje de media res con impresión de rótulo
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeListaFaena')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      garron,
      lado,
      peso,
      denticion,
      camaraId,
      tipificadorId,
      operadorId,
      listaFaenaId,
      esDecomiso
    } = body

    if (!garron || !lado) {
      return NextResponse.json(
        { success: false, error: 'garron y lado son requeridos' },
        { status: 400 }
      )
    }

    // Obtener la asignación de garrón
    const asignacion = await db.asignacionGarron.findFirst({
      where: {
        garron,
        listaFaenaId
      },
      include: {
        animal: {
          include: {
            tropa: true
          }
        }
      }
    })

    if (!asignacion) {
      return NextResponse.json(
        { success: false, error: 'Garrón no encontrado en la lista de faena' },
        { status: 404 }
      )
    }

    // Verificar si ya existe esta media
    const mediaExistente = await db.mediaRes.findFirst({
      where: {
        romaneo: {
          garron,
          listaFaenaId
        },
        lado: lado === 'DER' ? 'DERECHA' : 'IZQUIERDA'
      }
    })

    if (mediaExistente) {
      return NextResponse.json(
        { success: false, error: 'Esta media ya fue pesada', data: mediaExistente },
        { status: 400 }
      )
    }

    // Obtener o crear romaneo
    let romaneo = await db.romaneo.findFirst({
      where: {
        garron,
        listaFaenaId
      }
    })

    const fecha = new Date()
    const fechaStr = fecha.toISOString().split('T')[0].replace(/-/g, '').slice(2) // DDMMYY

    // Generar código de barras: tropaCodigo-garron-lado-fechaFaena
    const tropaCodigo = asignacion.animal.tropa?.codigo || 'S/T'
    const codigo = `${tropaCodigo}-${garron}-${lado}-${fechaStr}`

    const pesoNum = peso ? parseFloat(peso) : 0
    const esDecomisoBool = esDecomiso === true

    if (!romaneo) {
      // Crear romaneo
      romaneo = await db.romaneo.create({
        data: {
          garron,
          listaFaenaId,
          tropaCodigo,
          numeroAnimal: asignacion.numeroAnimal,
          tipoAnimal: asignacion.animal.tipoAnimal,
          raza: asignacion.animal.raza,
          pesoVivo: asignacion.animal.pesoVivo,
          denticion: denticion || '2',
          tipificadorId,
          operadorId,
          estado: 'PENDIENTE',
          pesoMediaIzq: lado === 'IZQ' ? pesoNum : null,
          pesoMediaDer: lado === 'DER' ? pesoNum : null,
          pesoTotal: pesoNum
        }
      })
    } else {
      // Actualizar romaneo existente
      const updateData: Record<string, unknown> = {}
      if (lado === 'DER') {
        updateData.pesoMediaDer = pesoNum
      } else {
        updateData.pesoMediaIzq = pesoNum
      }
      
      // Recalcular peso total y rinde
      const pesoDer = lado === 'DER' ? pesoNum : (romaneo.pesoMediaDer || 0)
      const pesoIzq = lado === 'IZQ' ? pesoNum : (romaneo.pesoMediaIzq || 0)
      updateData.pesoTotal = pesoDer + pesoIzq
      
      if (romaneo.pesoVivo && (pesoDer + pesoIzq) > 0) {
        updateData.rinde = ((pesoDer + pesoIzq) / romaneo.pesoVivo) * 100
      }

      if (denticion) updateData.denticion = denticion
      if (tipificadorId) updateData.tipificadorId = tipificadorId

      romaneo = await db.romaneo.update({
        where: { id: romaneo.id },
        data: updateData
      })
    }

    // Crear media res
    const mediaRes = await db.mediaRes.create({
      data: {
        romaneoId: romaneo.id,
        lado: lado === 'DER' ? 'DERECHA' : 'IZQUIERDA',
        peso: pesoNum,
        sigla: 'A',
        codigo,
        camaraId: camaraId || null,
        estado: camaraId ? 'EN_CAMARA' : 'EN_CAMARA'
      }
    })

    // Actualizar stock de cámara si corresponde
    if (camaraId && !esDecomisoBool) {
      const especie = asignacion.animal.tropa?.especie || 'BOVINO'
      
      const stockExistente = await db.stockMediaRes.findUnique({
        where: {
          camaraId_tropaCodigo_especie: {
            camaraId,
            tropaCodigo: tropaCodigo || null,
            especie: especie as 'BOVINO' | 'EQUINO'
          }
        }
      })

      if (stockExistente) {
        await db.stockMediaRes.update({
          where: { id: stockExistente.id },
          data: {
            cantidad: stockExistente.cantidad + 1,
            pesoTotal: stockExistente.pesoTotal + pesoNum
          }
        })
      } else {
        await db.stockMediaRes.create({
          data: {
            camaraId,
            tropaCodigo,
            especie: especie as 'BOVINO' | 'EQUINO',
            cantidad: 1,
            pesoTotal: pesoNum
          }
        })
      }
    }

    // Verificar si el garrón está completo
    const mediasGarron = await db.mediaRes.count({
      where: { romaneoId: romaneo.id }
    })

    const garronCompleto = mediasGarron >= 2

    return NextResponse.json({
      success: true,
      data: {
        romaneoId: romaneo.id,
        mediaResId: mediaRes.id,
        codigo,
        garron,
        lado,
        peso: pesoNum,
        denticion: romaneo.denticion,
        garronCompleto,
        mensaje: garronCompleto 
          ? 'Garrón completo. Presione Continuar para el siguiente garrón.'
          : `Media ${lado === 'DER' ? 'derecha' : 'izquierda'} registrada. Pese la otra media.`
      }
    })
  } catch (error) {
    console.error('Error en pesaje media res:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pesaje' },
      { status: 500 }
    )
  }
}
