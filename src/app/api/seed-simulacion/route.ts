import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkAdminRole } from '@/lib/auth-helpers'

// POST - Crear datos de simulación (solo ADMINISTRADOR)
export async function POST(request: NextRequest) {
  // Verificar que sea administrador
  const adminError = await checkAdminRole(request)
  if (adminError) return adminError

  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // 1. Crear clientes si no existen
    let productor = await db.cliente.findFirst({
      where: { nombre: 'Estancia Los Álamos' }
    })
    
    if (!productor) {
      productor = await db.cliente.create({
        data: {
          nombre: 'Estancia Los Álamos',
          cuit: '20-12345678-9',
          direccion: 'Ruta 7, Km 450, San Luis',
          telefono: '02652-456789',
          esProductor: true,
          esUsuarioFaena: false
        }
      })
    }

    let usuarioFaena = await db.cliente.findFirst({
      where: { nombre: 'Frigorífico Sur S.A.' }
    })
    
    if (!usuarioFaena) {
      usuarioFaena = await db.cliente.create({
        data: {
          nombre: 'Frigorífico Sur S.A.',
          cuit: '30-98765432-1',
          direccion: 'Parque Industrial, Bahía Blanca',
          telefono: '0291-4567890',
          esProductor: false,
          esUsuarioFaena: true
        }
      })
    }

    // 2. Crear corrales si no existen
    const corrales = []
    for (let i = 1; i <= 6; i++) {
      let corral = await db.corral.findFirst({
        where: { nombre: `Corral ${i}` }
      })
      if (!corral) {
        corral = await db.corral.create({
          data: {
            nombre: `Corral ${i}`,
            capacidad: 50,
            stockBovinos: 0,
            activo: true
          }
        })
      }
      corrales.push(corral)
    }

    // 3. Crear tipificadores si no existen
    const tipificadoresData = [
      { nombre: 'Carlos', apellido: 'Rodríguez', matricula: 'JPG-001' },
      { nombre: 'María', apellido: 'González', matricula: 'JPG-002' },
      { nombre: 'Juan', apellido: 'Pérez', matricula: 'JPG-003' }
    ]
    
    const tipificadores = []
    for (const tipData of tipificadoresData) {
      let tip = await db.tipificador.findFirst({
        where: { matricula: tipData.matricula }
      })
      if (!tip) {
        tip = await db.tipificador.create({ data: tipData })
      }
      tipificadores.push(tip)
    }

    // 4. Crear tropas en diferentes estados
    const estadosTropa = ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA', 'FAENADO']
    const tropasCreadas = []
    
    for (let i = 0; i < estadosTropa.length; i++) {
      const estado = estadosTropa[i] as any
      const numeroTropa = 100 + i
      const codigoTropa = `B 2026 ${numeroTropa.toString().padStart(4, '0')}`
      
      let tropa = await db.tropa.findFirst({
        where: { codigo: codigoTropa }
      })
      
      if (!tropa) {
        tropa = await db.tropa.create({
          data: {
            numero: numeroTropa,
            codigo: codigoTropa,
            codigoSimplificado: `B${numeroTropa.toString().padStart(4, '0')}`,
            productorId: productor.id,
            usuarioFaenaId: usuarioFaena.id,
            especie: 'BOVINO',
            dte: `DTE-${numeroTropa}-2026`,
            guia: `G-${numeroTropa}-2026`,
            cantidadCabezas: 10,
            corralId: corrales[i % corrales.length].id,
            estado,
            pesoBruto: estado !== 'RECIBIDO' ? 15000 : null,
            pesoTara: estado !== 'RECIBIDO' ? 5000 : null,
            pesoNeto: estado !== 'RECIBIDO' ? 10000 : null,
            fechaRecepcion: new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000)
          }
        })
      }
      
      tropasCreadas.push(tropa)

      // 5. Crear animales para cada tropa
      const cantidadAnimales = tropa.cantidadCabezas
      const tiposAnimales = ['NO', 'VQ', 'NT', 'VA', 'MEJ']
      
      for (let j = 1; j <= cantidadAnimales; j++) {
        const codigoAnimal = `${codigoTropa.replace(/ /g, '')}-${j.toString().padStart(3, '0')}`
        
        const animalExistente = await db.animal.findFirst({
          where: { codigo: codigoAnimal }
        })
        
        if (!animalExistente) {
          await db.animal.create({
            data: {
              tropaId: tropa.id,
              numero: j,
              codigo: codigoAnimal,
              caravana: `CAR-${numeroTropa}-${j.toString().padStart(3, '0')}`,
              tipoAnimal: tiposAnimales[Math.floor(Math.random() * tiposAnimales.length)] as any,
              raza: 'Angus',
              pesoVivo: estado !== 'RECIBIDO' ? 450 : null,
              estado: getEstadoAnimal(estado),
              corralId: tropa.corralId
            }
          })
        }
      }
    }

    // 6. Crear romaneos para la tropa en faena (índice 5) y faenado (índice 6)
    const tropaEnFaena = tropasCreadas[5]
    const tropaFaenada = tropasCreadas[6]
    
    const animalesEnFaena = await db.animal.findMany({
      where: { tropaId: tropaEnFaena.id }
    })
    
    const animalesFaenados = await db.animal.findMany({
      where: { tropaId: tropaFaenada.id }
    })

    let garronBase = 1
    
    // Romaneos pendientes
    for (const animal of animalesEnFaena) {
      const romaneoExistente = await db.romaneo.findFirst({
        where: { garron: garronBase, fecha: hoy }
      })
      
      if (!romaneoExistente) {
        await db.romaneo.create({
          data: {
            garron: garronBase,
            tropaCodigo: tropaEnFaena.codigoSimplificado,
            numeroAnimal: animal.numero,
            tipoAnimal: animal.tipoAnimal,
            raza: animal.raza,
            caravana: animal.caravana,
            pesoVivo: animal.pesoVivo,
            estado: 'PENDIENTE',
            fecha: hoy
          }
        })
      }
      garronBase++
    }

    // Romaneos completados
    for (const animal of animalesFaenados) {
      const romaneoExistente = await db.romaneo.findFirst({
        where: { garron: garronBase, fecha: hoy }
      })
      
      if (!romaneoExistente) {
        const pesoIzq = 100 + Math.random() * 50
        const pesoDer = 100 + Math.random() * 50
        const pesoTotal = pesoIzq + pesoDer
        const rinde = animal.pesoVivo ? (pesoTotal / animal.pesoVivo) * 100 : 0
        
        await db.romaneo.create({
          data: {
            garron: garronBase,
            tropaCodigo: tropaFaenada.codigoSimplificado,
            numeroAnimal: animal.numero,
            tipoAnimal: animal.tipoAnimal,
            raza: animal.raza,
            caravana: animal.caravana,
            pesoVivo: animal.pesoVivo,
            denticion: [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)],
            categoria: animal.tipoAnimal as any,
            tipificacion: ['M', 'A', 'S', 'I', 'N'][Math.floor(Math.random() * 5)] as any,
            grasaCobertura: ['ESCASA', 'LIGHT', 'MEDIANA'][Math.floor(Math.random() * 3)] as any,
            conformacion: ['BUENA', 'REGULAR'][Math.floor(Math.random() * 2)] as any,
            tipificadorId: tipificadores[Math.floor(Math.random() * tipificadores.length)].id,
            pesoMediaIzq: pesoIzq,
            pesoMediaDer: pesoDer,
            pesoTotal,
            rinde,
            estado: 'CONFIRMADO',
            fechaConfirmacion: new Date(),
            fecha: hoy
          }
        })
      }
      garronBase++
    }

    return NextResponse.json({
      success: true,
      message: 'Datos de simulación creados correctamente',
      data: {
        tropas: tropasCreadas.length,
        animalesEnFaena: animalesEnFaena.length,
        animalesFaenados: animalesFaenados.length,
        tipificadores: tipificadores.length,
        corrales: corrales.length
      }
    })
  } catch (error) {
    console.error('Error creating seed data:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear datos de simulación: ' + (error as Error).message
    }, { status: 500 })
  }
}

function getEstadoAnimal(estadoTropa: string): string {
  switch (estadoTropa) {
    case 'RECIBIDO':
    case 'EN_CORRAL':
      return 'RECIBIDO'
    case 'EN_PESAJE':
    case 'PESADO':
      return 'PESADO'
    case 'LISTO_FAENA':
    case 'EN_FAENA':
      return 'EN_FAENA'
    case 'FAENADO':
      return 'FAENADO'
    default:
      return 'RECIBIDO'
  }
}
