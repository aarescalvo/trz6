import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Singleton: reutilizar instancia en desarrollo (sobrevive a HMR)
// En producción también funciona correctamente
// Solo loguear queries en desarrollo; en producción solo errores
const logConfig = process.env.NODE_ENV === 'development' 
  ? ['query', 'error', 'warn'] as const 
  : ['error'] as const

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: logConfig })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
