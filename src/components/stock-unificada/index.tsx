'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StockCamarasModule } from '@/components/stock-camaras'
import C2StockModule from '@/components/c2-stock'
import { Beef, Package } from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
  permisos?: Record<string, boolean>
}

interface StockUnificadaProps {
  operador: Operador
}

export default function StockUnificada({ operador }: StockUnificadaProps) {
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
          <StockCamarasModule operador={operador} />
        </TabsContent>
        <TabsContent value="cajas">
          <C2StockModule operador={operador} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
