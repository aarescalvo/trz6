'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, DollarSign, CheckCircle, XCircle, Eye, 
  Plus, Search, Loader2, Printer, RefreshCw, CreditCard,
  Building2, Receipt, Calendar, User, Package, Beef,
  ArrowDownToLine, FileSpreadsheet, History, Pencil,
  ArrowLeftRight, Shield, AlertTriangle, Settings, Save, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { HistoricoPrecios } from '@/modules/facturacion/components/HistoricoPrecios'
import { LiquidacionForm } from '@/modules/facturacion/components/LiquidacionForm'
import { ComprobantesTable } from '@/modules/facturacion/components/ComprobantesTable'
import { CtaCteCliente } from '@/modules/facturacion/components/CtaCteCliente'

interface Operador { id: string; nombre: string; rol: string }

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
  condicionIva?: string
  direccion?: string
  esUsuarioFaena: boolean
}

interface TipoServicio {
  id: string
  codigo: string
  nombre: string
  unidad: string
  porcentajeIva: number
  activo: boolean
}

interface DetalleFactura {
  id: string
  tipoProducto: string
  descripcion: string
  cantidad: number
  unidad: string
  precioUnitario: number
  subtotal: number
  tipoServicio?: TipoServicio
}

interface PagoFactura {
  id: string
  fecha: string
  monto: number
  metodoPago: string
  referencia?: string
}

interface FacturaTributo {
  id: string
  facturaId: string
  tributoId: number
  descripcion: string
  baseImponible: number
  alicuota: number
  importe: number
  createdAt: string
}

interface NotaCreditoDebito {
  id: string
  tipo: 'CREDITO' | 'DEBITO'
  tipoComprobante: number
  facturaId: string
  factura?: { id: string; numero: string; clienteNombre?: string }
  numero: number
  puntoVenta: number
  fecha: string
  motivo: string
  descripcion?: string
  cae?: string
  caeVencimiento?: string
  subtotal: number
  iva: number
  total: number
  operadorId?: string
  createdAt: string
}

interface ConfiguracionAFIP {
  id: string
  certificadoPath?: string
  clavePrivadaPath?: string
  entorno: string
  cuit?: string
  razonSocial?: string
  inicioActividades?: string
  puntosVenta?: string
  wsaaUrl?: string
  wsfeUrl?: string
  tokenWsfe?: string
  signWsfe?: string
  tokenExpiracion?: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

interface Factura {
  id: string
  numero: string
  numeroInterno: number
  tipoComprobante: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'REMITO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
  clienteId: string
  cliente: Cliente
  clienteNombre?: string
  clienteCuit?: string
  clienteCondicionIva?: string
  clienteDireccion?: string
  fecha: string
  subtotal: number
  iva: number
  porcentajeIva: number
  total: number
  importeTributos: number
  saldo: number
  estado: 'PENDIENTE' | 'EMITIDA' | 'PAGADA' | 'ANULADA'
  condicionVenta?: string
  remito?: string
  observaciones?: string
  cae?: string
  caeVencimiento?: string
  puntoVenta: number
  numeroAfip?: number
  detalles: DetalleFactura[]
  pagos: PagoFactura[]
  tributos?: FacturaTributo[]
  notas?: NotaCreditoDebito[]
  operador?: { id: string; nombre: string }
}

interface Props { operador: Operador }

const TIPOS_COMPROBANTE = [
  { value: 'FACTURA_A', label: 'Factura A', descr: 'Para Responsables Inscriptos' },
  { value: 'FACTURA_B', label: 'Factura B', descr: 'Para Consumidor Final/Monotributo' },
  { value: 'FACTURA_C', label: 'Factura C', descr: 'Para Exentos/No Categorizados' },
]

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta Débito' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta Crédito' },
]

export function FacturacionModule({ operador }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<Factura | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'EMITIDA' | 'PAGADA' | 'ANULADA'>('TODOS')
  const [searchTerm, setSearchTerm] = useState('')
  const [tabActivo, setTabActivo] = useState('servicioFaena')

  // Servicio Faena state
  const [tropasFaena, setTropasFaena] = useState<any[]>([])
  const [resumenFaena, setResumenFaena] = useState<any>(null)
  const [porClienteFaena, setPorClienteFaena] = useState<any[]>([])
  const [loadingFaena, setLoadingFaena] = useState(false)
  const [filtroFaenaDesde, setFiltroFaenaDesde] = useState('')
  const [filtroFaenaHasta, setFiltroFaenaHasta] = useState('')
  const [filtroFaenaCliente, setFiltroFaenaCliente] = useState('')
  const [filtroFaenaEstado, setFiltroFaenaEstado] = useState('TODOS')
  const [tropasSeleccionadas, setTropasSeleccionadas] = useState<Set<string>>(new Set())
  const [editTropaId, setEditTropaId] = useState<string | null>(null)
  const [editTropaData, setEditTropaData] = useState<any>({})
  const [precioEditOpen, setPrecioEditOpen] = useState(false)
  const [precioEditData, setPrecioEditData] = useState<any>(null)

  // Liquidaciones state
  const [liquidaciones, setLiquidaciones] = useState<any[]>([])
  const [tropasPendientes, setTropasPendientes] = useState<any[]>([])
  const [loadingLiquidaciones, setLoadingLiquidaciones] = useState(false)
  const [selectedLiquidacionId, setSelectedLiquidacionId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    clienteId: '',
    fecha: new Date().toISOString().split('T')[0],
    condicionVenta: 'CUENTA_CORRIENTE',
    remito: '',
    observaciones: '',
    detalles: [{ tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
  })

  const [pagoData, setPagoData] = useState({
    monto: 0,
    metodoPago: 'EFECTIVO',
    referencia: '',
    banco: '',
    observaciones: ''
  })

  // Notas C/D state
  const [notas, setNotas] = useState<NotaCreditoDebito[]>([])
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [filtroNotasTipo, setFiltroNotasTipo] = useState<'TODOS' | 'CREDITO' | 'DEBITO'>('TODOS')
  const [notaDialogOpen, setNotaDialogOpen] = useState(false)
  const [notaFormData, setNotaFormData] = useState({
    facturaId: '',
    tipo: 'CREDITO' as 'CREDITO' | 'DEBITO',
    motivo: 'DEVOLUCION',
    descripcion: '',
    subtotal: 0,
    iva: 0,
    total: 0,
  })

  // AFIP state
  const [afipConfig, setAfipConfig] = useState<ConfiguracionAFIP | null>(null)
  const [loadingAfip, setLoadingAfip] = useState(false)
  const [afipSaving, setAfipSaving] = useState(false)
  const [afipFormData, setAfipFormData] = useState({
    id: '',
    entorno: 'testing',
    cuit: '',
    razonSocial: '',
    inicioActividades: '',
    certificadoPath: '',
    clavePrivadaPath: '',
    wsaaUrl: '',
    wsfeUrl: '',
    puntosVenta: '',
  })

  // Tributo state
  const [tributoDialogOpen, setTributoDialogOpen] = useState(false)
  const [tributoFormData, setTributoFormData] = useState({
    facturaId: '',
    tributoId: 1,
    descripcion: '',
    baseImponible: 0,
    alicuota: 0,
    importe: 0,
  })
  const [tributosFactura, setTributosFactura] = useState<FacturaTributo[]>([])

  useEffect(() => {
    fetchAll()
  }, [])

  // Cargar servicio faena cuando se cambia al tab
  useEffect(() => {
    if (tabActivo === 'servicioFaena') {
      fetchServicioFaena()
    } else if (tabActivo === 'notas') {
      fetchNotas()
    } else if (tabActivo === 'afip') {
      fetchAfipConfig()
    }
  }, [tabActivo, filtroFaenaDesde, filtroFaenaHasta, filtroFaenaCliente, filtroFaenaEstado])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [facturasRes, clientesRes, tiposRes] = await Promise.all([
        fetch('/api/facturacion'),
        fetch('/api/clientes'),
        fetch('/api/tipos-servicio?activo=true&seFactura=true')
      ])

      const [facturasData, clientesData, tiposData] = await Promise.all([
        facturasRes.json(),
        clientesRes.json(),
        tiposRes.json()
      ])

      if (facturasData.success) setFacturas(facturasData.data)
      if (clientesData.success) setClientes(clientesData.data.filter((c: Cliente) => c.esUsuarioFaena))
      if (tiposData.success) setTiposServicio(tiposData.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const fetchServicioFaena = async () => {
    setLoadingFaena(true)
    try {
      const params = new URLSearchParams()
      if (filtroFaenaDesde) params.set('desde', filtroFaenaDesde)
      if (filtroFaenaHasta) params.set('hasta', filtroFaenaHasta)
      if (filtroFaenaCliente && filtroFaenaCliente !== 'TODOS') params.set('usuarioId', filtroFaenaCliente)
      if (filtroFaenaEstado !== 'TODOS') params.set('estadoPago', filtroFaenaEstado)

      const res = await fetch(`/api/facturacion/servicio-faena?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setTropasFaena(data.data.tropas)
        setResumenFaena(data.data.resumen)
        setPorClienteFaena(data.data.porCliente)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar servicio faena')
    } finally {
      setLoadingFaena(false)
    }
  }

  const fetchNotas = async () => {
    setLoadingNotas(true)
    try {
      const params = new URLSearchParams()
      if (filtroNotasTipo !== 'TODOS') params.set('tipo', filtroNotasTipo)
      const res = await fetch(`/api/facturacion/notas?${params.toString()}`)
      const data = await res.json()
      if (data.success) setNotas(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar notas')
    } finally {
      setLoadingNotas(false)
    }
  }

  const fetchAfipConfig = async () => {
    setLoadingAfip(true)
    try {
      const res = await fetch('/api/facturacion/afip')
      const data = await res.json()
      if (data.success && data.data) {
        setAfipConfig(data.data)
        setAfipFormData({
          id: data.data.id,
          entorno: data.data.entorno || 'testing',
          cuit: data.data.cuit || '',
          razonSocial: data.data.razonSocial || '',
          inicioActividades: data.data.inicioActividades ? new Date(data.data.inicioActividades).toISOString().split('T')[0] : '',
          certificadoPath: data.data.certificadoPath || '',
          clavePrivadaPath: data.data.clavePrivadaPath || '',
          wsaaUrl: data.data.wsaaUrl || '',
          wsfeUrl: data.data.wsfeUrl || '',
          puntosVenta: data.data.puntosVenta || '',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar configuración AFIP')
    } finally {
      setLoadingAfip(false)
    }
  }

  const fetchLiquidaciones = async () => {
    setLoadingLiquidaciones(true)
    try {
      const res = await fetch('/api/liquidaciones')
      const data = await res.json()
      if (data.success) setLiquidaciones(data.data)
    } catch (error) { console.error(error) } finally { setLoadingLiquidaciones(false) }
  }

  const fetchPendientes = async () => {
    try {
      const res = await fetch('/api/liquidaciones?modo=pendientes')
      const data = await res.json()
      if (data.success) setTropasPendientes(data.data)
    } catch (error) { console.error(error) }
  }

  const handleCrearLiquidacion = async (tropaId: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/liquidaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tropaId, operadorId: operador.id })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Liquidación creada exitosamente')
        fetchLiquidaciones()
        fetchPendientes()
      } else {
        toast.error(data.error || 'Error al crear liquidación')
      }
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const fetchTributosFactura = async (facturaId: string) => {
    try {
      const res = await fetch(`/api/facturacion/tributos?facturaId=${facturaId}`)
      const data = await res.json()
      if (data.success) setTributosFactura(data.data)
    } catch {
      toast.error('Error al cargar tributos')
    }
  }

  const handleFacturarSeleccionadas = async () => {
    if (tropasSeleccionadas.size === 0) {
      toast.error('Seleccione al menos una tropa para facturar')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/servicio-faena/facturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tropaIds: Array.from(tropasSeleccionadas),
          operadorId: operador.id,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setTropasSeleccionadas(new Set())
        fetchServicioFaena()
        fetchAll()
      } else {
        toast.error(data.error || 'Error al facturar')
      }
    } catch {
      toast.error('Error al generar facturas')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTropa = (tropaId: string) => {
    setTropasSeleccionadas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tropaId)) newSet.delete(tropaId)
      else newSet.add(tropaId)
      return newSet
    })
  }

  const handleToggleAllTropas = () => {
    if (tropasSeleccionadas.size === tropasFaena.length) {
      setTropasSeleccionadas(new Set())
    } else {
      setTropasSeleccionadas(new Set(tropasFaena.map(t => t.id)))
    }
  }

  const handleUpdateTropaBilling = async (tropaId: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/servicio-faena', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tropaId, ...editTropaData })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Datos actualizados')
        setEditTropaId(null)
        setEditTropaData({})
        fetchServicioFaena()
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleExportExcelFaena = () => {
    if (!tropasFaena.length) return
    const headers = ['N° Tropa', 'Usuario', 'Cant. Animales', 'Kg Pie', 'Fecha Faena', 'Kg Gancho', 'Rinde %', '$/kg Servicio', 'Total Serv + IVA', 'Total Factura', 'N° Factura', 'Fecha Factura', 'Fecha Pago', 'Monto Depositado', 'Estado Pago']
    const rows = tropasFaena.map(t => [
      t.numero, t.usuarioFaena?.nombre || '', t.cantidadCabezas, t.pesoTotalIndividual || '',
      t.fechaFaena ? new Date(t.fechaFaena).toLocaleDateString('es-AR') : '',
      t.kgGancho || '', t.rinde ? t.rinde.toFixed(2) : '',
      t.precioServicioKg || '', t.montoServicioFaena || '', t.montoFactura || '',
      t.numeroFactura || '',
      t.fechaFactura ? new Date(t.fechaFactura).toLocaleDateString('es-AR') : '',
      t.fechaPago ? new Date(t.fechaPago).toLocaleDateString('es-AR') : '',
      t.montoDepositado || '', t.estadoPago || ''
    ])
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `servicio_faena_bovino_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo descargado')
  }

  const handleNuevaFactura = () => {
    setFormData({
      clienteId: '',
      fecha: new Date().toISOString().split('T')[0],
      condicionVenta: 'CUENTA_CORRIENTE',
      remito: '',
      observaciones: '',
      detalles: [{ tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
    })
    setDialogOpen(true)
  }

  const handleAgregarDetalle = () => {
    setFormData({
      ...formData,
      detalles: [...formData.detalles, { tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
    })
  }

  const handleEliminarDetalle = (index: number) => {
    if (formData.detalles.length === 1) return
    const nuevosDetalles = formData.detalles.filter((_, i) => i !== index)
    setFormData({ ...formData, detalles: nuevosDetalles })
  }

  const handleDetalleChange = (index: number, field: string, value: any) => {
    const nuevosDetalles = [...formData.detalles]
    nuevosDetalles[index] = { ...nuevosDetalles[index], [field]: value }
    
    // Si cambia el tipo de servicio, actualizar descripción y unidad
    if (field === 'tipoServicioId') {
      const tipo = tiposServicio.find(t => t.id === value)
      if (tipo) {
        nuevosDetalles[index].descripcion = tipo.nombre
        nuevosDetalles[index].unidad = tipo.unidad
      }
    }
    
    setFormData({ ...formData, detalles: nuevosDetalles })
  }

  const handleGuardar = async () => {
    if (!formData.clienteId) {
      toast.error('Debe seleccionar un cliente')
      return
    }

    if (formData.detalles.some(d => !d.descripcion || d.cantidad <= 0)) {
      toast.error('Complete todos los detalles correctamente')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/facturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${data.data.numero} creada exitosamente`)
        setDialogOpen(false)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al crear factura')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const handleMarcarPagada = async (factura: Factura) => {
    try {
      const res = await fetch('/api/facturacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: factura.id, estado: 'PAGADA' })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${factura.numero} marcada como pagada`)
        fetchAll()
      }
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const handleRegistrarPago = async () => {
    if (!facturaSeleccionada || pagoData.monto <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/cuenta-corriente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: facturaSeleccionada.id,
          ...pagoData,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Pago registrado exitosamente')
        setPagoOpen(false)
        setPagoData({ monto: 0, metodoPago: 'EFECTIVO', referencia: '', banco: '', observaciones: '' })
        fetchAll()
      } else {
        toast.error(data.error || 'Error al registrar pago')
      }
    } catch {
      toast.error('Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async () => {
    if (!facturaSeleccionada) return
    setSaving(true)
    try {
      const res = await fetch(`/api/facturacion?id=${facturaSeleccionada.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${facturaSeleccionada.numero} anulada`)
        setDeleteOpen(false)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al anular')
      }
    } catch {
      toast.error('Error al anular factura')
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarNota = async () => {
    if (!notaFormData.facturaId || !notaFormData.motivo) {
      toast.error('Seleccione una factura y un motivo')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...notaFormData, operadorId: operador.id })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Nota creada exitosamente')
        setNotaDialogOpen(false)
        setNotaFormData({ facturaId: '', tipo: 'CREDITO', motivo: 'DEVOLUCION', descripcion: '', subtotal: 0, iva: 0, total: 0 })
        fetchNotas()
        fetchAll()
      } else {
        toast.error(data.error || 'Error al crear nota')
      }
    } catch {
      toast.error('Error al crear nota')
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarAfip = async () => {
    if (!afipFormData.id) {
      toast.error('No hay configuración AFIP para actualizar')
      return
    }
    setAfipSaving(true)
    try {
      const res = await fetch('/api/facturacion/afip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...afipFormData,
          inicioActividades: afipFormData.inicioActividades ? new Date(afipFormData.inicioActividades).toISOString() : null,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Configuración AFIP guardada')
        fetchAfipConfig()
      } else {
        toast.error(data.error || 'Error al guardar configuración')
      }
    } catch {
      toast.error('Error al guardar configuración AFIP')
    } finally {
      setAfipSaving(false)
    }
  }

  const handleSolicitarCAE = () => {
    toast.info('Función de solicitud CAE será implementada con certificados AFIP')
  }

  const handleAddTributo = async () => {
    if (!tributoFormData.facturaId || !tributoFormData.descripcion) {
      toast.error('Seleccione una factura e ingrese descripción')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/tributos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tributoFormData)
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Tributo agregado exitosamente')
        setTributoDialogOpen(false)
        setTributoFormData({ facturaId: '', tributoId: 1, descripcion: '', baseImponible: 0, alicuota: 0, importe: 0 })
        fetchTributosFactura(tributoFormData.facturaId)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al agregar tributo')
      }
    } catch {
      toast.error('Error al agregar tributo')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTributo = async (tributoId: string, facturaId: string) => {
    try {
      const res = await fetch(`/api/facturacion/tributos?id=${tributoId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Tributo eliminado')
        fetchTributosFactura(facturaId)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al eliminar tributo')
      }
    } catch {
      toast.error('Error al eliminar tributo')
    }
  }

  const handleImprimir = (factura: Factura) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const tipoLabel = TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label || 'Factura'
      printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Comprobante ${factura.numero}</title>
<style>
body{font-family:Arial;padding:40px;max-width:800px;margin:0 auto}
.header{text-align:center;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:30px}
.title{font-size:24px;font-weight:bold}
.row{display:flex;margin-bottom:8px}
.label{font-weight:bold;width:200px;color:#555}
.value{flex:1}
.total{font-size:20px;font-weight:bold;margin-top:20px;text-align:right}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f5f5f5}
</style></head>
<body>
<div class="header">
<div class="title">${tipoLabel}</div>
<div>N° ${factura.numero}</div>
</div>
<div class="row"><span class="label">Fecha:</span><span class="value">${new Date(factura.fecha).toLocaleDateString('es-AR')}</span></div>
<div class="row"><span class="label">Cliente:</span><span class="value">${factura.clienteNombre || factura.cliente?.nombre}</span></div>
<div class="row"><span class="label">CUIT:</span><span class="value">${factura.clienteCuit || '-'}</span></div>
<div class="row"><span class="label">Condición IVA:</span><span class="value">${factura.clienteCondicionIva || '-'}</span></div>
<div class="row"><span class="label">Dirección:</span><span class="value">${factura.clienteDireccion || '-'}</span></div>
<table>
<thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
<tbody>
${factura.detalles?.map(d => `<tr>
<td>${d.descripcion}</td>
<td>${d.cantidad}</td>
<td>${d.unidad}</td>
<td>$${d.precioUnitario.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
<td>$${d.subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
</tr>`).join('') || ''}
</tbody>
</table>
<div class="total">
<p>Subtotal: $${factura.subtotal?.toLocaleString('es-AR', {minimumFractionDigits:2}) || '0.00'}</p>
${factura.iva > 0 ? `<p>IVA (${factura.porcentajeIva}%): $${factura.iva?.toLocaleString('es-AR', {minimumFractionDigits:2})}</p>` : ''}
<p style="font-size:24px">Total: $${factura.total?.toLocaleString('es-AR', {minimumFractionDigits:2}) || '0.00'}</p>
</div>
</body></html>`)
      printWindow.document.close()
      printWindow.print()
    }
    toast.success('Enviando a impresión...')
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
      case 'EMITIDA': return <Badge className="bg-blue-100 text-blue-700">Emitida</Badge>
      case 'PAGADA': return <Badge className="bg-emerald-100 text-emerald-700">Pagada</Badge>
      case 'ANULADA': return <Badge className="bg-red-100 text-red-700">Anulada</Badge>
      default: return <Badge>{estado}</Badge>
    }
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(amount)

  const facturasFiltradas = facturas.filter(f => {
    const matchEstado = filtroEstado === 'TODOS' || f.estado === filtroEstado
    const matchSearch = !searchTerm || 
      f.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchEstado && matchSearch
  })

  const totalFacturas = facturas.length
  const pendientes = facturas.filter(f => f.estado === 'PENDIENTE').length
  const pagadas = facturas.filter(f => f.estado === 'PAGADA').length
  const montoTotal = facturas.filter(f => f.estado !== 'ANULADA').reduce((sum, f) => sum + (f.total || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Receipt className="w-8 h-8 text-amber-500" />
              Facturación
            </h1>
            <p className="text-stone-500 mt-1">Gestión de facturas y cuenta corriente</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAll} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
            </Button>
            <Button onClick={handleNuevaFactura} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" /> Nueva Factura
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tabActivo} onValueChange={setTabActivo} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 max-w-2xl">
            <TabsTrigger value="servicioFaena" className="gap-1">
              <Beef className="w-4 h-4" />Servicio Faena
            </TabsTrigger>
            <TabsTrigger value="facturas">Facturas</TabsTrigger>
            <TabsTrigger value="cuentas">Cta. Cte.</TabsTrigger>
            <TabsTrigger value="notas" className="gap-1">
              <ArrowLeftRight className="w-4 h-4" />Notas C/D
            </TabsTrigger>
            <TabsTrigger value="afip" className="gap-1">
              <Shield className="w-4 h-4" />AFIP
            </TabsTrigger>
            <TabsTrigger value="historialPrecios" className="gap-1">
              <History className="w-4 h-4" />Hist. Precios
            </TabsTrigger>
          </TabsList>

          {/* TAB SERVICIO FAENA BOVINO */}
          <TabsContent value="servicioFaena" className="space-y-4">
            {/* Resumen KPIs */}
            {resumenFaena && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="border-0 shadow-sm bg-amber-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2"><Beef className="w-5 h-5 text-amber-600" /><div><p className="text-xs text-stone-500">Tropas</p><p className="text-xl font-bold text-amber-700">{resumenFaena.totalTropas}</p></div></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-blue-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /><div><p className="text-xs text-stone-500">Kg Gancho</p><p className="text-lg font-bold text-blue-700">{resumenFaena.totalKgGancho?.toLocaleString('es-AR', {maximumFractionDigits:0})}</p></div></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-emerald-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /><div><p className="text-xs text-stone-500">Total Facturado</p><p className="text-lg font-bold text-emerald-700">{formatCurrency(resumenFaena.totalFacturado)}</p></div></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-red-600" /><div><p className="text-xs text-stone-500">Pend. Facturar</p><p className="text-xl font-bold text-red-700">{resumenFaena.pendienteFacturar}</p></div></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-orange-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-orange-600" /><div><p className="text-xs text-stone-500">Pend. Cobrar</p><p className="text-xl font-bold text-orange-700">{resumenFaena.pendienteCobrar}</p></div></div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Filtros */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={filtroFaenaDesde} onChange={e => setFiltroFaenaDesde(e.target.value)} className="h-9 w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={filtroFaenaHasta} onChange={e => setFiltroFaenaHasta(e.target.value)} className="h-9 w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente</Label>
                    <Select value={filtroFaenaCliente} onValueChange={setFiltroFaenaCliente}>
                      <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado Pago</Label>
                    <Select value={filtroFaenaEstado} onValueChange={setFiltroFaenaEstado}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                        <SelectItem value="PAGADO">Pagado</SelectItem>
                        <SelectItem value="PAGO PARCIAL">Pago Parcial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => { setFiltroFaenaDesde(''); setFiltroFaenaHasta(''); setFiltroFaenaCliente(''); setFiltroFaenaEstado('TODOS') }}>Limpiar</Button>
                  <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={fetchServicioFaena}><RefreshCw className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Acciones masivas */}
            {tropasSeleccionadas.size > 0 && (
              <Card className="border-0 shadow-md bg-amber-50">
                <CardContent className="p-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-800">{tropasSeleccionadas.size} tropa(s) seleccionada(s)</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600" onClick={handleFacturarSeleccionadas} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                      Facturar Seleccionadas
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTropasSeleccionadas(new Set())}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grilla tipo Planilla Servicio Faena */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Beef className="w-5 h-5 text-amber-500" />
                    Planilla Servicio Faena Bovino
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={handleExportExcelFaena}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingFaena ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : tropasFaena.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <Beef className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay tropas faenadas</p>
                    <p className="text-sm mt-1">Las tropas aparecerán aquí cuando se complete el proceso de faena</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead className="w-10">
                            <input type="checkbox" checked={tropasSeleccionadas.size === tropasFaena.length && tropasFaena.length > 0} onChange={handleToggleAllTropas} className="rounded" />
                          </TableHead>
                          <TableHead className="font-semibold text-xs">N° Tropa</TableHead>
                          <TableHead className="font-semibold text-xs">Usuario</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Cant.</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Kg Pie</TableHead>
                          <TableHead className="font-semibold text-xs">Fecha Faena</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Kg Gancho</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Rinde %</TableHead>
                          <TableHead className="font-semibold text-xs text-right">$/kg Serv.</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Total Serv+IVA</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Total Factura</TableHead>
                          <TableHead className="font-semibold text-xs">N° Factura</TableHead>
                          <TableHead className="font-semibold text-xs">Fecha Fact.</TableHead>
                          <TableHead className="font-semibold text-xs">Fecha Pago</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Monto Dep.</TableHead>
                          <TableHead className="font-semibold text-xs">Estado</TableHead>
                          <TableHead className="font-semibold text-xs text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tropasFaena.map((tropa) => {
                          const isEditing = editTropaId === tropa.id
                          return (
                            <TableRow key={tropa.id} className={`text-xs ${!tropa.numeroFactura ? 'bg-red-50/50' : ''} ${isEditing ? 'bg-amber-50' : ''}`}>
                              <TableCell>
                                <input type="checkbox" checked={tropasSeleccionadas.has(tropa.id)} onChange={() => handleToggleTropa(tropa.id)} className="rounded" />
                              </TableCell>
                              <TableCell className="font-mono font-medium">{tropa.codigo}</TableCell>
                              <TableCell>
                                <p className="font-medium truncate max-w-[120px]">{tropa.usuarioFaena?.nombre || '-'}</p>
                              </TableCell>
                              <TableCell className="text-right">{tropa.cantidadCabezas}</TableCell>
                              <TableCell className="text-right">{tropa.pesoTotalIndividual?.toLocaleString('es-AR', {maximumFractionDigits:0}) || '-'}</TableCell>
                              <TableCell>{tropa.fechaFaena ? new Date(tropa.fechaFaena).toLocaleDateString('es-AR') : '-'}</TableCell>
                              <TableCell className="text-right font-medium">{tropa.kgGancho?.toLocaleString('es-AR', {maximumFractionDigits:1}) || '-'}</TableCell>
                              <TableCell className="text-right">{tropa.rinde ? tropa.rinde.toFixed(2) : '-'}</TableCell>
                              <TableCell className="text-right">
                                {tropa.precioServicioKg ? formatCurrency(tropa.precioServicioKg) : (
                                  tropa.precioSugerido ? (
                                    <span className="text-amber-500" title="Precio sugerido">{formatCurrency(tropa.precioSugerido)}*</span>
                                  ) : '-'
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">{tropa.montoServicioFaena ? formatCurrency(tropa.montoServicioFaena) : '-'}</TableCell>
                              <TableCell className="text-right font-medium">{tropa.montoFactura ? formatCurrency(tropa.montoFactura) : '-'}</TableCell>
                              <TableCell className="font-mono">{tropa.numeroFactura || <span className="text-red-400">Sin facturar</span>}</TableCell>
                              <TableCell>{tropa.fechaFactura ? new Date(tropa.fechaFactura).toLocaleDateString('es-AR') : '-'}</TableCell>
                              <TableCell>{tropa.fechaPago ? new Date(tropa.fechaPago).toLocaleDateString('es-AR') : '-'}</TableCell>
                              <TableCell className="text-right">{tropa.montoDepositado ? formatCurrency(tropa.montoDepositado) : '-'}</TableCell>
                              <TableCell>
                                {tropa.estadoPago === 'PAGADO' ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Pagado</Badge>
                                ) : tropa.estadoPago === 'PAGO PARCIAL' ? (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">Parcial</Badge>
                                ) : tropa.numeroFactura ? (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs">Pendiente</Badge>
                                ) : (
                                  <Badge className="bg-stone-100 text-stone-500 text-xs">-</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Editar precios"
                                  onClick={() => {
                                    setPrecioEditData({
                                      id: tropa.id,
                                      codigo: tropa.codigo,
                                      usuario: tropa.usuarioFaena?.nombre || '-',
                                      kgGancho: tropa.kgGancho || 0,
                                      precioServicioKg: tropa.precioServicioKg || tropa.precioSugerido || 0,
                                      precioServicioKgConRecupero: tropa.precioServicioKgConRecupero || 0,
                                      tasaInspVet: tropa.tasaInspVet || 0,
                                      arancelIpcva: tropa.arancelIpcva || 0,
                                    })
                                    setPrecioEditOpen(true)
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumen por Cliente */}
            {porClienteFaena.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg py-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-500" />
                    Resumen por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Tropas</TableHead>
                        <TableHead className="text-right">Cabezas</TableHead>
                        <TableHead className="text-right">Kg Gancho</TableHead>
                        <TableHead className="text-right">Total Factura</TableHead>
                        <TableHead className="text-right">Pagado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porClienteFaena.map((c: any) => (
                        <TableRow key={c.clienteId}>
                          <TableCell className="font-medium">{c.cliente}</TableCell>
                          <TableCell className="text-right">{c.tropas}</TableCell>
                          <TableCell className="text-right">{c.cabezas}</TableCell>
                          <TableCell className="text-right">{c.kgGancho?.toLocaleString('es-AR', {maximumFractionDigits:0})}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(c.totalFactura)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(c.totalPagado)}</TableCell>
                          <TableCell className="text-right text-amber-600">{formatCurrency(c.pendiente)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB FACTURAS */}
          <TabsContent value="facturas" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFiltroEstado('TODOS')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 rounded-lg"><FileText className="w-5 h-5 text-stone-600" /></div>
                    <div><p className="text-xs text-stone-500 uppercase">Total Facturas</p><p className="text-2xl font-bold text-stone-800">{totalFacturas}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFiltroEstado('PENDIENTE')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg"><DollarSign className="w-5 h-5 text-amber-600" /></div>
                    <div><p className="text-xs text-stone-500 uppercase">Pendientes</p><p className="text-2xl font-bold text-amber-600">{pendientes}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFiltroEstado('PAGADA')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
                    <div><p className="text-xs text-stone-500 uppercase">Pagadas</p><p className="text-2xl font-bold text-emerald-600">{pagadas}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 rounded-lg"><DollarSign className="w-5 h-5 text-stone-600" /></div>
                    <div><p className="text-xs text-stone-500 uppercase">Monto Total</p><p className="text-lg font-bold text-stone-800">{formatCurrency(montoTotal)}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input placeholder="Buscar por número o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los estados</SelectItem>
                      <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                      <SelectItem value="EMITIDA">Emitidas</SelectItem>
                      <SelectItem value="PAGADA">Pagadas</SelectItem>
                      <SelectItem value="ANULADA">Anuladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Facturas */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" /> Listado de Comprobantes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : facturasFiltradas.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay comprobantes que mostrar</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Número</TableHead>
                          <TableHead className="font-semibold">Fecha</TableHead>
                          <TableHead className="font-semibold">Cliente</TableHead>
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="font-semibold">Total</TableHead>
                          <TableHead className="font-semibold">Saldo</TableHead>
                          <TableHead className="font-semibold">Estado</TableHead>
                          <TableHead className="font-semibold text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facturasFiltradas.map((factura) => (
                          <TableRow key={factura.id} className={factura.estado === 'ANULADA' ? 'opacity-50' : ''}>
                            <TableCell className="font-mono font-medium">{factura.numero}</TableCell>
                            <TableCell>{new Date(factura.fecha).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{factura.clienteNombre || factura.cliente?.nombre}</p>
                                {factura.clienteCuit && <p className="text-xs text-stone-500">CUIT: {factura.clienteCuit}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label || factura.tipoComprobante}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(factura.total)}</TableCell>
                            <TableCell className={factura.saldo > 0 ? 'text-amber-600 font-medium' : ''}>
                              {formatCurrency(factura.saldo)}
                            </TableCell>
                            <TableCell>{getEstadoBadge(factura.estado)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setViewOpen(true) }} title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleImprimir(factura)} title="Imprimir" disabled={factura.estado === 'ANULADA'}><Printer className="w-4 h-4" /></Button>
                                {factura.estado === 'PENDIENTE' && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setPagoData({ ...pagoData, monto: factura.saldo }); setPagoOpen(true) }} title="Registrar pago" className="text-emerald-600"><CreditCard className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleMarcarPagada(factura)} title="Marcar pagada" className="text-emerald-600"><CheckCircle className="w-4 h-4" /></Button>
                                  </>
                                )}
                                {factura.estado !== 'ANULADA' && factura.estado !== 'PAGADA' && (
                                  <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setDeleteOpen(true) }} title="Anular" className="text-red-500"><XCircle className="w-4 h-4" /></Button>
                                )}
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

          {/* TAB CUENTA CORRIENTE */}
          <TabsContent value="cuentas" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-500" />Cuenta Corriente por Cliente</CardTitle>
                <CardDescription>Seleccione un cliente para ver su estado de cuenta con tributos</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <Select onValueChange={async (clienteId) => {
                    const facturasCliente = facturas.filter(f => f.clienteId === clienteId && f.estado !== 'ANULADA')
                    if (facturasCliente.length > 0) {
                      setFacturaSeleccionada(facturasCliente[0])
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente para ver cuenta corriente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.razonSocial ? `(${c.razonSocial})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {facturas.filter(f => f.clienteId === facturaSeleccionada?.clienteId && f.estado !== 'ANULADA').length > 0 && (
                    <div className="space-y-4 mt-4">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-semibold text-xs">Número</TableHead>
                              <TableHead className="font-semibold text-xs">Fecha</TableHead>
                              <TableHead className="font-semibold text-xs">Tipo</TableHead>
                              <TableHead className="font-semibold text-xs text-right">Subtotal</TableHead>
                              <TableHead className="font-semibold text-xs text-right">IVA</TableHead>
                              <TableHead className="font-semibold text-xs text-right">Tributos</TableHead>
                              <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                              <TableHead className="font-semibold text-xs text-right">Saldo</TableHead>
                              <TableHead className="font-semibold text-xs">CAE</TableHead>
                              <TableHead className="font-semibold text-xs text-center">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {facturas.filter(f => f.clienteId === facturaSeleccionada?.clienteId && f.estado !== 'ANULADA').map((f) => (
                              <TableRow key={f.id} className="text-xs">
                                <TableCell className="font-mono">{f.numero}</TableCell>
                                <TableCell>{new Date(f.fecha).toLocaleDateString('es-AR')}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{TIPOS_COMPROBANTE.find(t => t.value === f.tipoComprobante)?.label || f.tipoComprobante}</Badge></TableCell>
                                <TableCell className="text-right">{formatCurrency(f.subtotal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(f.iva)}</TableCell>
                                <TableCell className="text-right">{f.importeTributos > 0 ? <span className="text-orange-600">{formatCurrency(f.importeTributos)}</span> : '-'}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(f.total)}</TableCell>
                                <TableCell className={`text-right ${f.saldo > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}`}>{formatCurrency(f.saldo)}</TableCell>
                                <TableCell>
                                  {f.cae ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">CAE: {f.cae}</Badge>
                                  ) : (
                                    <Badge className="bg-stone-100 text-stone-400 text-xs">Sin CAE</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalle" onClick={() => { setFacturaSeleccionada(f); setViewOpen(true); fetchTributosFactura(f.id) }}><Eye className="w-3.5 h-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Agregar tributo" onClick={() => { setTributoFormData({ ...tributoFormData, facturaId: f.id }); setTributoDialogOpen(true) }}><Plus className="w-3.5 h-3.5 text-orange-500" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Total con tributos */}
                      <div className="bg-stone-50 rounded-lg p-4">
                        {(() => {
                          const factCliente = facturas.filter(f => f.clienteId === facturaSeleccionada?.clienteId && f.estado !== 'ANULADA')
                          const totalSubtotal = factCliente.reduce((s, f) => s + f.subtotal, 0)
                          const totalIva = factCliente.reduce((s, f) => s + f.iva, 0)
                          const totalTributos = factCliente.reduce((s, f) => s + (f.importeTributos || 0), 0)
                          const totalTotal = factCliente.reduce((s, f) => s + f.total, 0)
                          const totalSaldo = factCliente.reduce((s, f) => s + f.saldo, 0)
                          return (
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span className="text-stone-600">Subtotal:</span><span>{formatCurrency(totalSubtotal)}</span></div>
                              <div className="flex justify-between"><span className="text-stone-600">IVA:</span><span>{formatCurrency(totalIva)}</span></div>
                              {totalTributos > 0 && <div className="flex justify-between"><span className="text-orange-600">Tributos:</span><span className="text-orange-600">{formatCurrency(totalTributos)}</span></div>}
                              <div className="flex justify-between font-bold border-t pt-1"><span>Total con Tributos:</span><span>{formatCurrency(totalTotal)}</span></div>
                              {totalSaldo > 0 && <div className="flex justify-between text-amber-600 font-medium"><span>Saldo Pendiente:</span><span>{formatCurrency(totalSaldo)}</span></div>}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  {!facturaSeleccionada && (
                    <p className="text-stone-500 text-center py-8">Seleccione un cliente del listado para ver su estado de cuenta detallado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB NOTAS CRÉDITO/DÉBITO */}
          <TabsContent value="notas" className="space-y-4">
            {/* Filtros y acciones */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Filtrar por tipo</Label>
                    <Select value={filtroNotasTipo} onValueChange={(v) => setFiltroNotasTipo(v as typeof filtroNotasTipo)}>
                      <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="CREDITO">Notas de Crédito</SelectItem>
                        <SelectItem value="DEBITO">Notas de Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => setNotaDialogOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                    <Plus className="w-4 h-4 mr-2" />Nueva Nota
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Notas */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-amber-500" />Notas de Crédito / Débito
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingNotas ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : notas.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <ArrowLeftRight className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay notas de crédito/débito</p>
                    <p className="text-sm mt-1">Las notas aparecerán aquí cuando se generen desde facturas existentes</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Número</TableHead>
                          <TableHead className="font-semibold text-xs">Tipo</TableHead>
                          <TableHead className="font-semibold text-xs">Factura Ref.</TableHead>
                          <TableHead className="font-semibold text-xs">Motivo</TableHead>
                          <TableHead className="font-semibold text-xs">Fecha</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Subtotal</TableHead>
                          <TableHead className="font-semibold text-xs text-right">IVA</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                          <TableHead className="font-semibold text-xs">CAE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notas.map((nota) => (
                          <TableRow key={nota.id} className="text-xs">
                            <TableCell className="font-mono font-medium">
                              {String(nota.puntoVenta).padStart(4, '0')}-{String(nota.numero).padStart(8, '0')}
                            </TableCell>
                            <TableCell>
                              {nota.tipo === 'CREDITO' ? (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">Crédito</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 text-xs">Débito</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              {nota.factura?.numero || '-'}
                              {nota.factura?.clienteNombre && <p className="text-xs text-stone-400">{nota.factura.clienteNombre}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{nota.motivo}</Badge>
                            </TableCell>
                            <TableCell>{new Date(nota.fecha).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(nota.subtotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(nota.iva)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(nota.total)}</TableCell>
                            <TableCell>
                              {nota.cae ? (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">{nota.cae}</Badge>
                              ) : (
                                <Badge className="bg-stone-100 text-stone-400 text-xs">Sin CAE</Badge>
                              )}
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

          {/* TAB AFIP */}
          <TabsContent value="afip" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-500" />Configuración AFIP
                  </CardTitle>
                  {afipConfig && (
                    <div className="flex items-center gap-2">
                      {afipConfig.cuit && afipConfig.certificadoPath ? (
                        <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Configurado</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" />Incompleto</Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {loadingAfip ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : (
                  <div className="space-y-6">
                    {/* Entorno */}
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-stone-500" />
                        <div>
                          <p className="font-medium text-sm">Entorno</p>
                          <p className="text-xs text-stone-500">Testing para pruebas, Production para facturación real</p>
                        </div>
                      </div>
                      <Select value={afipFormData.entorno} onValueChange={(v) => setAfipFormData({ ...afipFormData, entorno: v })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="testing">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full" />Testing</span>
                          </SelectItem>
                          <SelectItem value="production">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full" />Production</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Datos del emisor */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Datos del Emisor</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">CUIT</Label>
                          <Input placeholder="30-12345678-9" value={afipFormData.cuit} onChange={(e) => setAfipFormData({ ...afipFormData, cuit: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Razón Social</Label>
                          <Input placeholder="Solemar Alimentaria S.A." value={afipFormData.razonSocial} onChange={(e) => setAfipFormData({ ...afipFormData, razonSocial: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Inicio Actividades</Label>
                          <Input type="date" value={afipFormData.inicioActividades} onChange={(e) => setAfipFormData({ ...afipFormData, inicioActividades: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {/* Certificados */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Certificados Digitales</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Certificado (.crt)</Label>
                          <Input placeholder="/ruta/al/certificado.crt" value={afipFormData.certificadoPath} onChange={(e) => setAfipFormData({ ...afipFormData, certificadoPath: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Clave Privada (.key)</Label>
                          <Input placeholder="/ruta/a/clave.key" value={afipFormData.clavePrivadaPath} onChange={(e) => setAfipFormData({ ...afipFormData, clavePrivadaPath: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {/* Web Services */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Web Services AFIP</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">WSAA URL</Label>
                          <Input placeholder="https://wsaahomo.afip.gov.ar/ws/services/LoginCms" value={afipFormData.wsaaUrl} onChange={(e) => setAfipFormData({ ...afipFormData, wsaaUrl: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">WSFE URL</Label>
                          <Input placeholder="https://wsfehomo.afip.gov.ar/wsfev1/service.asmx" value={afipFormData.wsfeUrl} onChange={(e) => setAfipFormData({ ...afipFormData, wsfeUrl: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {/* Puntos de venta */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Puntos de Venta</h3>
                      <div className="space-y-2">
                        <Label className="text-xs">Puntos de venta habilitados (JSON array)</Label>
                        <Input placeholder='[1, 2, 3]' value={afipFormData.puntosVenta} onChange={(e) => setAfipFormData({ ...afipFormData, puntosVenta: e.target.value })} />
                        <p className="text-xs text-stone-400">Formato: [1, 2, 3] — Puntos de venta habilitados por AFIP</p>
                      </div>
                      {afipFormData.puntosVenta && (() => {
                        try {
                          const pv = JSON.parse(afipFormData.puntosVenta)
                          if (Array.isArray(pv)) {
                            return (
                              <div className="flex flex-wrap gap-2">
                                {pv.map((p: number) => (
                                  <Badge key={p} variant="outline" className="text-xs">PV {String(p).padStart(4, '0')}</Badge>
                                ))}
                              </div>
                            )
                          }
                        } catch {}
                        return null
                      })()}
                    </div>

                    {/* Estado del token */}
                    {afipConfig?.tokenExpiracion && (
                      <div className="p-3 bg-stone-50 rounded-lg text-sm">
                        <p className="text-stone-500">Último token WSFE: {new Date(afipConfig.tokenExpiracion).toLocaleString('es-AR')}</p>
                        <p className="text-xs text-stone-400 mt-1">
                          {new Date(afipConfig.tokenExpiracion) > new Date() ? '✓ Token vigente' : '⚠ Token expirado'}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={handleGuardarAfip} disabled={afipSaving} className="bg-amber-500 hover:bg-amber-600">
                        {afipSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Configuración
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB HISTORIAL PRECIOS */}
          <TabsContent value="historialPrecios">
            <HistorialPreciosModule />
          </TabsContent>
        </Tabs>

        {/* Dialog Nueva Factura */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" />Nueva Factura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.clienteId} onValueChange={(v) => setFormData({ ...formData, clienteId: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre} {c.razonSocial ? `(${c.razonSocial})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Detalles de Factura</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAgregarDetalle}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
                </div>
                <div className="space-y-3">
                  {formData.detalles.map((detalle, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-stone-50 rounded-lg">
                      <div className="col-span-3">
                        <Select value={detalle.tipoServicioId} onValueChange={(v) => handleDetalleChange(index, 'tipoServicioId', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Servicio" /></SelectTrigger>
                          <SelectContent>
                            {tiposServicio.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input placeholder="Descripción" value={detalle.descripcion} onChange={(e) => handleDetalleChange(index, 'descripcion', e.target.value)} className="h-9" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Cant." value={detalle.cantidad || ''} onChange={(e) => handleDetalleChange(index, 'cantidad', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Precio" value={detalle.precioUnitario || ''} onChange={(e) => handleDetalleChange(index, 'precioUnitario', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-1 flex items-center">
                        <Badge variant="outline">{detalle.unidad}</Badge>
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleEliminarDetalle(index)} disabled={formData.detalles.length === 1}><XCircle className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Notas adicionales..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardar} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear Factura'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Ver Detalle */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-amber-600" />Detalle de Factura</DialogTitle>
            </DialogHeader>
            {facturaSeleccionada && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-stone-500">Número</p><p className="font-mono font-medium">{facturaSeleccionada.numero}</p></div>
                  <div><p className="text-sm text-stone-500">Tipo</p><p>{TIPOS_COMPROBANTE.find(t => t.value === facturaSeleccionada.tipoComprobante)?.label}</p></div>
                  <div><p className="text-sm text-stone-500">Fecha</p><p>{new Date(facturaSeleccionada.fecha).toLocaleDateString('es-AR')}</p></div>
                  <div><p className="text-sm text-stone-500">Estado</p>{getEstadoBadge(facturaSeleccionada.estado)}</div>
                  <div><p className="text-sm text-stone-500">Punto de Venta</p><p className="font-mono">{String(facturaSeleccionada.puntoVenta || 1).padStart(4, '0')}</p></div>
                  <div><p className="text-sm text-stone-500">CAE</p>
                    {facturaSeleccionada.cae ? (
                      <div>
                        <p className="font-mono text-emerald-700">{facturaSeleccionada.cae}</p>
                        {facturaSeleccionada.caeVencimiento && <p className="text-xs text-stone-400">Vto: {new Date(facturaSeleccionada.caeVencimiento).toLocaleDateString('es-AR')}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-stone-100 text-stone-400">Sin CAE</Badge>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSolicitarCAE}>
                          <Shield className="w-3 h-3 mr-1" />Solicitar CAE
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-stone-500 mb-2">Cliente</p>
                  <p className="font-medium">{facturaSeleccionada.clienteNombre || facturaSeleccionada.cliente?.nombre}</p>
                  {facturaSeleccionada.clienteCuit && <p className="text-sm text-stone-500">CUIT: {facturaSeleccionada.clienteCuit}</p>}
                  {facturaSeleccionada.clienteCondicionIva && <p className="text-sm text-stone-500">Cond. IVA: {facturaSeleccionada.clienteCondicionIva}</p>}
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-stone-500 mb-2">Detalles</p>
                  <Table>
                    <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead>Cant.</TableHead><TableHead>P. Unit.</TableHead><TableHead>Subtotal</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {facturaSeleccionada.detalles?.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.descripcion}</TableCell>
                          <TableCell>{d.cantidad} {d.unidad}</TableCell>
                          <TableCell>{formatCurrency(d.precioUnitario)}</TableCell>
                          <TableCell>{formatCurrency(d.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t pt-4 space-y-1">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(facturaSeleccionada.subtotal)}</span></div>
                  {facturaSeleccionada.iva > 0 && (
                    <div className="flex justify-between">
                      <span>IVA ({facturaSeleccionada.porcentajeIva}%):</span>
                      <span>{formatCurrency(facturaSeleccionada.iva)}</span>
                    </div>
                  )}
                  {(facturaSeleccionada.importeTributos || 0) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Tributos:</span>
                      <span>{formatCurrency(facturaSeleccionada.importeTributos || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>{formatCurrency(facturaSeleccionada.total)}</span></div>
                  {facturaSeleccionada.saldo > 0 && <div className="flex justify-between text-amber-600"><span>Saldo Pendiente:</span><span>{formatCurrency(facturaSeleccionada.saldo)}</span></div>}
                </div>
                {/* Tributos de la factura */}
                {tributosFactura.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-stone-500 mb-2 font-medium">Retenciones / Percepciones</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead className="text-right">Base Imp.</TableHead><TableHead className="text-right">Alícuota</TableHead><TableHead className="text-right">Importe</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {tributosFactura.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{t.descripcion}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(t.baseImponible)}</TableCell>
                            <TableCell className="text-right text-sm">{t.alicuota}%</TableCell>
                            <TableCell className="text-right text-sm font-medium text-orange-600">{formatCurrency(t.importe)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTributo(t.id, t.facturaId)} title="Eliminar tributo">
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {facturaSeleccionada.pagos && facturaSeleccionada.pagos.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-stone-500 mb-2">Pagos Registrados</p>
                    {facturaSeleccionada.pagos.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span>{new Date(p.fecha).toLocaleDateString('es-AR')} - {p.metodoPago} {p.referencia && `(${p.referencia})`}</span>
                        <span className="text-emerald-600">{formatCurrency(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>Cerrar</Button>
              {!facturaSeleccionada?.cae && facturaSeleccionada?.estado !== 'ANULADA' && (
                <Button variant="outline" onClick={handleSolicitarCAE}>
                  <Shield className="w-4 h-4 mr-2" />Solicitar CAE
                </Button>
              )}
              <Button onClick={() => { handleImprimir(facturaSeleccionada!); setViewOpen(false); }}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Pago */}
        <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-600" />Registrar Pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">Saldo pendiente: <strong>{formatCurrency(facturaSeleccionada?.saldo || 0)}</strong></p>
              </div>
              <div className="space-y-2">
                <Label>Monto a pagar *</Label>
                <Input type="number" value={pagoData.monto || ''} onChange={(e) => setPagoData({ ...pagoData, monto: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={pagoData.metodoPago} onValueChange={(v) => setPagoData({ ...pagoData, metodoPago: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {pagoData.metodoPago === 'TRANSFERENCIA' && (
                <div className="space-y-2">
                  <Label>Referencia / N° Comprobante</Label>
                  <Input value={pagoData.referencia} onChange={(e) => setPagoData({ ...pagoData, referencia: e.target.value })} placeholder="N° de transferencia" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Input value={pagoData.observaciones} onChange={(e) => setPagoData({ ...pagoData, observaciones: e.target.value })} placeholder="Notas opcionales" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPagoOpen(false)}>Cancelar</Button>
              <Button onClick={handleRegistrarPago} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Anular */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><XCircle className="w-5 h-5" />Anular Factura</DialogTitle></DialogHeader>
            <p className="text-sm text-stone-500">¿Está seguro que desea anular la factura {facturaSeleccionada?.numero}? Esta acción no se puede deshacer.</p>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
              <Button onClick={handleAnular} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Anulando...' : 'Anular Factura'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar Precios Tropa */}
        <Dialog open={precioEditOpen} onOpenChange={setPrecioEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-600" />
                Editar Precios - Tropa {precioEditData?.codigo}
              </DialogTitle>
              <DialogDescription>
                {precioEditData?.usuario} — Kg Gancho: {precioEditData?.kgGancho?.toLocaleString('es-AR', {maximumFractionDigits:1}) || '0'}
              </DialogDescription>
            </DialogHeader>
            {precioEditData && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio/kg Servicio</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precioEditData.precioServicioKg || ''}
                      onChange={(e) => setPrecioEditData({ ...precioEditData, precioServicioKg: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio/kg con Recupero</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precioEditData.precioServicioKgConRecupero || ''}
                      onChange={(e) => setPrecioEditData({ ...precioEditData, precioServicioKgConRecupero: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tasa Inspección Veterinaria ($/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precioEditData.tasaInspVet || ''}
                      onChange={(e) => setPrecioEditData({ ...precioEditData, tasaInspVet: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Arancel IPCVA ($/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precioEditData.arancelIpcva || ''}
                      onChange={(e) => setPrecioEditData({ ...precioEditData, arancelIpcva: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {/* Auto-calculated preview */}
                <div className="bg-stone-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Cálculo automático</p>
                  {(() => {
                    const kgGancho = precioEditData.kgGancho || 0
                    const precioKg = precioEditData.precioServicioKg || 0
                    const tasaVet = precioEditData.tasaInspVet || 0
                    const arancel = precioEditData.arancelIpcva || 0
                    const montoServicioFaena = kgGancho * precioKg * 1.21
                    const montoFactura = montoServicioFaena + (kgGancho * tasaVet) + (kgGancho * arancel)
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600">Monto Servicio Faena (IVA 21%):</span>
                          <span className="font-medium">{formatCurrency(montoServicioFaena)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-stone-500">
                          <span>= {kgGancho.toLocaleString('es-AR', {maximumFractionDigits:1})} kg × {formatCurrency(precioKg)} × 1.21</span>
                        </div>
                        <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                          <span className="text-stone-600">Total Factura:</span>
                          <span className="font-bold text-amber-700 text-base">{formatCurrency(montoFactura)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-400">
                          <span>Serv+IVA + ({kgGancho.toLocaleString('es-AR', {maximumFractionDigits:1})} × Tasa Vet) + ({kgGancho.toLocaleString('es-AR', {maximumFractionDigits:1})} × Arancel)</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrecioEditOpen(false)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!precioEditData) return
                  setSaving(true)
                  try {
                    const kgGancho = precioEditData.kgGancho || 0
                    const precioKg = precioEditData.precioServicioKg || 0
                    const tasaVet = precioEditData.tasaInspVet || 0
                    const arancel = precioEditData.arancelIpcva || 0
                    const montoServicioFaena = kgGancho * precioKg * 1.21
                    const montoFactura = montoServicioFaena + (kgGancho * tasaVet) + (kgGancho * arancel)

                    const res = await fetch('/api/facturacion/servicio-faena', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        tropaId: precioEditData.id,
                        precioServicioKg: precioEditData.precioServicioKg,
                        precioServicioKgConRecupero: precioEditData.precioServicioKgConRecupero,
                        tasaInspVet: precioEditData.tasaInspVet,
                        arancelIpcva: precioEditData.arancelIpcva,
                        montoServicioFaena,
                        montoFactura,
                      })
                    })
                    const data = await res.json()
                    if (data.success) {
                      toast.success('Precios actualizados correctamente')
                      setPrecioEditOpen(false)
                      setPrecioEditData(null)
                      fetchServicioFaena()
                    } else {
                      toast.error(data.error || 'Error al actualizar precios')
                    }
                  } catch {
                    toast.error('Error al actualizar precios')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                {saving ? 'Guardando...' : 'Guardar Precios'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Nueva Nota C/D */}
        <Dialog open={notaDialogOpen} onOpenChange={setNotaDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-amber-600" />Nueva Nota de Crédito / Débito</DialogTitle>
              <DialogDescription>Genere una nota asociada a una factura existente</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Factura de referencia *</Label>
                <Select value={notaFormData.facturaId} onValueChange={(v) => {
                  const factura = facturas.find(f => f.id === v)
                  setNotaFormData({ ...notaFormData, facturaId: v, subtotal: factura?.subtotal || 0, iva: factura?.iva || 0, total: factura?.total || 0 })
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar factura" /></SelectTrigger>
                  <SelectContent>
                    {facturas.filter(f => f.estado !== 'ANULADA').map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.numero} — {f.clienteNombre || f.cliente?.nombre} — {formatCurrency(f.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Nota *</Label>
                  <Select value={notaFormData.tipo} onValueChange={(v) => setNotaFormData({ ...notaFormData, tipo: v as 'CREDITO' | 'DEBITO' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDITO">Nota de Crédito</SelectItem>
                      <SelectItem value="DEBITO">Nota de Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivo *</Label>
                  <Select value={notaFormData.motivo} onValueChange={(v) => setNotaFormData({ ...notaFormData, motivo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                      <SelectItem value="DESCUENTO">Descuento</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="ANULACION">Anulación</SelectItem>
                      <SelectItem value="AJUSTE">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea value={notaFormData.descripcion} onChange={(e) => setNotaFormData({ ...notaFormData, descripcion: e.target.value })} placeholder="Detalle del motivo de la nota..." rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Subtotal</Label>
                  <Input type="number" value={notaFormData.subtotal || ''} onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0
                    const iva = subtotal * 0.21
                    setNotaFormData({ ...notaFormData, subtotal, iva, total: subtotal + iva })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>IVA (auto 21%)</Label>
                  <Input type="number" value={notaFormData.iva.toFixed(2)} readOnly className="bg-stone-50" />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input type="number" value={notaFormData.total.toFixed(2)} readOnly className="bg-stone-50 font-bold" />
                </div>
              </div>
              {notaFormData.facturaId && (() => {
                const factura = facturas.find(f => f.id === notaFormData.facturaId)
                if (!factura) return null
                return (
                  <div className="bg-stone-50 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold text-stone-600">Referencia: {factura.numero}</p>
                    <p>Tipo: {TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label}</p>
                    <p>Cliente: {factura.clienteNombre || factura.cliente?.nombre}</p>
                    {factura.tipoComprobante === 'FACTURA_A' && (
                      <p className="text-amber-600">Factura A: IVA discriminado — Subtotal neto + IVA = Total</p>
                    )}
                    {factura.tipoComprobante === 'FACTURA_B' && (
                      <p className="text-amber-600">Factura B: IVA incluido en el precio — El total ya contiene IVA</p>
                    )}
                  </div>
                )
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotaDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardarNota} disabled={saving} className={notaFormData.tipo === 'CREDITO' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />}
                {saving ? 'Creando...' : `Crear Nota de ${notaFormData.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Agregar Tributo */}
        <Dialog open={tributoDialogOpen} onOpenChange={setTributoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-600" />Agregar Retención / Percepción</DialogTitle>
              <DialogDescription>Agregue tributos a la factura seleccionada</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Tributo</Label>
                <Select value={String(tributoFormData.tributoId)} onValueChange={(v) => {
                  const tributoId = parseInt(v)
                  const descripciones: Record<number, string> = { 1: 'Impuesto Nacional', 4: 'Percepción IIBB', 5: 'Percepción IVA', 6: 'Percepción Ganancias', 7: 'Otro' }
                  setTributoFormData({ ...tributoFormData, tributoId, descripcion: descripciones[tributoId] || '' })
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nacional</SelectItem>
                    <SelectItem value="4">Percepción IIBB</SelectItem>
                    <SelectItem value="5">Percepción IVA</SelectItem>
                    <SelectItem value="6">Percepción Ganancias</SelectItem>
                    <SelectItem value="7">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input value={tributoFormData.descripcion} onChange={(e) => setTributoFormData({ ...tributoFormData, descripcion: e.target.value })} placeholder="Ej: Percepción IIBB CABA" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base Imponible</Label>
                  <Input type="number" value={tributoFormData.baseImponible || ''} onChange={(e) => {
                    const baseImponible = parseFloat(e.target.value) || 0
                    const importe = baseImponible * (tributoFormData.alicuota / 100)
                    setTributoFormData({ ...tributoFormData, baseImponible, importe })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Alícuota %</Label>
                  <Input type="number" step="0.01" value={tributoFormData.alicuota || ''} onChange={(e) => {
                    const alicuota = parseFloat(e.target.value) || 0
                    const importe = tributoFormData.baseImponible * (alicuota / 100)
                    setTributoFormData({ ...tributoFormData, alicuota, importe })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Importe</Label>
                  <Input type="number" value={tributoFormData.importe.toFixed(2)} readOnly className="bg-stone-50 font-bold" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTributoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddTributo} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Agregar Tributo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default FacturacionModule
