import { useEffect, useState } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { get, post } from '../lib/api'
import { fcfa, dateIso } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, Modal, useToast } from '../ui'
import { PageCrud, optionsDepuis, type ChampForm } from '../components/PageCrud'

const CHAMPS: ChampForm[] = [
  { nom: 'nom', label: 'Nom complet', type: 'texte', requis: true },
  { nom: 'poste', label: 'Poste', type: 'texte', requis: true, placeholder: 'maçon, ferrailleur, coffreur…' },
  { nom: 'qualification', label: 'Qualification', type: 'texte' },
  { nom: 'tel', label: 'Téléphone', type: 'texte' },
  { nom: 'tauxJournalier', label: 'Taux journalier (FCFA)', type: 'nombre' },
  { nom: 'chantierId', label: 'Chantier affecté', type: 'select', options: optionsDepuis('chantiers', 'nom') },
  {
    nom: 'statut', label: 'Statut', type: 'select',
    options: [
      { valeur: 'actif', label: 'Actif' },
      { valeur: 'congé', label: 'Congé' },
      { valeur: 'parti', label: 'Parti' },
    ],
  },
]

function ModalPointage({ onFermer }: { onFermer: () => void }) {
  const { notifier } = useToast()
  const [chantiers, setChantiers] = useState<any[]>([])
  const [chantierId, setChantierId] = useState('')
  const [date, setDate] = useState(dateIso(new Date()))
  const [lignes, setLignes] = useState<{ employe: any; present: boolean | null }[]>([])
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    get('/api/chantiers').then((rows) => {
      setChantiers(rows)
      if (rows.length && !chantierId) setChantierId(rows.find((c: any) => c.statut === 'En cours')?.id ?? rows[0].id)
    })
  }, [])

  useEffect(() => {
    if (!chantierId || !date) return
    get(`/api/pointages?chantierId=${chantierId}&date=${date}`)
      .then((rows) => setLignes(rows.map((r: any) => ({ ...r, present: r.present ?? true }))))
      .catch((e) => notifier('erreur', e.message))
  }, [chantierId, date])

  const enregistrer = async () => {
    setEnCours(true)
    try {
      await post('/api/pointages/journee', {
        chantierId,
        date,
        presences: lignes.map((l) => ({ employeId: l.employe.id, present: !!l.present })),
      })
      notifier('succes', 'Pointage enregistré — le coût main-d\'œuvre du chantier est mis à jour.')
      onFermer()
    } catch (e: any) {
      notifier('erreur', e.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal titre="Pointage journalier" ouvert onFermer={onFermer} large>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="etiquette">Chantier</label>
          <select className="champ" value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette">Date</label>
          <input className="champ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
          Aucun employé actif affecté à ce chantier.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {lignes.map((l, i) => (
            <label key={l.employe.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primaire"
                checked={!!l.present}
                onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, present: e.target.checked } : y)))}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700">{l.employe.nom}</div>
                <div className="text-xs text-slate-400">{l.employe.poste} · {fcfa(l.employe.tauxJournalier)}/jour</div>
              </div>
              <span className={l.present ? 'text-xs font-medium text-green-600' : 'text-xs text-slate-400'}>
                {l.present ? 'Présent' : 'Absent'}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-discret" onClick={onFermer}>Annuler</button>
        <button className="btn-primaire" onClick={enregistrer} disabled={enCours || !lignes.length}>
          {enCours && <Loader2 size={14} className="animate-spin" />}
          Enregistrer le pointage
        </button>
      </div>
    </Modal>
  )
}

export function Employes() {
  const [pointageOuvert, setPointageOuvert] = useState(false)
  const { peutEcrire } = useAuth()

  return (
    <>
      <PageCrud
        titre="Employés"
        ressource="employes"
        boutonCreer="Nouvel employé"
        rolesEcriture={['CHEF_PROJET', 'CONDUCTEUR']}
        champs={CHAMPS}
        libelleSuppression={(e: any) => `Voulez-vous vraiment supprimer l'employé « ${e.nom} » ?`}
        enTeteSupplement={
          peutEcrire(['CHEF_PROJET', 'CONDUCTEUR']) ? (
            <button className="btn-secondaire" onClick={() => setPointageOuvert(true)}>
              <CalendarCheck size={15} /> Pointage du jour
            </button>
          ) : undefined
        }
        colonnes={[
          { titre: 'Nom', rendu: (e: any) => <span className="font-medium text-slate-800">{e.nom}</span> },
          { titre: 'Poste', rendu: (e: any) => e.poste },
          { titre: 'Qualification', rendu: (e: any) => e.qualification || '—' },
          { titre: 'Téléphone', rendu: (e: any) => e.tel ?? '—' },
          { titre: 'Taux journalier', align: 'right', rendu: (e: any) => <span className="font-medium">{fcfa(e.tauxJournalier)}</span> },
          { titre: 'Chantier', rendu: (e: any) => <span className="text-xs">{e.chantier?.nom ?? 'Non affecté'}</span> },
          { titre: 'Statut', rendu: (e: any) => <Badge statut={e.statut} /> },
        ]}
      />
      {pointageOuvert && <ModalPointage onFermer={() => setPointageOuvert(false)} />}
    </>
  )
}
