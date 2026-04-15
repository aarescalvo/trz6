'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Loader2, RefreshCw, DollarSign, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Cliente { id: string; nombre: string; cuit?: string; razonSocial?: string; esUsuarioFaena: boolean }
interface Factura { id: string; numero: string; tipoComprobante: string; fecha: string; total: number; saldo: number; estado: string }
interface Pago { id: string; fecha: string; monto: number; metodoPago: string; referencia?: string }

interface Props { operador: { id: string; nombre: string; rol: string } }

export function CtaCteCliente({ operador }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(false)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<Factura | null>(null)
  const [saving, setSaving] = useState(false)
  const [pagoData, setPagoData] = useState({ monto: 0, metodoPago: 'EFECTIVO', referencia: '' })

  const formatCurrency = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v)

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => { if (d.success) setClientes(d.data.filter((c: Cliente) => c.esUsuarioFaena)) })
  }, [])

  const fetchCtaCte = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/facturacion?clienteId=${clienteId}`)
      const data = await res.json()
      if (data.success) setFacturas(data.data)
    } catch { toast.error('Error al cargar') } finally { setLoading(false) }
  }, [clienteId])

  useEffect(() => { fetchCtaCte() }, [fetchCtaCte])

  const handlePagar = async () => {
    if (!facturaSeleccionada || pagoData.monto <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/cuenta-corriente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturaId: facturaSeleccionada.id, ...pagoData, operadorId: operador.id })
      })
      const data = await res.json()
      if (data.success) { toast.success('Pago registrado'); setPagoOpen(false); fetchCtaCte(); }
      else { toast.error(data.error) }
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const saldoTotal = facturas.filter(f => f.estado !== 'ANULADA').reduce((s, f) => s + f.saldo, 0)
  const totalFacturado = facturas.filter(f => f.estado !== 'ANULADA').reduce((s, f) => s + f.total, 0)

  return (
    <div className="space-y-4">
      {/* Selector de cliente */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razonSocial || c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchCtaCte} disabled={!clienteId}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {clienteId && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm bg-stone-50"><CardContent className="p-3"><div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-stone-600" /><div><p className="text-xs text-stone-500">Total Facturado</p><p className="text-lg font-bold">{formatCurrency(totalFacturado)}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm bg-emerald-50"><CardContent className="p-3"><div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /><div><p className="text-xs text-stone-500">Cobrado</p><p className="text-lg font-bold text-emerald-700">{formatCurrency(totalFacturado - saldoTotal)}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm bg-amber-50"><CardContent className="p-3"><div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-600" /><div><p className="text-xs text-stone-500">Saldo Pendiente</p><p className="text-lg font-bold text-amber-700">{formatCurrency(saldoTotal)}</p></div></div></CardContent></Card>
        </div>
      )}

      {/* Tabla de movimientos */}
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div> : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead className="text-xs font-semibold">Comprobante</TableHead>
                  <TableHead className="text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Saldo</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map(f => (
                  <TableRow key={f.id} className="text-xs">
                    <TableCell className="font-mono">{f.numero}</TableCell>
                    <TableCell>{new Date(f.fecha).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(f.total)}</TableCell>
                    <TableCell className={`text-right font-mono ${f.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(f.saldo)}</TableCell>
                    <TableCell>{f.estado === 'PAGADA' ? <Badge className="bg-emerald-100 text-emerald-700 text-xs">Pagada</Badge> : f.estado === 'ANULADA' ? <Badge className="bg-red-100 text-red-700 text-xs">Anulada</Badge> : <Badge className="bg-amber-100 text-amber-700 text-xs">Pendiente</Badge>}</TableCell>
                    <TableCell className="text-center">{f.saldo > 0 && f.estado !== 'ANULADA' && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFacturaSeleccionada(f); setPagoData({ ...pagoData, monto: f.saldo }); setPagoOpen(true) }}><CreditCard className="w-3.5 h-3.5 mr-1" />Pagar</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pago Dialog */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-stone-500">Factura: <span className="font-mono">{facturaSeleccionada?.numero}</span></p>
            <p className="text-sm text-stone-500">Saldo: <span className="font-bold text-amber-600">{formatCurrency(facturaSeleccionada?.saldo || 0)}</span></p>
            <div className="space-y-2"><Label>Monto</Label><Input type="number" value={pagoData.monto || ''} onChange={e => setPagoData({ ...pagoData, monto: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Método</Label>
              <Select value={pagoData.metodoPago} onValueChange={v => setPagoData({ ...pagoData, metodoPago: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="TARJETA_DEBITO">Tarjeta Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={pagoData.referencia} onChange={e => setPagoData({ ...pagoData, referencia: e.target.value })} placeholder="N° transferencia, cheque..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoOpen(false)}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={handlePagar} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}Registrar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
