'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IngresoDespostadaModule } from '@/components/ingreso-despostada'
import C2IngresoDesposteModule from '@/components/c2-ingreso-desposte'
import { Package, Scissors } from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
  permisos?: Record<string, boolean>
}

interface IngresoDesposteUnificadoProps {
  operador: Operador
}

export default function IngresoDesposteUnificado({ operador }: IngresoDesposteUnificadoProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="medias" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="medias" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Medias Res
          </TabsTrigger>
          <TabsTrigger value="cuartos" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Cuartos C2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="medias">
          <IngresoDespostadaModule operador={operador} />
        </TabsContent>
        <TabsContent value="cuartos">
          <C2IngresoDesposteModule operador={operador} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
