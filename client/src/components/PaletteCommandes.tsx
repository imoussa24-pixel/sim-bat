import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, CornerDownLeft, FileText, FolderKanban, HardHat, Loader2,
  Receipt, Search, Truck, User, Users, LayoutDashboard, CalendarRange, Package, Wallet,
} from 'lucide-react'
import { get } from '../lib/api'
import { cx } from '../ui'

interface Entree {
  type: string
  id?: string
  titre: string
  sous?: string
  lien: string
}

const PAGES: Entree[] = [
  { type: 'page', titre: 'Tableau de bord', lien: '/' },
  { type: 'page', titre: 'Clients', lien: '/clients' },
  { type: 'page', titre: 'Projets', lien: '/projets' },
  { type: 'page', titre: 'Chantiers', lien: '/chantiers' },
  { type: 'page', titre: 'Planification', lien: '/planification' },
  { type: 'page', titre: 'Tâches', lien: '/taches' },
  { type: 'page', titre: 'Employés', lien: '/employes' },
  { type: 'page', titre: 'Matériels', lien: '/materiels' },
  { type: 'page', titre: 'Mouvements matériel', lien: '/mouvements-materiel' },
  { type: 'page', titre: 'Stock matériaux', lien: '/stock' },
  { type: 'page', titre: 'Maintenance', lien: '/maintenance' },
  { type: 'page', titre: 'Devis', lien: '/devis' },
  { type: 'page', titre: 'Factures', lien: '/factures' },
  { type: 'page', titre: 'Dépenses', lien: '/depenses' },
  { type: 'page', titre: 'Paiements', lien: '/paiements' },
  { type: 'page', titre: 'Analyse statistique', lien: '/analyse' },
]

const LIBELLES: Record<string, string> = {
  page: 'Navigation',
  client: 'Clients',
  projet: 'Projets',
  chantier: 'Chantiers',
  devis: 'Devis',
  facture: 'Factures',
  employe: 'Employés',
  materiel: 'Matériels',
}

const ICONES: Record<string, React.ReactNode> = {
  page: <LayoutDashboard size={15} />,
  client: <Users size={15} />,
  projet: <FolderKanban size={15} />,
  chantier: <HardHat size={15} />,
  devis: <FileText size={15} />,
  facture: <Receipt size={15} />,
  employe: <User size={15} />,
  materiel: <Truck size={15} />,
}

function lienPour(r: { type: string; id: string; titre: string }): string {
  switch (r.type) {
    case 'chantier':
      return `/planification/${r.id}`
    case 'devis':
      return `/devis/${r.id}`
    case 'client':
      return `/clients?q=${encodeURIComponent(r.titre)}`
    case 'projet':
      return `/projets?q=${encodeURIComponent(r.titre)}`
    case 'facture':
      return `/factures?q=${encodeURIComponent(r.titre.split(' — ')[0])}`
    case 'employe':
      return `/employes?q=${encodeURIComponent(r.titre)}`
    case 'materiel':
      return `/materiels?q=${encodeURIComponent(r.titre)}`
    default:
      return '/'
  }
}

export function PaletteCommandes({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [resultatsApi, setResultatsApi] = useState<Entree[]>([])
  const [chargement, setChargement] = useState(false)
  const [index, setIndex] = useState(0)
  const refInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ouverte) {
      setQ('')
      setResultatsApi([])
      setIndex(0)
      setTimeout(() => refInput.current?.focus(), 50)
    }
  }, [ouverte])

  // Recherche API debouncée
  useEffect(() => {
    if (!ouverte || q.trim().length < 2) {
      setResultatsApi([])
      return
    }
    setChargement(true)
    const minuteur = setTimeout(async () => {
      try {
        const rows = await get<any[]>(`/api/recherche?q=${encodeURIComponent(q)}`)
        setResultatsApi(rows.map((r) => ({ ...r, lien: lienPour(r) })))
      } catch {
        setResultatsApi([])
      } finally {
        setChargement(false)
      }
    }, 220)
    return () => clearTimeout(minuteur)
  }, [q, ouverte])

  const entrees = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const pages = ql
      ? PAGES.filter((p) => p.titre.toLowerCase().includes(ql)).slice(0, 5)
      : PAGES.slice(0, 6)
    return [...pages, ...resultatsApi]
  }, [q, resultatsApi])

  useEffect(() => setIndex(0), [entrees.length])

  const executer = useCallback(
    (e: Entree) => {
      onFermer()
      navigate(e.lien)
    },
    [navigate, onFermer]
  )

  useEffect(() => {
    if (!ouverte) return
    const clavier = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onFermer()
      else if (ev.key === 'ArrowDown') {
        ev.preventDefault()
        setIndex((i) => Math.min(entrees.length - 1, i + 1))
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (ev.key === 'Enter' && entrees[index]) {
        ev.preventDefault()
        executer(entrees[index])
      }
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [ouverte, entrees, index, executer, onFermer])

  if (!ouverte) return null

  // Groupement par type dans l'ordre d'apparition
  const groupes: { type: string; items: { entree: Entree; idx: number }[] }[] = []
  entrees.forEach((e, idx) => {
    let g = groupes.find((x) => x.type === e.type)
    if (!g) {
      g = { type: e.type, items: [] }
      groupes.push(g)
    }
    g.items.push({ entree: e, idx })
  })

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-900/55 p-4 pt-[12vh] backdrop-blur-[2px] [animation:fondu_0.15s_ease-out]"
      onMouseDown={onFermer}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl [animation:surgir_0.22s_cubic-bezier(0.22,1,0.36,1)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          {chargement ? <Loader2 size={17} className="animate-spin text-primaire" /> : <Search size={17} className="text-slate-400" />}
          <input
            ref={refInput}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Rechercher un client, chantier, facture… ou naviguer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Échap</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto py-1.5">
          {entrees.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {q.length >= 2 ? 'Aucun résultat.' : 'Tapez au moins 2 caractères pour chercher dans les données.'}
            </div>
          )}
          {groupes.map((g) => (
            <div key={g.type}>
              <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {LIBELLES[g.type] ?? g.type}
              </div>
              {g.items.map(({ entree, idx }) => (
                <button
                  key={`${entree.type}-${entree.id ?? entree.lien}`}
                  className={cx(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                    idx === index ? 'bg-blue-50 text-primaire' : 'text-slate-700 hover:bg-slate-50'
                  )}
                  onMouseEnter={() => setIndex(idx)}
                  onClick={() => executer(entree)}
                >
                  <span className={cx('shrink-0', idx === index ? 'text-primaire' : 'text-slate-400')}>
                    {ICONES[entree.type] ?? <ArrowRight size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entree.titre}</span>
                    {entree.sous && <span className="block truncate text-xs text-slate-400">{entree.sous}</span>}
                  </span>
                  {idx === index && <CornerDownLeft size={13} className="shrink-0 text-slate-300" />}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] text-slate-400">
          <span><kbd className="font-semibold">↑↓</kbd> naviguer</span>
          <span><kbd className="font-semibold">Entrée</kbd> ouvrir</span>
          <span className="ml-auto">Recherche globale SIM-BAT</span>
        </div>
      </div>
    </div>
  )
}
