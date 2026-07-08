export interface Utilisateur {
  id: string
  nom: string
  email: string
  role: string
  roleLibelle: string
}

interface Session {
  utilisateur: Utilisateur
  accessToken: string
  refreshToken: string
}

const CLE_SESSION = 'simbat_session'

export function lireSession(): Session | null {
  try {
    const brut = localStorage.getItem(CLE_SESSION)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

export function ecrireSession(s: Session | null) {
  if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s))
  else localStorage.removeItem(CLE_SESSION)
  for (const cb of abonnes) cb(s?.utilisateur ?? null)
}

const abonnes = new Set<(u: Utilisateur | null) => void>()
export function surChangementSession(cb: (u: Utilisateur | null) => void) {
  abonnes.add(cb)
  return () => {
    abonnes.delete(cb)
  }
}

export class ApiErreur extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let rafraichissementEnCours: Promise<boolean> | null = null

async function rafraichir(): Promise<boolean> {
  const session = lireSession()
  if (!session?.refreshToken) return false
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = (async () => {
      try {
        const rep = await fetch('/api/auth/rafraichir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        })
        if (!rep.ok) return false
        const donnees = await rep.json()
        ecrireSession(donnees)
        return true
      } catch {
        return false
      } finally {
        rafraichissementEnCours = null
      }
    })()
  }
  return rafraichissementEnCours
}

/** Appel API avec jeton + rafraîchissement automatique sur 401. */
export async function api<T = any>(chemin: string, options: RequestInit = {}, deuxieme = false): Promise<T> {
  const session = lireSession()
  const entetes: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  }
  const rep = await fetch(chemin, { ...options, headers: entetes })
  if (rep.status === 401 && !deuxieme && !chemin.startsWith('/api/auth/connexion')) {
    if (await rafraichir()) return api<T>(chemin, options, true)
    ecrireSession(null)
    throw new ApiErreur(401, 'Session expirée, veuillez vous reconnecter.')
  }
  if (!rep.ok) {
    let message = `Erreur ${rep.status}`
    try {
      const corps = await rep.json()
      if (corps?.message) message = corps.message
    } catch {
      /* réponse non JSON */
    }
    throw new ApiErreur(rep.status, message)
  }
  if (rep.status === 204) return undefined as T
  return rep.json()
}

export const get = <T = any>(chemin: string) => api<T>(chemin)
export const post = <T = any>(chemin: string, corps?: any) =>
  api<T>(chemin, { method: 'POST', body: JSON.stringify(corps ?? {}) })
export const put = <T = any>(chemin: string, corps?: any) =>
  api<T>(chemin, { method: 'PUT', body: JSON.stringify(corps ?? {}) })
export const patch = <T = any>(chemin: string, corps?: any) =>
  api<T>(chemin, { method: 'PATCH', body: JSON.stringify(corps ?? {}) })
export const supprimer = <T = any>(chemin: string) => api<T>(chemin, { method: 'DELETE' })

/** URL de téléchargement authentifiée (exports PDF/Excel). */
export function urlExport(chemin: string): string {
  const session = lireSession()
  const sep = chemin.includes('?') ? '&' : '?'
  return `${chemin}${sep}token=${encodeURIComponent(session?.accessToken ?? '')}`
}
