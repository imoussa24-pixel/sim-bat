import { fcfa, dateFr } from '../lib/format'
import { Badge, cx } from '../ui'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'materielId', label: 'Matériel', type: 'select', requis: true, options: optionsDepuis('materiels', 'designation'), colSpan: 2 },
  {
    nom: 'type', label: 'Type', type: 'select',
    options: [
      { valeur: 'préventive', label: 'Préventive' },
      { valeur: 'curative', label: 'Curative' },
    ],
  },
  {
    nom: 'statut', label: 'Statut', type: 'select',
    options: [
      { valeur: 'planifiée', label: 'Planifiée' },
      { valeur: 'réalisée', label: 'Réalisée' },
    ],
  },
  { nom: 'datePlanifiee', label: 'Date planifiée', type: 'date' },
  { nom: 'dateRealisee', label: 'Date réalisée', type: 'date' },
  { nom: 'cout', label: 'Coût (FCFA)', type: 'nombre' },
  { nom: 'technicien', label: 'Technicien / Prestataire', type: 'texte' },
  { nom: 'pieces', label: 'Pièces', type: 'texte', colSpan: 2 },
  { nom: 'description', label: 'Description', type: 'textarea' },
  { nom: 'prochaineEcheance', label: 'Prochaine échéance', type: 'date' },
]

export function Maintenance() {
  const bientot = (d: string | null) => d && new Date(d).getTime() - Date.now() < 14 * 86400000

  return (
    <PageCrud
      titre="Maintenance"
      sousTitre="Interventions préventives et curatives sur le parc matériel"
      ressource="maintenances"
      boutonCreer="Nouvelle intervention"
      rolesEcriture={['CHEF_PROJET', 'CONDUCTEUR', 'MAGASINIER']}
      champs={CHAMPS}
      colonnes={[
        { titre: 'Matériel', rendu: (m: any) => <span className="font-medium text-slate-800">{m.materiel?.designation}</span> },
        { titre: 'Type', rendu: (m: any) => <Badge statut={m.type} /> },
        { titre: 'Planifiée', rendu: (m: any) => dateFr(m.datePlanifiee) },
        { titre: 'Réalisée', rendu: (m: any) => dateFr(m.dateRealisee) },
        { titre: 'Coût', align: 'right', rendu: (m: any) => <span className="font-medium">{fcfa(m.cout)}</span> },
        { titre: 'Technicien', rendu: (m: any) => <span className="text-xs">{m.technicien ?? '—'}</span> },
        {
          titre: 'Prochaine échéance',
          rendu: (m: any) => (
            <span className={cx('text-xs', bientot(m.prochaineEcheance) && 'font-semibold text-orange-600')}>
              {dateFr(m.prochaineEcheance)}
            </span>
          ),
        },
        { titre: 'Statut', rendu: (m: any) => <Badge statut={m.statut} /> },
      ]}
    />
  )
}
