import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from './db'
import { config } from './config'
import { ApiError, h } from './lib/http'
import { auditer } from './lib/audit'

export type Role = 'ADMIN' | 'CHEF_PROJET' | 'CONDUCTEUR' | 'COMPTABLE' | 'MAGASINIER' | 'LECTURE'

export const ROLES: Record<Role, string> = {
  ADMIN: 'Administrateur',
  CHEF_PROJET: 'Chef de projet',
  CONDUCTEUR: 'Conducteur de travaux',
  COMPTABLE: 'Comptable',
  MAGASINIER: 'Magasinier',
  LECTURE: 'Lecture seule',
}

export interface JwtUser {
  id: string
  nom: string
  email: string
  role: Role
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser
    }
  }
}

function genererAccessToken(u: JwtUser) {
  return jwt.sign(u, config.jwtSecret, { expiresIn: config.accessTokenDuree } as jwt.SignOptions)
}

async function genererRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + config.refreshTokenDureeJours * 86400000)
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } })
  return token
}

/** Middleware : exige un JWT valide (Bearer ou ?token= pour les téléchargements). */
export function authRequis(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token && typeof req.query.token === 'string') token = req.query.token
  if (!token) return res.status(401).json({ message: 'Authentification requise.' })
  try {
    const user = jwt.verify(token, config.jwtSecret) as JwtUser
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter.' })
  }
}

/** Vérifie que l'utilisateur a l'un des rôles requis (ADMIN passe toujours). */
export function verifierRole(req: Request, roles: Role[]) {
  const user = req.user
  if (!user) throw new ApiError(401, 'Authentification requise.')
  if (user.role === 'ADMIN') return
  if (user.role === 'LECTURE' || !roles.includes(user.role)) {
    throw new ApiError(403, "Vous n'avez pas les droits nécessaires pour cette action.")
  }
}

export const routerAuth = Router()

// Anti force brute : 5 échecs max par email+IP, blocage 15 minutes
const tentativesEchouees = new Map<string, { n: number; bloqueJusqua: number }>()

function verifierTentatives(cle: string) {
  const t = tentativesEchouees.get(cle)
  if (t && t.bloqueJusqua > Date.now()) {
    const minutes = Math.ceil((t.bloqueJusqua - Date.now()) / 60000)
    throw new ApiError(429, `Trop de tentatives. Réessayez dans ${minutes} minute(s).`)
  }
}

function enregistrerEchec(cle: string) {
  const t = tentativesEchouees.get(cle) ?? { n: 0, bloqueJusqua: 0 }
  t.n += 1
  if (t.n >= 5) {
    t.bloqueJusqua = Date.now() + 15 * 60000
    t.n = 0
  }
  tentativesEchouees.set(cle, t)
}

setInterval(() => {
  const maintenant = Date.now()
  for (const [cle, t] of tentativesEchouees) {
    if (t.bloqueJusqua < maintenant && t.n === 0) tentativesEchouees.delete(cle)
  }
}, 30 * 60000).unref?.()

routerAuth.post(
  '/connexion',
  h(async (req, res) => {
    const { email, motDePasse } = z
      .object({ email: z.string().email('Email invalide'), motDePasse: z.string().min(1, 'Mot de passe requis') })
      .parse(req.body)
    const cleTentative = `${email}|${req.ip}`
    verifierTentatives(cleTentative)
    const user = await prisma.utilisateur.findFirst({ where: { email, deletedAt: null, actif: true } })
    if (!user || !(await bcrypt.compare(motDePasse, user.motDePasseHash))) {
      enregistrerEchec(cleTentative)
      throw new ApiError(401, 'Email ou mot de passe incorrect.')
    }
    tentativesEchouees.delete(cleTentative)
    const jwtUser: JwtUser = { id: user.id, nom: user.nom, email: user.email, role: user.role as Role }
    const accessToken = genererAccessToken(jwtUser)
    const refreshToken = await genererRefreshToken(user.id)
    req.user = jwtUser
    auditer(req, 'LOGIN', 'utilisateur', user.id, `Connexion de ${user.nom}`)
    res.json({ utilisateur: { ...jwtUser, roleLibelle: ROLES[jwtUser.role] }, accessToken, refreshToken })
  })
)

routerAuth.post(
  '/rafraichir',
  h(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const stocke = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } })
    if (!stocke || stocke.expiresAt < new Date() || stocke.user.deletedAt || !stocke.user.actif) {
      if (stocke) await prisma.refreshToken.delete({ where: { id: stocke.id } }).catch(() => {})
      throw new ApiError(401, 'Session expirée, veuillez vous reconnecter.')
    }
    // Rotation du refresh token
    await prisma.refreshToken.delete({ where: { id: stocke.id } })
    const u = stocke.user
    const jwtUser: JwtUser = { id: u.id, nom: u.nom, email: u.email, role: u.role as Role }
    res.json({
      utilisateur: { ...jwtUser, roleLibelle: ROLES[jwtUser.role] },
      accessToken: genererAccessToken(jwtUser),
      refreshToken: await genererRefreshToken(u.id),
    })
  })
)

routerAuth.post(
  '/deconnexion',
  h(async (req, res) => {
    const refreshToken = req.body?.refreshToken
    if (typeof refreshToken === 'string' && refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }
    res.json({ message: 'Déconnecté.' })
  })
)

routerAuth.get('/moi', authRequis, (req, res) => {
  const u = req.user!
  res.json({ ...u, roleLibelle: ROLES[u.role] })
})

/** Purge périodique des refresh tokens expirés. */
export async function purgerTokensExpires() {
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
}
