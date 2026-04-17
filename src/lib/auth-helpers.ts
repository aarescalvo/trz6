import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AuthHelpers')

/**
 * Valida que un operador tenga un permiso específico.
 * ADMINISTRADOR tiene todos los permisos automáticamente.
 * 
 * @param operadorId - ID del operador
 * @param permiso - Nombre del permiso (ej: 'puedeFacturacion')
 * @returns true si tiene permiso, false si no
 */
export async function validarPermiso(operadorId: string | null | undefined, permiso: string): Promise<boolean> {
  if (!operadorId) return false

  const operador = await db.operador.findUnique({
    where: { id: operadorId },
    select: { rol: true, activo: true, [permiso]: true }
  })

  if (!operador) return false
  if (!operador.activo) return false

  // ADMINISTRADOR tiene todos los permisos
  if (operador.rol === 'ADMINISTRADOR') return true

  // Verificar el permiso específico
  return operador[permiso as keyof typeof operador] === true
}

/**
 * Valida que un operador tenga permiso de facturación.
 * Si no tiene, devuelve una respuesta de error.
 */
export async function requireFacturacion(operadorId: string | null | undefined): Promise<{ authorized: boolean; error?: Response }> {
  const hasPermission = await validarPermiso(operadorId, 'puedeFacturacion')
  if (!hasPermission) {
    return {
      authorized: false,
      error: new Response(JSON.stringify({ success: false, error: 'Sin permisos de facturación' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  return { authorized: true }
}

/**
 * Extrae el operadorId del request (header o query param) y valida
 * que tenga el permiso requerido. Devuelve null si autorizado,
 * o una NextResponse de error si no.
 * 
 * Uso típico en route handlers:
 *   const authError = await checkPermission(request, 'puedeConfiguracion')
 *   if (authError) return authError
 */
export async function checkPermission(
  request: NextRequest,
  permiso: string
): Promise<NextResponse | null> {
  const operadorId = 
    request.headers.get('x-operador-id') || 
    new URL(request.url).searchParams.get('operadorId')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const hasPermission = await validarPermiso(operadorId, permiso)
  if (!hasPermission) {
    logger.warn('Permiso denegado', { operadorId, permiso })
    return NextResponse.json(
      { success: false, error: 'Sin permisos suficientes' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Valida que un operador tenga rol ADMINISTRADOR.
 * Solo los administradores pueden realizar operaciones críticas como:
 * - Crear/eliminar operadores
 * - Ejecutar migraciones y seeds
 * - Modificar configuración del sistema
 * 
 * @param operadorId - ID del operador
 * @returns true si es ADMINISTRADOR, false si no
 */
export async function validarRolAdmin(operadorId: string | null | undefined): Promise<boolean> {
  if (!operadorId) return false

  const operador = await db.operador.findUnique({
    where: { id: operadorId },
    select: { rol: true, activo: true }
  })

  if (!operador) return false
  if (!operador.activo) return false

  return operador.rol === 'ADMINISTRADOR'
}

/**
 * Extrae el operadorId del request y valida que tenga rol ADMINISTRADOR.
 * Devuelve null si es admin, o una NextResponse de error si no.
 * 
 * Uso típico en route handlers:
 *   const adminError = await checkAdminRole(request)
 *   if (adminError) return adminError
 */
export async function checkAdminRole(
  request: NextRequest
): Promise<NextResponse | null> {
  const operadorId = 
    request.headers.get('x-operador-id') || 
    new URL(request.url).searchParams.get('operadorId')

  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  const isAdmin = await validarRolAdmin(operadorId)
  if (!isAdmin) {
    logger.warn('Acceso denegado: se requiere rol ADMINISTRADOR', { operadorId })
    return NextResponse.json(
      { success: false, error: 'Se requiere rol ADMINISTRADOR para esta operación' },
      { status: 403 }
    )
  }

  return null
}
