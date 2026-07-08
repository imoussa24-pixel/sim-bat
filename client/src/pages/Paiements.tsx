import { fcfa, dateFr } from '../lib/format'
import { MODES_PAIEMENT } from '../lib/statuts'
import { Badge } from '../ui'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  {
    nom: 'sens', label: 'Sens', type: 'select',
    options: [
      { valeur: 'encaissement', label: 'Encaissement (client)' },
      { valeur: 'decaissement', label: 'Décaissement (fournisseur)' },
    ],
  },
  { nom: 'mode', label: 'Mode', type: 'select', options: MODES_PAIEMENT.map((m) => ({ valeur: m, label: m })) },
  { nom: 'factureId', label: 'Facture liée (encaissements)', type: 'select', options: optionsDepuis('factures', (f) => `${f.numero} — ${f.client?.nom ?? ''}`), colSpan: 2 },
  { nom: 'tiers', label: 'Client / Fournisseur', type: 'texte' },
  { nom: 'montant', label: 'Montant (FCFA)', type: 'nombre', requis: true },
  { nom: 'date', label: 'Date', type: 'date' },
  { nom: 'reference', label: 'Référence', type: 'texte' },
]

export function Paiements() {
  return (
    <PageCrud
      titre="Paiements"
      sousTitre="Encaissements clients et décaissements fournisseurs — le statut des factures liées est recalculé automatiquement"
      ressource="paiements"
      boutonCreer="Nouveau paiement"
      rolesEcriture={['COMPTABLE']}
      champs={CHAMPS}
      colonnes={[
        { titre: 'Date', rendu: (p: any) => dateFr(p.date) },
        { titre: 'Sens', rendu: (p: any) => <Badge statut={p.sens} /> },
        { titre: 'Mode', rendu: (p: any) => <span className="text-xs capitalize">{p.mode}</span> },
        { titre: 'Tiers', rendu: (p: any) => <span className="font-medium text-slate-800">{p.tiers ?? p.facture?.client?.nom ?? '—'}</span> },
        { titre: 'Facture', rendu: (p: any) => <span className="font-mono text-xs">{p.facture?.numero ?? '—'}</span> },
        { titre: 'Référence', rendu: (p: any) => <span className="text-xs text-slate-500">{p.reference ?? '—'}</span> },
        {
          titre: 'Montant',
          align: 'right',
          rendu: (p: any) => (
            <span className={`font-semibold ${p.sens === 'encaissement' ? 'text-green-600' : 'text-orange-600'}`}>
              {p.sens === 'encaissement' ? '+' : '−'} {fcfa(p.montant)}
            </span>
          ),
        },
      ]}
    />
  )
}
