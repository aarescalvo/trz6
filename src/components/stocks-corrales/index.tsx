'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  Warehouse, Loader2, RefreshCw, AlertTriangle, CheckCircle, 
  MinusCircle, PlusCircle
} from 'lucide-react'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface Operador {
  id: string
  nombre: string
  rol: string
}

interface CorralStock {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
  activo: boolean
  tropas: Array<{
    id: string
    codigo: string
    especie: string
    cantidadCabezas: number
    estado: string
    productor?: { nombre: string }
    fechaRecepcion: string
  }>
}

interface Props {
  operador: Operador
}

export function StocksCorralesModule({ operador }: Props) {
  const { editMode, getTexto } = useEditor()
  const [corrales, setCorrales] = useState<CorralStock[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    fetchStock()
  }, [])

  const fetchStock = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/corrales/stock')
      const data = await res.json()
      if (data.success) {
        setCorrales(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar stock de corrales')
    } finally {
      setLoading(false)
    }
  }

  const getOcupacion = (corral: CorralStock) => {
    const total = corral.stockBovinos + corral.stockEquinos
    const porcentaje = corral.capacidad > 0 ? (total / corral.capacidad) * 100 : 0
    return { total, porcentaje }
  }

  const getEstadoBadge = (corral: CorralStock) => {
    const { porcentaje } = getOcupacion(corral)
    
    if (porcentaje >= 100) {
      return <Badge className="bg-red-100 text-red-700"><TextoEditable id="estado-lleno-corral" original="Lleno" tag="span" /></Badge>
    } else if (porcentaje >= 80) {
      return <Badge className="bg-amber-100 text-amber-700"><TextoEditable id="estado-casi-lleno-corral" original="Casi lleno" tag="span" /></Badge>
    } else if (porcentaje > 0) {
      return <Badge className="bg-emerald-100 text-emerald-700"><TextoEditable id="estado-disponible-corral" original="Disponible" tag="span" /></Badge>
    } else {
      return <Badge className="bg-stone-100 text-stone-500"><TextoEditable id="estado-vacio-corral" original="Vacío" tag="span" /></Badge>
    }
  }

  const getBarraColor = (porcentaje: number) => {
    if (porcentaje >= 100) return 'bg-red-500'
    if (porcentaje >= 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const corralesFiltrados = corrales.filter(c => {
    if (filtroEstado === 'todos') return true
    if (filtroEstado === 'vacios') return c.stockBovinos === 0 && c.stockEquinos === 0
    if (filtroEstado === 'disponibles') return getOcupacion(c).porcentaje < 80
    if (filtroEstado === 'llenos') return getOcupacion(c).porcentaje >= 80
    return true
  })

  const totalAnimales = corrales.reduce((acc, c) => acc + c.stockBovinos + c.stockEquinos, 0)
  const totalCapacidad = corrales.reduce((acc, c) => acc + c.capacidad, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
                <Warehouse className="w-8 h-8 text-amber-500" />
                <TextoEditable id="titulo-stocks-corrales" original="Stocks de Corrales" tag="span" />
              </h1>
              <p className="text-stone-500 mt-1">
                <TextoEditable id="subtitulo-stocks-corrales" original="Control de animales en corrales" tag="span" />
              </p>
            </div>
            <Button onClick={fetchStock} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              <TextoEditable id="btn-actualizar-corrales" original="Actualizar" tag="span" />
            </Button>
          </div>
        </EditableBlock>

        {/* Resumen */}
        <EditableBlock bloqueId="resumen" label="Tarjetas de Resumen">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-total-animales-corral" original="Total Animales" tag="span" /></p>
                <p className="text-3xl font-bold text-stone-800">{totalAnimales}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-capacidad-total-corral" original="Capacidad Total" tag="span" /></p>
                <p className="text-3xl font-bold text-stone-800">{totalCapacidad}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-bovinos-corral" original="Bovinos" tag="span" /></p>
                <p className="text-3xl font-bold text-amber-600">
                  {corrales.reduce((acc, c) => acc + c.stockBovinos, 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-equinos-corral" original="Equinos" tag="span" /></p>
                <p className="text-3xl font-bold text-purple-600">
                  {corrales.reduce((acc, c) => acc + c.stockEquinos, 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </EditableBlock>

        {/* Filtro */}
        <EditableBlock bloqueId="filtro" label="Filtro de Estado">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-stone-600"><TextoEditable id="label-filtrar-estado-corral" original="Filtrar por estado:" tag="span" /></span>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos"><TextoEditable id="filtro-todos-corral" original="Todos" tag="span" /></SelectItem>
                    <SelectItem value="vacios"><TextoEditable id="filtro-vacios-corral" original="Vacíos" tag="span" /></SelectItem>
                    <SelectItem value="disponibles"><TextoEditable id="filtro-disponibles-corral" original="Disponibles" tag="span" /></SelectItem>
                    <SelectItem value="llenos"><TextoEditable id="filtro-llenos-corral" original="Llenos/Casi llenos" tag="span" /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </EditableBlock>

        {/* Lista de Corrales */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <EditableBlock bloqueId="corrales" label="Lista de Corrales">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {corralesFiltrados.map((corral) => {
                const { total, porcentaje } = getOcupacion(corral)
                
                return (
                  <Card key={corral.id} className={`border-0 shadow-md ${!corral.activo ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Warehouse className="w-5 h-5 text-amber-500" />
                          {corral.nombre}
                        </CardTitle>
                        {getEstadoBadge(corral)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Barra de progreso */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500"><TextoEditable id="label-ocupacion-corral" original="Ocupación" tag="span" /></span>
                          <span className="font-medium">{total}/{corral.capacidad}</span>
                        </div>
                        <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${getBarraColor(porcentaje)}`}
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-stone-400 text-right">{porcentaje.toFixed(0)}%</p>
                      </div>

                      {/* Desglose */}
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-amber-500 rounded-full" />
                          <span className="text-stone-600"><TextoEditable id="label-bovinos-cant" original="Bovinos:" tag="span" /> <strong>{corral.stockBovinos}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full" />
                          <span className="text-stone-600"><TextoEditable id="label-equinos-cant" original="Equinos:" tag="span" /> <strong>{corral.stockEquinos}</strong></span>
                        </div>
                      </div>

                      {/* Tropas en el corral */}
                      {corral.tropas && corral.tropas.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs text-stone-500 mb-2"><TextoEditable id="label-tropas-en-corral" original="Tropas en este corral:" tag="span" /></p>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {corral.tropas.map((tropa) => (
                              <div key={tropa.id} className="flex justify-between text-xs">
                                <span className="font-mono text-stone-700">{tropa.codigo}</span>
                                <span className="text-stone-500">
                                  {tropa.cantidadCabezas} <TextoEditable id="label-cab-tropa" original="cab." tag="span" /> - {tropa.productor?.nombre || 'S/P'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alertas */}
                      {porcentaje >= 100 && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                          <AlertTriangle className="w-4 h-4" />
                          <span><TextoEditable id="alerta-capacidad-maxima" original="Capacidad máxima alcanzada" tag="span" /></span>
                        </div>
                      )}
                      {porcentaje >= 80 && porcentaje < 100 && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                          <AlertTriangle className="w-4 h-4" />
                          <span><TextoEditable id="alerta-capacidad-cercana" original="Capacidad cercana al límite" tag="span" /></span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </EditableBlock>
        )}

        {/* Mensaje si no hay resultados */}
        {!loading && corralesFiltrados.length === 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-stone-400">
              <Warehouse className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p><TextoEditable id="msg-sin-corrales-filtro" original="No hay corrales que coincidan con el filtro" tag="span" /></p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default StocksCorralesModule
