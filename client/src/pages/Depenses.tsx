import { Paperclip, FileSpreadsheet } from 'lucide-react'
import { urlExport } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { CATEGORIES_DEPENSE } from '../lib/statuts'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const COULEUR_CATEGORIE: Record<string, string> = {
  'matériaux': 'bg-blue-100 text-blue-700',
  "main-d'œuvre": 'bg-indigo-100 text-indigo-700',
  'sous-traitance': 'bg-purple-100 text-purple-700',
  'carburant': 'bg-amber-100 text-amber-700',
  'location': 'bg-teal-100 text-teal-700',
  'divers': 'bg-slate-200 text-slate-600',
}

const CHAMPS: ChampForm[] = [
  { nom: 'chantierId', label: 'Chantier', type: 'select', options: optionsDepuis('chantiers', 'nom'), colSpan: 2 },
  {
    nom: 'categorie', label: 'Catégorie', type: 'select',
    options: CATEGORIES_DEPENSE.map((c) => ({ valeur: c, label: c })),
  },
  { nom: 'fournisseur', label: 'Fournisseur', type: 'texte' },
  { nom: 'montant', label: 'Montant (FCFA)', type: 'nombre', requis: true },
  { nom: 'date', label: 'Date', type: 'date' },
  { nom: 'description', label: 'Description', type: 'texte', colSpan: 2 },
  { nom: 'justificatifUrl', label: 'Justificatif (photo, facture…)', type: 'fichier', colSpan: 2 },
]

export function Depenses() {
  return (
    <PageCrud
      titre="Dépenses"
      sousTitre="Saisie par chantier — alimente automatiquement le « Dépensé » de chaque chantier"
      ressource="depenses"
      boutonCreer="Nouvelle dépense"
      rolesEcriture={['COMPTABLE', 'CONDUCTEUR', 'CHEF_PROJET']}
      champs={CHAMPS}
      enTeteSupplement={
        <a className="btn-discret" href={urlExport('/api/exports/finance-xlsx')} target="_blank" rel="noreferrer" title="États financiers Excel">
          <FileSpreadsheet size={15} className="text-green-600" /> Excel
        </a>
      }
      selectionnable
      colonnes={[
        { titre: 'Date', tri: (d: any) => new Date(d.date).getTime(), rendu: (d: any) => dateFr(d.date) },
        { titre: 'Chantier', tri: (d: any) => d.chantier?.nom ?? '', rendu: (d: any) => <span className="font-medium text-slate-800">{d.chantier?.nom ?? '—'}</span> },
        {
          titre: 'Catégorie',
          tri: (d: any) => d.categorie,
          rendu: (d: any) => (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COULEUR_CATEGORIE[d.categorie] ?? 'bg-slate-200 text-slate-600'}`}>
              {d.categorie}
            </span>
          ),
        },
        { titre: 'Fournisseur', tri: (d: any) => d.fournisseur ?? '', rendu: (d: any) => d.fournisseur ?? '—' },
        { titre: 'Description', rendu: (d: any) => <span className="text-xs text-slate-500">{d.description ?? '—'}</span> },
        { titre: 'Montant', align: 'right', tri: (d: any) => d.montant, rendu: (d: any) => <span className="font-semibold">{fcfa(d.montant)}</span> },
        {
          titre: 'Justif.',
          align: 'center',
          rendu: (d: any) =>
            d.justificatifUrl ? (
              <a href={d.justificatifUrl} target="_blank" rel="noreferrer" className="inline-flex text-primaire" title="Voir le justificatif">
                <Paperclip size={14} />
              </a>
            ) : (
              <span className="text-slate-300">—</span>
            ),
        },
      ]}
    />
  )
}
