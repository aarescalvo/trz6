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

// Rutas que requieren rol ADMINISTRADOR para escritura (POST/PUT/DELETE/PATCH)
const ADMIN_ONLY_ROUTES = [
  '/api/operadores',
  '/api/seguridad',
  '/api/admin',
  '/api/sistema/backup',
  '/api/backup',
  '/api/migrar-usuarios',
  '/api/puente-web',
  '/api/seed-simulacion',
  '/api/seed-tropas',
]

// Mapeo de rutas a permisos requeridos
// Se usa tanto para documentación como para verificación en middleware
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
  '/api/depositos': 'puedeStock',
  '/api/valores-indicador': 'puedeReportes',
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

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))
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

  // Obtener operadorId de header o query param
  const operadorId = request.headers.get('x-operador-id') || request.nextUrl.searchParams.get('operadorId')
  const operadorRol = request.headers.get('x-operador-rol')

  // Para escritura (POST/PUT/DELETE/PATCH): exigir operadorId
  if (method !== 'GET') {
    if (!operadorId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado - se requiere operadorId' },
        { status: 401 }
      )
    }

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

  // Para GET: si hay operadorId en header, está autenticado
  // Si no hay operadorId, el handler deberá validar si es necesario

  // Propagar operadorId desde query params a headers si no está presente
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
