import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Import articulos from Excel file
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const body = await request.json()
    const { filePath } = body
    
    // Use default file path if not provided
    const excelPath = filePath || '/home/z/my-project/upload/CODIGO.xlsx'
    
    // Check if file exists
    if (!fs.existsSync(excelPath)) {
      return NextResponse.json(
        { success: false, error: `Archivo no encontrado: ${excelPath}` },
        { status: 400 }
      )
    }
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelPath)
    
    // Look for the specific sheet name
    const sheetName = 'tabla composicion codigo'
    const sheet = workbook.Sheets[sheetName]
    
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: `Hoja "${sheetName}" no encontrada` },
        { status: 400 }
      )
    }
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 })
    
    // Process rows - format is ".001 lomo" (code + name together)
    let importados = 0
    let actualizados = 0
    let errores = 0
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as unknown[]
      if (!row || row.length === 0) continue
      
      // Get first column value
      const primeraColumna = String(row[0] || '').trim()
      
      // Skip empty rows or headers
      if (!primeraColumna || 
          primeraColumna.toLowerCase().includes('tabla') || 
          primeraColumna.toLowerCase().includes('articulo')) {
        continue
      }
      
      // Parse "ARTICULO" column which has format: ".001 lomo"
      // Extract code (first 4 chars: .XXX) and name (rest)
      const match = primeraColumna.match(/^(\.\d{3})\s+(.+)$/)
      
      if (!match) {
        continue
      }
      
      const codigo = match[1]  // .001
      const nombre = match[2].trim()  // lomo
      
      // Skip "total" row
      if (codigo === '.000' || nombre.toLowerCase().includes('total')) {
        continue
      }
      
      if (!nombre) {
        errores++
        continue
      }
      
      try {
        // Check if articulo exists
        const existente = await db.articulo.findUnique({
          where: { codigo }
        })
        
        if (existente) {
          // Update if name is different
          if (existente.nombre !== nombre) {
            await db.articulo.update({
              where: { codigo },
              data: { nombre }
            })
            actualizados++
          }
        } else {
          // Create new
          await db.articulo.create({
            data: {
              codigo,
              nombre,
              activo: true
            }
          })
          importados++
        }
      } catch (error) {
        console.error(`Error processing row ${i}:`, error)
        errores++
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Importación completada`,
      data: {
        importados,
        actualizados,
        errores,
        sheetName
      }
    })
    
  } catch (error) {
    console.error('Error importing articulos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al importar articulos: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
