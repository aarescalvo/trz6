import { BaseService } from '@/core/service/base.service'
import { TropaRepository } from '../repositories/tropa.repository'
import { eventBus, EventTypes } from '@/core/events/event-bus'
import { db } from '@/lib/db'
import {
  Tropa,
  TropaCreate,
  TropaUpdate,
  TropaWithDetails,
  TropaFilters,
  TropaStats,
  TropaPaginatedResponse,
  Especie,
  EstadoTropa,
  CodigoResult,
  TipoAnimalCantidad,
} from '../types'

export class TropaService extends BaseService<Tropa> {
  protected repository: any

  constructor() {
    super()
    this.repository = new TropaRepository()
  }

  /**
   * Crea una nueva tropa con código automático
   */
  async crearTropa(data: TropaCreate): Promise<Tropa> {
    // Generar código automático
    const { numero, codigo } = await this.repository.generarCodigo(data.especie)
    
    // Crear la tropa en una transacción
    const tropa = await db.$transaction(async (tx) => {
      // Crear la tropa
      const nuevaTropa = await tx.tropa.create({
        data: {
          numero,
          codigo,
          codigoSimplificado: codigo.replace(/\s/g, ''),
          productorId: data.productorId,
          usuarioFaenaId: data.usuarioFaenaId,
          especie: data.especie,
          dte: data.dte,
          guia: data.guia,
          cantidadCabezas: data.cantidadCabezas,
          corralId: data.corralId,
          observaciones: data.observaciones,
          operadorId: data.operadorId,
          estado: 'RECIBIDO' as EstadoTropa,
          fechaRecepcion: new Date(),
        },
        include: {
          productor: true,
          usuarioFaena: true,
          corral: true,
        }
      })

      // Guardar tipos de animales si se proporcionaron
      if (data.tiposAnimales && data.tiposAnimales.length > 0) {
        await tx.tropaAnimalCantidad.createMany({
          data: data.tiposAnimales.map(t => ({
            tropaId: nuevaTropa.id,
            tipoAnimal: t.tipo,
            cantidad: t.cantidad,
          }))
        })
      }

      return nuevaTropa
    })

    // Emitir evento de tropa creada
    eventBus.emit(EventTypes.TROPA_CREADA, tropa)

    return tropa as Tropa
  }

  /**
   * Actualiza el estado de una tropa
   */
  async cambiarEstado(id: string, estado: EstadoTropa): Promise<Tropa> {
    const tropaAnterior = await this.repository.findById(id)
    const tropa = await this.repository.updateEstado(id, estado)

    // Emitir evento de cambio de estado
    eventBus.emit(EventTypes.TROPA_ESTADO_CAMBIADO, {
      tropaId: id,
      estadoAnterior: tropaAnterior?.estado,
      estadoNuevo: estado,
      tropa,
    })

    return tropa
  }

  /**
   * Obtiene todas las tropas activas
   */
  async getActivas(): Promise<TropaWithDetails[]> {
    return this.repository.findActivas()
  }

  /**
   * Obtiene una tropa con todos sus detalles
   */
  async getByIdWithDetails(id: string): Promise<TropaWithDetails | null> {
    return this.repository.findByIdWithDetails(id)
  }

  /**
   * Obtiene tropas con filtros y paginación
   */
  async getWithFilters(
    filters: TropaFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<TropaPaginatedResponse> {
    const { data, total } = await this.repository.findWithFilters(filters, page, pageSize)
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * Obtiene estadísticas de tropas
   */
  async getStats(): Promise<TropaStats> {
    return this.repository.getStats()
  }

  /**
   * Asigna un corral a una tropa
   */
  async asignarCorral(id: string, corralId: string): Promise<Tropa> {
    const tropa = await this.repository.asignarCorral(id, corralId)
    
    eventBus.emit(EventTypes.TROPA_ACTUALIZADA, {
      tropaId: id,
      cambio: 'corral_asignado',
      corralId,
    })

    return tropa
  }

  /**
   * Actualiza los pesos de una tropa
   */
  async actualizarPesos(
    id: string,
    pesos: { pesoBruto?: number; pesoTara?: number; pesoNeto?: number; pesoTotalIndividual?: number }
  ): Promise<Tropa> {
    const tropa = await this.repository.updatePesos(id, pesos)

    eventBus.emit(EventTypes.TROPA_ACTUALIZADA, {
      tropaId: id,
      cambio: 'pesos_actualizados',
      pesos,
    })

    return tropa
  }

  /**
   * Actualiza los tipos de animales de una tropa
   */
  async actualizarTiposAnimales(id: string, tipos: TipoAnimalCantidad[]): Promise<void> {
    await this.repository.saveTiposAnimales(id, tipos)

    eventBus.emit(EventTypes.TROPA_ACTUALIZADA, {
      tropaId: id,
      cambio: 'tipos_animales_actualizados',
      tipos,
    })
  }

  /**
   * Obtiene tropas por usuario de faena
   */
  async getByUsuarioFaena(usuarioFaenaId: string): Promise<Tropa[]> {
    return this.repository.findByUsuarioFaena(usuarioFaenaId)
  }

  /**
   * Obtiene tropas por rango de fechas
   */
  async getByFechaRange(
    fechaDesde: Date,
    fechaHasta: Date,
    especie?: Especie
  ): Promise<Tropa[]> {
    return this.repository.findByFechaRange(fechaDesde, fechaHasta, especie)
  }

  /**
   * Genera un código preview sin crear la tropa
   */
  async previewCodigo(especie: Especie): Promise<CodigoResult> {
    return this.repository.generarCodigo(especie)
  }

  /**
   * Busca una tropa por código
   */
  async getByCodigo(codigo: string): Promise<Tropa | null> {
    return this.repository.findByCodigo(codigo)
  }

  /**
   * Busca una tropa por número
   */
  async getByNumero(numero: number): Promise<Tropa | null> {
    return this.repository.findByNumero(numero)
  }

  /**
   * Obtiene el progreso de pesaje de una tropa
   */
  async getProgresoPesaje(id: string): Promise<{
    totalAnimales: number
    animalesPesados: number
    porcentaje: number
  }> {
    const tropa = await this.repository.findById(id)
    if (!tropa) {
      throw new Error('Tropa no encontrada')
    }

    const animalesPesados = await this.repository.countAnimalesPesados(id)

    return {
      totalAnimales: tropa.cantidadCabezas,
      animalesPesados,
      porcentaje: Math.round((animalesPesados / tropa.cantidadCabezas) * 100),
    }
  }

  /**
   * Elimina una tropa (solo si no tiene animales procesados)
   */
  async eliminarTropa(id: string): Promise<Tropa> {
    const animalesPesados = await this.repository.countAnimalesPesados(id)
    
    if (animalesPesados > 0) {
      throw new Error('No se puede eliminar una tropa con animales ya procesados')
    }

    const tropa = await this.repository.delete(id)

    eventBus.emit(EventTypes.TROPA_ELIMINADA, tropa)

    return tropa
  }

  /**
   * Actualiza una tropa completa
   */
  async actualizarTropa(id: string, data: TropaUpdate): Promise<Tropa> {
    const tropa = await this.repository.update(id, data)

    eventBus.emit(EventTypes.TROPA_ACTUALIZADA, {
      tropaId: id,
      cambio: 'tropa_actualizada',
      data,
    })

    return tropa
  }

  /**
   * Valida si una tropa puede cambiar de estado
   */
  async puedeCambiarEstado(id: string, nuevoEstado: EstadoTropa): Promise<{
    valido: boolean
    mensaje?: string
  }> {
    const tropa = await this.repository.findByIdWithDetails(id)
    
    if (!tropa) {
      return { valido: false, mensaje: 'Tropa no encontrada' }
    }

    const estadoActual = tropa.estado

    // Validar transiciones de estado
    const transicionesValidas: Record<EstadoTropa, EstadoTropa[]> = {
      'RECIBIDO': ['EN_CORRAL', 'EN_PESAJE'],
      'EN_CORRAL': ['EN_PESAJE', 'RECIBIDO'],
      'EN_PESAJE': ['PESADO', 'EN_CORRAL'],
      'PESADO': ['LISTO_FAENA', 'EN_PESAJE'],
      'LISTO_FAENA': ['EN_FAENA', 'PESADO'],
      'EN_FAENA': ['FAENADO', 'LISTO_FAENA'],
      'FAENADO': ['DESPACHADO'],
      'DESPACHADO': [],
    }

    if (!transicionesValidas[estadoActual]?.includes(nuevoEstado)) {
      return {
        valido: false,
        mensaje: `No se puede cambiar de ${estadoActual} a ${nuevoEstado}`
      }
    }

    // Validaciones adicionales por estado
    if (nuevoEstado === 'PESADO') {
      const progreso = await this.getProgresoPesaje(id)
      if (progreso.porcentaje < 100) {
        return {
          valido: false,
          mensaje: `Falta pesar ${progreso.totalAnimales - progreso.animalesPesados} animales`
        }
      }
    }

    return { valido: true }
  }
}
