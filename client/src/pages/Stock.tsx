import { useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardList, FileSpreadsheet, History } from 'lucide-react'
import { urlExport } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, Modal, Tableau, cx } from '../ui'
import { PageCrud, FormulaireModal, optionsDepuis, usePageCrud, type ChampForm } from '../components/PageCrud'
import { post } from '../lib/api'
import { useToast } from '../ui'

const CHAMPS_MATERIAU: ChampForm[] = [
  { nom: 'designation', label: 'Désignation', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'unite', label: 'Unité', type: 'texte', requis: true, placeholder: 'sac, kg, m³, barre…' },
  { nom: 'seuilAlerte', label: "Seuil d'alerte", type: 'nombre' },
  { nom: 'prixUnitaire', label: 'Prix unitaire moyen (FCFA)', type: 'nombre' },
]

function champsMouvement(type: 'entree' | 'sortie' | 'inventaire'): ChampForm[] {
  return [
    { nom: 'materiauId', label: 'Matériau', type: 'select', requis: true, options: optionsDepuis('materiaux', (m) => `${m.designation} (${m.unite})`), colSpan: 2 },
    { nom: 'chantierId', label: type === 'entree' ? 'Destination (vide = dépôt central)' : type === 'sortie' ? 'Chantier consommateur' : 'Lieu inventorié (vide = dépôt)', type: 'select', options: optionsDepuis('chantiers', 'nom') },
    { nom: 'quantite', label: type === 'inventaire' ? 'Quantité constatée' : 'Quantité', type: 'nombre', requis: true },
    ...(type === 'entree'
      ? ([
          { nom: 'prixUnitaire', label: "Prix unitaire d'achat (FCFA)", type: 'nombre' },
          { nom: 'fournisseur', label: 'Fournisseur', type: 'texte' },
        ] as ChampForm[])
      : []),
    { nom: 'motif', label: 'Motif', type: 'texte' },
    { nom: 'date', label: 'Date', type: 'date' },
  ]
}

function ModalHistorique({ onFermer }: { onFermer: () => void }) {
  const { lignes, chargement } = usePageCrud<any>('stock-mouvements')
  return (
    <Modal titre="Historique des mouvements de stock" ouvert onFermer={onFermer} large>
      {chargement ? (
        <p className="py-6 text-center text-sm text-slate-400">Chargement…</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <Tableau
            lignes={lignes}
            colonnes={[
              { titre: 'Date', rendu: (m: any) => dateFr(m.date) },
              { titre: 'Matériau', rendu: (m: any) => <span className="font-medium">{m.materiau?.designation}</span> },
              { titre: 'Type', rendu: (m: any) => <Badge statut={m.type} /> },
              { titre: 'Quantité', align: 'right', rendu: (m: any) => `${m.quantite} ${m.materiau?.unite ?? ''}` },
              { titre: 'Dépôt / Chantier', rendu: (m: any) => <span className="text-xs">{m.chantier?.nom ?? 'Dépôt central'}</span> },
              { titre: 'Fournisseur / Motif', rendu: (m: any) => <span className="text-xs text-slate-500">{m.fournisseur ?? m.motif ?? '—'}</span> },
            ]}
          />
        </div>
      )}
    </Modal>
  )
}

export function Stock() {
  const { peutEcrire } = useAuth()
  const { notifier } = useToast()
  const [mouvement, setMouvement] = useState<'entree' | 'sortie' | 'inventaire' | null>(null)
  const [historique, setHistorique] = useState(false)
  const [cleRechargement, setCleRechargement] = useState(0)
  const ecriture = peutEcrire(['MAGASINIER', 'CONDUCTEUR', 'CHEF_PROJET'])

  return (
    <>
      <PageCrud
        key={cleRechargement}
        titre="Stock matériaux"
        sousTitre="Catalogue, niveaux par dépôt/chantier et alertes de stock bas"
        ressource="materiaux"
        boutonCreer="Nouveau matériau"
        rolesEcriture={['MAGASINIER', 'CONDUCTEUR', 'CHEF_PROJET']}
        champs={CHAMPS_MATERIAU}
        enTeteSupplement={
          <>
            <a className="btn-discret" href={urlExport('/api/exports/stock-xlsx')} target="_blank" rel="noreferrer" title="Exporter l'état du stock en Excel">
              <FileSpreadsheet size={15} className="text-green-600" /> Excel
            </a>
            <button className="btn-discret" onClick={() => setHistorique(true)}>
              <History size={15} /> Historique
            </button>
            {ecriture && (
              <>
                <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700" onClick={() => setMouvement('entree')}>
                  <ArrowDownToLine size={15} /> Entrée
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-orange-600" onClick={() => setMouvement('sortie')}>
                  <ArrowUpFromLine size={15} /> Sortie
                </button>
                <button className="btn-discret" onClick={() => setMouvement('inventaire')}>
                  <ClipboardList size={15} /> Inventaire
                </button>
              </>
            )}
          </>
        }
        colonnes={[
          {
            titre: 'Désignation',
            rendu: (m: any) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{m.designation}</span>
                {m.enAlerte && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    <AlertTriangle size={10} /> Stock bas
                  </span>
                )}
              </div>
            ),
          },
          { titre: 'Unité', rendu: (m: any) => m.unite },
          {
            titre: 'Stock total',
            align: 'right',
            rendu: (m: any) => (
              <span className={cx('font-semibold', m.enAlerte ? 'text-red-600' : 'text-slate-800')}>
                {m.stockTotal} {m.unite}
              </span>
            ),
          },
          {
            titre: 'Répartition',
            rendu: (m: any) => (
              <div className="flex flex-wrap gap-1">
                {(m.parDepot ?? []).filter((d: any) => d.quantite !== 0).map((d: any, i: number) => (
                  <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {d.depot} : {d.quantite}
                  </span>
                ))}
                {(m.parDepot ?? []).every((d: any) => d.quantite === 0) && <span className="text-xs text-slate-300">—</span>}
              </div>
            ),
          },
          { titre: "Seuil d'alerte", align: 'right', rendu: (m: any) => m.seuilAlerte },
          { titre: 'P.U. moyen', align: 'right', rendu: (m: any) => <span className="font-medium">{fcfa(m.prixUnitaire)}</span> },
          { titre: 'Valorisation', align: 'right', rendu: (m: any) => <span className="text-xs text-slate-500">{fcfa(m.valorisation)}</span> },
        ]}
      />

      {mouvement && (
        <FormulaireModal
          titre={mouvement === 'entree' ? 'Entrée de stock (achat / livraison)' : mouvement === 'sortie' ? 'Sortie de stock (consommation chantier)' : 'Inventaire (quantité constatée)'}
          ouvert
          onFermer={() => setMouvement(null)}
          champs={champsMouvement(mouvement)}
          onSoumettre={async (valeurs) => {
            await post('/api/stock-mouvements', { ...valeurs, type: mouvement })
            notifier('succes', mouvement === 'entree' ? 'Entrée enregistrée — prix moyen pondéré mis à jour.' : 'Mouvement enregistré.')
            setCleRechargement((k) => k + 1)
          }}
        />
      )}
      {historique && <ModalHistorique onFermer={() => setHistorique(false)} />}
    </>
  )
}
