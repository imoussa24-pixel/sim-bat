import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { CpmError } from '../cpm/engine'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Enveloppe les handlers async pour propager les erreurs au middleware Express. */
export function h(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

export function middlewareErreurs(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message })
  }
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => `${e.path.join('.')} : ${e.message}`).join(' ; ')
    return res.status(400).json({ message: `Données invalides — ${details}` })
  }
  if (err instanceof CpmError) {
    return res.status(422).json({ message: err.message })
  }
  // Erreurs Prisma courantes
  if (err?.code === 'P2002') {
    return res.status(409).json({ message: 'Conflit : une entrée avec cette valeur unique existe déjà.' })
  }
  if (err?.code === 'P2003') {
    return res.status(409).json({ message: 'Opération impossible : des éléments liés existent encore.' })
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ message: 'Élément introuvable.' })
  }
  console.error(err)
  return res.status(500).json({ message: 'Erreur interne du serveur.' })
}
