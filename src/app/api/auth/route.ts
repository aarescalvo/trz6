import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkRateLimit, resetRateLimit, generateRateLimitKey } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:Auth')

// Helper para obtener IP del cliente
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return '127.0.0.1'
}

// GET - Validate operator session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operadorId = searchParams.get('operadorId')
    
    if (!operadorId) {
      return NextResponse.json(
        { success: false, error: 'Operador ID requerido' },
        { status: 400 }
      )
    }
    
    const operador = await db.operador.findUnique({
      where: { id: operadorId }
    })
    
    if (!operador || !operador.activo) {
      return NextResponse.json(
        { success: false, error: 'Operador no encontrado o inactivo' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        email: operador.email,
        permisos: {
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
    })
  } catch (error) {
    logger.error('Error validando operador', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// POST - Login con usuario/password o PIN
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
      
      return NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos: {
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
      })
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
      
      return NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos: {
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
      })
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

// DELETE - Logout
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    const body = await request.json()
    const { operadorId } = body
    
    if (operadorId) {
      // Registrar logout en auditoría
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
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error en logout', error)
    return NextResponse.json({ success: true })
  }
}
