import { Router, type Request } from 'express'
import { z, type ZodTypeAny } from 'zod'
import { prisma } from './db'
import { h, ApiError } from './lib/http'
import { auditer } from './lib/audit'
import { authRequis, verifierRole, type Role } from './auth'

export type TypeChamp = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'enum'

export interface ChampDef {
  type: TypeChamp
  requis?: boolean
  valeurs?: string[] // pour enum
  label?: string
}

export interface EntiteDef {
  /** Segment d'URL : /api/<nom> */
  nom: string
  /** Nom du modèle Prisma (accès prisma[modele]) */
  modele: string
  titre: string
  champs: Record<string, ChampDef>
  rolesEcriture: Role[]
  /** Si défini, restreint aussi la lecture (ADMIN passe toujours) */
  rolesLecture?: Role[]
  /** Champs texte parcourus par la recherche ?q= */
  recherche?: string[]
  /** Champs filtrables par égalité via query string */
  filtres?: string[]
  include?: any
  orderBy?: any
  softDelete?: boolean
  /** Post-traitement des lignes (champs calculés) */
  enrichir?: (rows: any[]) => Promise<any[]>
  /** Transformation des données avant création (numérotation auto, hash…) */
  avantCreer?: (data: any, req: Request) => Promise<any>
  avantModifier?: (data: any, req: Request, existant: any) => Promise<any>
  /** Hook après création/modification/suppression */
  apresMutation?: (row: any, action: 'CREATE' | 'UPDATE' | 'DELETE', req: Request) => Promise<void>
}

function zodPourChamp(def: ChampDef): ZodTypeAny {
  let base: ZodTypeAny
  switch (def.type) {
    case 'number':
      base = z.coerce.number()
      break
    case 'boolean':
      base = z.boolean()
      break
    case 'date':
      base = z.coerce.date()
      break
    case 'enum':
      base = z.enum(def.valeurs as [string, ...string[]])
      break
    default:
      base = z.string()
  }
  if (def.requis) {
    if (def.type === 'string' || def.type === 'text') base = (base as z.ZodString).min(1, 'requis')
    return base
  }
  return base.nullish()
}

function construireSchemas(champs: Record<string, ChampDef>) {
  const forme: Record<string, ZodTypeAny> = {}
  for (const [nom, def] of Object.entries(champs)) forme[nom] = zodPourChamp(def)
  const creation = z.object(forme)
  const modification = creation.partial()
  return { creation, modification }
}

/** Convertit les chaînes vides en null (formulaires HTML) et ignore les champs inconnus. */
function nettoyer(body: any, champs: Record<string, ChampDef>) {
  const out: Record<string, any> = {}
  if (!body || typeof body !== 'object') return out
  for (const cle of Object.keys(champs)) {
    if (!(cle in body)) continue
    let v = body[cle]
    if (v === '') v = null
    out[cle] = v
  }
  return out
}

function texteRecherche(row: any, champs: string[]): string {
  return champs
    .map((c) => {
      const v = c.split('.').reduce((acc: any, k) => (acc == null ? acc : acc[k]), row)
      return v == null ? '' : String(v)
    })
    .join(' ')
    .toLowerCase()
}

export function creerRouteurCrud(def: EntiteDef): Router {
  const router = Router()
  const modele = (prisma as any)[def.modele]
  const { creation, modification } = construireSchemas(def.champs)
  const soft = def.softDelete !== false

  router.use(authRequis)

  if (def.rolesLecture) {
    router.use((req, _res, next) => {
      try {
        const user = req.user
        if (user && user.role !== 'ADMIN' && !def.rolesLecture!.includes(user.role as Role)) {
          throw new ApiError(403, "Vous n'avez pas les droits nécessaires pour consulter ces données.")
        }
        next()
      } catch (e) {
        next(e)
      }
    })
  }

  // Liste : GET /?q=&<filtre>=
  router.get(
    '/',
    h(async (req, res) => {
      const where: any = soft ? { deletedAt: null } : {}
      for (const f of def.filtres ?? []) {
        const v = req.query[f]
        if (typeof v === 'string' && v !== '') where[f] = v
      }
      let rows: any[] = await modele.findMany({
        where,
        include: def.include,
        orderBy: def.orderBy ?? { createdAt: 'desc' },
      })
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
      if (q && def.recherche?.length) {
        rows = rows.filter((r) => texteRecherche(r, def.recherche!).includes(q))
      }
      if (def.enrichir) rows = await def.enrichir(rows)
      res.json(rows)
    })
  )

  // Détail : GET /:id
  router.get(
    '/:id',
    h(async (req, res) => {
      const row = await modele.findFirst({
        where: soft ? { id: req.params.id, deletedAt: null } : { id: req.params.id },
        include: def.include,
      })
      if (!row) throw new ApiError(404, `${def.titre} introuvable.`)
      const [enrichi] = def.enrichir ? await def.enrichir([row]) : [row]
      res.json(enrichi)
    })
  )

  // Création : POST /
  router.post(
    '/',
    h(async (req, res) => {
      verifierRole(req, def.rolesEcriture)
      let data = creation.parse(nettoyer(req.body, def.champs))
      if (def.avantCreer) data = await def.avantCreer(data, req)
      const row = await modele.create({ data, include: def.include })
      auditer(req, 'CREATE', def.nom, row.id, JSON.stringify(data).slice(0, 500))
      if (def.apresMutation) await def.apresMutation(row, 'CREATE', req)
      const [enrichi] = def.enrichir ? await def.enrichir([row]) : [row]
      res.status(201).json(enrichi)
    })
  )

  // Modification : PUT /:id
  router.put(
    '/:id',
    h(async (req, res) => {
      verifierRole(req, def.rolesEcriture)
      const existant = await modele.findFirst({
        where: soft ? { id: req.params.id, deletedAt: null } : { id: req.params.id },
      })
      if (!existant) throw new ApiError(404, `${def.titre} introuvable.`)
      let data = modification.parse(nettoyer(req.body, def.champs))
      if (def.avantModifier) data = await def.avantModifier(data, req, existant)
      const row = await modele.update({ where: { id: req.params.id }, data, include: def.include })
      auditer(req, 'UPDATE', def.nom, row.id, JSON.stringify(data).slice(0, 500))
      if (def.apresMutation) await def.apresMutation(row, 'UPDATE', req)
      const [enrichi] = def.enrichir ? await def.enrichir([row]) : [row]
      res.json(enrichi)
    })
  )

  // Suppression : DELETE /:id (soft delete par défaut)
  router.delete(
    '/:id',
    h(async (req, res) => {
      verifierRole(req, def.rolesEcriture)
      const existant = await modele.findFirst({
        where: soft ? { id: req.params.id, deletedAt: null } : { id: req.params.id },
      })
      if (!existant) throw new ApiError(404, `${def.titre} introuvable.`)
      const row = soft
        ? await modele.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
        : await modele.delete({ where: { id: req.params.id } })
      auditer(req, 'DELETE', def.nom, req.params.id)
      if (def.apresMutation) await def.apresMutation(row, 'DELETE', req)
      res.json({ message: 'Supprimé.' })
    })
  )

  return router
}
