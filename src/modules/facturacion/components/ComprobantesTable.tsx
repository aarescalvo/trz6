'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, Loader2, RefreshCw, Eye, CreditCard, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Factura { id: string; numero: string; tipoComprobante: string; clienteNombre?: string; clienteCuit?: string; fecha: string; subtotal: number; iva: number; total: number; saldo: number; estado: string; cae?: string | null; importeTributos?: number; detalles?: any[]; pagos?: any[] }

interface Props { operador: { id: string; nombre: string; rol: string } }

export function ComprobantesTable({ operador }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewFactura, setViewFactura] = useState<Factura | null>(null)

  const formatCurrency = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v)

  const fetchFacturas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado !== 'TODOS') params.set('estado', filtroEstado)
      if (searchTerm) params.set('search', searchTerm)
      const res = await fetch(`/api/facturacion?${params.toString()}`)
      const data = await res.json()
      if (data.success) setFacturas(data.data)
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }, [filtroEstado, searchTerm])

  useEffect(() => { fetchFacturas() }, [fetchFacturas])

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
      case 'EMITIDA': return <Badge className="bg-blue-100 text-blue-700">Emitida</Badge>
      case 'PAGADA': return <Badge className="bg-emerald-100 text-emerald-700">Pagada</Badge>
      case 'ANULADA': return <Badge className="bg-red-100 text-red-700">Anulada</Badge>
      default: return <Badge>{estado}</Badge>
    }
  }

  const getTipoLabel = (tipo: string) => {
    const map: Record<string, string> = { FACTURA_A: 'Fc A', FACTURA_B: 'Fc B', FACTURA_C: 'Fc C', NOTA_CREDITO: 'NC', NOTA_DEBITO: 'ND', REMITO: 'Rem' }
    return map[tipo] || tipo
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-64"><Input placeholder="Buscar por número o cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
            <SelectItem value="EMITIDA">Emitidas</SelectItem>
            <SelectItem value="PAGADA">Pagadas</SelectItem>
            <SelectItem value="ANULADA">Anuladas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchFacturas}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Tabla */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Número</TableHead>
                  <TableHead className="text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Saldo</TableHead>
                  <TableHead className="text-xs font-semibold">CAE</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map(f => (
                  <TableRow key={f.id} className="text-xs">
                    <TableCell><Badge variant="outline" className="text-xs font-mono">{getTipoLabel(f.tipoComprobante)}</Badge></TableCell>
                    <TableCell className="font-mono">{f.numero}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{f.clienteNombre || '-'}</TableCell>
                    <TableCell>{new Date(f.fecha).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(f.total)}</TableCell>
                    <TableCell className={`text-right font-mono ${f.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(f.saldo)}</TableCell>
                    <TableCell>{f.cae ? <Badge className="bg-emerald-100 text-emerald-700 text-xs">CAE</Badge> : '-'}</TableCell>
                    <TableCell>{getEstadoBadge(f.estado)}</TableCell>
                    <TableCell className="text-center"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewFactura(f)}><Eye className="w-3.5 h-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewFactura} onOpenChange={() => setViewFactura(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Comprobante {viewFactura?.numero}</DialogTitle></DialogHeader>
          {viewFactura && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-stone-500">Tipo:</span> {getTipoLabel(viewFactura.tipoComprobante)}</div>
                <div><span className="text-stone-500">Estado:</span> {getEstadoBadge(viewFactura.estado)}</div>
                <div><span className="text-stone-500">Cliente:</span> {viewFactura.clienteNombre}</div>
                <div><span className="text-stone-500">CUIT:</span> {viewFactura.clienteCuit || '-'}</div>
                <div><span className="text-stone-500">Subtotal:</span> {formatCurrency(viewFactura.subtotal)}</div>
                <div><span className="text-stone-500">IVA:</span> {formatCurrency(viewFactura.iva)}</div>
                {viewFactura.importeTributos ? <div><span className="text-stone-500">Tributos:</span> {formatCurrency(viewFactura.importeTributos)}</div> : null}
                <div className="text-lg font-bold"><span className="text-stone-500">Total:</span> {formatCurrency(viewFactura.total)}</div>
                {viewFactura.cae && <div><span className="text-stone-500">CAE:</span> <span className="font-mono text-emerald-600">{viewFactura.cae}</span></div>}
              </div>
              {viewFactura.detalles && viewFactura.detalles.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead className="text-xs">Concepto</TableHead><TableHead className="text-xs text-right">Cant.</TableHead><TableHead className="text-xs text-right">P.Unit.</TableHead><TableHead className="text-xs text-right">Subtotal</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {viewFactura.detalles.map((d: any) => (
                      <TableRow key={d.id} className="text-xs"><TableCell>{d.descripcion}</TableCell><TableCell className="text-right">{d.cantidad}</TableCell><TableCell className="text-right font-mono">{formatCurrency(d.precioUnitario)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(d.subtotal)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
