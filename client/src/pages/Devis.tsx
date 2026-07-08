import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, FolderOpen } from 'lucide-react'
import { urlExport } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { Badge, Modal, Tableau, cx } from '../ui'
import { PageCrud, optionsDepuis, usePageCrud, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'objet', label: 'Objet du devis', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'clientId', label: 'Client', type: 'select', options: optionsDepuis('clients', 'nom') },
  { nom: 'projetId', label: 'Projet (optionnel)', type: 'select', options: optionsDepuis('projets', 'nom') },
  { nom: 'date', label: 'Date', type: 'date' },
  {
    nom: 'statut', label: 'Statut', type: 'select',
    options: ['brouillon', 'envoyé', 'accepté', 'refusé'].map((s) => ({ valeur: s, label: s })),
  },
  { nom: 'tvaTaux', label: 'TVA (%)', type: 'nombre' },
  { nom: 'remise', label: 'Remise (FCFA)', type: 'nombre' },
  { nom: 'notes', label: 'Notes', type: 'textarea' },
]

function ModalContrats({ onFermer }: { onFermer: () => void }) {
  const { lignes, chargement } = usePageCrud<any>('contrats')
  return (
    <Modal titre={`Contrats (${lignes.length})`} ouvert onFermer={onFermer} large>
      {chargement ? (
        <p className="py-6 text-center text-sm text-slate-400">Chargement…</p>
      ) : (
        <Tableau
          lignes={lignes}
          colonnes={[
            { titre: 'Numéro', rendu: (c: any) => <span className="font-mono text-xs font-semibold">{c.numero}</span> },
            { titre: 'Objet', rendu: (c: any) => c.objet ?? '—' },
            { titre: 'Client', rendu: (c: any) => <span className="text-xs">{c.client?.nom ?? '—'}</span> },
            { titre: 'Devis', rendu: (c: any) => <span className="font-mono text-xs">{c.devis?.numero ?? '—'}</span> },
            { titre: 'Signé le', rendu: (c: any) => dateFr(c.dateSignature) },
            { titre: 'Montant', align: 'right', rendu: (c: any) => <span className="font-semibold">{fcfa(c.montant)}</span> },
          ]}
        />
      )}
    </Modal>
  )
}

export function Devis() {
  const navigate = useNavigate()
  const [contratsOuverts, setContratsOuverts] = useState(false)

  return (
    <>
      <PageCrud
        titre="Devis"
        sousTitre="Numérotation automatique DEV-AAAA-NNN — ouvrez un devis pour saisir ses lignes d'ouvrage"
        ressource="devis"
        boutonCreer="Nouveau devis"
        rolesEcriture={['COMPTABLE', 'CHEF_PROJET']}
        champs={CHAMPS}
        large
        enTeteSupplement={
          <button className="btn-discret" onClick={() => setContratsOuverts(true)}>
            <FileText size={15} /> Contrats
          </button>
        }
        colonnes={[
          {
            titre: 'Numéro',
            rendu: (d: any) => (
              <Link to={`/devis/${d.id}`} className="font-mono text-xs font-semibold text-primaire hover:underline" onClick={(e) => e.stopPropagation()}>
                {d.numero}
                {d.version > 1 && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">v{d.version}</span>}
              </Link>
            ),
          },
          { titre: 'Objet', rendu: (d: any) => <span className="text-slate-800">{d.objet ?? '—'}</span> },
          { titre: 'Client', rendu: (d: any) => <span className="text-xs">{d.client?.nom ?? '—'}</span> },
          { titre: 'Date', rendu: (d: any) => dateFr(d.date) },
          { titre: 'Total HT', align: 'right', rendu: (d: any) => fcfa(d.totalHT) },
          { titre: 'Total TTC', align: 'right', rendu: (d: any) => <span className="font-semibold">{fcfa(d.totalTTC)}</span> },
          {
            titre: 'Statut',
            rendu: (d: any) => (
              <div className="flex items-center gap-1.5">
                <Badge statut={d.statut} />
                {d.contrat && <span className={cx('rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600')}>→ {d.contrat.numero}</span>}
              </div>
            ),
          },
        ]}
        actionsSupplementaires={(d: any) => (
          <>
            <button
              title="Ouvrir l'éditeur de lignes"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-primaire hover:text-primaire"
              onClick={() => navigate(`/devis/${d.id}`)}
            >
              <FolderOpen size={14} />
            </button>
            <a
              title="Exporter en PDF"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-400 hover:text-red-500"
              href={urlExport(`/api/exports/devis/${d.id}/pdf`)}
              target="_blank"
              rel="noreferrer"
            >
              <FileSpreadsheet size={14} />
            </a>
          </>
        )}
      />
      {contratsOuverts && <ModalContrats onFermer={() => setContratsOuverts(false)} />}
    </>
  )
}
