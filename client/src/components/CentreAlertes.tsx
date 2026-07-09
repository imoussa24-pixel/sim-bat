import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Share2, Sparkles, X } from 'lucide-react'
import { get } from '../lib/api'
import { dateFr } from '../lib/format'
import { cx } from '../ui'

const LIBELLES_TYPE: Record<string, string> = {
  RETARD_TACHE: 'Tâche en retard',
  DEPASSEMENT_FIN: 'Dépassement de délai',
  BUDGET: 'Budget',
  SURCHARGE_RESSOURCE: 'Surcharge ressource',
  STOCK_BAS: 'Stock bas',
  FACTURE_RETARD: 'Facture en retard',
  MAINTENANCE: 'Maintenance',
}

const CLE_VUES = 'simbat_alertes_vues'
const signature = (a: any) => `${a.type}|${a.message}`

function lireVues(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLE_VUES) || '[]'))
  } catch {
    return new Set()
  }
}

export function CentreAlertes() {
  const navigate = useNavigate()
  const [donnees, setDonnees] = useState<{ total: number; hautes: number; alertes: any[] } | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [vues, setVues] = useState<Set<string>>(() => lireVues())
  // Nouvelles alertes figées à l'ouverture (pour garder les tags « Nouveau » pendant la consultation)
  const [nouvellesSession, setNouvellesSession] = useState<Set<string>>(new Set())

  const charger = () => get('/api/alertes/globales').then(setDonnees).catch(() => {})

  useEffect(() => {
    charger()
    const minuteur = setInterval(charger, 90_000) // rafraîchi toutes les 90 s
    return () => clearInterval(minuteur)
  }, [])

  const total = donnees?.total ?? 0

  // Alertes jamais vues (nouvelles depuis la dernière ouverture)
  const nbNouvelles = useMemo(() => {
    if (!donnees) return 0
    return donnees.alertes.filter((a) => !vues.has(signature(a))).length
  }, [donnees, vues])

  const ouvrir = () => {
    setOuvert(true)
    if (donnees) {
      // Fige les nouvelles pour l'affichage, puis marque tout comme vu
      const nouvelles = new Set(donnees.alertes.filter((a) => !vues.has(signature(a))).map(signature))
      setNouvellesSession(nouvelles)
      const toutesSignatures = donnees.alertes.map(signature)
      localStorage.setItem(CLE_VUES, JSON.stringify(toutesSignatures))
      setVues(new Set(toutesSignatures))
    }
  }

  return (
    <>
      <button
        className="relative mx-2 mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-slate-300 transition-all duration-200 hover:translate-x-0.5 hover:bg-white/5 hover:text-white"
        onClick={ouvrir}
        title="Centre d'alertes"
      >
        <span className="relative">
          <Bell size={16} className={cx((total > 0 || nbNouvelles > 0) && 'text-amber-400', nbNouvelles > 0 && 'animate-[pulsationDouce_1.8s_ease-in-out_infinite]')} />
          {total > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </span>
        Alertes
        {nbNouvelles > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
            <Sparkles size={9} /> {nbNouvelles} nouv.
          </span>
        ) : donnees && donnees.hautes > 0 ? (
          <span className="ml-auto rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            {donnees.hautes} critique{donnees.hautes > 1 ? 's' : ''}
          </span>
        ) : null}
      </button>

      {/* Panneau latéral */}
      {ouvert && (
        <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-[1px] [animation:fondu_0.15s_ease-out]" onMouseDown={() => setOuvert(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl [animation:glisserPanneau_0.28s_cubic-bezier(0.22,1,0.36,1)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Bell size={17} className="text-amber-500" />
                <h3 className="text-base font-semibold text-slate-800">Centre d'alertes</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{total}</span>
              </div>
              <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => setOuvert(false)}>
                <X size={18} />
              </button>
            </div>
            {nouvellesSession.size > 0 && (
              <div className="flex items-center gap-1.5 border-b border-green-100 bg-green-50 px-5 py-2 text-xs font-medium text-green-700">
                <Sparkles size={13} />
                {nouvellesSession.size} nouvelle{nouvellesSession.size > 1 ? 's' : ''} alerte{nouvellesSession.size > 1 ? 's' : ''} depuis votre dernière visite
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {!donnees && <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>}
              {donnees && donnees.alertes.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">Aucune alerte — tout est sous contrôle. ✔</p>
              )}
              {donnees?.alertes.map((a, i) => {
                const estNouvelle = nouvellesSession.has(signature(a))
                return (
                  <button
                    key={i}
                    className={cx(
                      'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-transform hover:scale-[1.01]',
                      a.gravite === 'haute' ? 'border-red-200 bg-red-50/80' : 'border-orange-200 bg-orange-50/70'
                    )}
                    onClick={() => {
                      if (a.lien) {
                        setOuvert(false)
                        navigate(a.lien)
                      }
                    }}
                  >
                    <AlertTriangle size={15} className={cx('mt-0.5 shrink-0', a.gravite === 'haute' ? 'text-red-500' : 'text-orange-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {LIBELLES_TYPE[a.type] ?? a.type}
                          {a.chantierNom ? ` — ${a.chantierNom}` : ''}
                        </span>
                        {estNouvelle && (
                          <span className="rounded-full bg-green-500 px-1.5 py-px text-[9px] font-bold text-white">Nouveau</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-700">{a.message}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5">
              <span className="text-[11px] text-slate-400">Actualisation toutes les 90 s</span>
              {donnees && donnees.alertes.length > 0 && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-green-500/25 transition-transform hover:scale-[1.03]"
                  title="Partager le résumé des alertes sur WhatsApp"
                  onClick={() => {
                    const lignes = donnees.alertes
                      .slice(0, 10)
                      .map((a) => `${a.gravite === 'haute' ? '🔴' : '🟠'} ${a.message}`)
                      .join('\n')
                    const texte = `🏗 *SIM-BAT — Alertes chantiers du ${dateFr(new Date())}*\n(${donnees.total} alerte${donnees.total > 1 ? 's' : ''}, dont ${donnees.hautes} critique${donnees.hautes > 1 ? 's' : ''})\n\n${lignes}${donnees.alertes.length > 10 ? `\n… et ${donnees.alertes.length - 10} de plus.` : ''}`
                    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank')
                  }}
                >
                  <Share2 size={13} />
                  Partager sur WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
