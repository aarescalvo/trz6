'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  History, DollarSign, Plus, Search, Loader2, RefreshCw,
  Pencil, Trash2, TrendingUp, Calendar, User, Package,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// Interfaces for API data
interface TipoServicio {
  id: string
  codigo: string
  nombre: string
  unidad: string
  porcentajeIva: number
  activo: boolean
}

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
  esUsuarioFaena: boolean
}

interface PrecioServicio {
  id: string
  tipoServicioId: string
  clienteId: string
  precio: number
  fechaDesde: string
  fechaHasta?: string | null
  observaciones?: string | null
  createdBy?: string | null
  tipoServicio: TipoServicio
  cliente: {
    id: string
    nombre: string
    cuit?: string
    razonSocial?: string
  }
}

interface Props {
  operador?: { id: string; nombre: string; rol: string }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(amount)

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function HistorialPreciosModule({ operador }: Props) {
  // Data state
  const [precios, setPrecios] = useState<PrecioServicio[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filter state
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [filtroTipoServicio, setFiltroTipoServicio] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Tab state
  const [tabActivo, setTabActivo] = useState('vigentes')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedPrecio, setSelectedPrecio] = useState<PrecioServicio | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    tipoServicioId: '',
    clienteId: '',
    precio: '',
    fechaDesde: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    precio: '',
    fechaDesde: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  // ─── Data Fetching ───────────────────────────────────────────────

  const fetchTiposServicio = useCallback(async () => {
    try {
      const res = await fetch('/api/tipos-servicio?activo=true')
      const data = await res.json()
      if (data.success) setTiposServicio(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar tipos de servicio')
    }
  }, [])

  const fetchClientes = useCallback(async () => {
    try {
      const res = await fetch('/api/clientes?esUsuarioFaena=true')
      const data = await res.json()
      if (data.success) setClientes(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar clientes')
    }
  }, [])

  const fetchPrecios = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroCliente) params.set('clienteId', filtroCliente)
      if (filtroTipoServicio) params.set('tipoServicioId', filtroTipoServicio)

      const res = await fetch(`/api/precios-servicio?${params.toString()}`)
      const data = await res.json()
      if (data.success) setPrecios(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar precios')
    } finally {
      setLoading(false)
    }
  }, [filtroCliente, filtroTipoServicio])

  useEffect(() => {
    fetchTiposServicio()
    fetchClientes()
  }, [fetchTiposServicio, fetchClientes])

  useEffect(() => {
    fetchPrecios()
  }, [fetchPrecios])

  // ─── Computed Values ──────────────────────────────────────────────

  const preciosVigentes = precios.filter(p => !p.fechaHasta)
  const preciosHistoricos = precios.filter(p => p.fechaHasta)

  const preciosFiltrados = (tabActivo === 'vigentes' ? preciosVigentes : preciosHistoricos).filter(p => {
    const matchSearch = !searchTerm ||
      p.tipoServicio?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipoServicio?.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cliente?.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchSearch
  })

  const clientesConPrecio = new Set(preciosVigentes.map(p => p.clienteId)).size

  // ─── Price variation calculation ──────────────────────────────────

  const getPriceVariation = (precio: PrecioServicio) => {
    // Find the previous price for same client/service
    const historicosMismaCombinacion = preciosHistoricos
      .filter(p => p.clienteId === precio.clienteId && p.tipoServicioId === precio.tipoServicioId)
      .sort((a, b) => new Date(b.fechaDesde).getTime() - new Date(a.fechaDesde).getTime())

    const anterior = historicosMismaCombinacion[0]
    if (!anterior) return null

    const variacion = ((precio.precio - anterior.precio) / anterior.precio) * 100
    return {
      anterior: anterior.precio,
      variacion,
      esAumento: variacion > 0
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleNuevoPrecio = () => {
    setFormData({
      tipoServicioId: filtroTipoServicio || '',
      clienteId: filtroCliente || '',
      precio: '',
      fechaDesde: new Date().toISOString().split('T')[0],
      observaciones: ''
    })
    setDialogOpen(true)
  }

  const handleGuardarNuevo = async () => {
    if (!formData.tipoServicioId) {
      toast.error('Seleccione un tipo de servicio')
      return
    }
    if (!formData.clienteId) {
      toast.error('Seleccione un cliente')
      return
    }
    if (!formData.precio || isNaN(parseFloat(formData.precio)) || parseFloat(formData.precio) <= 0) {
      toast.error('Ingrese un precio válido mayor a 0')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/precios-servicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoServicioId: formData.tipoServicioId,
          clienteId: formData.clienteId,
          precio: parseFloat(formData.precio),
          fechaDesde: formData.fechaDesde || undefined,
          observaciones: formData.observaciones || undefined,
          createdBy: operador?.nombre || 'Sistema'
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Precio creado exitosamente')
        setDialogOpen(false)
        fetchPrecios()
      } else {
        toast.error(data.error || 'Error al crear precio')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear precio')
    } finally {
      setSaving(false)
    }
  }

  const handleEditarPrecio = (precio: PrecioServicio) => {
    setSelectedPrecio(precio)
    setEditFormData({
      precio: precio.precio.toString(),
      fechaDesde: new Date().toISOString().split('T')[0],
      observaciones: ''
    })
    setEditDialogOpen(true)
  }

  const handleGuardarEdicion = async () => {
    if (!selectedPrecio) return
    if (!editFormData.precio || isNaN(parseFloat(editFormData.precio)) || parseFloat(editFormData.precio) <= 0) {
      toast.error('Ingrese un precio válido mayor a 0')
      return
    }

    setSaving(true)
    try {
      // Create a new price record (the API automatically closes the previous one)
      const res = await fetch('/api/precios-servicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoServicioId: selectedPrecio.tipoServicioId,
          clienteId: selectedPrecio.clienteId,
          precio: parseFloat(editFormData.precio),
          fechaDesde: editFormData.fechaDesde || undefined,
          observaciones: editFormData.observaciones || `Actualización de precio (anterior: ${formatCurrency(selectedPrecio.precio)})`,
          createdBy: operador?.nombre || 'Sistema'
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Precio actualizado exitosamente')
        setEditDialogOpen(false)
        setSelectedPrecio(null)
        fetchPrecios()
      } else {
        toast.error(data.error || 'Error al actualizar precio')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al actualizar precio')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminarPrecio = (precio: PrecioServicio) => {
    setSelectedPrecio(precio)
    setDeleteDialogOpen(true)
  }

  const handleConfirmarEliminar = async () => {
    if (!selectedPrecio) return

    setSaving(true)
    try {
      const res = await fetch(`/api/precios-servicio?id=${selectedPrecio.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Precio eliminado exitosamente')
        setDeleteDialogOpen(false)
        setSelectedPrecio(null)
        fetchPrecios()
      } else {
        toast.error(data.error || 'Error al eliminar precio')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar precio')
    } finally {
      setSaving(false)
    }
  }

  const limpiarFiltros = () => {
    setFiltroCliente('')
    setFiltroTipoServicio('')
    setSearchTerm('')
  }

  // ─── Auto-fill precio when service+client change in new price dialog ───

  const handleFormTipoServicioChange = (value: string) => {
    setFormData(prev => ({ ...prev, tipoServicioId: value }))
    // Auto-fill current price if exists
    const precioExistente = preciosVigentes.find(
      p => p.tipoServicioId === value && p.clienteId === formData.clienteId
    )
    if (precioExistente) {
      setFormData(prev => ({ ...prev, precio: precioExistente.precio.toString() }))
    }
  }

  const handleFormClienteChange = (value: string) => {
    setFormData(prev => ({ ...prev, clienteId: value }))
    // Auto-fill current price if exists
    const precioExistente = preciosVigentes.find(
      p => p.tipoServicioId === formData.tipoServicioId && p.clienteId === value
    )
    if (precioExistente) {
      setFormData(prev => ({ ...prev, precio: precioExistente.precio.toString() }))
    }
  }

  // ─── Variation display helper ─────────────────────────────────────

  const renderVariation = (precio: PrecioServicio) => {
    const variation = getPriceVariation(precio)
    if (!variation) return <span className="text-stone-400 text-xs">Nuevo</span>

    const pct = variation.variacion.toFixed(1)
    const color = variation.esAumento ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'
    const icon = variation.esAumento
      ? <ArrowUpRight className="w-3 h-3" />
      : <ArrowDownRight className="w-3 h-3" />

    return (
      <Badge className={`${color} text-xs gap-0.5`}>
        {icon}
        {variation.esAumento ? '+' : ''}{pct}%
      </Badge>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-stone-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-stone-600" />
              <div>
                <p className="text-xs text-stone-500">Total Precios</p>
                <p className="text-xl font-bold text-stone-800">{precios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-stone-500">Vigentes</p>
                <p className="text-xl font-bold text-emerald-700">{preciosVigentes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-stone-500">Clientes c/Precio</p>
                <p className="text-xl font-bold text-amber-700">{clientesConPrecio}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-stone-500">Históricos</p>
                <p className="text-xl font-bold text-blue-700">{preciosHistoricos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Servicio o cliente..."
                  className="h-9 w-48 pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-9 w-52">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los clientes</SelectItem>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo Servicio</Label>
              <Select value={filtroTipoServicio} onValueChange={setFiltroTipoServicio}>
                <SelectTrigger className="h-9 w-52">
                  <SelectValue placeholder="Todos los servicios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los servicios</SelectItem>
                  {tiposServicio.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={limpiarFiltros}>
              Limpiar
            </Button>
            <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={fetchPrecios}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={handleNuevoPrecio}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo Precio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Vigentes / Historial */}
      <Tabs value={tabActivo} onValueChange={setTabActivo} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vigentes" className="gap-1">
            <DollarSign className="w-4 h-4" /> Precios Vigentes
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1">
            <History className="w-4 h-4" /> Historial de Precios
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Precios Vigentes ──────────────────────────── */}
        <TabsContent value="vigentes" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Precios Vigentes
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-700">
                  {preciosFiltrados.length} registro{preciosFiltrados.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : preciosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No hay precios vigentes</p>
                  <p className="text-sm mt-1">Agregue nuevos precios haciendo clic en &quot;Nuevo Precio&quot;</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50">
                        <TableHead className="font-semibold text-xs">Tipo Servicio</TableHead>
                        <TableHead className="font-semibold text-xs">Cliente</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Precio</TableHead>
                        <TableHead className="font-semibold text-xs">Unidad</TableHead>
                        <TableHead className="font-semibold text-xs">Vigente Desde</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Variación</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Estado</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preciosFiltrados.map(precio => (
                        <TableRow key={precio.id} className="text-xs hover:bg-stone-50/50">
                          <TableCell>
                            <div>
                              <p className="font-medium">{precio.tipoServicio?.nombre || '-'}</p>
                              <p className="text-stone-400 text-xs">{precio.tipoServicio?.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[140px]">{precio.cliente?.nombre || '-'}</p>
                              <p className="text-stone-400 text-xs">{precio.cliente?.cuit || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-stone-800">
                            {formatCurrency(precio.precio)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {precio.tipoServicio?.unidad || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formatDate(precio.fechaDesde)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {renderVariation(precio)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              Vigente
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar precio"
                                onClick={() => handleEditarPrecio(precio)}
                              >
                                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Eliminar precio"
                                onClick={() => handleEliminarPrecio(precio)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Historial de Precios ──────────────────────── */}
        <TabsContent value="historial" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500" />
                  Historial de Precios
                </CardTitle>
                <Badge className="bg-stone-100 text-stone-700">
                  {preciosFiltrados.length} registro{preciosFiltrados.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : preciosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No hay precios históricos</p>
                  <p className="text-sm mt-1">Los precios actualizados aparecerán aquí como registros históricos</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50">
                        <TableHead className="font-semibold text-xs">Tipo Servicio</TableHead>
                        <TableHead className="font-semibold text-xs">Cliente</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Precio</TableHead>
                        <TableHead className="font-semibold text-xs">Unidad</TableHead>
                        <TableHead className="font-semibold text-xs">Vigente Desde</TableHead>
                        <TableHead className="font-semibold text-xs">Vigente Hasta</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Estado</TableHead>
                        <TableHead className="font-semibold text-xs">Observaciones</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preciosFiltrados.map(precio => (
                        <TableRow key={precio.id} className="text-xs hover:bg-stone-50/50 opacity-80">
                          <TableCell>
                            <div>
                              <p className="font-medium">{precio.tipoServicio?.nombre || '-'}</p>
                              <p className="text-stone-400 text-xs">{precio.tipoServicio?.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[140px]">{precio.cliente?.nombre || '-'}</p>
                              <p className="text-stone-400 text-xs">{precio.cliente?.cuit || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-stone-600">
                            {formatCurrency(precio.precio)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {precio.tipoServicio?.unidad || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formatDate(precio.fechaDesde)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formatDate(precio.fechaHasta!)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-stone-100 text-stone-500 text-xs">
                              Histórico
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="truncate max-w-[150px] text-stone-500 text-xs">
                              {precio.observaciones || '-'}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Eliminar precio"
                              onClick={() => handleEliminarPrecio(precio)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Nuevo Precio ────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Nuevo Precio de Servicio
            </DialogTitle>
            <DialogDescription>
              Configure el precio para un servicio y cliente. Si ya existe un precio vigente para la misma combinación, se cerrará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Servicio *</Label>
                <Select value={formData.tipoServicioId} onValueChange={handleFormTipoServicioChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposServicio.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre} <span className="text-stone-400">({t.unidad})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cliente *</Label>
                <Select value={formData.clienteId} onValueChange={handleFormClienteChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Show existing price warning */}
            {formData.tipoServicioId && formData.clienteId && preciosVigentes.find(
              p => p.tipoServicioId === formData.tipoServicioId && p.clienteId === formData.clienteId
            ) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Precio vigente existente</p>
                  <p className="text-amber-700">
                    Precio actual: {formatCurrency(
                      preciosVigentes.find(p => p.tipoServicioId === formData.tipoServicioId && p.clienteId === formData.clienteId)?.precio || 0
                    )} — Se cerrará automáticamente al crear el nuevo precio.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Precio *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio}
                    onChange={e => setFormData(prev => ({ ...prev, precio: e.target.value }))}
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fecha Vigencia</Label>
                <Input
                  type="date"
                  value={formData.fechaDesde}
                  onChange={e => setFormData(prev => ({ ...prev, fechaDesde: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Observaciones</Label>
              <Textarea
                value={formData.observaciones}
                onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Ej: Ajuste trimestral, aumento de costo, etc."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleGuardarNuevo}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" /> Crear Precio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Editar Precio (creates new record) ───────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              Actualizar Precio
            </DialogTitle>
            <DialogDescription>
              Se creará un nuevo registro de precio y se cerrará el anterior automáticamente.
            </DialogDescription>
          </DialogHeader>
          {selectedPrecio && (
            <div className="space-y-4">
              {/* Current price info */}
              <div className="p-3 bg-stone-50 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Servicio:</span>
                  <span className="font-medium">{selectedPrecio.tipoServicio?.nombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Cliente:</span>
                  <span className="font-medium">{selectedPrecio.cliente?.nombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Precio Actual:</span>
                  <span className="font-bold text-stone-800">{formatCurrency(selectedPrecio.precio)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Vigente Desde:</span>
                  <span>{formatDate(selectedPrecio.fechaDesde)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nuevo Precio *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.precio}
                      onChange={e => setEditFormData(prev => ({ ...prev, precio: e.target.value }))}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nueva Fecha Vigencia</Label>
                  <Input
                    type="date"
                    value={editFormData.fechaDesde}
                    onChange={e => setEditFormData(prev => ({ ...prev, fechaDesde: e.target.value }))}
                  />
                </div>
              </div>

              {/* Variation preview */}
              {editFormData.precio && !isNaN(parseFloat(editFormData.precio)) && selectedPrecio.precio > 0 && (
                <div className="p-3 bg-stone-50 rounded-lg">
                  <p className="text-sm text-stone-600">
                    Variación:{' '}
                    {(() => {
                      const variacion = ((parseFloat(editFormData.precio) - selectedPrecio.precio) / selectedPrecio.precio * 100).toFixed(1)
                      const esAumento = parseFloat(variacion) > 0
                      return (
                        <span className={`font-bold ${esAumento ? 'text-red-600' : 'text-emerald-600'}`}>
                          {esAumento ? '+' : ''}{variacion}%
                        </span>
                      )
                    })()}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Observaciones</Label>
                <Textarea
                  value={editFormData.observaciones}
                  onChange={e => setEditFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Motivo de la actualización..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedPrecio(null) }}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleGuardarEdicion}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Actualizando...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" /> Actualizar Precio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Confirmar Eliminación ────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Eliminar Precio
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar este precio? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {selectedPrecio && (
            <div className="p-3 bg-red-50 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Servicio:</span>
                <span className="font-medium">{selectedPrecio.tipoServicio?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Cliente:</span>
                <span className="font-medium">{selectedPrecio.cliente?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Precio:</span>
                <span className="font-bold">{formatCurrency(selectedPrecio.precio)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Vigente Desde:</span>
                <span>{formatDate(selectedPrecio.fechaDesde)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedPrecio(null) }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmarEliminar} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
