import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkAdminRole } from '@/lib/auth-helpers'
import ExcelJS from 'exceljs'

interface UsuarioExcel {
  'TITULAR ': string
  'CUIT': number
  'MAIL': string
  'NOMBRE Y APELLIGO': string
  'CELULAR': string
}

interface ResultadoMigracion {
  total: number
  creados: number
  duplicados: number
  errores: string[]
  usuariosCreados: Array<{
    nombre: string
    cuit: string
  }>
}

// GET - Mostrar estado de la migración (solo ADMINISTRADOR)
export async function GET(request: NextRequest) {
  // Verificar que sea administrador
  const adminError = await checkAdminRole(request)
  if (adminError) return adminError

  try {
    // Contar usuarios de faena existentes
    const usuariosFaena = await db.cliente.count({
      where: { esUsuarioFaena: true }
    })

    // Obtener los últimos 5 usuarios creados
    const ultimosUsuarios = await db.cliente.findMany({
      where: { esUsuarioFaena: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        nombre: true,
        cuit: true,
        celular: true,
        emails: true,
        createdAt: true
      } as any
    })

    return NextResponse.json({
      success: true,
      data: {
        usuariosFaenaExistentes: usuariosFaena,
        ultimosCreados: ultimosUsuarios,
        archivoDisponible: true
      }
    })
  } catch (error) {
    console.error('Error al obtener estado:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado de migración' },
      { status: 500 }
    )
  }
}

// POST - Ejecutar migración (solo ADMINISTRADOR)
export async function POST(request: NextRequest) {
  // Verificar que sea administrador
  const adminError = await checkAdminRole(request)
  if (adminError) return adminError

  try {
    const path = await import('path')
    const fs = await import('fs')
    
    const resultado: ResultadoMigracion = {
      total: 0,
      creados: 0,
      duplicados: 0,
      errores: [],
      usuariosCreados: []
    }

    // Leer archivo Excel - usar rutas absolutas
    const fileName = 'CUIT DE USUARIOS + DATOS.xlsx'
    const possiblePaths = [
      `/home/z/my-project/upload/${fileName}`,
      path.join(process.cwd(), 'upload', fileName),
      path.join(process.cwd(), '..', 'upload', fileName),
    ]
    
    let filePath = ''
    let fileBuffer: Buffer | null = null
    
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          fileBuffer = fs.readFileSync(p)
          filePath = p
          break
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!fileBuffer) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No se encontró el archivo de usuarios. Verifique que el archivo esté en /upload/'
        },
        { status: 404 }
      )
    }
    
    let workbook
    try {
      // Leer desde buffer con ExcelJS
      workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(fileBuffer)
    } catch (readError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al leer el archivo Excel: ' + (readError instanceof Error ? readError.message : 'Error desconocido')
        },
        { status: 500 }
      )
    }

    const ws = workbook.getWorksheet('Hoja1')
    
    if (!ws) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Hoja "Hoja1" no encontrada en el archivo Excel'
        },
        { status: 500 }
      )
    }

    // Leer encabezado para mapear columnas
    const headerRow = ws.getRow(1)
    const headerValues: string[] = []
    headerRow.eachCell((cell, colNumber) => {
      headerValues[colNumber] = String(cell.value || '').trim()
    })

    // Mapeo de nombres de columna a posición (exceljs es 1-indexed)
    const colMap: Record<string, number> = {}
    for (let i = 1; i < headerValues.length; i++) {
      if (headerValues[i]) {
        colMap[headerValues[i]] = i
      }
    }

    // También intentar mapear con el espacio final que usa la interfaz original
    // 'TITULAR ' tiene un espacio al final en la interfaz
    for (const key of Object.keys(colMap)) {
      if (!colMap[key + ' ']) {
        colMap[key + ' '] = colMap[key]
      }
    }

    const data: UsuarioExcel[] = []
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // skip header

      const getCellValue = (colKey: string) => {
        const colNum = colMap[colKey]
        if (!colNum) return undefined
        const cell = row.getCell(colNum)
        return cell.value
      }

      data.push({
        'TITULAR ': String(getCellValue('TITULAR') || '').trim(),
        'CUIT': Number(getCellValue('CUIT')) || 0,
        'MAIL': String(getCellValue('MAIL') || '').trim(),
        'NOMBRE Y APELLIGO': String(getCellValue('NOMBRE Y APELLIGO') || '').trim(),
        'CELULAR': String(getCellValue('CELULAR') || '').trim(),
      })
    })
    
    resultado.total = data.length

    for (const row of data) {
      try {
        // Normalizar datos
        const nombre = row['TITULAR ']?.trim() || ''
        const cuit = String(row['CUIT'] || '').trim()
        const mail = row['MAIL']?.trim() || ''
        const contactoNombre = row['NOMBRE Y APELLIGO']?.trim() || ''
        const celular = row['CELULAR']?.trim() || ''

        // Omitir filas de encabezado o vacías
        if (!nombre || !cuit || nombre === 'TITULAR' || cuit === 'CUIT') {
          continue
        }

        // Verificar si ya existe por CUIT
        const existente = await db.cliente.findUnique({
          where: { cuit }
        })

        if (existente) {
          resultado.duplicados++
          continue
        }

        // Crear cliente - usar campo 'email' (singular) pero guardar múltiples emails
        const cliente = await db.cliente.create({
          data: {
            nombre,
            cuit,
            email: mail || null,  // Campo email (singular) con múltiples emails separados por ;
            celular: celular || null,
            esUsuarioFaena: true,
            esProductor: false,
            modalidadRetiro: true,
          } as any
        })

        resultado.creados++
        resultado.usuariosCreados.push({
          nombre: cliente.nombre,
          cuit: cliente.cuit || ''
        })

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
        resultado.errores.push(`Error con ${row['TITULAR ']}: ${errorMsg}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: resultado
    })

  } catch (error) {
    console.error('Error en migración:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido durante la migración' 
      },
      { status: 500 }
    )
  }
}
