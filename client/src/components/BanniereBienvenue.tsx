import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, Rocket } from 'lucide-react'
import { cx } from '../ui'

interface Etape {
  fait: boolean
  titre: string
  lien: string
  action: string
}

/**
 * Guide de démarrage affiché sur le tableau de bord tant que la configuration
 * n'est pas complète (base neuve). Disparaît une fois toutes les étapes faites.
 */
export function BanniereBienvenue({ compteurs, nomUtilisateur }: { compteurs: any; nomUtilisateur?: string }) {
  const etapes: Etape[] = [
    { fait: (compteurs.clients ?? 0) > 0, titre: 'Ajouter un premier client', lien: '/clients', action: 'Clients' },
    { fait: (compteurs.projets ?? 0) > 0, titre: 'Créer un projet', lien: '/projets', action: 'Projets' },
    { fait: (compteurs.chantiers ?? 0) > 0, titre: 'Ouvrir un chantier et planifier', lien: '/chantiers', action: 'Chantiers' },
    { fait: (compteurs.contrats ?? 0) > 0, titre: 'Établir un devis puis un contrat', lien: '/devis', action: 'Devis' },
  ]
  const faites = etapes.filter((e) => e.fait).length
  if (faites === etapes.length) return null

  const prochaine = etapes.find((e) => !e.fait)
  const pct = Math.round((faites / etapes.length) * 100)

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2a4a] via-[#1e2540] to-[#141a2e] p-5 text-white shadow-flottant [animation:surgir_0.4s_ease-out]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-amber-300">
              <Rocket size={17} />
            </span>
            <h2 className="text-lg font-bold">Bienvenue{nomUtilisateur ? `, ${nomUtilisateur.split(' ')[0]}` : ''} 👋</h2>
          </div>
          <p className="text-sm text-slate-300">
            Configurons SIM-BAT pour votre entreprise — {faites} étape{faites > 1 ? 's' : ''} sur {etapes.length} déjà faite{faites > 1 ? 's' : ''}.
          </p>

          {/* Barre de progression */}
          <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>

          {/* Étapes */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {etapes.map((e, i) => (
              <Link
                key={i}
                to={e.lien}
                className={cx(
                  'group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-all',
                  e.fait
                    ? 'border-white/5 bg-white/[0.03] text-slate-400'
                    : 'border-white/10 bg-white/[0.06] text-white hover:border-amber-400/40 hover:bg-white/10'
                )}
              >
                {e.fait ? (
                  <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                ) : (
                  <Circle size={16} className="shrink-0 text-slate-400 group-hover:text-amber-300" />
                )}
                <span className={cx('flex-1', e.fait && 'line-through')}>{e.titre}</span>
                {!e.fait && <ArrowRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
              </Link>
            ))}
          </div>
        </div>

        {prochaine && (
          <Link to={prochaine.lien} className="btn-primaire shrink-0 !bg-white !bg-none !text-slate-900 shadow-lg hover:!brightness-95">
            Commencer : {prochaine.action}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </div>
  )
}
