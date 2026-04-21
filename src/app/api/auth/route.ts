import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkRateLimit, resetRateLimit, generateRateLimitKey } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { createSessionToken, getSessionCookieConfig, getLogoutCookieConfig, verifySessionToken } from '@/lib/jwt'

const logger = createLogger('API:Auth')

// Helper para obtener IP del cliente
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return '127.0.0.1'
}

// Helper para construir el objeto de permisos del operador
function buildPermisos(operador: any) {
  return {
    puedePesajeCamiones: operador.puedePesajeCamiones,
    puedePesajeIndividual: operador.puedePesajeIndividual,
    puedeMovimientoHacienda: operador.puedeMovimientoHacienda,
    puedeListaFaena: operador.puedeListaFaena,
    puedeRomaneo: operador.puedeRomaneo,
    puedeIngresoCajon: operador.puedeIngresoCajon,
    puedeCuarteo: operador.puedeCuarteo,
    puedeDesposte: operador.puedeDesposte,
    puedeEmpaque: operador.puedeEmpaque,
    puedeExpedicionC2: operador.puedeExpedicionC2,
    puedeMenudencias: operador.puedeMenudencias,
    puedeStock: operador.puedeStock,
    puedeReportes: operador.puedeReportes,
    puedeCCIR: operador.puedeCCIR,
    puedeFacturacion: operador.puedeFacturacion,
    puedeConfiguracion: operador.puedeConfiguracion
  }
}

// GET - Validate operator session (now verifies JWT cookie)
export async function GET(request: NextRequest) {
  try {
    const cookieConfig = getSessionCookieConfig()
    const token = request.cookies.get(cookieConfig.name)?.value
    
    // Try JWT cookie first (new method)
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        // Verify operator still exists and is active
        const operador = await db.operador.findUnique({
          where: { id: payload.operadorId }
        })
        
        if (operador && operador.activo) {
          return NextResponse.json({
            success: true,
            data: {
              id: operador.id,
              nombre: operador.nombre,
              usuario: operador.usuario,
              rol: operador.rol,
              email: operador.email,
              permisos: buildPermisos(operador)
            }
          })
        }
        
        // Operator no longer valid - clear cookie
        const logoutConfig = getLogoutCookieConfig()
        const response = NextResponse.json(
          { success: false, error: 'Sesión expirada' },
          { status: 401 }
        )
        response.cookies.set(logoutConfig.name, '', logoutConfig.options)
        return response
      }
    }
    
    // LEGACY AUTH REMOVIDO - Solo se acepta JWT via cookie session_token
    return NextResponse.json(
      { success: false, error: 'No hay sesión activa' },
      { status: 401 }
    )
  } catch (error) {
    logger.error('Error validando operador', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// POST - Login con usuario/password o PIN (now issues JWT in httpOnly cookie)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    const body = await request.json()
    const { usuario, password, pin } = body
    
    logger.info('Intento de login', { usuario, hasPassword: !!password, hasPin: !!pin, ip })
    
    // Login con usuario y password
    if (usuario && password) {
      // Verificar rate limit
      const rateLimitKey = generateRateLimitKey(ip, 'auth:login', usuario)
      const rateLimit = checkRateLimit(rateLimitKey, 'AUTH_LOGIN')
      
      if (!rateLimit.allowed) {
        logger.warn('Rate limit excedido', { usuario, ip, blocked: rateLimit.blocked })
        return NextResponse.json(
          { 
            success: false, 
            error: rateLimit.blocked 
              ? 'Cuenta bloqueada temporalmente. Intente más tarde.' 
              : 'Demasiados intentos. Intente más tarde.',
            retryAfter: rateLimit.retryAfter
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfter || 60)
            }
          }
        )
      }
      
      logger.debug('Buscando usuario', { usuario: String(usuario).toLowerCase() })
      
      const operador = await db.operador.findFirst({
        where: {
          usuario: String(usuario).toLowerCase(),
          activo: true
        }
      })
      
      if (!operador) {
        logger.warn('Usuario no encontrado', { usuario, ip })
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado o inactivo' },
          { status: 401 }
        )
      }
      
      const validPassword = await bcrypt.compare(password, operador.password)
      
      if (!validPassword) {
        logger.warn('Contraseña incorrecta', { usuario, ip })
        return NextResponse.json(
          { success: false, error: 'Contraseña incorrecta' },
          { status: 401 }
        )
      }
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Crear JWT token
      const permisos = buildPermisos(operador)
      const token = await createSessionToken({
        operadorId: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        permisos
      })
      
      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login exitoso: ${operador.nombre} (${operador.usuario})`,
          ip
        }
      })
      
      logger.info('Login exitoso', { usuario: operador.usuario, nombre: operador.nombre, ip })
      
      // Set JWT in httpOnly cookie
      const cookieConfig = getSessionCookieConfig()
      const response = NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos
        }
      })
      response.cookies.set(cookieConfig.name, token, cookieConfig.options)
      
      return response
    }
    
    // Login con PIN (alternativa rápida)
    if (pin) {
      // Verificar rate limit para PIN
      const rateLimitKey = generateRateLimitKey(ip, 'auth:pin')
      const rateLimit = checkRateLimit(rateLimitKey, 'AUTH_PIN')
      
      if (!rateLimit.allowed) {
        logger.warn('Rate limit PIN excedido', { ip, blocked: rateLimit.blocked })
        return NextResponse.json(
          { 
            success: false, 
            error: rateLimit.blocked 
              ? 'Demasiados intentos fallidos. Espere antes de reintentar.' 
              : 'Demasiados intentos. Intente más tarde.',
            retryAfter: rateLimit.retryAfter
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfter || 60)
            }
          }
        )
      }
      
      // Hash PIN and compare (security improvement - PIN should be hashed)
      // For now, maintain backward compatibility but log a warning
      const operador = await db.operador.findFirst({
        where: {
          pin: String(pin),
          activo: true
        }
      })
      
      if (!operador) {
        logger.warn('PIN inválido', { ip })
        return NextResponse.json(
          { success: false, error: 'PIN inválido o operador inactivo' },
          { status: 401 }
        )
      }
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Crear JWT token
      const permisos = buildPermisos(operador)
      const token = await createSessionToken({
        operadorId: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        permisos
      })
      
      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN_PIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login con PIN: ${operador.nombre}`,
          ip
        }
      })
      
      logger.info('Login con PIN exitoso', { usuario: operador.usuario, ip })
      
      // Set JWT in httpOnly cookie
      const cookieConfig = getSessionCookieConfig()
      const response = NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos
        }
      })
      response.cookies.set(cookieConfig.name, token, cookieConfig.options)
      
      return response
    }
    
    return NextResponse.json(
      { success: false, error: 'Debe proporcionar usuario/password o PIN' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Error en login', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Logout (clear JWT cookie)
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    // Get operadorId from JWT cookie before clearing
    const cookieConfig = getSessionCookieConfig()
    const token = request.cookies.get(cookieConfig.name)?.value
    let operadorId: string | null = null
    
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        operadorId = payload.operadorId
      }
    }
    
    // Registrar logout en auditoría si hay operador identificado
    if (operadorId) {
      await db.auditoria.create({
        data: {
          operadorId,
          modulo: 'AUTH',
          accion: 'LOGOUT',
          entidad: 'Operador',
          entidadId: operadorId,
          descripcion: 'Logout',
          ip
        }
      })
      
      logger.info('Logout', { operadorId, ip })
    }
    
    // Clear JWT cookie
    const logoutConfig = getLogoutCookieConfig()
    const response = NextResponse.json({ success: true })
    response.cookies.set(logoutConfig.name, '', logoutConfig.options)
    
    return response
  } catch (error) {
    logger.error('Error en logout', error)
    // Still clear cookie even on error
    const logoutConfig = getLogoutCookieConfig()
    const response = NextResponse.json({ success: true })
    response.cookies.set(logoutConfig.name, '', logoutConfig.options)
    return response
  }
}
