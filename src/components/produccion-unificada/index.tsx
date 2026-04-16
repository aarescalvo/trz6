'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmpaqueModule } from '@/components/empaque'
import C2ProduccionModule from '@/components/c2-produccion'
import { Package, Scissors, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Operador {
  id: string
  nombre: string
  rol: string
  permisos?: Record<string, boolean>
}

interface ProduccionUnificadaProps {
  operador: Operador
}

export default function ProduccionUnificada({ operador }: ProduccionUnificadaProps) {
  const isAdmin = operador.rol === 'ADMINISTRADOR'
  const puedeDesposte = isAdmin || operador.permisos?.puedeDesposte
  const puedeEmpaque = isAdmin || operador.permisos?.puedeEmpaque

  // Si no tiene ningún permiso, mostrar mensaje
  if (!puedeDesposte && !puedeEmpaque) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-stone-400" />
          <p className="text-lg font-medium text-stone-800">Sin permisos</p>
          <p className="text-sm text-stone-500 mt-2">No tiene permisos para acceder a este módulo</p>
        </CardContent>
      </Card>
    )
  }

  // Si solo tiene un permiso, mostrar directamente ese módulo sin tabs
  if (puedeDesposte && !puedeEmpaque) {
    return <C2ProduccionModule operador={operador} />
  }
  if (!puedeDesposte && puedeEmpaque) {
    return <EmpaqueModule operador={operador} />
  }

  // Tiene ambos permisos, mostrar tabs
  return (
    <div className="space-y-4">
      <Tabs defaultValue="c2" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="c2" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Producción C2
          </TabsTrigger>
          <TabsTrigger value="empaque" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Empaque
          </TabsTrigger>
        </TabsList>
        <TabsContent value="c2">
          <C2ProduccionModule operador={operador} />
        </TabsContent>
        <TabsContent value="empaque">
          <EmpaqueModule operador={operador} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
