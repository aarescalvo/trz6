// Script para crear el rótulo de pesaje individual por defecto
// Ejecutar con: bun run scripts/seed-rotulo-pesaje.ts

import { PrismaClient, TipoRotulo } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creando rótulo de pesaje individual...')

  // Rótulo DPL para Datamax Mark II - 10x5cm (203 DPI)
  // Ancho: 10cm = ~799 dots | Alto: 5cm = ~399 dots
  //
  // Comandos DPL:
  // <STX>L = Inicio de formato de etiqueta
  // T<x>,<y>,<fuente>,<alto>,<ancho>,"texto"
  // B<x>,<y>,<tipo>,<alto>,<ancho>,<texto> = Código de barras
  // <ETX> = Fin de etiqueta
  //
  // Formato del rótulo:
  // ┌─────────────────────────────┐
  // │  TROPA: B 2026 0100         │  (fila 30)
  // │                             │
  // │        ┌───────┐            │
  // │        │ 0015  │  NÚMERO    │  (fila 100, centrado)
  // │        └───────┘            │
  // │                             │
  // │  PESO: 450 KG               │  (fila 280)
  // └─────────────────────────────┘

  const contenidoDPL = `<STX>L
T50,30,3,30,25,N,"TROPA:"
T180,30,3,30,25,N,"{TROPA}"
T280,120,5,60,50,N,"{NUMERO}"
T50,300,3,30,25,N,"PESO:"
T200,300,3,30,25,N,"{PESO} KG"
<ETX>`

  // Variables disponibles para el rótulo
  const variables = JSON.stringify([
    { variable: 'TROPA', campo: 'tropa.codigo', descripcion: 'Código de tropa (ej: B 2026 0100)' },
    { variable: 'NUMERO', campo: 'animal.numero', descripcion: 'Número de animal (ej: 0015)' },
    { variable: 'PESO', campo: 'animal.pesoVivo', descripcion: 'Peso vivo en kg (ej: 450)' }
  ])

  // Crear o actualizar el rótulo
  const rotulo = await prisma.rotulo.upsert({
    where: { codigo: 'PESAJE_INDIVIDUAL_DEFAULT' },
    update: {
      nombre: 'Rótulo Pesaje Individual - Datamax',
      tipo: TipoRotulo.PESAJE_INDIVIDUAL,
      tipoImpresora: 'DATAMAX',
      modeloImpresora: 'MARK_II',
      ancho: 100,  // 10cm
      alto: 50,    // 5cm
      dpi: 203,
      contenido: contenidoDPL,
      variables: variables,
      activo: true,
      esDefault: true,
      diasConsumo: 30,
      temperaturaMax: 5.0
    },
    create: {
      codigo: 'PESAJE_INDIVIDUAL_DEFAULT',
      nombre: 'Rótulo Pesaje Individual - Datamax',
      tipo: TipoRotulo.PESAJE_INDIVIDUAL,
      tipoImpresora: 'DATAMAX',
      modeloImpresora: 'MARK_II',
      ancho: 100,  // 10cm
      alto: 50,    // 5cm
      dpi: 203,
      contenido: contenidoDPL,
      variables: variables,
      activo: true,
      esDefault: true,
      diasConsumo: 30,
      temperaturaMax: 5.0
    }
  })

  console.log('✅ Rótulo creado/actualizado:', rotulo.id)
  console.log('   - Tipo:', rotulo.tipo)
  console.log('   - Impresora:', rotulo.tipoImpresora, rotulo.modeloImpresora)
  console.log('   - Tamaño:', rotulo.ancho + 'mm x ' + rotulo.alto + 'mm')
  console.log('   - DPI:', rotulo.dpi)
  console.log('')
  console.log('Contenido DPL:')
  console.log(contenidoDPL)
  console.log('')
  console.log('Variables disponibles:', variables)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
