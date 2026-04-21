'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react'
import { Tropa, TropaCreate, TropaUpdate, Especie, TipoAnimalCantidad, TipoAnimal, ClienteBasico, CorralBasico } from '../types'

interface TropaFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TropaCreate | TropaUpdate) => Promise<boolean>
  tropa?: Tropa | null // Si existe, es edición
  clientes?: ClienteBasico[]
  corrales?: CorralBasico[]
  previewCodigo?: { numero: number; codigo: string } | null
  loading?: boolean
}

const TIPOS_BOVINO: { value: TipoAnimal; label: string }[] = [
  { value: 'TO', label: 'Toro (TO)' },
  { value: 'VA', label: 'Vaca (VA)' },
  { value: 'VQ', label: 'Vaquillona (VQ)' },
  { value: 'MEJ', label: 'Torito/Mej (MEJ)' },
  { value: 'NO', label: 'Novillo (NO)' },
  { value: 'NT', label: 'Novillito (NT)' },
]

const TIPOS_EQUINO: { value: TipoAnimal; label: string }[] = [
  { value: 'PADRILLO', label: 'Padrillo' },
  { value: 'POTRILLO', label: 'Potrillo' },
  { value: 'YEGUA', label: 'Yegua' },
  { value: 'CABALLO', label: 'Caballo' },
  { value: 'BURRO', label: 'Burro' },
  { value: 'MULA', label: 'Mula' },
]

export function TropaForm({
  open,
  onClose,
  onSubmit,
  tropa,
  clientes = [],
  corrales = [],
  previewCodigo,
  loading = false,
}: TropaFormProps) {
  const isEdit = !!tropa

  // Form state - initialize with memoized values
  const initialFormData = useMemo(() => {
    if (tropa) {
      return {
        productorId: tropa.productorId || '',
        usuarioFaenaId: tropa.usuarioFaenaId,
        especie: tropa.especie,
        dte: tropa.dte,
        guia: tropa.guia,
        cantidadCabezas: tropa.cantidadCabezas,
        corralId: tropa.corralId || '',
        tiposAnimales: tropa.tiposAnimales || [],
        observaciones: tropa.observaciones || '',
      }
    }
    return {
      productorId: '',
      usuarioFaenaId: '',
      especie: 'BOVINO' as Especie,
      dte: '',
      guia: '',
      cantidadCabezas: 0,
      corralId: '',
      tiposAnimales: [] as TipoAnimalCantidad[],
      observaciones: '',
    }
  }, [tropa])

  const [formData, setFormData] = useState(initialFormData)
  const [tiposAnimales, setTiposAnimales] = useState<TipoAnimalCantidad[]>(() => tropa?.tiposAnimales || [])
  const [nuevoTipo, setNuevoTipo] = useState<TipoAnimal | ''>('')
  const [nuevaCantidad, setNuevaCantidad] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Calculate total from tiposAnimales (derived value, no setState in effect)
  const totalTiposAnimales = useMemo(() => 
    tiposAnimales.reduce((sum, t) => sum + t.cantidad, 0),
    [tiposAnimales]
  )

  // Filtrar clientes
  const productores = clientes.filter(c => c.esProductor)
  const usuariosFaena = clientes.filter(c => c.esUsuarioFaena)

  // Tipos de animal según especie
  const tiposDisponibles = formData.especie === 'BOVINO' ? TIPOS_BOVINO : TIPOS_EQUINO
  const tiposRestantes = tiposDisponibles.filter(
    t => !tiposAnimales.some(ta => ta.tipo === t.value)
  )

  // Handlers
  const handleChange = (field: keyof TropaCreate, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const agregarTipo = () => {
    if (nuevoTipo && nuevaCantidad > 0) {
      setTiposAnimales(prev => [
        ...prev,
        { tipo: nuevoTipo as TipoAnimal, cantidad: nuevaCantidad }
      ])
      setNuevoTipo('')
      setNuevaCantidad(1)
    }
  }

  const eliminarTipo = (tipo: TipoAnimal) => {
    setTiposAnimales(prev => prev.filter(t => t.tipo !== tipo))
  }

  const validar = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!isEdit && !formData.usuarioFaenaId) {
      newErrors.usuarioFaenaId = 'El usuario de faena es requerido'
    }
    if (!formData.dte) {
      newErrors.dte = 'El DTE es requerido'
    }
    if (!formData.guia) {
      newErrors.guia = 'La guía es requerida'
    }
    if (formData.cantidadCabezas <= 0) {
      newErrors.cantidadCabezas = 'La cantidad debe ser mayor a 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validar()) return

    const data = {
      ...formData,
      tiposAnimales,
    }

    const success = await onSubmit(data)
    if (success) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose} key={tropa?.id || 'new'}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar Tropa ${tropa?.codigo}` : 'Nueva Tropa'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifique los datos de la tropa'
              : 'Complete los datos para registrar una nueva tropa'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Preview de código (solo nueva tropa) */}
          {!isEdit && previewCodigo && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Badge variant="outline" className="text-lg font-mono">
                {previewCodigo.codigo}
              </Badge>
              <span className="text-sm text-muted-foreground">
                (Código automático)
              </span>
            </div>
          )}

          {/* Especie */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="especie" className="text-right">
              Especie *
            </Label>
            <Select
              value={formData.especie}
              onValueChange={(v) => handleChange('especie', v as Especie)}
              disabled={isEdit}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOVINO">Bovino</SelectItem>
                <SelectItem value="EQUINO">Equino</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Productor */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="productor" className="text-right">
              Productor
            </Label>
            <Select
              value={formData.productorId || 'NINGUNO'}
              onValueChange={(v) => handleChange('productorId', v === 'NINGUNO' ? '' : v)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccionar productor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NINGUNO">Sin productor</SelectItem>
                {productores.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} {p.cuit ? `(${p.cuit})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Usuario Faena */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="usuarioFaena" className="text-right">
              Usuario Faena *
            </Label>
            <Select
              value={formData.usuarioFaenaId}
              onValueChange={(v) => handleChange('usuarioFaenaId', v)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccionar usuario de faena" />
              </SelectTrigger>
              <SelectContent>
                {usuariosFaena.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre} {u.cuit ? `(${u.cuit})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.usuarioFaenaId && (
              <span className="col-span-4 text-sm text-red-500 text-right">
                {errors.usuarioFaenaId}
              </span>
            )}
          </div>

          {/* DTE y Guía */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dte" className="text-right">
                DTE *
              </Label>
              <Input
                id="dte"
                value={formData.dte}
                onChange={(e) => handleChange('dte', e.target.value)}
                className="col-span-3"
                placeholder="N° DTE"
              />
            </div>
            {errors.dte && (
              <span className="text-sm text-red-500">{errors.dte}</span>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="guia" className="text-right">
                Guía *
              </Label>
              <Input
                id="guia"
                value={formData.guia}
                onChange={(e) => handleChange('guia', e.target.value)}
                className="col-span-3"
                placeholder="N° Guía"
              />
            </div>
            {errors.guia && (
              <span className="text-sm text-red-500">{errors.guia}</span>
            )}
          </div>

          {/* Corral */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="corral" className="text-right">
              Corral
            </Label>
            <Select
              value={formData.corralId || 'NINGUNO'}
              onValueChange={(v) => handleChange('corralId', v === 'NINGUNO' ? '' : v)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccionar corral" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NINGUNO">Sin asignar</SelectItem>
                {corrales.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} (Cap: {c.capacidad})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipos de animales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Tipos de Animales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agregar tipo */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select value={nuevoTipo} onValueChange={(v) => setNuevoTipo(v as TipoAnimal | '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de animal" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposRestantes.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={nuevaCantidad}
                  onChange={(e) => setNuevaCantidad(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={agregarTipo}
                  disabled={!nuevoTipo}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Tabla de tipos */}
              {tiposAnimales.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiposAnimales.map((ta) => (
                      <TableRow key={ta.tipo}>
                        <TableCell>
                          {tiposDisponibles.find(t => t.value === ta.tipo)?.label || ta.tipo}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {ta.cantidad}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => eliminarTipo(ta.tipo)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-center font-bold">
                        {totalTiposAnimales}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}

              {/* Cantidad manual */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cabezas" className="text-right">
                  Total Cabezas *
                </Label>
                <Input
                  id="cabezas"
                  type="number"
                  min={1}
                  value={totalTiposAnimales > 0 ? totalTiposAnimales : formData.cantidadCabezas}
                  onChange={(e) => handleChange('cantidadCabezas', parseInt(e.target.value) || 0)}
                  className="col-span-3"
                  disabled={totalTiposAnimales > 0}
                />
              </div>
              {errors.cantidadCabezas && (
                <span className="text-sm text-red-500">{errors.cantidadCabezas}</span>
              )}
            </CardContent>
          </Card>

          {/* Observaciones */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="observaciones" className="text-right pt-2">
              Observaciones
            </Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              className="col-span-3"
              rows={3}
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar Cambios' : 'Crear Tropa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
