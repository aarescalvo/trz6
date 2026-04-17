import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Cierre de romaneo por día de faena
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const { listaFaenaId, operadorId } = body

    if (!listaFaenaId) {
      return NextResponse.json(
        { success: false, error: 'listaFaenaId es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el operador es supervisor o administrador
    const operador = await db.operador.findUnique({
      where: { id: operadorId }
    })

    if (!operador || (operador.rol !== 'SUPERVISOR' && operador.rol !== 'ADMINISTRADOR')) {
      return NextResponse.json(
        { success: false, error: 'Solo supervisores o administradores pueden cerrar el romaneo' },
        { status: 403 }
      )
    }

    // Obtener lista de faena
    const listaFaena = await db.listaFaena.findUnique({
      where: { id: listaFaenaId },
      include: {
        asignaciones: {
          include: {
            animal: {
              include: {
                tropa: true
              }
            }
          }
        },
        tropas: {
          include: {
            tropa: true
          }
        }
      }
    })

    if (!listaFaena) {
      return NextResponse.json(
        { success: false, error: 'Lista de faena no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que todos los garrones tengan sus medias pesadas
    const garronesIncompletos = []
    
    for (const asig of listaFaena.asignaciones) {
      const medias = await db.mediaRes.findMany({
        where: {
          romaneo: {
            garron: asig.garron,
            listaFaenaId
          }
        }
      })

      if (medias.length < 2) {
        garronesIncompletos.push(asig.garron)
      }
    }

    if (garronesIncompletos.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Hay garrones incompletos: ${garronesIncompletos.slice(0, 5).join(', ')}${garronesIncompletos.length > 5 ? '...' : ''}. Complete o registre como decomiso antes de cerrar.` 
        },
        { status: 400 }
      )
    }

    // Cerrar lista de faena
    await db.listaFaena.update({
      where: { id: listaFaenaId },
      data: {
        estado: 'CERRADA',
        supervisorId: operadorId,
        fechaCierre: new Date()
      }
    })

    // Actualizar estado de animales a FAENADO y dar de baja de corral
    const resultadosPorTropa: Record<string, { cantidad: number; rindeTotal: number; pesoVivoTotal: number; pesoMediaTotal: number }> = {}

    for (const asig of listaFaena.asignaciones) {
      const animal = asig.animal
      
      // Actualizar estado del animal
      await db.animal.update({
        where: { id: animal.id },
        data: { estado: 'FAENADO' }
      })

      // Actualizar stock del corral (dar de baja)
      if (animal.corralId) {
        const tropa = animal.tropa
        if (tropa?.especie === 'BOVINO') {
          await db.corral.update({
            where: { id: animal.corralId },
            data: { stockBovinos: { decrement: 1 } }
          })
        } else if (tropa?.especie === 'EQUINO') {
          await db.corral.update({
            where: { id: animal.corralId },
            data: { stockEquinos: { decrement: 1 } }
          })
        }
      }

      // Calcular rinde por tropa
      const romaneo = await db.romaneo.findFirst({
        where: { garron: asig.garron, listaFaenaId }
      })

      if (romaneo && animal.tropa) {
        const tropaCodigo = animal.tropa.codigo
        if (!resultadosPorTropa[tropaCodigo]) {
          resultadosPorTropa[tropaCodigo] = {
            cantidad: 0,
            rindeTotal: 0,
            pesoVivoTotal: 0,
            pesoMediaTotal: 0
          }
        }
        resultadosPorTropa[tropaCodigo].cantidad++
        resultadosPorTropa[tropaCodigo].rindeTotal += romaneo.rinde || 0
        resultadosPorTropa[tropaCodigo].pesoVivoTotal += romaneo.pesoVivo || 0
        resultadosPorTropa[tropaCodigo].pesoMediaTotal += romaneo.pesoTotal || 0
      }
    }

    // Actualizar estado de tropas a FAENADO
    for (const tropaItem of listaFaena.tropas) {
      await db.tropa.update({
        where: { id: tropaItem.tropaId },
        data: { estado: 'FAENADO' }
      })
    }

    // Registrar auditoría
    await db.auditoria.create({
      data: {
        operadorId,
        modulo: 'ROMANEO',
        accion: 'CIERRE',
        entidad: 'ListaFaena',
        entidadId: listaFaenaId,
        descripcion: `Cierre de romaneo del día ${listaFaena.fecha.toLocaleDateString('es-AR')}. Total garrones: ${listaFaena.asignaciones.length}`
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        listaFaenaId,
        totalGarrones: listaFaena.asignaciones.length,
        resultadosPorTropa: Object.entries(resultadosPorTropa).map(([codigo, datos]) => ({
          tropaCodigo: codigo,
          cantidad: datos.cantidad,
          rindePromedio: datos.cantidad > 0 ? (datos.rindeTotal / datos.cantidad).toFixed(2) : 0,
          pesoVivoTotal: datos.pesoVivoTotal,
          pesoMediaTotal: datos.pesoMediaTotal
        }))
      }
    })
  } catch (error) {
    console.error('Error en cierre de romaneo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cerrar romaneo' },
      { status: 500 }
    )
  }
}
