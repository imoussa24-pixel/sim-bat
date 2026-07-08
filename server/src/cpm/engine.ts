// ─────────────────────────────────────────────────────────────────────────────
// SIM-BAT — Moteur CPM (Critical Path Method)
// Calcule ES/EF (passe avant), LS/LF (passe arrière), marge totale et chemin
// critique sur un calendrier ouvré configurable (défaut : 6 j/7, dimanche chômé).
// Types de dépendances : FD (fin→début), DD (début→début), FF (fin→fin), DF (début→fin)
// ─────────────────────────────────────────────────────────────────────────────

export type TypeDependance = 'FD' | 'DD' | 'FF' | 'DF'

export interface CalendrierOuvre {
  /** Jours de la semaine travaillés (0 = dimanche … 6 = samedi). Défaut : lundi→samedi */
  joursOuvres: number[]
  /** Jours fériés au format ISO 'AAAA-MM-JJ' */
  feries: string[]
}

export const CALENDRIER_DEFAUT: CalendrierOuvre = {
  joursOuvres: [1, 2, 3, 4, 5, 6],
  feries: [],
}

export interface TacheCpm {
  id: string
  nom?: string
  /** Durée en jours ouvrés (0 pour un jalon) */
  duree: number
  /** Contrainte « ne pas commencer avant » */
  contrainteDebut?: Date | null
}

export interface DependanceCpm {
  predecesseurId: string
  successeurId: string
  type: TypeDependance
  lagJours: number
}

export interface ResultatTache {
  id: string
  es: number
  ef: number
  ls: number
  lf: number
  margeTotale: number
  estCritique: boolean
  dateDebut: Date
  dateFin: Date
}

export interface ResultatCpm {
  taches: ResultatTache[]
  finProjet: Date
  dureeProjetJours: number
  cheminCritique: string[]
}

export class CpmError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CpmError'
  }
}

// ────────────────────────────── Calendrier ──────────────────────────────────

function cleJour(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

function debutJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function estJourOuvre(d: Date, cal: CalendrierOuvre): boolean {
  if (!cal.joursOuvres.includes(d.getDay())) return false
  if (cal.feries.includes(cleJour(d))) return false
  return true
}

/** Premier jour ouvré à partir de `d` (inclus). */
export function prochainJourOuvre(d: Date, cal: CalendrierOuvre): Date {
  let cur = debutJour(d)
  let garde = 0
  while (!estJourOuvre(cur, cal)) {
    cur = new Date(cur.getTime() + 86400000)
    cur = debutJour(cur)
    if (++garde > 3700) throw new CpmError('Calendrier invalide : aucun jour ouvré trouvé sur 10 ans.')
  }
  return cur
}

/** Ajoute `n` jours ouvrés à un jour ouvré donné (n ≥ 0, entier). */
export function ajouterJoursOuvres(depart: Date, n: number, cal: CalendrierOuvre): Date {
  let cur = prochainJourOuvre(depart, cal)
  let restant = Math.round(n)
  while (restant > 0) {
    cur = prochainJourOuvre(new Date(cur.getTime() + 86400000), cal)
    restant--
  }
  return cur
}

/** Nombre de jours ouvrés entre deux dates (index de `fin` si `debut` est le jour 0). */
export function indexJourOuvre(debutProjet: Date, date: Date, cal: CalendrierOuvre): number {
  const d0 = prochainJourOuvre(debutProjet, cal)
  const cible = debutJour(date)
  if (cible.getTime() <= d0.getTime()) return 0
  let idx = 0
  let cur = d0
  let garde = 0
  while (cur.getTime() < cible.getTime()) {
    cur = prochainJourOuvre(new Date(cur.getTime() + 86400000), cal)
    idx++
    if (++garde > 7400) break // ~20 ans de garde-fou
  }
  return idx
}

// ─────────────────────────── Tri topologique ────────────────────────────────

function triTopologique(taches: TacheCpm[], deps: DependanceCpm[]): string[] {
  const ids = new Set(taches.map((t) => t.id))
  const entrants = new Map<string, number>()
  const sortants = new Map<string, string[]>()
  for (const t of taches) {
    entrants.set(t.id, 0)
    sortants.set(t.id, [])
  }
  for (const d of deps) {
    if (!ids.has(d.predecesseurId) || !ids.has(d.successeurId)) continue
    entrants.set(d.successeurId, (entrants.get(d.successeurId) ?? 0) + 1)
    sortants.get(d.predecesseurId)!.push(d.successeurId)
  }
  const file: string[] = []
  for (const [id, n] of entrants) if (n === 0) file.push(id)
  const ordre: string[] = []
  while (file.length) {
    const id = file.shift()!
    ordre.push(id)
    for (const s of sortants.get(id) ?? []) {
      const n = (entrants.get(s) ?? 1) - 1
      entrants.set(s, n)
      if (n === 0) file.push(s)
    }
  }
  if (ordre.length !== taches.length) {
    // Trouver un cycle pour un message explicite
    const dansOrdre = new Set(ordre)
    const restants = taches.filter((t) => !dansOrdre.has(t.id))
    const nomDe = new Map(taches.map((t) => [t.id, t.nom || t.id]))
    const cycle = trouverCycle(restants.map((t) => t.id), sortants)
    const chemin = cycle.map((id) => `« ${nomDe.get(id)} »`).join(' → ')
    throw new CpmError(
      `Cycle de dépendances détecté : ${chemin}. Supprimez une des dépendances pour pouvoir calculer le planning.`
    )
  }
  return ordre
}

function trouverCycle(restants: string[], sortants: Map<string, string[]>): string[] {
  const ensemble = new Set(restants)
  const visite = new Set<string>()
  const pile: string[] = []
  const dansPile = new Set<string>()
  let cycle: string[] = []
  const dfs = (id: string): boolean => {
    visite.add(id)
    pile.push(id)
    dansPile.add(id)
    for (const s of sortants.get(id) ?? []) {
      if (!ensemble.has(s)) continue
      if (dansPile.has(s)) {
        cycle = pile.slice(pile.indexOf(s)).concat(s)
        return true
      }
      if (!visite.has(s) && dfs(s)) return true
    }
    pile.pop()
    dansPile.delete(id)
    return false
  }
  for (const id of restants) {
    if (!visite.has(id) && dfs(id)) break
  }
  return cycle.length ? cycle : restants.slice(0, 3)
}

// ─────────────────────────────── Calcul CPM ─────────────────────────────────

const EPSILON = 1e-6

export function calculerCpm(
  taches: TacheCpm[],
  dependances: DependanceCpm[],
  dateDebutProjet: Date,
  calendrier: CalendrierOuvre = CALENDRIER_DEFAUT
): ResultatCpm {
  if (!taches.length) {
    const d0 = prochainJourOuvre(dateDebutProjet, calendrier)
    return { taches: [], finProjet: d0, dureeProjetJours: 0, cheminCritique: [] }
  }
  if (!calendrier.joursOuvres.length) {
    throw new CpmError('Le calendrier doit comporter au moins un jour ouvré par semaine.')
  }

  const ids = new Set(taches.map((t) => t.id))
  const deps = dependances.filter((d) => ids.has(d.predecesseurId) && ids.has(d.successeurId))
  const ordre = triTopologique(taches, deps)
  const parId = new Map(taches.map((t) => [t.id, t]))
  const entrantsDe = new Map<string, DependanceCpm[]>()
  const sortantsDe = new Map<string, DependanceCpm[]>()
  for (const t of taches) {
    entrantsDe.set(t.id, [])
    sortantsDe.set(t.id, [])
  }
  for (const d of deps) {
    entrantsDe.get(d.successeurId)!.push(d)
    sortantsDe.get(d.predecesseurId)!.push(d)
  }

  const ES = new Map<string, number>()
  const EF = new Map<string, number>()
  const LS = new Map<string, number>()
  const LF = new Map<string, number>()

  // ── Passe avant : dates au plus tôt
  for (const id of ordre) {
    const t = parId.get(id)!
    const duree = Math.max(0, t.duree)
    let es = 0
    if (t.contrainteDebut) {
      es = Math.max(es, indexJourOuvre(dateDebutProjet, t.contrainteDebut, calendrier))
    }
    for (const d of entrantsDe.get(id)!) {
      const p = d.predecesseurId
      const lag = d.lagJours || 0
      let candidat: number
      switch (d.type) {
        case 'DD':
          candidat = ES.get(p)! + lag
          break
        case 'FF':
          candidat = EF.get(p)! + lag - duree
          break
        case 'DF':
          candidat = ES.get(p)! + lag - duree
          break
        case 'FD':
        default:
          candidat = EF.get(p)! + lag
      }
      es = Math.max(es, candidat)
    }
    es = Math.max(0, es)
    ES.set(id, es)
    EF.set(id, es + duree)
  }

  const finProjetIdx = Math.max(...ordre.map((id) => EF.get(id)!), 0)

  // ── Passe arrière : dates au plus tard
  for (const id of [...ordre].reverse()) {
    const t = parId.get(id)!
    const duree = Math.max(0, t.duree)
    let lf = finProjetIdx
    for (const d of sortantsDe.get(id)!) {
      const s = d.successeurId
      const lag = d.lagJours || 0
      let candidat: number
      switch (d.type) {
        case 'DD':
          candidat = LS.get(s)! - lag + duree
          break
        case 'FF':
          candidat = LF.get(s)! - lag
          break
        case 'DF':
          candidat = LF.get(s)! - lag + duree
          break
        case 'FD':
        default:
          candidat = LS.get(s)! - lag
      }
      lf = Math.min(lf, candidat)
    }
    LF.set(id, lf)
    LS.set(id, lf - duree)
  }

  // ── Résultats + conversion en dates calendaires
  const resultats: ResultatTache[] = []
  for (const t of taches) {
    const es = ES.get(t.id)!
    const ef = EF.get(t.id)!
    const ls = LS.get(t.id)!
    const lf = LF.get(t.id)!
    const marge = ls - es
    const estCritique = marge <= EPSILON
    const debutIdx = Math.round(es)
    const finIdx = Math.max(debutIdx, Math.ceil(ef - EPSILON) - 1)
    const dateDebut = ajouterJoursOuvres(dateDebutProjet, debutIdx, calendrier)
    const dateFin =
      t.duree <= 0 ? dateDebut : ajouterJoursOuvres(dateDebutProjet, finIdx, calendrier)
    resultats.push({
      id: t.id,
      es,
      ef,
      ls,
      lf,
      margeTotale: Math.round(marge * 100) / 100,
      estCritique,
      dateDebut,
      dateFin,
    })
  }

  const finProjet = resultats.length
    ? new Date(Math.max(...resultats.map((r) => r.dateFin.getTime())))
    : prochainJourOuvre(dateDebutProjet, calendrier)

  return {
    taches: resultats,
    finProjet,
    dureeProjetJours: finProjetIdx,
    cheminCritique: resultats.filter((r) => r.estCritique).map((r) => r.id),
  }
}

// ──────────────────────── Avancement attendu à date ─────────────────────────

/**
 * Avancement théorique (%) d'une tâche à une date donnée, selon le planning calculé.
 * Sert à détecter les tâches en retard : avancement réel < avancement attendu.
 */
export function avancementAttendu(
  dateDebut: Date | null,
  dateFin: Date | null,
  aujourdHui: Date,
  cal: CalendrierOuvre = CALENDRIER_DEFAUT
): number {
  if (!dateDebut || !dateFin) return 0
  const auj = debutJour(aujourdHui)
  if (auj.getTime() < debutJour(dateDebut).getTime()) return 0
  if (auj.getTime() >= debutJour(dateFin).getTime()) return 100
  const total = indexJourOuvre(dateDebut, dateFin, cal) + 1
  const ecoule = indexJourOuvre(dateDebut, auj, cal)
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((ecoule / total) * 100)))
}
