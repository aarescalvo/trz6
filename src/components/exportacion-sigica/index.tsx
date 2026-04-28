'use client'

import { useState } from 'react'
import {
  Download, FileSpreadsheet, Calendar, Search, Loader2, AlertCircle, CheckCircle2, Info, ClipboardList, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Operador { id: string; nombre: string; rol: string }

interface TropaResumen {
  tropaId: string
  tropaNumero: number
  tropaCodigo: string
  usuarioFaena: string
  cantidadCabezas: number
  romaneosConfirmados: number
  registros: RegistroSIGICA[]
  totalKg: number
}

interface RegistroSIGICA {
  tropa: number
  tropaCodigo: string
  especie: string
  fecha: string
  periodo: string
  clasificacion: string
  despiece: string
  garon: number
  kilos: number
  camara: string
  camaraNombre: string
  destino: string
  tipoAnimal: string
  denticion: string
}

const DESTINOS = [
  { value: '106', label: '106 - Consumo Interno' },
  { value: '100', label: '100 - Exportacion U.E.' },
  { value: '105', label: '105 - Exportacion Otros Paises' },
  { value: '117', label: '117 - Digestor' },
]

export function ExportacionSIGICAModule({ operador }: { operador: Operador }) {
  const [fecha, setFecha] = useState(() => {
    // Default: hoy en formato YYYY-MM-DD
    const hoy = new Date()
    return hoy.toISOString().split('T')[0]
  })
  const [destino, setDestino] = useState('106')
  const [loading, setLoading] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [preview, setPreview] = useState<{
    tropas: TropaResumen[]
    registros: RegistroSIGICA[]
    totalMedias: number
    totalKg: number
  } | null>(null)
  const [tropasSeleccionadas, setTropasSeleccionadas] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(true)

  // Buscar tropas faenadas en la fecha seleccionada
  const buscarTropas = async () => {
    if (!fecha) {
      toast.error('Seleccioná una fecha de faena')
      return
    }

    setLoading(true)
    setPreview(null)
    setTropasSeleccionadas([])
    setSelectAll(true)

    try {
      const res = await fetch('/api/reportes-sigica/exportacion-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          destino,
          tropaIds: [] // traer todas
        })
      })

      const data = await res.json()

      if (data.success) {
        if (data.data.totalMedias === 0) {
          toast.info('No se encontraron tropas bovinas faenadas con romaneos confirmados en esa fecha')
          return
        }
        setPreview(data.data)
        // Seleccionar todas las tropas por defecto
        const todos = data.data.tropas.map((t: TropaResumen) => t.tropaNumero)
        setTropasSeleccionadas(todos)
        toast.success(`Se encontraron ${data.data.totalMedias} medias res en ${data.data.tropas.length} tropas`)
      } else {
        toast.error(data.error || 'Error al buscar tropas')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  // Toggle tropa seleccionada
  const toggleTropa = (numero: number) => {
    setTropasSeleccionadas(prev => {
      if (prev.includes(numero)) {
        return prev.filter(n => n !== numero)
      } else {
        return [...prev, numero]
      }
    })
    setSelectAll(false)
  }

  const toggleAll = () => {
    if (selectAll) {
      setTropasSeleccionadas([])
      setSelectAll(false)
    } else {
      if (preview) {
        setTropasSeleccionadas(preview.tropas.map(t => t.tropaNumero))
        setSelectAll(true)
      }
    }
  }

  // Filtrar registros por tropas seleccionadas
  const registrosFiltrados = preview?.registros.filter(r => tropasSeleccionadas.includes(r.tropa)) || []
  const totalKgFiltrado = registrosFiltrados.reduce((sum, r) => sum + (r.kilos || 0), 0)

  // Descargar CSV
  const descargarCSV = async () => {
    if (tropasSeleccionadas.length === 0) {
      toast.error('Selecciona al menos una tropa')
      return
    }

    setDescargando(true)
    try {
      const params = new URLSearchParams({
        fecha,
        destino,
        tropaIds: tropasSeleccionadas.join(',')
      })

      const res = await fetch(`/api/reportes-sigica/exportacion-csv?${params}`)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
        toast.error(err.error || 'Error al generar CSV')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Extraer filename del header
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename = `Importacion_Faena_${fecha.replace(/-/g, '')}.csv`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?(;|$)/)
        if (match) filename = match[1]
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`CSV descargado: ${registrosFiltrados.length} registros, ${totalKgFiltrado.toFixed(1)} kg`)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al descargar CSV')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
              Exportacion SIGICA
            </h1>
            <p className="text-stone-500">
              Generacion de archivo CSV para importacion a SIGICA (Importacion de Faena)
            </p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg pb-3">
            <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
              <Search className="w-5 h-5 text-stone-500" />
              Parametros de Busqueda
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fecha */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-stone-400" />
                  Fecha de Faena
                </Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-stone-400" />
                  Destino
                </Label>
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINOS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Boton Buscar */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  onClick={buscarTropas}
                  disabled={loading || !fecha}
                  className="w-full bg-stone-800 hover:bg-stone-900"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Buscar Tropas
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p><strong>Formato SIGICA:</strong> El CSV contiene una fila por cada media res (1/2 animal). 
                La clasificacion se arma como "2D - VQ" donde el numero es la denticion y las siglas son el tipo de animal.</p>
                <p className="mt-1"><strong>Destinos:</strong> 106=Consumo Interno, 100=Exportacion UE, 105=Exportacion Otros Paises, 117=Digestor</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {preview && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 rounded-lg">
                      <ClipboardList className="w-5 h-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-800">{preview.tropas.length}</p>
                      <p className="text-xs text-stone-500">Tropas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">{preview.totalMedias}</p>
                      <p className="text-xs text-stone-500">Medias Res</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Package className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-700">
                        {registrosFiltrados.length}
                      </p>
                      <p className="text-xs text-stone-500">Seleccionadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-700">
                        {totalKgFiltrado.toFixed(0)}
                      </p>
                      <p className="text-xs text-stone-500">Kg Totales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seleccion de Tropas */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
                    <ClipboardList className="w-5 h-5 text-stone-500" />
                    Seleccionar Tropas
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={descargarCSV}
                      disabled={descargando || tropasSeleccionadas.length === 0}
                      className="bg-green-600 hover:bg-green-700 text-white border-0"
                    >
                      {descargando ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Descargar CSV ({registrosFiltrados.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectAll && tropasSeleccionadas.length === preview.tropas.length}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Tropa</TableHead>
                      <TableHead>Usuario Faena</TableHead>
                      <TableHead className="text-center">Cabezas</TableHead>
                      <TableHead className="text-center">Romaneos</TableHead>
                      <TableHead className="text-center">Medias</TableHead>
                      <TableHead className="text-right">Kg Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.tropas.map((tropa) => (
                      <TableRow key={tropa.tropaId} className={tropasSeleccionadas.includes(tropa.tropaNumero) ? 'bg-green-50/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={tropasSeleccionadas.includes(tropa.tropaNumero)}
                            onCheckedChange={() => toggleTropa(tropa.tropaNumero)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{tropa.tropaNumero}</TableCell>
                        <TableCell>{tropa.usuarioFaena}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{tropa.cantidadCabezas}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            {tropa.romaneosConfirmados} confirmados
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            {tropa.registros.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {tropa.totalKg.toFixed(1)} kg
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detalle de registros */}
            {registrosFiltrados.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg pb-3">
                  <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
                    <FileSpreadsheet className="w-5 h-5 text-stone-500" />
                    Vista Previa del CSV ({registrosFiltrados.length} registros)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-stone-50">
                        <TableRow>
                          <TableHead>Tropa</TableHead>
                          <TableHead>Especie</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Periodo</TableHead>
                          <TableHead>Clasificacion</TableHead>
                          <TableHead className="text-center">Despiece</TableHead>
                          <TableHead className="text-center">Garón</TableHead>
                          <TableHead className="text-right">Kilos</TableHead>
                          <TableHead className="text-center">Camara</TableHead>
                          <TableHead className="text-center">Destino</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrosFiltrados.map((reg, idx) => (
                          <TableRow key={idx} className="text-sm">
                            <TableCell className="font-medium">{reg.tropa}</TableCell>
                            <TableCell>{reg.especie === '1' ? 'Bovino' : 'Equino'}</TableCell>
                            <TableCell>{reg.fecha}</TableCell>
                            <TableCell>{reg.periodo}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {reg.clasificacion}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{reg.despiece}</TableCell>
                            <TableCell className="text-center font-mono">{reg.garon}</TableCell>
                            <TableCell className="text-right font-mono">{reg.kilos}</TableCell>
                            <TableCell className="text-center">{reg.camara}</TableCell>
                            <TableCell className="text-center">{reg.destino}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Estado vacio */}
        {!preview && !loading && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-stone-300" />
              <h3 className="text-lg font-semibold text-stone-600 mb-2">
                Selecciona una fecha y busca tropas
              </h3>
              <p className="text-stone-400 text-sm max-w-md mx-auto">
                Ingresá la fecha de faena para ver las tropas bovinas con romaneos confirmados 
                y generar el archivo CSV de importacion para SIGICA.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ExportacionSIGICAModule
