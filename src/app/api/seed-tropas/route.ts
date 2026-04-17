import { NextRequest, NextResponse } from 'next/server'
import { Especie, TipoAnimal, EstadoTropa, EstadoAnimal } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { checkAdminRole } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  // Verificar que sea administrador
  const adminError = await checkAdminRole(request)
  if (adminError) return adminError

  try {
    // 1. Verificar si ya existen clientes
    let productor = await db.cliente.findFirst({
      where: { esProductor: true }
    })

    let usuarioFaena = await db.cliente.findFirst({
      where: { esUsuarioFaena: true }
    })

    // Crear clientes de prueba si no existen
    if (!productor) {
      productor = await db.cliente.create({
        data: {
          nombre: 'Estancia La Pampa SA',
          cuit: '20-12345678-9',
          dni: '12345678',
          direccion: 'Ruta 5 Km 45',
          localidad: 'Santa Rosa',
          provincia: 'La Pampa',
          telefono: '02954-456789',
          email: 'estancia@lapampa.com.ar',
          razonSocial: 'Estancia La Pampa SA',
          condicionIva: 'RI',
          esProductor: true,
          esUsuarioFaena: false,
        }
      })
    }

    if (!usuarioFaena) {
      usuarioFaena = await db.cliente.create({
        data: {
          nombre: 'Carnicería Don José',
          cuit: '20-98765432-1',
          dni: '98765432',
          direccion: 'Av. Principal 1234',
          localidad: 'Bahía Blanca',
          provincia: 'Buenos Aires',
          telefono: '0291-4567890',
          email: 'carniceria@donjose.com.ar',
          razonSocial: 'Carnicería Don José SRL',
          condicionIva: 'RI',
          esProductor: false,
          esUsuarioFaena: true,
        }
      })
    }

    // 2. Crear/Verificar corral
    let corral = await db.corral.findFirst()
    if (!corral) {
      corral = await db.corral.create({
        data: {
          nombre: 'Corral 1',
          capacidad: 50,
          observaciones: 'Corral principal',
          activo: true,
        }
      })
    }

    // 3. Verificar si ya existe operador
    let operador = await db.operador.findFirst()
    if (!operador) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      operador = await db.operador.create({
        data: {
          nombre: 'Admin Principal',
          usuario: 'admin',
          password: hashedPassword,
          rol: 'ADMINISTRADOR',
          activo: true,
          puedePesajeCamiones: true,
          puedePesajeIndividual: true,
          puedeMovimientoHacienda: true,
          puedeListaFaena: true,
          puedeRomaneo: true,
          puedeIngresoCajon: true,
          puedeMenudencias: true,
          puedeStock: true,
          puedeReportes: true,
          puedeCCIR: true,
          puedeFacturacion: true,
          puedeConfiguracion: true,
        }
      })
    }

    // 4. Obtener último número de tropa
    const ultimoTropa = await db.tropa.findFirst({
      where: { especie: Especie.BOVINO },
      orderBy: { numero: 'desc' },
      select: { numero: true }
    })
    const proximoNumero = (ultimoTropa?.numero || 0) + 1
    const anio = new Date().getFullYear()

    // 5. Crear Tropa 1 - Con animales PESADOS individualmente
    const tropa1Codigo = `B ${anio} ${String(proximoNumero).padStart(4, '0')}`
    const tropa1CodigoSimplificado = `B${String(proximoNumero).padStart(4, '0')}`

    const tropa1 = await db.tropa.create({
      data: {
        numero: proximoNumero,
        codigo: tropa1Codigo,
        codigoSimplificado: tropa1CodigoSimplificado,
        productorId: productor.id,
        usuarioFaenaId: usuarioFaena.id,
        especie: Especie.BOVINO,
        dte: `DTE-${anio}-${proximoNumero}`,
        guia: `GUIA-${anio}-${proximoNumero}`,
        cantidadCabezas: 5,
        corralId: corral.id,
        estado: EstadoTropa.PESADO,
        pesoBruto: 2400,
        pesoTara: 800,
        pesoNeto: 1600,
        pesoTotalIndividual: 2450,
        operadorId: operador.id,
        observaciones: 'TROPA DE PRUEBA - Animales pesados individualmente',
        tiposAnimales: {
          create: [
            { tipoAnimal: TipoAnimal.NO, cantidad: 3 },
            { tipoAnimal: TipoAnimal.VA, cantidad: 2 },
          ]
        }
      }
    })

    // Crear animales pesados para tropa 1
    const pesosVivos = [480, 520, 490, 510, 450]
    for (let i = 1; i <= 5; i++) {
      const animalCodigo = `${tropa1Codigo.replace(/\s/g, '')}-${String(i).padStart(3, '0')}`
      
      await db.animal.create({
        data: {
          tropaId: tropa1.id,
          numero: i,
          codigo: animalCodigo,
          tipoAnimal: i <= 3 ? TipoAnimal.NO : TipoAnimal.VA,
          raza: i % 2 === 0 ? 'Angus' : 'Hereford',
          caravana: `CAR-${proximoNumero}-${i}`,
          pesoVivo: pesosVivos[i-1],
          estado: EstadoAnimal.PESADO,
          corralId: corral.id,
        }
      })
    }

    // Crear registros de pesaje individual
    for (let i = 1; i <= 5; i++) {
      const animal = await db.animal.findFirst({
        where: { tropaId: tropa1.id, numero: i }
      })
      if (animal) {
        await db.pesajeIndividual.create({
          data: {
            animalId: animal.id,
            peso: pesosVivos[i-1],
            caravana: `CAR-${proximoNumero}-${i}`,
            operadorId: operador.id,
          }
        })
      }
    }

    // 6. Crear Tropa 2 - Con animales SIN pesar
    const tropa2Numero = proximoNumero + 1
    const tropa2Codigo = `B ${anio} ${String(tropa2Numero).padStart(4, '0')}`
    const tropa2CodigoSimplificado = `B${String(tropa2Numero).padStart(4, '0')}`

    const tropa2 = await db.tropa.create({
      data: {
        numero: tropa2Numero,
        codigo: tropa2Codigo,
        codigoSimplificado: tropa2CodigoSimplificado,
        productorId: productor.id,
        usuarioFaenaId: usuarioFaena.id,
        especie: Especie.BOVINO,
        dte: `DTE-${anio}-${tropa2Numero}`,
        guia: `GUIA-${anio}-${tropa2Numero}`,
        cantidadCabezas: 4,
        corralId: corral.id,
        estado: EstadoTropa.EN_CORRAL,
        pesoBruto: 1920,
        pesoTara: 800,
        pesoNeto: 1120,
        pesoTotalIndividual: null,
        operadorId: operador.id,
        observaciones: 'TROPA DE PRUEBA - Animales SIN pesar individualmente',
        tiposAnimales: {
          create: [
            { tipoAnimal: TipoAnimal.VQ, cantidad: 2 },
            { tipoAnimal: TipoAnimal.NT, cantidad: 2 },
          ]
        }
      }
    })

    // Crear animales sin pesar para tropa 2
    for (let i = 1; i <= 4; i++) {
      const animalCodigo = `${tropa2Codigo.replace(/\s/g, '')}-${String(i).padStart(3, '0')}`
      
      await db.animal.create({
        data: {
          tropaId: tropa2.id,
          numero: i,
          codigo: animalCodigo,
          tipoAnimal: i <= 2 ? TipoAnimal.VQ : TipoAnimal.NT,
          raza: i % 2 === 0 ? 'Aberdeen Angus' : 'Shorthorn',
          caravana: `CAR-${tropa2Numero}-${i}`,
          pesoVivo: null, // Sin peso
          estado: EstadoAnimal.RECIBIDO,
          corralId: corral.id,
        }
      })
    }

    // 7. Crear Tropa 3 - Mixta (algunos pesados, otros no)
    const tropa3Numero = proximoNumero + 2
    const tropa3Codigo = `B ${anio} ${String(tropa3Numero).padStart(4, '0')}`
    const tropa3CodigoSimplificado = `B${String(tropa3Numero).padStart(4, '0')}`

    const tropa3 = await db.tropa.create({
      data: {
        numero: tropa3Numero,
        codigo: tropa3Codigo,
        codigoSimplificado: tropa3CodigoSimplificado,
        productorId: productor.id,
        usuarioFaenaId: usuarioFaena.id,
        especie: Especie.BOVINO,
        dte: `DTE-${anio}-${tropa3Numero}`,
        guia: `GUIA-${anio}-${tropa3Numero}`,
        cantidadCabezas: 6,
        corralId: corral.id,
        estado: EstadoTropa.EN_PESAJE,
        pesoBruto: 2800,
        pesoTara: 800,
        pesoNeto: 2000,
        pesoTotalIndividual: 780, // Solo 2 pesados
        operadorId: operador.id,
        observaciones: 'TROPA DE PRUEBA - Mixta (pesaje en proceso)',
        tiposAnimales: {
          create: [
            { tipoAnimal: TipoAnimal.TO, cantidad: 1 },
            { tipoAnimal: TipoAnimal.NO, cantidad: 2 },
            { tipoAnimal: TipoAnimal.VA, cantidad: 2 },
            { tipoAnimal: TipoAnimal.MEJ, cantidad: 1 },
          ]
        }
      }
    })

    // Crear animales para tropa 3 - 2 pesados, 4 sin pesar
    const pesosTropa3 = [580, 420, null, null, null, null]
    const estadosAnimales = [
      EstadoAnimal.PESADO,
      EstadoAnimal.PESADO,
      EstadoAnimal.RECIBIDO,
      EstadoAnimal.RECIBIDO,
      EstadoAnimal.RECIBIDO,
      EstadoAnimal.RECIBIDO
    ]
    const tiposAnimalesTropa3 = [
      TipoAnimal.TO,
      TipoAnimal.MEJ,
      TipoAnimal.NO,
      TipoAnimal.NO,
      TipoAnimal.VA,
      TipoAnimal.VA
    ]

    for (let i = 1; i <= 6; i++) {
      const animalCodigo = `${tropa3Codigo.replace(/\s/g, '')}-${String(i).padStart(3, '0')}`
      
      const animal = await db.animal.create({
        data: {
          tropaId: tropa3.id,
          numero: i,
          codigo: animalCodigo,
          tipoAnimal: tiposAnimalesTropa3[i-1],
          raza: 'Angus',
          caravana: `CAR-${tropa3Numero}-${i}`,
          pesoVivo: pesosTropa3[i-1],
          estado: estadosAnimales[i-1],
          corralId: corral.id,
        }
      })

      // Crear pesaje individual solo para los 2 primeros
      if (pesosTropa3[i-1]) {
        await db.pesajeIndividual.create({
          data: {
            animalId: animal.id,
            peso: pesosTropa3[i-1]!,
            caravana: `CAR-${tropa3Numero}-${i}`,
            operadorId: operador.id,
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tropas de prueba creadas exitosamente',
      data: {
        clientes: {
          productor: { id: productor.id, nombre: productor.nombre },
          usuarioFaena: { id: usuarioFaena.id, nombre: usuarioFaena.nombre }
        },
        corral: { id: corral.id, nombre: corral.nombre },
        tropas: [
          {
            id: tropa1.id,
            codigo: tropa1.codigo,
            estado: tropa1.estado,
            cantidad: tropa1.cantidadCabezas,
            pesoTotalIndividual: tropa1.pesoTotalIndividual,
            tipo: 'PESADOS INDIVIDUALMENTE'
          },
          {
            id: tropa2.id,
            codigo: tropa2.codigo,
            estado: tropa2.estado,
            cantidad: tropa2.cantidadCabezas,
            pesoTotalIndividual: tropa2.pesoTotalIndividual,
            tipo: 'SIN PESAR'
          },
          {
            id: tropa3.id,
            codigo: tropa3.codigo,
            estado: tropa3.estado,
            cantidad: tropa3.cantidadCabezas,
            pesoTotalIndividual: tropa3.pesoTotalIndividual,
            tipo: 'MIXTA (pesaje en proceso)'
          }
        ]
      }
    })
  } catch (error) {
    console.error('Error creando tropas de prueba:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
