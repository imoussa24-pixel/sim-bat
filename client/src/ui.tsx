import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, CheckCircle2, Inbox, Loader2, Search, X } from 'lucide-react'
import { COULEURS_STATUT, couleurProgression } from './lib/statuts'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ────────────────────────────── Badge statut ────────────────────────────────

export function Badge({ statut, className }: { statut: string; className?: string }) {
  return (
    <span
      className={cx(
        'pilule ring-1 ring-inset ring-black/[0.04]',
        COULEURS_STATUT[statut] ?? 'bg-slate-100 text-slate-600',
        className
      )}
    >
      {statut}
    </span>
  )
}

// ─────────────────────────── Barre de progression ───────────────────────────

export function BarreProgression({
  valeur,
  statut,
  className,
}: {
  valeur: number
  statut?: string
  className?: string
}) {
  const v = Math.min(100, Math.max(0, valeur ?? 0))
  const [largeur, setLargeur] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLargeur(v)))
    return () => cancelAnimationFrame(raf)
  }, [v])
  return (
    <div className={cx('h-1.5 w-full rounded-full bg-slate-200 overflow-hidden', className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out', couleurProgression(v, statut))}
        style={{ width: `${largeur}%` }}
      />
    </div>
  )
}

/** Compteur animé (ease-out cubique) pour les KPI numériques. */
export function useCompteur(valeur: number, duree = 800): number {
  const [affiche, setAffiche] = useState(0)
  useEffect(() => {
    let raf = 0
    const debut = performance.now()
    const animer = (t: number) => {
      const p = Math.min(1, (t - debut) / duree)
      setAffiche(valeur * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(animer)
    }
    raf = requestAnimationFrame(animer)
    return () => cancelAnimationFrame(raf)
  }, [valeur, duree])
  return affiche
}

// ────────────────────────────────── Modal ───────────────────────────────────

export function Modal({
  titre,
  ouvert,
  onFermer,
  children,
  large,
  pied,
}: {
  titre: React.ReactNode
  ouvert: boolean
  onFermer: () => void
  children: React.ReactNode
  large?: boolean
  pied?: React.ReactNode
}) {
  useEffect(() => {
    if (!ouvert) return
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [ouvert, onFermer])
  if (!ouvert) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 pt-12 backdrop-blur-[2px] [animation:fondu_0.2s_ease-out]"
      onMouseDown={onFermer}
    >
      <div
        className={cx('carte w-full p-0 shadow-flottant [animation:surgir_0.28s_cubic-bezier(0.22,1,0.36,1)]', large ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-slate-800">{titre}</h3>
          <button onClick={onFermer} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pied && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{pied}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────── Confirmation suppression ───────────────────────

export function ConfirmSuppression({
  ouvert,
  onFermer,
  onConfirmer,
  message,
}: {
  ouvert: boolean
  onFermer: () => void
  onConfirmer: () => void | Promise<void>
  message?: string
}) {
  const [enCours, setEnCours] = useState(false)
  return (
    <Modal titre="Confirmer la suppression" ouvert={ouvert} onFermer={onFermer}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-2 text-red-600">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-700">{message ?? 'Voulez-vous vraiment supprimer cet élément ?'}</p>
          <p className="mt-1 text-xs text-slate-500">Cette action peut être annulée par un administrateur (suppression douce).</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-discret" onClick={onFermer}>
          Annuler
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
          disabled={enCours}
          onClick={async () => {
            setEnCours(true)
            try {
              await onConfirmer()
              onFermer()
            } finally {
              setEnCours(false)
            }
          }}
        >
          {enCours && <Loader2 size={14} className="animate-spin" />}
          Supprimer
        </button>
      </div>
    </Modal>
  )
}

// ──────────────────────────────── Champs ────────────────────────────────────

export function Champ({
  label,
  children,
  requis,
  colSpan,
}: {
  label: string
  children: React.ReactNode
  requis?: boolean
  colSpan?: number
}) {
  return (
    <div style={colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined}>
      <label className="etiquette">
        {label} {requis && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─────────────────────────────── Recherche ──────────────────────────────────

export function Recherche({
  valeur,
  onChange,
  placeholder,
}: {
  valeur: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="champ pl-9 w-64"
        placeholder={placeholder ?? 'Rechercher…'}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ────────────────────────────── Onglets pilules ─────────────────────────────

export function OngletsPilules({
  options,
  actif,
  onChange,
}: {
  options: { valeur: string; label: string; compteur?: number }[]
  actif: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.valeur}
          onClick={() => onChange(o.valeur)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
            actif === o.valeur
              ? 'border-primaire bg-primaire text-white shadow-bouton'
              : 'border-slate-200 bg-white text-slate-600 hover:border-primaire/50 hover:text-primaire'
          )}
        >
          {o.label}
          {o.compteur != null && (
            <span
              className={cx(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                actif === o.valeur ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
              {o.compteur}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ──────────────────────────────── Tableau ───────────────────────────────────

export interface Colonne<T> {
  titre: string
  rendu: (ligne: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  largeur?: string
  /** Fournir une valeur de tri rend l'en-tête cliquable pour trier sur cette colonne. */
  tri?: (ligne: T) => string | number | null | undefined
}

export function Tableau<T extends { id: string }>({
  colonnes,
  lignes,
  vide,
  surClic,
  selection,
  onSelection,
}: {
  colonnes: Colonne<T>[]
  lignes: T[]
  vide?: string
  surClic?: (ligne: T) => void
  /** Ensemble d'identifiants sélectionnés (active la colonne de cases à cocher). */
  selection?: Set<string>
  onSelection?: (nouvelle: Set<string>) => void
}) {
  const [triCol, setTriCol] = useState<number | null>(null)
  const [triDesc, setTriDesc] = useState(false)

  const lignesTriees = useMemo(() => {
    if (triCol == null || !colonnes[triCol]?.tri) return lignes
    const val = colonnes[triCol].tri!
    return [...lignes].sort((a, b) => {
      const va = val(a) ?? '',
        vb = val(b) ?? ''
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * (triDesc ? -1 : 1)
      return String(va).localeCompare(String(vb), 'fr', { numeric: true }) * (triDesc ? -1 : 1)
    })
  }, [lignes, triCol, triDesc, colonnes])

  const cliquerTri = (i: number) => {
    if (!colonnes[i].tri) return
    if (triCol === i) setTriDesc((d) => !d)
    else {
      setTriCol(i)
      setTriDesc(false)
    }
  }

  const selectionnable = !!selection && !!onSelection
  const idsVisibles = lignesTriees.map((l) => l.id)
  const toutSelectionne = selectionnable && idsVisibles.length > 0 && idsVisibles.every((id) => selection!.has(id))

  return (
    <div className="carte overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            {selectionnable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primaire focus:ring-blue-200"
                  checked={toutSelectionne}
                  onChange={() => {
                    const n = new Set(selection!)
                    if (toutSelectionne) idsVisibles.forEach((id) => n.delete(id))
                    else idsVisibles.forEach((id) => n.add(id))
                    onSelection!(n)
                  }}
                />
              </th>
            )}
            {colonnes.map((c, i) => (
              <th
                key={i}
                className={cx('px-4 py-3 select-none', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.tri && 'cursor-pointer transition-colors hover:text-slate-700')}
                style={c.largeur ? { width: c.largeur } : undefined}
                onClick={() => cliquerTri(i)}
              >
                <span className={cx('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                  {c.titre}
                  {c.tri &&
                    (triCol === i ? (
                      triDesc ? <ArrowDown size={12} className="text-primaire" /> : <ArrowUp size={12} className="text-primaire" />
                    ) : (
                      <ChevronsUpDown size={12} className="opacity-30" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignesTriees.length === 0 && (
            <tr>
              <td colSpan={colonnes.length + (selectionnable ? 1 : 0)} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Inbox size={26} className="text-slate-300" />
                  <span className="text-sm">{vide ?? 'Aucun élément à afficher.'}</span>
                </div>
              </td>
            </tr>
          )}
          {lignesTriees.map((l) => {
            const coche = selectionnable && selection!.has(l.id)
            return (
              <tr
                key={l.id}
                className={cx(
                  'border-b border-slate-50 last:border-0 transition-colors',
                  coche ? 'bg-primaire-50/60' : 'hover:bg-primaire-50/40',
                  surClic && 'cursor-pointer'
                )}
                onClick={surClic ? () => surClic(l) : undefined}
              >
                {selectionnable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primaire focus:ring-blue-200"
                      checked={coche}
                      onChange={() => {
                        const n = new Set(selection!)
                        n.has(l.id) ? n.delete(l.id) : n.add(l.id)
                        onSelection!(n)
                      }}
                    />
                  </td>
                )}
                {colonnes.map((c, i) => (
                  <td key={i} className={cx('px-4 py-3 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                    {c.rendu(l)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────── État vide ──────────────────────────────────

/** État vide guidé : icône + message + action, pour orienter l'utilisateur. */
export function EtatVide({
  icone,
  titre,
  description,
  action,
}: {
  icone?: React.ReactNode
  titre: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="carte flex flex-col items-center gap-3 px-6 py-14 text-center [animation:apparition_0.4s_ease-out]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-primaire ring-1 ring-inset ring-blue-100">
        {icone ?? <Inbox size={26} />}
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">{titre}</h3>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

// ────────────────────────────── Carte KPI ───────────────────────────────────

function ValeurCompteur({ valeur }: { valeur: number }) {
  const affiche = useCompteur(valeur)
  return <>{Math.round(affiche).toLocaleString('fr-FR').replace(/ | /g, ' ')}</>
}

export function CarteKpi({
  titre,
  valeur,
  icone,
  couleur,
  sous,
  tendance,
}: {
  titre: string
  valeur: React.ReactNode
  icone?: React.ReactNode
  couleur?: string
  sous?: React.ReactNode
  /** Variation vs période précédente, en % (affiche ↑/↓ coloré) */
  tendance?: number | null
}) {
  return (
    <div className="carte carte-interactive flex items-center gap-4 p-4">
      {icone && (
        <div
          className={cx(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-black/[0.03]',
            couleur ?? 'bg-blue-50 text-primaire'
          )}
        >
          {icone}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{titre}</div>
        <div className="flex items-baseline gap-2">
          <div className="tabnum truncate text-2xl font-extrabold tracking-tight2 text-slate-800">
            {typeof valeur === 'number' ? <ValeurCompteur valeur={valeur} /> : valeur}
          </div>
          {tendance != null && isFinite(tendance) && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                tendance >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              )}
            >
              {tendance >= 0 ? '▲' : '▼'} {Math.abs(Math.round(tendance))} %
            </span>
          )}
        </div>
        {sous && <div className="mt-0.5 text-xs text-slate-400">{sous}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────── Chargement ─────────────────────────────────

export function Chargement({ texte }: { texte?: string }) {
  return (
    <div className="animation-page">
      <div className="mb-4 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="carte flex items-center gap-3 p-4">
            <div className="squelette h-10 w-10 shrink-0 !rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="squelette h-2.5 w-2/3" />
              <div className="squelette h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="carte p-4">
        <div className="squelette mb-3 h-3 w-40" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="squelette mb-2.5 h-8 w-full" style={{ opacity: 1 - i * 0.13 }} />
        ))}
        <div className="flex items-center justify-center gap-2 pt-3 text-slate-400">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-xs">{texte ?? 'Chargement…'}</span>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────── Toasts ────────────────────────────────────

interface Toast {
  id: number
  type: 'succes' | 'erreur'
  message: string
}

const ToastContexte = createContext<{ notifier: (type: Toast['type'], message: string) => void }>({
  notifier: () => {},
})

export function useToast() {
  return useContext(ToastContexte)
}

export function FournisseurToasts({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const compteur = useRef(0)
  const notifier = useCallback((type: Toast['type'], message: string) => {
    const id = ++compteur.current
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastContexte.Provider value={{ notifier }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-xl [animation:glisserGauche_0.35s_cubic-bezier(0.22,1,0.36,1)]',
              t.type === 'succes' ? 'bg-slate-800/95 backdrop-blur' : 'bg-red-600/95 backdrop-blur'
            )}
          >
            {t.type === 'succes' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContexte.Provider>
  )
}

// ─────────────────────────── En-tête de page ────────────────────────────────

export function EnTetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string
  sousTitre?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-[1.65rem] font-extrabold tracking-tight2 text-slate-900">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-slate-500">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
