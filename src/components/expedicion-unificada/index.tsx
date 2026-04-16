'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpedicionModule } from '@/components/expedicion'
import C2ExpedicionModule from '@/components/c2-expedicion'
import { Beef, Package } from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
  permisos?: Record<string, boolean>
}

interface ExpedicionUnificadaProps {
  operador: Operador
}

export default function ExpedicionUnificada({ operador }: ExpedicionUnificadaProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="medias" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="medias" className="flex items-center gap-2">
            <Beef className="w-4 h-4" />
            Medias Res
          </TabsTrigger>
          <TabsTrigger value="cajas" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Cajas C2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="medias">
          <ExpedicionModule operador={operador} />
        </TabsContent>
        <TabsContent value="cajas">
          <C2ExpedicionModule operador={operador} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
