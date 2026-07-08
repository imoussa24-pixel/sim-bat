import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Search, X } from 'lucide-react'
import { COULEURS_STATUT, couleurProgression } from './lib/statuts'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ────────────────────────────── Badge statut ────────────────────────────────

export function Badge({ statut, className }: { statut: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        COULEURS_STATUT[statut] ?? 'bg-slate-200 text-slate-600',
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
        className={cx('carte w-full p-0 shadow-2xl [animation:surgir_0.28s_cubic-bezier(0.22,1,0.36,1)]', large ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">{titre}</h3>
          <button onClick={onFermer} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pied && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{pied}</div>}
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
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border',
            actif === o.valeur
              ? 'bg-primaire text-white border-primaire'
              : 'bg-white text-slate-600 border-slate-200 hover:border-primaire hover:text-primaire'
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
}

export function Tableau<T extends { id: string }>({
  colonnes,
  lignes,
  vide,
  surClic,
}: {
  colonnes: Colonne<T>[]
  lignes: T[]
  vide?: string
  surClic?: (ligne: T) => void
}) {
  return (
    <div className="carte overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
            {colonnes.map((c, i) => (
              <th key={i} className={cx('px-4 py-3 font-medium', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={c.largeur ? { width: c.largeur } : undefined}>
                {c.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.length === 0 && (
            <tr>
              <td colSpan={colonnes.length} className="px-4 py-10 text-center text-sm text-slate-400">
                {vide ?? 'Aucun élément à afficher.'}
              </td>
            </tr>
          )}
          {lignes.map((l) => (
            <tr
              key={l.id}
              className={cx('border-b border-slate-100 last:border-0 hover:bg-slate-50/60', surClic && 'cursor-pointer')}
              onClick={surClic ? () => surClic(l) : undefined}
            >
              {colonnes.map((c, i) => (
                <td key={i} className={cx('px-4 py-2.5 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                  {c.rendu(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner',
            couleur ?? 'bg-blue-50 text-primaire'
          )}
        >
          {icone}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{titre}</div>
        <div className="flex items-baseline gap-2">
          <div className="truncate text-xl font-bold text-slate-800">
            {typeof valeur === 'number' ? <ValeurCompteur valeur={valeur} /> : valeur}
          </div>
          {tendance != null && isFinite(tendance) && (
            <span
              className={cx(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                tendance >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              )}
            >
              {tendance >= 0 ? '▲' : '▼'} {Math.abs(Math.round(tendance))} %
            </span>
          )}
        </div>
        {sous && <div className="text-xs text-slate-400">{sous}</div>}
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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-sm text-slate-500">{sousTitre}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
