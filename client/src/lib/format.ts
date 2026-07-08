/** Format monétaire FCFA : 6 709 998 F (séparateur de milliers = espace). */
export function fcfa(montant: number | null | undefined): string {
  if (montant == null || isNaN(montant)) return '0 F'
  const signe = montant < 0 ? '-' : ''
  const entier = Math.round(Math.abs(montant)).toString()
  return `${signe}${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`
}

/** Format compact pour les axes : 12,5 M */
export function fcfaCompact(montant: number): string {
  if (Math.abs(montant) >= 1_000_000) return `${(montant / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (Math.abs(montant) >= 1_000) return `${Math.round(montant / 1_000)} k`
  return String(Math.round(montant))
}

/** Date au format JJ/MM/AAAA. */
export function dateFr(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return '—'
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

/** Date courte JJ/MM. */
export function dateCourte(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
}

/** Valeur pour <input type="date"> : AAAA-MM-JJ. */
export function dateIso(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function pourcent(n: number | null | undefined): string {
  return `${Math.round(n ?? 0)} %`
}

/** Numéro de semaine ISO (S25, S26…). */
export function semaineIso(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const jour = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - jour)
  const debutAnnee = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7)
}

export const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
