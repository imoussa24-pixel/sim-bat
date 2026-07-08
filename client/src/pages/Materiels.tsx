import { fcfa } from '../lib/format'
import { Badge } from '../ui'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'designation', label: 'Désignation', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'type', label: 'Type', type: 'texte', placeholder: 'Levage, Véhicule, Équipement béton…' },
  { nom: 'numeroSerie', label: 'Immatriculation / N° série', type: 'texte' },
  {
    nom: 'etat', label: 'État', type: 'select',
    options: [
      { valeur: 'bon', label: 'Bon' },
      { valeur: 'moyen', label: 'Moyen' },
      { valeur: 'panne', label: 'En panne' },
    ],
  },
  { nom: 'coutHoraire', label: 'Coût horaire (FCFA)', type: 'nombre' },
  { nom: 'chantierId', label: 'Affectation (chantier)', type: 'select', options: optionsDepuis('chantiers', 'nom') },
]

export function Materiels() {
  return (
    <PageCrud
      titre="Matériels"
      sousTitre="Parc d'engins et d'équipements"
      ressource="materiels"
      boutonCreer="Nouveau matériel"
      rolesEcriture={['CHEF_PROJET', 'CONDUCTEUR', 'MAGASINIER']}
      champs={CHAMPS}
      libelleSuppression={(m: any) => `Voulez-vous vraiment supprimer « ${m.designation} » ?`}
      colonnes={[
        { titre: 'Désignation', rendu: (m: any) => <span className="font-medium text-slate-800">{m.designation}</span> },
        { titre: 'Type', rendu: (m: any) => m.type ?? '—' },
        { titre: 'Immat. / N° série', rendu: (m: any) => <span className="font-mono text-xs">{m.numeroSerie ?? '—'}</span> },
        { titre: 'État', rendu: (m: any) => <Badge statut={m.etat} /> },
        { titre: 'Coût horaire', align: 'right', rendu: (m: any) => <span className="font-medium">{fcfa(m.coutHoraire)}</span> },
        { titre: 'Affectation', rendu: (m: any) => <span className="text-xs">{m.chantier?.nom ?? 'Dépôt central'}</span> },
      ]}
    />
  )
}
