import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck2, CalendarRange, CheckCircle2, ClipboardEdit, GanttChartSquare, HardHat, Loader2, MapPin } from 'lucide-react'
import { get } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { Badge, BarreProgression, CarteKpi, Chargement, EnTetePage, cx } from '../ui'

export function Planification() {
  const [donnees, setDonnees] = useState<any>(null)

  useEffect(() => {
    get('/api/planification/apercu').then(setDonnees).catch(() => setDonnees({ compteurs: {}, chantiers: [] }))
  }, [])

  if (!donnees) return <Chargement texte="Chargement de la planification…" />
  const { compteurs, chantiers } = donnees

  return (
    <div>
      <EnTetePage titre="Planification" sousTitre="Préparez la WBS de chaque chantier puis calculez le planning CPM" />

      {/* Bandeau de compteurs */}
      <div className="grille-animee mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CarteKpi titre="Chantiers total" valeur={compteurs.total ?? 0} icone={<HardHat size={20} />} couleur="bg-blue-50 text-primaire" />
        <CarteKpi titre="Planning calculé" valeur={compteurs.calcules ?? 0} icone={<CalendarCheck2 size={20} />} couleur="bg-green-50 text-green-600" />
        <CarteKpi titre="En cours" valeur={compteurs.enCours ?? 0} icone={<Loader2 size={20} />} couleur="bg-orange-50 text-orange-600" />
        <CarteKpi titre="Terminés" valeur={compteurs.termines ?? 0} icone={<CheckCircle2 size={20} />} couleur="bg-emerald-50 text-emerald-600" />
      </div>

      {/* Grille de cartes chantier */}
      <div className="grille-animee grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {chantiers.map((c: any) => (
          <div key={c.id} className="carte carte-interactive flex flex-col p-4">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug text-slate-800">{c.nom}</h3>
              <Badge statut={c.statut} />
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {c.ville && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {c.ville}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarRange size={12} />
                {dateFr(c.dateDebut)} → {dateFr(c.dateFin)}
              </span>
            </div>
            <div className="mb-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{fcfa(c.budget)}</span>
              {c.depense > 0 && <span className="text-slate-400"> · dépensé : {fcfa(c.depense)}</span>}
            </div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Avancement</span>
              <span className="font-semibold text-slate-700">{Math.round(c.avancement)} %</span>
            </div>
            <BarreProgression valeur={c.avancement} statut={c.statut} className="mb-3" />

            {/* Bandeau planning */}
            <div
              className={cx(
                'mb-3 rounded-lg px-3 py-2 text-xs font-medium',
                c.planningCalcule ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
              )}
            >
              {c.planningCalcule ? (
                <>✔ Planning calculé — Fin : {dateFr(c.finPrevue)} · {c.nbTaches} tâche{c.nbTaches > 1 ? 's' : ''}</>
              ) : (
                'Planning non calculé'
              )}
            </div>

            <div className="mt-auto flex items-center gap-2">
              <Link to={`/planification/${c.id}`} className="btn-primaire !px-3 !py-1.5 text-xs">
                <ClipboardEdit size={13} /> Préparer
              </Link>
              {c.planningCalcule && (
                <Link to={`/planification/${c.id}?onglet=gantt`} className="btn-secondaire !px-3 !py-1.5 text-xs">
                  <GanttChartSquare size={13} /> Chronogramme
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
