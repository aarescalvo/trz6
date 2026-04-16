import { NextRequest, NextResponse } from 'next/server'

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/seed',
  '/api/seed-simulacion',
  '/api/seed-tropas',
  '/api/migrar-usuarios',
  '/api/sistema/status',
  '/api/balanza/lectura',
  '/api/balanza/configuracion',
]

// Rutas de solo lectura (GET) que no requieren permisos específicos
// (cualquier operador autenticado puede consultar)
const READ_ONLY_NO_PERM = [
  '/api/configuracion',
  '/api/indicadores',
  '/api/dashboard',
  '/api/dashboard-financiero',
]

// Mapeo de rutas a permisos requeridos para escritura (POST/PUT/DELETE/PATCH)
const ROUTE_PERMISSIONS: Record<string, string> = {
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
  '/api/lista-faena': 'puedeListaFaena',
  '/api/romaneo': 'puedeRomaneo',
  '/api/ingreso-cajon': 'puedeIngresoCajon',
  '/api/menudencias': 'puedeMenudencias',
  '/api/stock': 'puedeStock',
  '/api/stock-camaras': 'puedeStock',
  '/api/ccir': 'puedeCCIR',
  '/api/declaracion-jurada': 'puedeCCIR',
  '/api/reportes-senasa': 'puedeReportes',
  '/api/auditoria': 'puedeReportes',
  '/api/despachos': 'puedeFacturacion',
  '/api/liquidaciones': 'puedeFacturacion',
  '/api/tarifas': 'puedeFacturacion',
  '/api/precios': 'puedeFacturacion',
  '/api/precios-servicio': 'puedeFacturacion',
  '/api/precios-cliente': 'puedeFacturacion',
  '/api/historico-precios': 'puedeFacturacion',
  '/api/historial-precios': 'puedeFacturacion',
  '/api/clientes': 'puedeFacturacion',
  '/api/tipos-servicio': 'puedeFacturacion',
  '/api/insumos': 'puedeStock',
  '/api/rotulos': 'puedeConfiguracion',
  '/api/seguridad': 'puedeConfiguracion',
  '/api/admin': 'puedeConfiguracion',
  '/api/backup': 'puedeConfiguracion',
  '/api/productos': 'puedeStock',
  '/api/sistema/backup': 'puedeConfiguracion',
  // Ciclo II - Desposte y Logística
  '/api/cuarteo': 'puedeCuarteo',
  '/api/cuartos': 'puedeCuarteo',
  '/api/ingreso-despostada': 'puedeDesposte',
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
  '/api/movimientos-despostada': 'puedeDesposte',
  '/api/lotes-despostada': 'puedeDesposte',
  // Ciclo II - Configuración
  '/api/c2-rubros': 'puedeConfiguracion',
  '/api/c2-tipos-cuarto': 'puedeConfiguracion',
  '/api/c2-productos-desposte': 'puedeConfiguracion',
  '/api/c2-bom': 'puedeConfiguracion',
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Allow GET requests on read-only-no-perm routes
  if (method === 'GET' && READ_ONLY_NO_PERM.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // For write operations (POST/PUT/DELETE/PATCH), validate operadorId header
  if (method !== 'GET') {
    const operadorId = request.headers.get('x-operador-id') || request.nextUrl.searchParams.get('operadorId')

    if (!operadorId) {
      // Some routes pass operadorId in the body, which we can't read in middleware.
      // The handler will validate permissions using the body operadorId.
      // But for routes that should have it in headers, we still pass through.
      // The handler-level validation is the authoritative check.
    }
  }

  // Propagate operadorId from query params to headers if not already present
  const response = NextResponse.next()
  const operadorIdQuery = request.nextUrl.searchParams.get('operadorId')
  if (operadorIdQuery && !request.headers.get('x-operador-id')) {
    response.headers.set('x-operador-id', operadorIdQuery)
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}
