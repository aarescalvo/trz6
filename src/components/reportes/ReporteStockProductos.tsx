'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { RefreshCw, Warehouse, Package } from 'lucide-react'
import { toast } from 'sonner'

interface StockCamaraItem {
  camara: string
  tipo: string
  totalMedias: number
  pesoTotal: number
  capacidad: number
  ocupacion: number
}

interface StockTropaItem {
  tropaCodigo: string
  cantidad: number
  pesoTotal: number
}

interface StockData {
  stockPorCamara: StockCamaraItem[]
  stockPorTropa: StockTropaItem[]
  totalMedias: number
  pesoTotal: number
}

export function ReporteStockProductos() {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [camaraId, setCamaraId] = useState('')
  const [camaras, setCamaras] = useState<{ id: string; nombre: string }[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (camaraId) params.append('camaraId', camaraId)
      const res = await fetch(`/api/reportes/stock-productos?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else toast.error('Error al cargar stock de productos')
    } catch (error) {
      console.error(error)
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const fetchCamaras = async () => {
    try {
      const res = await fetch('/api/camaras')
      const json = await res.json()
      if (json.success || Array.isArray(json.data)) setCamaras(json.data.map((c: any) => ({ id: c.id, nombre: c.nombre })))
    } catch (error) { console.error(error) }
  }

  useEffect(() => { fetchData(); fetchCamaras() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-center text-stone-400">No hay datos disponibles</div>
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs text-stone-500">Cámara</Label>
              <Select value={camaraId} onValueChange={setCamaraId}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {camaras.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchData} size="sm" className="bg-amber-500 hover:bg-amber-600">
              <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <Warehouse className="w-6 h-6 mx-auto text-amber-600 mb-1" />
            <p className="text-xs text-amber-600">Total Medias en Cámara</p>
            <p className="text-2xl font-bold text-amber-800">{data.totalMedias}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <Package className="w-6 h-6 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-blue-600">Peso Total</p>
            <p className="text-2xl font-bold text-blue-800">{data.pesoTotal.toLocaleString('es-AR')} kg</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock por Cámara */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50">
          <CardTitle className="text-sm">Stock por Cámara</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.stockPorCamara.length === 0 ? (
            <div className="p-8 text-center text-stone-400">No hay datos de stock</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cámara</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Medias</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                  <TableHead className="text-right">Capacidad</TableHead>
                  <TableHead className="text-right">Ocupación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stockPorCamara.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.camara}</TableCell>
                    <TableCell><Badge variant="outline">{s.tipo}</Badge></TableCell>
                    <TableCell className="text-right">{s.totalMedias}</TableCell>
                    <TableCell className="text-right">{s.pesoTotal.toLocaleString('es-AR')}</TableCell>
                    <TableCell className="text-right">{s.capacidad}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={s.ocupacion >= 90 ? 'destructive' : s.ocupacion >= 70 ? 'secondary' : 'default'}
                        className={s.ocupacion >= 90 ? 'bg-red-100 text-red-700' : s.ocupacion >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                        {s.ocupacion}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stock por Tropa */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50">
          <CardTitle className="text-sm">Stock por Tropa</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.stockPorTropa.length === 0 ? (
            <div className="p-8 text-center text-stone-400">No hay datos por tropa</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tropa</TableHead>
                  <TableHead className="text-right">Medias</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stockPorTropa.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-medium">{s.tropaCodigo}</TableCell>
                    <TableCell className="text-right">{s.cantidad}</TableCell>
                    <TableCell className="text-right">{s.pesoTotal.toLocaleString('es-AR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
