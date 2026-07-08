import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink } from 'lucide-react'
import { get, patch } from '../lib/api'
import { dateFr } from '../lib/format'
import { useAuth } from '../auth'
import { BarreProgression, Chargement, EnTetePage, Recherche, cx, useToast } from '../ui'
import { estEnRetard } from '../components/Gantt'

type StatutTache = 'À faire' | 'En cours' | 'En retard' | 'Terminée'

function statutTache(t: any): StatutTache {
  if (t.avancement >= 100) return 'Terminée'
  const gantt = {
    id: t.id, nom: t.nom, duree: t.dureeJours, avancement: t.avancement,
    critique: t.estCritique, jalon: t.estJalon, marge: t.margeTotale,
    debut: t.dateDebut ? new Date(t.dateDebut) : null,
    fin: t.dateFin ? new Date(t.dateFin) : null,
  }
  if (estEnRetard(gantt, new Date())) return 'En retard'
  if (t.avancement > 0) return 'En cours'
  return 'À faire'
}

const COULEUR_STATUT_TACHE: Record<StatutTache, string> = {
  'À faire': 'bg-slate-200 text-slate-600',
  'En cours': 'bg-blue-100 text-blue-700',
  'En retard': 'bg-orange-100 text-orange-700',
  'Terminée': 'bg-green-100 text-green-700',
}

function CelluleAvancement({ tache, onMaj }: { tache: any; onMaj: (v: number) => Promise<void> }) {
  const [valeur, setValeur] = useState(String(Math.round(tache.avancement)))
  const [enCours, setEnCours] = useState(false)
  const modifie = Number(valeur) !== Math.round(tache.avancement)
  return (
    <div className="flex items-center gap-1.5">
      <input
        className="champ !w-16 !px-2 !py-1 text-center text-xs"
        type="number"
        min={0}
        max={100}
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && modifie) {
            setEnCours(true)
            await onMaj(Number(valeur))
            setEnCours(false)
          }
        }}
      />
      {modifie && (
        <button
          className="rounded-lg bg-green-600 p-1 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={enCours}
          title="Enregistrer"
          onClick={async () => {
            setEnCours(true)
            await onMaj(Number(valeur))
            setEnCours(false)
          }}
        >
          <Check size={12} />
        </button>
      )}
    </div>
  )
}

export function Taches() {
  const [taches, setTaches] = useState<any[] | null>(null)
  const [q, setQ] = useState('')
  const [fChantier, setFChantier] = useState('')
  const [fLot, setFLot] = useState('')
  const [fStatut, setFStatut] = useState('')
  const [fResponsable, setFResponsable] = useState('')
  const { notifier } = useToast()
  const { peutEcrire } = useAuth()
  const ecriture = peutEcrire(['CHEF_PROJET', 'CONDUCTEUR'])

  const charger = () => get('/api/taches-transversales').then(setTaches).catch((e) => notifier('erreur', e.message))
  useEffect(() => {
    charger()
  }, [])

  const options = useMemo(() => {
    const chantiers = new Map<string, string>()
    const lots = new Set<string>()
    const responsables = new Map<string, string>()
    for (const t of taches ?? []) {
      if (t.lot?.chantier) chantiers.set(t.lot.chantier.id, t.lot.chantier.nom)
      if (t.lot) lots.add(t.lot.nom)
      if (t.responsable) responsables.set(t.responsable.id, t.responsable.nom)
    }
    return { chantiers: [...chantiers], lots: [...lots], responsables: [...responsables] }
  }, [taches])

  const visibles = useMemo(() => {
    let rows = taches ?? []
    if (fChantier) rows = rows.filter((t) => t.lot?.chantier?.id === fChantier)
    if (fLot) rows = rows.filter((t) => t.lot?.nom === fLot)
    if (fStatut) rows = rows.filter((t) => statutTache(t) === fStatut)
    if (fResponsable) rows = rows.filter((t) => t.responsable?.id === fResponsable)
    if (q) {
      const ql = q.toLowerCase()
      rows = rows.filter((t) => `${t.nom} ${t.lot?.nom} ${t.lot?.chantier?.nom}`.toLowerCase().includes(ql))
    }
    return rows
  }, [taches, q, fChantier, fLot, fStatut, fResponsable])

  if (!taches) return <Chargement texte="Chargement des tâches…" />

  return (
    <div>
      <EnTetePage
        titre="Tâches"
        sousTitre={`${visibles.length} / ${taches.length} tâches — tous chantiers confondus`}
        actions={<Recherche valeur={q} onChange={setQ} placeholder="Rechercher une tâche…" />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select className="champ !w-56" value={fChantier} onChange={(e) => setFChantier(e.target.value)}>
          <option value="">Tous les chantiers</option>
          {options.chantiers.map(([id, nom]) => (
            <option key={id} value={id}>{nom}</option>
          ))}
        </select>
        <select className="champ !w-40" value={fLot} onChange={(e) => setFLot(e.target.value)}>
          <option value="">Tous les lots</option>
          {options.lots.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select className="champ !w-40" value={fStatut} onChange={(e) => setFStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {(['À faire', 'En cours', 'En retard', 'Terminée'] as StatutTache[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="champ !w-48" value={fResponsable} onChange={(e) => setFResponsable(e.target.value)}>
          <option value="">Tous les responsables</option>
          {options.responsables.map(([id, nom]) => (
            <option key={id} value={id}>{nom}</option>
          ))}
        </select>
      </div>

      <div className="carte overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Tâche</th>
              <th className="px-3 py-3 font-medium">Chantier</th>
              <th className="px-3 py-3 font-medium">Lot</th>
              <th className="px-3 py-3 font-medium">Responsable</th>
              <th className="px-3 py-3 font-medium">Échéance</th>
              <th className="px-3 py-3 font-medium">Statut</th>
              <th className="px-3 py-3 font-medium" style={{ width: 170 }}>Avancement</th>
              {ecriture && <th className="px-3 py-3 font-medium" style={{ width: 110 }}>Mise à jour</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Aucune tâche ne correspond aux filtres.</td></tr>
            )}
            {visibles.map((t) => {
              const st = statutTache(t)
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <span className={cx(t.estJalon && 'font-semibold text-purple-700')}>
                      {t.estJalon && '◆ '}{t.nom}
                    </span>
                    {t.estCritique && t.avancement < 100 && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">critique</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to={`/planification/${t.lot?.chantier?.id}?onglet=gantt`} className="inline-flex items-center gap-1 text-xs text-primaire hover:underline">
                      {t.lot?.chantier?.nom} <ExternalLink size={11} />
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{t.lot?.nom}</td>
                  <td className="px-3 py-2.5 text-xs">{t.responsable?.nom ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs">{dateFr(t.dateFin)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', COULEUR_STATUT_TACHE[st])}>{st}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <BarreProgression valeur={t.avancement} className="w-20" />
                      <span className="text-xs font-medium">{Math.round(t.avancement)} %</span>
                    </div>
                  </td>
                  {ecriture && (
                    <td className="px-3 py-2.5">
                      <CelluleAvancement
                        tache={t}
                        onMaj={async (v) => {
                          try {
                            await patch(`/api/taches/${t.id}/avancement`, { avancement: v })
                            notifier('succes', 'Avancement mis à jour.')
                            await charger()
                          } catch (e: any) {
                            notifier('erreur', e.message)
                          }
                        }}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
