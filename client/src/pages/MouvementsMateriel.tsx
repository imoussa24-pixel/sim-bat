import { ArrowRight } from 'lucide-react'
import { get } from '../lib/api'
import { dateFr } from '../lib/format'
import { PageCrud, optionsDepuis, type ChampForm, type OptionSelect } from '../components/PageCrud'

/** Origine / destination : dépôt central ou l'un des chantiers (par nom). */
async function optionsLieux(): Promise<OptionSelect[]> {
  const chantiers = await get<any[]>('/api/chantiers')
  return [
    { valeur: 'Dépôt central', label: 'Dépôt central' },
    ...chantiers.map((c) => ({ valeur: c.nom, label: c.nom })),
  ]
}

const CHAMPS: ChampForm[] = [
  { nom: 'materielId', label: 'Matériel', type: 'select', requis: true, options: optionsDepuis('materiels', 'designation'), colSpan: 2 },
  { nom: 'origine', label: 'Origine', type: 'select', options: optionsLieux },
  { nom: 'destination', label: 'Destination', type: 'select', options: optionsLieux },
  { nom: 'date', label: 'Date', type: 'date' },
  { nom: 'responsableId', label: 'Responsable', type: 'select', options: optionsDepuis('employes', (e) => `${e.nom} (${e.poste})`) },
  { nom: 'motif', label: 'Motif', type: 'texte', colSpan: 2 },
  {
    nom: 'etatDepart', label: 'État au départ', type: 'select',
    options: [{ valeur: 'bon', label: 'Bon' }, { valeur: 'moyen', label: 'Moyen' }, { valeur: 'panne', label: 'Panne' }],
  },
  {
    nom: 'etatArrivee', label: "État à l'arrivée", type: 'select',
    options: [{ valeur: 'bon', label: 'Bon' }, { valeur: 'moyen', label: 'Moyen' }, { valeur: 'panne', label: 'Panne' }],
  },
]

export function MouvementsMateriel() {
  return (
    <PageCrud
      titre="Mouvements matériel"
      sousTitre="Journal des transferts entre chantiers et dépôt — l'affectation du matériel est mise à jour automatiquement"
      ressource="mouvements-materiel"
      boutonCreer="Nouveau mouvement"
      rolesEcriture={['CHEF_PROJET', 'CONDUCTEUR', 'MAGASINIER']}
      champs={CHAMPS}
      colonnes={[
        { titre: 'Date', rendu: (m: any) => dateFr(m.date) },
        { titre: 'Matériel', rendu: (m: any) => <span className="font-medium text-slate-800">{m.materiel?.designation}</span> },
        {
          titre: 'Transfert',
          rendu: (m: any) => (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5">{m.origine ?? '—'}</span>
              <ArrowRight size={12} className="text-slate-400" />
              <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{m.destination ?? '—'}</span>
            </span>
          ),
        },
        { titre: 'Responsable', rendu: (m: any) => <span className="text-xs">{m.responsable?.nom ?? '—'}</span> },
        { titre: 'Motif', rendu: (m: any) => <span className="text-xs text-slate-500">{m.motif ?? '—'}</span> },
        {
          titre: 'État départ → arrivée',
          rendu: (m: any) => (
            <span className="text-xs">{m.etatDepart ?? '—'} → {m.etatArrivee ?? '—'}</span>
          ),
        },
      ]}
    />
  )
}
