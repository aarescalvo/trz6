import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/jwt'
import { checkRateLimit, generateRateLimitKey, RATE_LIMIT_CONFIGS, type RateLimitType } from '@/lib/rate-limit'

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/sistema/status',
]

// Rutas de solo lectura (GET) que no requieren permisos específicos
// (cualquier operador autenticado puede consultar)
const READ_ONLY_NO_PERM = [
  '/api/configuracion',
  '/api/indicadores',
]

// Rutas que requieren rol ADMINISTRADOR para escritura (POST/PUT/DELETE/PATCH)
const ADMIN_ONLY_ROUTES = [
  '/api/operadores',
  '/api/seguridad',
  '/api/admin',
  '/api/sistema/backup',
  '/api/backup',
  '/api/migrar-usuarios',
  '/api/puente-web',
]

// Mapeo de rutas a permisos requeridos
const ROUTE_PERMISSIONS: Record<string, string> = {
  // Faena y Hacienda
  '/api/facturacion': 'puedeFacturacion',
  '/api/cuenta-corriente': 'puedeFacturacion',
  '/api/operadores': 'puedeConfiguracion',
  '/api/usuarios': 'puedeConfiguracion',
  '/api/configuracion': 'puedeConfiguracion',
  '/api/corrales': 'puedeMovimientoHacienda',
  '/api/tropas': 'puedeMovimientoHacienda',
  '/api/animales': 'puedeMovimientoHacienda',
  '/api/pesaje-camion': 'puedePesajeCamiones',
  '/api/pesaje-individual': 'puedePesajeIndividual',
  '/api/pesaje-interno': 'puedePesajeIndividual',
  '/api/lista-faena': 'puedeListaFaena',
  '/api/romaneo': 'puedeRomaneo',
  '/api/romaneos': 'puedeRomaneo',
  '/api/romaneos-dia': 'puedeRomaneo',
  '/api/sesion-romaneo': 'puedeRomaneo',
  '/api/vb-romaneo': 'puedeRomaneo',
  '/api/ingreso-cajon': 'puedeIngresoCajon',
  '/api/menudencias': 'puedeMenudencias',
  '/api/tipos-menudencia': 'puedeMenudencias',
  '/api/stock': 'puedeStock',
  '/api/stock-camaras': 'puedeStock',
  '/api/stock-cuartos': 'puedeStock',
  '/api/stock-insumos': 'puedeStock',
  '/api/stock-productos': 'puedeStock',
  '/api/ccir': 'puedeCCIR',
  '/api/declaracion-jurada': 'puedeCCIR',
  '/api/reportes-senasa': 'puedeReportes',
  '/api/reportes-sif': 'puedeReportes',
  '/api/reportes-sigica': 'puedeReportes',
  '/api/reportes': 'puedeReportes',
  '/api/reportes-automaticos': 'puedeReportes',
  '/api/plantillas-reporte': 'puedeReportes',
  '/api/auditoria': 'puedeReportes',
  '/api/despachos': 'puedeFacturacion',
  '/api/liquidaciones': 'puedeFacturacion',
  '/api/tarifas': 'puedeFacturacion',
  '/api/precios': 'puedeFacturacion',
  '/api/precios-servicio': 'puedeFacturacion',
  '/api/precios-cliente': 'puedeFacturacion',
  '/api/precios-rendering': 'puedeFacturacion',
  '/api/precios-sugeridos': 'puedeFacturacion',
  '/api/historico-precios': 'puedeFacturacion',
  '/api/historico-precios-producto': 'puedeFacturacion',
  '/api/historial-precios': 'puedeFacturacion',
  '/api/clientes': 'puedeFacturacion',
  '/api/tipos-servicio': 'puedeFacturacion',
  '/api/insumos': 'puedeStock',
  '/api/movimientos-insumos': 'puedeStock',
  '/api/rotulos': 'puedeConfiguracion',
  '/api/configuracion-rotulos': 'puedeConfiguracion',
  '/api/seguridad': 'puedeConfiguracion',
  '/api/admin': 'puedeConfiguracion',
  '/api/backup': 'puedeConfiguracion',
  '/api/productos': 'puedeStock',
  '/api/productos-vendibles': 'puedeStock',
  '/api/sistema/backup': 'puedeConfiguracion',
  '/api/sistema': 'puedeConfiguracion',
  // Faena
  '/api/flujo-faena': 'puedeListaFaena',
  '/api/garrones': 'puedeListaFaena',
  '/api/garrones-asignados': 'puedeListaFaena',
  '/api/medias-res': 'puedeRomaneo',
  '/api/balances-faena': 'puedeRomaneo',
  '/api/rinde-faena': 'puedeRomaneo',
  '/api/rindes': 'puedeRomaneo',
  '/api/rendimientos-historico': 'puedeRomaneo',
  '/api/grasa-dressing': 'puedeRomaneo',
  '/api/tipificadores': 'puedeListaFaena',
  '/api/cueros': 'puedeStock',
  '/api/decomisos': 'puedeStock',
  '/api/rendering': 'puedeStock',
  // Desposte / Ingreso despostada
  '/api/ingreso-despostada': 'puedeDesposte',
  '/api/movimientos-despostada': 'puedeDesposte',
  '/api/lotes-despostada': 'puedeDesposte',
  '/api/merma-despostada': 'puedeDesposte',
  // Balanza
  '/api/balanza': 'puedePesajeIndividual',
  '/api/balanzas': 'puedeConfiguracion',
  '/api/config-balanzas': 'puedeConfiguracion',
  // Ciclo II
  '/api/cuarteo': 'puedeCuarteo',
  '/api/cuartos': 'puedeCuarteo',
  '/api/c2-ingreso-desposte': 'puedeDesposte',
  '/api/c2-produccion-cajas': 'puedeDesposte',
  '/api/c2-subproductos': 'puedeDesposte',
  '/api/c2-degradacion': 'puedeDesposte',
  '/api/empaque': 'puedeEmpaque',
  '/api/caja-empaque': 'puedeEmpaque',
  '/api/c2-expedicion': 'puedeExpedicionC2',
  '/api/c2-pallets': 'puedeExpedicionC2',
  '/api/c2-stock': 'puedeStock',
  '/api/c2-rendimiento': 'puedeStock',
  // Ciclo II - Configuración
  '/api/c2-rubros': 'puedeConfiguracion',
  '/api/c2-tipos-cuarto': 'puedeConfiguracion',
  '/api/c2-productos-desposte': 'puedeConfiguracion',
  '/api/c2-bom': 'puedeConfiguracion',
  // Expedición / Despachos
  '/api/expedicion': 'puedeFacturacion',
  '/api/fifo': 'puedeStock',
  // Financiero
  '/api/pagos': 'puedeFacturacion',
  '/api/pagos-factura': 'puedeFacturacion',
  '/api/notas-credito': 'puedeFacturacion',
  '/api/notas-debito': 'puedeFacturacion',
  '/api/detalles-nota-credito': 'puedeFacturacion',
  '/api/detalles-nota-debito': 'puedeFacturacion',
  '/api/cheques': 'puedeFacturacion',
  '/api/cuentas-bancarias': 'puedeFacturacion',
  '/api/movimientos-caja': 'puedeFacturacion',
  '/api/arqueos-caja': 'puedeFacturacion',
  '/api/cotizaciones': 'puedeFacturacion',
  '/api/costos-faena': 'puedeFacturacion',
  '/api/proveedores': 'puedeFacturacion',
  '/api/productores': 'puedeFacturacion',
  '/api/recepciones-compra': 'puedeFacturacion',
  '/api/ordenes-compra': 'puedeFacturacion',
  '/api/detalles-orden-compra': 'puedeFacturacion',
  '/api/monedas': 'puedeFacturacion',
  '/api/formas-pago': 'puedeFacturacion',
  '/api/contabilidad': 'puedeConfiguracion',
  '/api/sigica': 'puedeReportes',
  // Stock / Inventario
  '/api/inventarios': 'puedeStock',
  '/api/detalles-inventario': 'puedeStock',
  '/api/vencimientos': 'puedeStock',
  '/api/movimiento-camaras': 'puedeStock',
  '/api/movimientos-camara': 'puedeStock',
  '/api/camaras': 'puedeStock',
  '/api/ingreso-terceros': 'puedeStock',
  '/api/subproductos-config': 'puedeStock',
  '/api/subproductos-incomestibles': 'puedeStock',
  '/api/cajas': 'puedeEmpaque',
  '/api/pallet': 'puedeExpedicionC2',
  '/api/consumos-centro': 'puedeStock',
  '/api/consumos-insumo': 'puedeStock',
  '/api/presupuestos-centro': 'puedeStock',
  // Configuración general
  '/api/codigo-barras': 'puedeConfiguracion',
  '/api/condiciones-embalaje': 'puedeConfiguracion',
  '/api/categorias-insumos': 'puedeConfiguracion',
  '/api/articulos': 'puedeConfiguracion',
  '/api/codigos-articulo': 'puedeConfiguracion',
  '/api/razas': 'puedeConfiguracion',
  '/api/tipos-producto': 'puedeConfiguracion',
  '/api/tipos-trabajo': 'puedeConfiguracion',
  '/api/transportistas': 'puedeConfiguracion',
  '/api/impresoras': 'puedeConfiguracion',
  '/api/centros-costo': 'puedeConfiguracion',
  '/api/puestos-trabajo': 'puedeConfiguracion',
  '/api/terminales': 'puedeConfiguracion',
  '/api/layout-modulo': 'puedeConfiguracion',
  '/api/observaciones-usuario': 'puedeConfiguracion',
  '/api/preferencias-ui': 'puedeConfiguracion',
  // Calidad / Email
  '/api/calidad-reclamos': 'puedeReportes',
  '/api/calidad-novedades': 'puedeReportes',
  '/api/calidad-usuarios': 'puedeConfiguracion',
  '/api/email': 'puedeConfiguracion',
  // Conciliación
  '/api/conciliacion': 'puedeStock',
  '/api/balances-insumos': 'puedeStock',
  // Misc
  '/api/planilla01': 'puedeReportes',
  '/api/actividad-operador': 'puedeConfiguracion',
  '/api/autorizaciones-reporte': 'puedeReportes',
  '/api/gerencia': 'puedeReportes',
  '/api/borrador': 'puedeConfiguracion',
  '/api/busqueda': 'puedeStock',
  '/api/trazabilidad': 'puedeStock',
  '/api/trazabilidad-pdf': 'puedeStock',
  '/api/afip': 'puedeConfiguracion',
  '/api/alertas': 'puedeStock',
  '/api/barcode': 'puedeConfiguracion',
  '/api/dashboard': 'puedeReportes',
  '/api/dashboard-financiero': 'puedeDashboardFinanciero',
  '/api/depositos': 'puedeStock',
  '/api/valores-indicador': 'puedeReportes',
  '/api/filtros-reporte': 'puedeReportes',
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Validar Origin/Referer para protección CSRF en operaciones de escritura.
 * Se asegura que las peticiones mutating (POST/PUT/DELETE/PATCH) provengan
 * del dominio legítimo de la aplicación, evitando ataques CSRF cross-origin.
 * En desarrollo se permite localhost y la URL configurada.
 */
function isOriginAllowed(request: NextRequest): boolean {
  // Los GET son safe methods, no necesitan validación CSRF
  const method = request.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // Orígenes permitidos (sin protocolo)
  const allowedHosts: string[] = []

  // Agregar la URL configurada de la app
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      const parsed = new URL(appUrl)
      allowedHosts.push(parsed.host)
    } catch {
      // Ignorar si la URL es inválida
    }
  }

  // En desarrollo, siempre permitir localhost
  if (process.env.NODE_ENV === 'development') {
    allowedHosts.push('localhost:3000', 'localhost:3001', '127.0.0.1:3000', '127.0.0.1:3001')
  }

  // Si no hay Origin ni Referer, verificar si el Host coincide
  if (!origin && !referer) {
    // En desarrollo, permitir requests sin origin (ej: Postman, fetch directo)
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    // En producción, si el host está en la lista permitida, confiar
    if (host && allowedHosts.includes(host)) {
      return true
    }
    return false
  }

  // Verificar Origin (header prioritario para CORS/CSRF)
  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (allowedHosts.includes(originHost)) {
        return true
      }
      // Permitir si el origin coincide con el host del request (same-origin)
      if (host && originHost === host) {
        return true
      }
    } catch {
      // Origin inválido
      return false
    }
  }

  // Fallback: verificar Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (allowedHosts.includes(refererHost)) {
        return true
      }
      if (host && refererHost === host) {
        return true
      }
    } catch {
      // Referer inválido
      return false
    }
  }

  return false
}

function getRateLimitType(pathname: string, method: string): RateLimitType {
  // Auth routes get stricter limits to prevent brute force
  if (pathname.startsWith('/api/auth')) {
    return 'AUTH_LOGIN'
  }
  // Write operations get lower limits
  if (method !== 'GET') {
    return 'API_WRITE'
  }
  // Default: general API limit
  return 'API_GENERAL'
}

function getRequiredPermission(pathname: string): string | null {
  // Find the longest matching route prefix
  let bestMatch: string | null = null
  for (const route of Object.keys(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      if (!bestMatch || route.length > bestMatch.length) {
        bestMatch = route
      }
    }
  }
  return bestMatch ? ROUTE_PERMISSIONS[bestMatch] : null
}

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ========================================
  // RATE LIMITING
  // ========================================
  const clientIp = getClientIp(request)
  const rateLimitType = getRateLimitType(pathname, method)
  const rateLimitKey = generateRateLimitKey(clientIp, pathname)
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitType)
  const rateLimitConfig = RATE_LIMIT_CONFIGS[rateLimitType]

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: rateLimitResult.blocked
          ? 'Demasiados intentos. Intente más tarde.'
          : 'Rate limit excedido',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || 60),
          'X-RateLimit-Limit': String(rateLimitConfig.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
        },
      }
    )
  }

  // ========================================
  // CSRF PROTECTION (Origin validation for mutating requests)
  // ========================================
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { success: false, error: 'Origen no permitido - posible ataque CSRF' },
      { status: 403 }
    )
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))
    return response
  }

  // Allow GET requests on read-only-no-perm routes
  if (method === 'GET' && READ_ONLY_NO_PERM.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))
    return response
  }

  // ========================================
  // JWT AUTHENTICATION (primary method)
  // ========================================
  let operadorId: string | null = null
  let operadorRol: string | null = null
  
  // Try JWT cookie first (secure method)
  const token = request.cookies.get('session_token')?.value
  if (token) {
    const payload = await verifySessionToken(token)
    if (payload) {
      operadorId = payload.operadorId
      operadorRol = payload.rol
    }
  }
  
  // LEGACY AUTH REMOVIDO - Solo se acepta JWT via cookie session_token
  // Antes se aceptaba x-operador-id header / operadorId query param (session hijacking risk)

  // Para TODOS los métodos: exigir autenticación JWT
  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado - inicie sesión' },
      { status: 401 }
    )
  }

  // Para escritura (POST/PUT/DELETE/PATCH): verificar permisos adicionales
  if (method !== 'GET') {

    // Verificar rutas admin: exigir rol ADMINISTRADOR
    if (isAdminOnlyRoute(pathname)) {
      if (operadorRol !== 'ADMINISTRADOR') {
        return NextResponse.json(
          { success: false, error: 'Se requiere rol ADMINISTRADOR para esta operación' },
          { status: 403 }
        )
      }
    }
  }

  // Para GET: autenticación ya verificada arriba, propagar identidy

  // Propagar identidad del operador autenticado via headers
  const response = NextResponse.next()
  response.headers.set('x-operador-id', operadorId!)
  if (operadorRol) {
    response.headers.set('x-operador-rol', operadorRol)
  }
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}
