import { BaseRepository } from '@/core/repository/base.repository'
import { db } from '@/lib/db'
import {
  Tropa,
  TropaCreate,
  TropaUpdate,
  TropaWithDetails,
  TropaFilters,
  TropaStats,
  Especie,
  EstadoTropa,
  CodigoResult,
  TipoAnimalCantidad,
} from '../types'

export class TropaRepository extends BaseRepository<Tropa> {
  protected model: any = db.tropa

  /**
   * Busca una tropa por su código único
   */
  async findByCodigo(codigo: string): Promise<Tropa | null> {
    return this.model.findUnique({ where: { codigo } }) as Promise<Tropa | null>
  }

  /**
   * Busca una tropa por su número único
   */
  async findByNumero(numero: number): Promise<Tropa | null> {
    return this.model.findUnique({ where: { numero } }) as Promise<Tropa | null>
  }

  /**
   * Obtiene todas las tropas activas (pendientes de procesar)
   */
  async findActivas(): Promise<TropaWithDetails[]> {
    return this.model.findMany({
      where: {
        estado: { in: ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA'] as EstadoTropa[] }
      },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        operador: true,
        tiposAnimales: true,
      },
      orderBy: { fechaRecepcion: 'desc' }
    }) as unknown as Promise<TropaWithDetails[]>
  }

  /**
   * Obtiene el siguiente número correlativo para una especie
   */
  async getNextNumero(especie: Especie): Promise<number> {
    const prefijo = especie === 'BOVINO' ? 'B' : 'E'
    const ultima = await this.model.findFirst({
      where: {
        codigo: { startsWith: prefijo }
      },
      orderBy: { numero: 'desc' }
    })
    return (ultima?.numero || 0) + 1
  }

  /**
   * Genera un código único para una nueva tropa
   * Formato: "B 2024 0001" para bovinos, "E 2024 0001" para equinos
   */
  async generarCodigo(especie: Especie): Promise<CodigoResult> {
    const numero = await this.getNextNumero(especie)
    const prefijo = especie === 'BOVINO' ? 'B' : 'E'
    const anio = new Date().getFullYear()
    const codigo = `${prefijo} ${anio} ${numero.toString().padStart(4, '0')}`
    return { numero, codigo }
  }

  /**
   * Obtiene tropas con filtros y paginación
   */
  async findWithFilters(
    filters: TropaFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: TropaWithDetails[]; total: number }> {
    const where: Record<string, unknown> = {}

    if (filters.especie) {
      where.especie = filters.especie
    }

    if (filters.estado) {
      if (Array.isArray(filters.estado)) {
        where.estado = { in: filters.estado }
      } else {
        where.estado = filters.estado
      }
    }

    if (filters.productorId) {
      where.productorId = filters.productorId
    }

    if (filters.usuarioFaenaId) {
      where.usuarioFaenaId = filters.usuarioFaenaId
    }

    if (filters.corralId) {
      where.corralId = filters.corralId
    }

    if (filters.fechaDesde || filters.fechaHasta) {
      where.fechaRecepcion = {}
      if (filters.fechaDesde) {
        (where.fechaRecepcion as Record<string, unknown>).gte = filters.fechaDesde
      }
      if (filters.fechaHasta) {
        (where.fechaRecepcion as Record<string, unknown>).lte = filters.fechaHasta
      }
    }

    if (filters.search) {
      where.OR = [
        { codigo: { contains: filters.search } },
        { codigoSimplificado: { contains: filters.search } },
        { dte: { contains: filters.search } },
        { guia: { contains: filters.search } },
      ]
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: {
          productor: true,
          usuarioFaena: true,
          corral: true,
          operador: true,
          tiposAnimales: true,
        },
        orderBy: { fechaRecepcion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.model.count({ where }),
    ])

    return { data: data as unknown as TropaWithDetails[], total }
  }

  /**
   * Obtiene estadísticas de tropas
   */
  async getStats(): Promise<TropaStats> {
    const [total, porEstado, porEspecie] = await Promise.all([
      this.model.count(),
      this.model.groupBy({
        by: ['estado'],
        _count: { id: true },
      }),
      this.model.groupBy({
        by: ['especie'],
        _count: { id: true },
      }),
    ])

    const estadoStats = {} as Record<EstadoTropa, number>
    const estados: EstadoTropa[] = ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA', 'FAENADO', 'DESPACHADO']
    estados.forEach(e => {
      estadoStats[e] = 0
    })
    porEstado.forEach(item => {
      estadoStats[item.estado as EstadoTropa] = item._count.id
    })

    const especieStats = {} as Record<Especie, number>
    especieStats['BOVINO'] = 0
    especieStats['EQUINO'] = 0
    porEspecie.forEach(item => {
      especieStats[item.especie as Especie] = item._count.id
    })

    return {
      total,
      porEstado: estadoStats,
      porEspecie: especieStats,
      pendientesPesaje: estadoStats['RECIBIDO'] + estadoStats['EN_CORRAL'] + estadoStats['EN_PESAJE'],
      pendientesFaena: estadoStats['PESADO'] + estadoStats['LISTO_FAENA'],
    }
  }

  /**
   * Obtiene una tropa con todos sus detalles
   */
  async findByIdWithDetails(id: string): Promise<TropaWithDetails | null> {
    return this.model.findUnique({
      where: { id },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        operador: true,
        animales: {
          orderBy: { numero: 'asc' }
        },
        tiposAnimales: true,
      },
    }) as Promise<TropaWithDetails | null>
  }

  /**
   * Actualiza el estado de una tropa
   */
  async updateEstado(id: string, estado: EstadoTropa): Promise<Tropa> {
    return this.model.update({
      where: { id },
      data: { estado }
    }) as Promise<Tropa>
  }

  /**
   * Asigna un corral a una tropa
   */
  async asignarCorral(id: string, corralId: string): Promise<Tropa> {
    return this.model.update({
      where: { id },
      data: { corralId, estado: 'EN_CORRAL' as EstadoTropa }
    }) as Promise<Tropa>
  }

  /**
   * Actualiza los pesos de una tropa
   */
  async updatePesos(
    id: string,
    pesos: { pesoBruto?: number; pesoTara?: number; pesoNeto?: number; pesoTotalIndividual?: number }
  ): Promise<Tropa> {
    return this.model.update({
      where: { id },
      data: pesos
    }) as Promise<Tropa>
  }

  /**
   * Guarda los tipos de animales de una tropa
   */
  async saveTiposAnimales(tropaId: string, tipos: TipoAnimalCantidad[]): Promise<void> {
    // Primero eliminamos los tipos existentes
    await db.tropaAnimalCantidad.deleteMany({
      where: { tropaId }
    })

    // Luego insertamos los nuevos
    if (tipos.length > 0) {
      await db.tropaAnimalCantidad.createMany({
        data: tipos.map(t => ({
          tropaId,
          tipoAnimal: t.tipo,
          cantidad: t.cantidad,
        }))
      })
    }
  }

  /**
   * Obtiene tropas por usuario de faena
   */
  async findByUsuarioFaena(usuarioFaenaId: string): Promise<Tropa[]> {
    return this.model.findMany({
      where: { usuarioFaenaId },
      include: {
        productor: true,
        corral: true,
        tiposAnimales: true,
      },
      orderBy: { fechaRecepcion: 'desc' }
    }) as unknown as Promise<Tropa[]>
  }

  /**
   * Obtiene tropas por rango de fechas
   */
    async findByFechaRange(
    fechaDesde: Date,
    fechaHasta: Date,
    especie?: Especie
  ): Promise<Tropa[]> {
    const where: Record<string, unknown> = {
      fechaRecepcion: {
        gte: fechaDesde,
        lte: fechaHasta
      }
    }

    if (especie) {
      where.especie = especie
    }

    return this.model.findMany({
      where,
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        tiposAnimales: true,
      },
      orderBy: { fechaRecepcion: 'desc' }
    }) as unknown as Promise<Tropa[]>
  }

  /**
   * Cuenta animales pesados en una tropa
   */
  async countAnimalesPesados(tropaId: string): Promise<number> {
    return db.animal.count({
      where: {
        tropaId,
        estado: { in: ['PESADO', 'EN_FAENA', 'FAENADO', 'EN_CAMARA', 'DESPACHADO'] }
      }
    })
  }
}
