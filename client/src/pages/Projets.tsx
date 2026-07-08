import { useMemo, useState } from 'react'
import { CalendarDays, Eye, LayoutGrid, List, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { post, put, supprimer } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { STATUTS_PROJET } from '../lib/statuts'
import { useAuth } from '../auth'
import {
  Badge, BarreProgression, Chargement, ConfirmSuppression, EnTetePage, Modal,
  OngletsPilules, Recherche, Tableau, cx, useToast,
} from '../ui'
import { FormulaireModal, optionsDepuis, usePageCrud, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'nom', label: 'Nom du projet', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'description', label: 'Description', type: 'textarea' },
  { nom: 'clientId', label: 'Client', type: 'select', options: optionsDepuis('clients', 'nom') },
  { nom: 'responsableId', label: 'Responsable', type: 'select', options: optionsDepuis('employes', (e) => `${e.nom} (${e.poste})`) },
  { nom: 'budget', label: 'Budget (FCFA)', type: 'nombre' },
  { nom: 'dateDebut', label: 'Date de début', type: 'date' },
  { nom: 'livraisonPrevue', label: 'Livraison prévue', type: 'date' },
  { nom: 'statut', label: 'Statut', type: 'select', options: STATUTS_PROJET.map((s) => ({ valeur: s, label: s })) },
  { nom: 'avancement', label: 'Avancement (%) — manuel si aucun chantier', type: 'nombre' },
  { nom: 'localites', label: 'Localité(s)', type: 'texte', placeholder: 'Niamey, Zinder…' },
]

function ModalDetails({ projet, onFermer }: { projet: any; onFermer: () => void }) {
  return (
    <Modal titre={projet.nom} ouvert onFermer={onFermer} large>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge statut={projet.statut} />
          {projet.localites && <span className="text-xs text-slate-500">📍 {projet.localites}</span>}
        </div>
        {projet.description && <p className="text-sm text-slate-600">{projet.description}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Client</div>
            <div className="font-medium">{projet.client?.nom ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Responsable</div>
            <div className="font-medium">{projet.responsable?.nom ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Budget</div>
            <div className="font-medium">{fcfa(projet.budget)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Dépensé</div>
            <div className="font-medium">{fcfa(projet.depense ?? 0)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Début</div>
            <div className="font-medium">{dateFr(projet.dateDebut)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Livraison prévue</div>
            <div className="font-medium">{dateFr(projet.livraisonPrevue)}</div>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Avancement ({projet.nbChantiers ?? 0} chantier{(projet.nbChantiers ?? 0) > 1 ? 's' : ''})</span>
            <span className="font-semibold text-slate-700">{Math.round(projet.avancement)} %</span>
          </div>
          <BarreProgression valeur={projet.avancement} statut={projet.statut} className="h-2" />
        </div>
      </div>
    </Modal>
  )
}

export function Projets() {
  const { lignes: projets, chargement, q, setQ, recharger } = usePageCrud<any>('projets')
  const { peutEcrire } = useAuth()
  const { notifier } = useToast()
  const [vue, setVue] = useState<'grille' | 'liste'>('grille')
  const [filtre, setFiltre] = useState('Tous')
  const [modalOuvert, setModalOuvert] = useState(false)
  const [edition, setEdition] = useState<any>(null)
  const [details, setDetails] = useState<any>(null)
  const [suppression, setSuppression] = useState<any>(null)
  const ecriture = peutEcrire(['CHEF_PROJET'])

  const filtres = useMemo(() => {
    const compteur = (s: string) => projets.filter((p) => p.statut === s).length
    return [
      { valeur: 'Tous', label: 'Tous', compteur: projets.length },
      ...STATUTS_PROJET.map((s) => ({ valeur: s, label: s, compteur: compteur(s) })),
    ]
  }, [projets])

  const visibles = filtre === 'Tous' ? projets : projets.filter((p) => p.statut === filtre)

  const ouvrirCreation = () => {
    setEdition(null)
    setModalOuvert(true)
  }

  const boutonsActions = (p: any) => (
    <div className="flex items-center gap-1.5">
      <button className="btn-discret !px-2.5 !py-1.5 text-xs" onClick={() => setDetails(p)}>
        <Eye size={13} /> Détails
      </button>
      {ecriture && (
        <>
          <button
            className="btn-secondaire !px-2.5 !py-1.5 text-xs"
            onClick={() => {
              setEdition(p)
              setModalOuvert(true)
            }}
          >
            <Pencil size={13} /> Modifier
          </button>
          <button className="btn-danger-doux !p-1.5" title="Supprimer" onClick={() => setSuppression(p)}>
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )

  return (
    <div>
      <EnTetePage
        titre="Projets"
        sousTitre={`${visibles.length} / ${projets.length} projet${projets.length > 1 ? 's' : ''}`}
        actions={
          <>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                className={cx('rounded-md p-1.5', vue === 'grille' ? 'bg-primaire text-white' : 'text-slate-500 hover:text-slate-700')}
                onClick={() => setVue('grille')}
                title="Vue grille"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                className={cx('rounded-md p-1.5', vue === 'liste' ? 'bg-primaire text-white' : 'text-slate-500 hover:text-slate-700')}
                onClick={() => setVue('liste')}
                title="Vue liste"
              >
                <List size={15} />
              </button>
            </div>
            <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un projet…" />
            {ecriture && (
              <button className="btn-primaire" onClick={ouvrirCreation}>
                <Plus size={16} /> Nouveau projet
              </button>
            )}
          </>
        }
      />

      <div className="mb-5">
        <OngletsPilules options={filtres} actif={filtre} onChange={setFiltre} />
      </div>

      {chargement ? (
        <Chargement />
      ) : vue === 'grille' ? (
        <div className="grille-animee grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.length === 0 && (
            <div className="col-span-full py-14 text-center text-sm text-slate-400">Aucun projet ne correspond à ce filtre.</div>
          )}
          {visibles.map((p) => (
            <div key={p.id} className="carte carte-interactive flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 leading-snug">{p.nom}</h3>
                <Badge statut={p.statut} />
              </div>
              <p className="mb-3 line-clamp-2 min-h-[2.4em] text-xs text-slate-500">{p.description || '—'}</p>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Avancement</span>
                <span className="font-semibold text-slate-700">{Math.round(p.avancement)} %</span>
              </div>
              <BarreProgression valeur={p.avancement} statut={p.statut} className="mb-3" />
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Wallet size={13} className="text-slate-400" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Budget</div>
                    <div className="font-semibold">{fcfa(p.budget)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CalendarDays size={13} className="text-slate-400" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Livraison prévue</div>
                    <div className="font-semibold">{dateFr(p.livraisonPrevue)}</div>
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-slate-100 pt-3">{boutonsActions(p)}</div>
            </div>
          ))}
        </div>
      ) : (
        <Tableau
          lignes={visibles}
          colonnes={[
            { titre: 'Projet', rendu: (p: any) => <span className="font-medium text-slate-800">{p.nom}</span> },
            { titre: 'Client', rendu: (p: any) => p.client?.nom ?? '—' },
            { titre: 'Statut', rendu: (p: any) => <Badge statut={p.statut} /> },
            {
              titre: 'Avancement',
              largeur: '160px',
              rendu: (p: any) => (
                <div className="flex items-center gap-2">
                  <BarreProgression valeur={p.avancement} statut={p.statut} className="w-20" />
                  <span className="text-xs font-medium">{Math.round(p.avancement)} %</span>
                </div>
              ),
            },
            { titre: 'Budget', align: 'right', rendu: (p: any) => <span className="font-medium">{fcfa(p.budget)}</span> },
            { titre: 'Livraison prévue', rendu: (p: any) => dateFr(p.livraisonPrevue) },
            { titre: '', align: 'right', largeur: '250px', rendu: (p: any) => boutonsActions(p) },
          ]}
        />
      )}

      <FormulaireModal
        titre={edition ? 'Modifier le projet' : 'Nouveau projet'}
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
        champs={CHAMPS}
        valeursInitiales={edition ?? undefined}
        large
        onSoumettre={async (valeurs) => {
          if (edition) {
            await put(`/api/projets/${edition.id}`, valeurs)
            notifier('succes', 'Projet modifié.')
          } else {
            await post('/api/projets', valeurs)
            notifier('succes', 'Projet créé.')
          }
          await recharger()
        }}
      />

      {details && <ModalDetails projet={details} onFermer={() => setDetails(null)} />}

      <ConfirmSuppression
        ouvert={!!suppression}
        onFermer={() => setSuppression(null)}
        message={suppression ? `Voulez-vous vraiment supprimer le projet « ${suppression.nom} » ?` : undefined}
        onConfirmer={async () => {
          await supprimer(`/api/projets/${suppression.id}`)
          notifier('succes', 'Projet supprimé.')
          await recharger()
        }}
      />
    </div>
  )
}
