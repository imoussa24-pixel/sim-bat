import { CalendarRange } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fcfa, dateFr } from '../lib/format'
import { STATUTS_CHANTIER } from '../lib/statuts'
import { Badge, BarreProgression, cx } from '../ui'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'nom', label: 'Nom du chantier', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'projetId', label: 'Projet', type: 'select', options: optionsDepuis('projets', 'nom') },
  { nom: 'ville', label: 'Ville / Localisation', type: 'texte', placeholder: 'Niamey, Maradi…' },
  { nom: 'dateDebut', label: 'Date de début', type: 'date' },
  { nom: 'dateFin', label: 'Date de fin contractuelle', type: 'date' },
  { nom: 'budget', label: 'Budget (FCFA)', type: 'nombre' },
  { nom: 'statut', label: 'Statut', type: 'select', options: STATUTS_CHANTIER.map((s) => ({ valeur: s, label: s })) },
  { nom: 'chefId', label: 'Chef de chantier', type: 'select', options: optionsDepuis('employes', (e) => `${e.nom} (${e.poste})`) },
  { nom: 'avancement', label: 'Avancement (%) — manuel si pas de planning', type: 'nombre' },
]

export function Chantiers() {
  return (
    <PageCrud
      titre="Chantiers"
      ressource="chantiers"
      boutonCreer="Nouveau chantier"
      rolesEcriture={['CHEF_PROJET', 'CONDUCTEUR']}
      champs={CHAMPS}
      large
      libelleSuppression={(c: any) => `Voulez-vous vraiment supprimer le chantier « ${c.nom} » ?`}
      colonnes={[
        {
          titre: 'Chantier',
          rendu: (c: any) => (
            <div>
              <div className="font-medium text-slate-800">{c.nom}</div>
              <div className="text-xs text-slate-400">{c.projet?.nom ?? 'Sans projet'}</div>
            </div>
          ),
        },
        { titre: 'Ville', rendu: (c: any) => c.ville ?? '—' },
        {
          titre: 'Période',
          rendu: (c: any) => (
            <span className="text-xs">
              {dateFr(c.dateDebut)} → {dateFr(c.dateFin)}
            </span>
          ),
        },
        { titre: 'Statut', rendu: (c: any) => <Badge statut={c.statut} /> },
        {
          titre: 'Budget / Dépensé',
          align: 'right',
          rendu: (c: any) => {
            const ratio = c.budget > 0 ? c.depense / c.budget : 0
            return (
              <div className="text-right">
                <div className="font-medium">{fcfa(c.budget)}</div>
                <div className={cx('text-xs', ratio > 1 ? 'text-red-600 font-semibold' : ratio > 0.9 ? 'text-orange-600 font-medium' : 'text-slate-400')}>
                  dépensé : {fcfa(c.depense)}
                </div>
              </div>
            )
          },
        },
        {
          titre: 'Avancement',
          largeur: '150px',
          rendu: (c: any) => (
            <div className="flex items-center gap-2">
              <BarreProgression valeur={c.avancement} statut={c.statut} className="w-20" />
              <span className="text-xs font-medium">{Math.round(c.avancement)} %</span>
            </div>
          ),
        },
        { titre: 'Chef', rendu: (c: any) => <span className="text-xs">{c.chef?.nom ?? '—'}</span> },
        { titre: 'Effectif', align: 'center', rendu: (c: any) => c.effectif ?? 0 },
      ]}
      actionsSupplementaires={(c: any) => (
        <Link
          to={`/planification/${c.id}`}
          title="Planification du chantier"
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-primaire hover:text-primaire"
        >
          <CalendarRange size={14} />
        </Link>
      )}
    />
  )
}
