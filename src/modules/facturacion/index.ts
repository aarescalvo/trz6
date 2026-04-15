// Módulo Facturación - Fachada
export { FacturacionModule } from '@/components/facturacion'
export { DespachosModule } from '@/components/despachos'

// Types
export type { 
  TipoTarifa, HistoricoTarifa, CrearTarifaInput,
  LiquidacionFaena, LiquidacionItem, CrearLiquidacionInput,
  ActualizarItemsInput, SupervisorAuthInput,
  TropaPendienteLiquidacion, EstadoLiquidacion, UnidadTarifa
} from './types'

// Constants
export {
  TIPOS_TARIFA_DEFAULT, ESPECIE_TARIFA_MAP, ALICUOTAS_IVA,
  TIPOS_COMPROBANTE_AFIP, CONDICION_IVA_COMPROBANTE,
  PERMISOS_FACTURACION, MOTIVOS_NOTA, TRIBUTOS_AFIP,
  ESTADOS_LIQUIDACION, UNIDADES_TARIFA
} from './constants'
