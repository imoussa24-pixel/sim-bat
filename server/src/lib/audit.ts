import type { Request } from 'express'
import { prisma } from '../db'

/** Journal d'audit : qui a fait quoi, quand. Ne bloque jamais la requête. */
export function auditer(req: Request, action: string, entite: string, entiteId?: string, details?: string) {
  const user = (req as any).user
  prisma.auditLog
    .create({
      data: {
        userId: user?.id ?? null,
        userNom: user?.nom ?? null,
        action,
        entite,
        entiteId: entiteId ?? null,
        details: details ? details.slice(0, 1000) : null,
      },
    })
    .catch(() => {})
}
