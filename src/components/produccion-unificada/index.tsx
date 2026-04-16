'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmpaqueModule } from '@/components/empaque'
import C2ProduccionModule from '@/components/c2-produccion'
import { Package, Scissors } from 'lucide-react'

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
