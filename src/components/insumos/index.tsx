'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Loader2, Plus, Search, Trash, Package, AlertTriangle,
  Edit, TrendingDown, TrendingUp, Box
} from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
}

interface Insumo {
  id: string
  codigo: string
  nombre: string
  categoria: string
  subcategoria: string | null
  unidadMedida: string
  stockActual: number
  stockMinimo: number
  stockMaximo: number | null
  puntoReposicion: number | null
  proveedorNombre: string | null
  codigoProveedor: string | null
  precioUnitario: number | null
  moneda: string
  ubicacion: string | null
  activo: boolean
  observaciones: string | null
}

interface Props {
  operador: Operador
}

const CATEGORIAS = [
  { value: 'EMBALAJE', label: 'Embalaje' },
  { value: 'ETIQUETAS', label: 'Etiquetas' },
  { value: 'LIMPIEZA', label: 'Limpieza' },
  { value: 'EPP', label: 'EPP' },
  { value: 'REPUESTOS', label: 'Repuestos' },
  { value: 'OTRO', label: 'Otro' }
]

const UNIDADES = [
  { value: 'UN', label: 'Unidad (UN)' },
  { value: 'KG', label: 'Kilogramo (KG)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'M', label: 'Metro (M)' },
  { value: 'ROLLO', label: 'Rollo' },
  { value: 'CAJA', label: 'Caja' }
]

const MONEDAS = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' }
]

export function InsumosModule({ operador }: Props) {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState<{id: string; nombre: string; stockActual: number; stockMinimo: number}[]>([])
  
  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Insumo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    categoria: 'EMBALAJE',
    subcategoria: '',
    unidadMedida: 'UN',
    stockActual: '',
    stockMinimo: '',
    stockMaximo: '',
    puntoReposicion: '',
    proveedorNombre: '',
    codigoProveedor: '',
    precioUnitario: '',
    moneda: 'ARS',
    ubicacion: '',
    observaciones: ''
  })

  useEffect(() => {
    fetchInsumos()
  }, [])

  const fetchInsumos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insumos')
      const data = await res.json()
      
      if (data.success) {
        setInsumos(data.data)
        // Calcular alertas de stock bajo
        const alertasStock = data.data.filter((i: Insumo) => 
          i.activo && i.stockActual <= i.stockMinimo
        )
        setAlertas(alertasStock)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar insumos')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!formData.codigo || !formData.nombre) {
      toast.error('Complete código y nombre')
      return
    }
    if (!formData.categoria) {
      toast.error('Seleccione una categoría')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        subcategoria: formData.subcategoria.trim() || null,
        unidadMedida: formData.unidadMedida,
        stockActual: parseFloat(formData.stockActual) || 0,
        stockMinimo: parseFloat(formData.stockMinimo) || 0,
        stockMaximo: formData.stockMaximo ? parseFloat(formData.stockMaximo) : null,
        puntoReposicion: formData.puntoReposicion ? parseFloat(formData.puntoReposicion) : null,
        proveedorNombre: formData.proveedorNombre.trim() || null,
        codigoProveedor: formData.codigoProveedor.trim() || null,
        precioUnitario: formData.precioUnitario ? parseFloat(formData.precioUnitario) : null,
        moneda: formData.moneda,
        ubicacion: formData.ubicacion.trim() || null,
        observaciones: formData.observaciones.trim() || null,
      }

      if (editando) {
        const res = await fetch('/api/insumos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editando.id, ...payload })
        })
        const data = await res.json()
        if (data.success) {
          toast.success('Insumo actualizado')
          fetchInsumos()
        } else {
          toast.error(data.error || 'Error al actualizar')
        }
      } else {
        const res = await fetch('/api/insumos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (data.success) {
          toast.success('Insumo creado')
          fetchInsumos()
        } else {
          toast.error(data.error || 'Error al crear')
        }
      }
      
      setModalOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const handleEditar = (insumo: Insumo) => {
    setEditando(insumo)
    setFormData({
      codigo: insumo.codigo,
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      subcategoria: insumo.subcategoria || '',
      unidadMedida: insumo.unidadMedida,
      stockActual: insumo.stockActual.toString(),
      stockMinimo: insumo.stockMinimo.toString(),
      stockMaximo: insumo.stockMaximo?.toString() || '',
      puntoReposicion: insumo.puntoReposicion?.toString() || '',
      proveedorNombre: insumo.proveedorNombre || '',
      codigoProveedor: insumo.codigoProveedor || '',
      precioUnitario: insumo.precioUnitario?.toString() || '',
      moneda: insumo.moneda || 'ARS',
      ubicacion: insumo.ubicacion || '',
      observaciones: insumo.observaciones || ''
    })
    setModalOpen(true)
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este insumo?')) return
    
    try {
      const res = await fetch(`/api/insumos?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Insumo eliminado')
        fetchInsumos()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  const handleToggleActivo = async (insumo: Insumo) => {
    try {
      const res = await fetch('/api/insumos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: insumo.id,
          activo: !insumo.activo
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(insumo.activo ? 'Insumo desactivado' : 'Insumo activado')
        fetchInsumos()
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const resetForm = () => {
    setEditando(null)
    setFormData({
      codigo: '',
      nombre: '',
      categoria: 'EMBALAJE',
      subcategoria: '',
      unidadMedida: 'UN',
      stockActual: '',
      stockMinimo: '',
      stockMaximo: '',
      puntoReposicion: '',
      proveedorNombre: '',
      codigoProveedor: '',
      precioUnitario: '',
      moneda: 'ARS',
      ubicacion: '',
      observaciones: ''
    })
  }

  const insumosFiltrados = insumos.filter(i => {
    if (filtroCategoria !== 'todos' && i.categoria !== filtroCategoria) return false
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase()
      return (
        i.codigo.toLowerCase().includes(busquedaLower) ||
        i.nombre.toLowerCase().includes(busquedaLower) ||
        (i.proveedorNombre || '').toLowerCase().includes(busquedaLower)
      )
    }
    return true
  })

  const getCategoriaBadge = (categoria: string) => {
    const colores: Record<string, string> = {
      EMBALAJE: 'bg-blue-100 text-blue-700',
      ETIQUETAS: 'bg-purple-100 text-purple-700',
      LIMPIEZA: 'bg-cyan-100 text-cyan-700',
      EPP: 'bg-orange-100 text-orange-700',
      REPUESTOS: 'bg-amber-100 text-amber-700',
      OTRO: 'bg-gray-100 text-gray-700'
    }
    return colores[categoria] || 'bg-gray-100 text-gray-700'
  }

  const totalInsumos = insumos.filter(i => i.activo).length
  const insumosAlerta = alertas.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Box className="w-8 h-8 text-amber-500" />
              Insumos
            </h1>
            <p className="text-stone-500 mt-1">Gestión de insumos y materiales</p>
          </div>
          <Button 
            onClick={() => { resetForm(); setModalOpen(true); }}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Insumo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {CATEGORIAS.slice(0, 4).map(cat => {
            const count = insumos.filter(i => i.categoria === cat.value && i.activo).length
            return (
              <Card key={cat.value} className="border-0 shadow-md">
                <CardContent className="p-4">
                  <Badge className={getCategoriaBadge(cat.value)}>{cat.label}</Badge>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                  <p className="text-xs text-stone-500">insumos</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Alertas de stock bajo */}
        {alertas.length > 0 && (
          <Card className="border-0 shadow-md mb-6 border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Alertas de Stock Bajo ({alertas.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {alertas.map(a => (
                  <Badge key={a.id} variant="outline" className="border-red-300 text-red-600">
                    {a.nombre}: {a.stockActual} / {a.stockMinimo}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    placeholder="Buscar por código, nombre o proveedor..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las categorías</SelectItem>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Insumos ({insumosFiltrados.length})</span>
              <span className="text-sm font-normal text-stone-500">Total activos: {totalInsumos}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : insumosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <Box className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No hay insumos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-stone-500 uppercase">Unidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-stone-500 uppercase">Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-stone-500 uppercase">Mínimo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase">Precio</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {insumosFiltrados.map((insumo) => (
                      <tr key={insumo.id} className={`hover:bg-stone-50 ${!insumo.activo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono font-medium">{insumo.codigo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{insumo.nombre}</span>
                          {insumo.proveedorNombre && (
                            <p className="text-xs text-stone-400">{insumo.proveedorNombre}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={getCategoriaBadge(insumo.categoria)}>
                            {CATEGORIAS.find(c => c.value === insumo.categoria)?.label || insumo.categoria}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-stone-600">{insumo.unidadMedida}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${insumo.stockActual <= insumo.stockMinimo ? 'text-red-500' : 'text-stone-700'}`}>
                            {insumo.stockActual}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-stone-500">{insumo.stockMinimo}</td>
                        <td className="px-4 py-3 text-right text-stone-600">
                          {insumo.precioUnitario 
                            ? `${insumo.moneda} ${insumo.precioUnitario.toLocaleString('es-AR', {minimumFractionDigits: 2})}` 
                            : '-'
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditar(insumo)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleToggleActivo(insumo)}
                              title={insumo.activo ? 'Desactivar' : 'Activar'}
                            >
                              {insumo.activo 
                                ? <Package className="w-4 h-4 text-stone-400" />
                                : <Package className="w-4 h-4 text-green-500" />
                              }
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEliminar(insumo.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Nuevo/Editar */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
            <DialogHeader>
              <DialogTitle>
                {editando ? 'Editar Insumo' : 'Nuevo Insumo'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Fila 1: Código y Nombre */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={formData.codigo}
                    onChange={(e) => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                    placeholder="BOL001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    placeholder="Bolsa vacía 10kg"
                  />
                </div>
              </div>

              {/* Fila 2: Categoría y Unidad */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select 
                    value={formData.categoria} 
                    onValueChange={(v) => setFormData({...formData, categoria: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidad de Medida</Label>
                  <Select 
                    value={formData.unidadMedida} 
                    onValueChange={(v) => setFormData({...formData, unidadMedida: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(u => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 3: Subcategoría */}
              <div className="space-y-2">
                <Label>Subcategoría</Label>
                <Input
                  value={formData.subcategoria}
                  onChange={(e) => setFormData({...formData, subcategoria: e.target.value})}
                  placeholder="Ej: Bolsas de camara, Bolsas de consigna..."
                />
              </div>

              {/* Fila 4: Stock */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Stock Actual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.stockActual}
                    onChange={(e) => setFormData({...formData, stockActual: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({...formData, stockMinimo: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock Máximo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.stockMaximo}
                    onChange={(e) => setFormData({...formData, stockMaximo: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Punto Reposición</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.puntoReposicion}
                    onChange={(e) => setFormData({...formData, puntoReposicion: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              {/* Fila 5: Precio */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Precio Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.precioUnitario}
                    onChange={(e) => setFormData({...formData, precioUnitario: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select 
                    value={formData.moneda} 
                    onValueChange={(v) => setFormData({...formData, moneda: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 6: Proveedor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input
                    value={formData.proveedorNombre}
                    onChange={(e) => setFormData({...formData, proveedorNombre: e.target.value})}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código Proveedor</Label>
                  <Input
                    value={formData.codigoProveedor}
                    onChange={(e) => setFormData({...formData, codigoProveedor: e.target.value})}
                    placeholder="Código interno del proveedor"
                  />
                </div>
              </div>

              {/* Fila 7: Ubicación y Observaciones */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <Input
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                    placeholder="Depósito, estantería..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Input
                    value={formData.observaciones}
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                    placeholder="Notas adicionales"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGuardar}
                disabled={guardando}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {guardando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
