import { useEffect, useState } from 'react'
import { FileText, HandCoins, Loader2, Wand2 } from 'lucide-react'
import { get, post, urlExport } from '../lib/api'
import { fcfa, dateFr, dateIso } from '../lib/format'
import { MODES_PAIEMENT } from '../lib/statuts'
import { useAuth } from '../auth'
import { Badge, Champ, Modal, cx, useToast } from '../ui'
import { PageCrud, FormulaireModal, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'objet', label: 'Objet', type: 'texte', requis: true, colSpan: 2 },
  { nom: 'clientId', label: 'Client', type: 'select', options: optionsDepuis('clients', 'nom') },
  { nom: 'projetId', label: 'Projet', type: 'select', options: optionsDepuis('projets', 'nom') },
  { nom: 'contratId', label: 'Contrat', type: 'select', options: optionsDepuis('contrats', (c) => `${c.numero} — ${c.objet ?? ''}`) },
  {
    nom: 'type', label: 'Type', type: 'select',
    options: [
      { valeur: 'acompte', label: 'Acompte' },
      { valeur: 'situation', label: 'Situation (avancement)' },
      { valeur: 'solde', label: 'Solde' },
    ],
  },
  { nom: 'montant', label: 'Montant (FCFA)', type: 'nombre', requis: true },
  { nom: 'avancementPct', label: 'Avancement facturé (%)', type: 'nombre' },
  { nom: 'retenueGarantie', label: 'Retenue de garantie (%)', type: 'nombre' },
  { nom: 'date', label: 'Date', type: 'date' },
  { nom: 'echeance', label: 'Échéance', type: 'date' },
  {
    nom: 'statut', label: 'Statut', type: 'select',
    options: ['brouillon', 'envoyée', 'partiellement payée', 'payée', 'en retard'].map((s) => ({ valeur: s, label: s })),
  },
]

function ModalEncaissement({ facture, onFermer, onFait }: { facture: any; onFermer: () => void; onFait: () => void }) {
  const { notifier } = useToast()
  return (
    <FormulaireModal
      titre={`Encaisser — ${facture.numero} (reste ${fcfa(facture.resteAPayer)})`}
      ouvert
      onFermer={onFermer}
      champs={[
        { nom: 'montant', label: 'Montant encaissé (FCFA)', type: 'nombre', requis: true },
        { nom: 'mode', label: 'Mode', type: 'select', options: MODES_PAIEMENT.map((m) => ({ valeur: m, label: m })) },
        { nom: 'date', label: 'Date', type: 'date' },
        { nom: 'reference', label: 'Référence', type: 'texte' },
      ]}
      valeursInitiales={{ montant: facture.resteAPayer, mode: 'virement', date: dateIso(new Date()) }}
      onSoumettre={async (v) => {
        await post('/api/paiements', { ...v, factureId: facture.id, sens: 'encaissement', tiers: facture.client?.nom })
        notifier('succes', 'Paiement enregistré — statut de la facture mis à jour.')
        onFait()
      }}
    />
  )
}

/** Génère une facture de situation depuis l'avancement réel des chantiers du contrat. */
function ModalSituationAuto({ onFermer, onCree }: { onFermer: () => void; onCree: () => void }) {
  const { notifier } = useToast()
  const [contrats, setContrats] = useState<any[]>([])
  const [contratId, setContratId] = useState('')
  const [apercu, setApercu] = useState<any>(null)
  const [montant, setMontant] = useState<number | ''>('')
  const [retenue, setRetenue] = useState(5)
  const [echeance, setEcheance] = useState('')
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    get('/api/contrats').then((rows) => {
      setContrats(rows)
      if (rows.length) setContratId(rows[0].id)
    })
  }, [])

  useEffect(() => {
    if (!contratId) return
    setApercu(null)
    get(`/api/contrats/${contratId}/situation-apercu`)
      .then((a) => {
        setApercu(a)
        setMontant(a.montantPropose)
      })
      .catch((e) => notifier('erreur', e.message))
  }, [contratId])

  return (
    <Modal titre="Situation de travaux automatique" ouvert onFermer={onFermer} large>
      <p className="mb-4 text-sm text-slate-500">
        Le montant est calculé depuis l'<b>avancement réel</b> des chantiers du contrat :
        montant du contrat × avancement − déjà facturé.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Contrat" colSpan={2}>
          <select className="champ" value={contratId} onChange={(e) => setContratId(e.target.value)}>
            {contrats.map((c) => (
              <option key={c.id} value={c.id}>{c.numero} — {c.objet ?? ''} ({c.client?.nom ?? '—'})</option>
            ))}
          </select>
        </Champ>
      </div>

      {apercu ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">Montant du contrat</div>
            <div className="text-sm font-bold text-slate-800">{fcfa(apercu.contrat.montant)}</div>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <div className="text-xs text-slate-500">Avancement réel</div>
            <div className="text-sm font-bold text-primaire">{apercu.avancementPct} %</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">Déjà facturé</div>
            <div className="text-sm font-bold text-slate-800">{fcfa(apercu.dejaFacture + apercu.enBrouillon)}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xs text-slate-500">À facturer</div>
            <div className="text-sm font-bold text-green-700">{fcfa(apercu.montantPropose)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 py-4 text-center text-sm text-slate-400">Calcul de l'avancement…</div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Champ label="Montant de la situation (FCFA)">
          <input className="champ" type="number" value={montant} onChange={(e) => setMontant(e.target.value === '' ? '' : Number(e.target.value))} />
        </Champ>
        <Champ label="Retenue de garantie (%)">
          <input className="champ" type="number" min={0} max={20} value={retenue} onChange={(e) => setRetenue(Number(e.target.value))} />
        </Champ>
        <Champ label="Échéance">
          <input className="champ" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </Champ>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-discret" onClick={onFermer}>Annuler</button>
        <button
          className="btn-primaire"
          disabled={enCours || !apercu || !montant}
          onClick={async () => {
            setEnCours(true)
            try {
              const f = await post(`/api/contrats/${contratId}/situation`, {
                montant: montant || undefined,
                retenueGarantie: retenue,
                ...(echeance ? { echeance } : {}),
              })
              notifier('succes', `Facture ${f.numero} créée (brouillon) — avancement ${f.avancementPct} %.`)
              onCree()
              onFermer()
            } catch (e: any) {
              notifier('erreur', e.message)
            } finally {
              setEnCours(false)
            }
          }}
        >
          {enCours ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Générer la situation
        </button>
      </div>
    </Modal>
  )
}

export function Factures() {
  const { peutEcrire } = useAuth()
  const [encaissement, setEncaissement] = useState<{ facture: any; recharger: () => Promise<void> } | null>(null)
  const [situationOuverte, setSituationOuverte] = useState(false)
  const [cleRechargement, setCleRechargement] = useState(0)

  return (
    <>
      <PageCrud
        key={cleRechargement}
        titre="Factures"
        sousTitre="Acomptes, situations et soldes — numérotation automatique FAC-AAAA-NNN"
        ressource="factures"
        boutonCreer="Nouvelle facture"
        rolesEcriture={['COMPTABLE']}
        champs={CHAMPS}
        large
        enTeteSupplement={
          peutEcrire(['COMPTABLE', 'CHEF_PROJET']) ? (
            <button className="btn-secondaire" onClick={() => setSituationOuverte(true)} title="Générer une facture de situation depuis l'avancement réel">
              <Wand2 size={15} /> Situation auto
            </button>
          ) : undefined
        }
        colonnes={[
          { titre: 'Numéro', rendu: (f: any) => <span className="font-mono text-xs font-semibold">{f.numero}</span> },
          { titre: 'Client', rendu: (f: any) => <span className="text-xs">{f.client?.nom ?? '—'}</span> },
          { titre: 'Type', rendu: (f: any) => <Badge statut={f.type} /> },
          { titre: 'Date', rendu: (f: any) => dateFr(f.date) },
          {
            titre: 'Échéance',
            rendu: (f: any) => (
              <span className={cx('text-xs', f.statut === 'en retard' && 'font-semibold text-red-600')}>{dateFr(f.echeance)}</span>
            ),
          },
          { titre: 'Montant', align: 'right', rendu: (f: any) => <span className="font-semibold">{fcfa(f.montant)}</span> },
          {
            titre: 'Payé / Reste',
            align: 'right',
            rendu: (f: any) => (
              <div className="text-right text-xs">
                <div className="text-green-600">{fcfa(f.totalPaye)}</div>
                {f.resteAPayer > 0 && <div className="text-orange-600">reste {fcfa(f.resteAPayer)}</div>}
              </div>
            ),
          },
          { titre: 'Retenue', align: 'center', rendu: (f: any) => (f.retenueGarantie ? `${f.retenueGarantie} %` : '—') },
          { titre: 'Statut', rendu: (f: any) => <Badge statut={f.statut} /> },
        ]}
        actionsSupplementaires={(f: any, recharger) => (
          <>
            {peutEcrire(['COMPTABLE']) && f.resteAPayer > 0 && f.statut !== 'brouillon' && (
              <button
                title="Enregistrer un encaissement"
                className="rounded-lg border border-green-200 bg-green-50 p-1.5 text-green-600 hover:bg-green-100"
                onClick={() => setEncaissement({ facture: f, recharger })}
              >
                <HandCoins size={14} />
              </button>
            )}
            <a
              title="Exporter en PDF"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-400 hover:text-red-500"
              href={urlExport(`/api/exports/factures/${f.id}/pdf`)}
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={14} />
            </a>
          </>
        )}
      />
      {encaissement && (
        <ModalEncaissement
          facture={encaissement.facture}
          onFermer={() => setEncaissement(null)}
          onFait={() => encaissement.recharger()}
        />
      )}
      {situationOuverte && (
        <ModalSituationAuto onFermer={() => setSituationOuverte(false)} onCree={() => setCleRechargement((k) => k + 1)} />
      )}
    </>
  )
}
