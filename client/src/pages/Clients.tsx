import { useState } from 'react'
import { History } from 'lucide-react'
import { get } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { Badge, Modal, Tableau, useToast } from '../ui'
import { PageCrud, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'nom', label: 'Nom / Raison sociale', type: 'texte', requis: true, colSpan: 2 },
  {
    nom: 'type', label: 'Type', type: 'select',
    options: [
      { valeur: 'particulier', label: 'Particulier' },
      { valeur: 'entreprise', label: 'Entreprise' },
      { valeur: 'administration', label: 'Administration' },
    ],
  },
  { nom: 'contact', label: 'Personne de contact', type: 'texte' },
  { nom: 'tel', label: 'Téléphone', type: 'texte', placeholder: '+227 …' },
  { nom: 'email', label: 'Email', type: 'texte' },
  { nom: 'adresse', label: 'Adresse', type: 'texte' },
  { nom: 'ville', label: 'Ville', type: 'texte', placeholder: 'Niamey, Zinder, Dosso…' },
  { nom: 'nif', label: 'NIF', type: 'texte' },
]

function ModalHistorique({ clientId, onFermer }: { clientId: string; onFermer: () => void }) {
  const [historique, setHistorique] = useState<any>(null)
  const { notifier } = useToast()

  useState(() => {
    get(`/api/clients/${clientId}/historique`)
      .then(setHistorique)
      .catch((e) => notifier('erreur', e.message))
  })

  return (
    <Modal titre={`Historique — ${historique?.client?.nom ?? ''}`} ouvert onFermer={onFermer} large>
      {!historique ? (
        <div className="py-8 text-center text-sm text-slate-400">Chargement…</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Total facturé</div>
              <div className="text-base font-bold text-slate-800">{fcfa(historique.solde.totalFacture)}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-xs text-slate-500">Total encaissé</div>
              <div className="text-base font-bold text-green-700">{fcfa(historique.solde.totalPaye)}</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3">
              <div className="text-xs text-slate-500">Reste à payer</div>
              <div className="text-base font-bold text-orange-600">{fcfa(historique.solde.resteAPayer)}</div>
            </div>
          </div>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Projets ({historique.projets.length})</h4>
            {historique.projets.length === 0 && <p className="text-xs text-slate-400">Aucun projet.</p>}
            <ul className="space-y-1">
              {historique.projets.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span>{p.nom}</span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {fcfa(p.budget)} <Badge statut={p.statut} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Contrats ({historique.contrats.length})</h4>
            <ul className="space-y-1">
              {historique.contrats.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span>
                    {c.numero} — {c.objet ?? ''}
                  </span>
                  <span className="text-xs text-slate-500">
                    {dateFr(c.dateSignature)} · <b>{fcfa(c.montant)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Factures ({historique.factures.length})</h4>
            <ul className="space-y-1">
              {historique.factures.map((f: any) => (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span>
                    {f.numero} <span className="text-xs text-slate-400">({f.type})</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {fcfa(f.montant)} — payé {fcfa(f.totalPaye)} <Badge statut={f.statut} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  )
}

export function Clients() {
  const [historiqueId, setHistoriqueId] = useState<string | null>(null)

  return (
    <>
      <PageCrud
        titre="Clients"
        ressource="clients"
        boutonCreer="Nouveau client"
        rolesEcriture={['CHEF_PROJET', 'COMPTABLE']}
        champs={CHAMPS}
        selectionnable
        libelleSuppression={(c: any) => `Voulez-vous vraiment supprimer le client « ${c.nom} » ?`}
        colonnes={[
          { titre: 'Nom / Raison sociale', tri: (c: any) => c.nom, rendu: (c: any) => <span className="font-medium text-slate-800">{c.nom}</span> },
          { titre: 'Type', tri: (c: any) => c.type, rendu: (c: any) => <Badge statut={c.type} /> },
          { titre: 'Téléphone', rendu: (c: any) => c.tel ?? '—' },
          { titre: 'Email', rendu: (c: any) => c.email || '—' },
          { titre: 'Ville', tri: (c: any) => c.ville ?? '', rendu: (c: any) => c.ville ?? '—' },
          { titre: 'NIF', rendu: (c: any) => c.nif || '—' },
          { titre: 'Contact', rendu: (c: any) => c.contact || '—' },
        ]}
        actionsSupplementaires={(c: any) => (
          <button
            title="Historique (projets, contrats, factures)"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-primaire hover:text-primaire"
            onClick={() => setHistoriqueId(c.id)}
          >
            <History size={14} />
          </button>
        )}
      />
      {historiqueId && <ModalHistorique clientId={historiqueId} onFermer={() => setHistoriqueId(null)} />}
    </>
  )
}
