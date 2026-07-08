import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Bell, BookTemplate, Calculator, Camera, ChevronDown, ClipboardEdit,
  Download, FileSpreadsheet, FileText, GanttChartSquare, Image, Layers, Loader2,
  MessageSquare, Pencil, Plus, RefreshCw, Save, Send, Trash2, X,
} from 'lucide-react'
import { get, post, put, supprimer, urlExport } from '../lib/api'
import { dateFr, dateCourte } from '../lib/format'
import { useAuth } from '../auth'
import {
  Badge, CarteKpi, Champ, Chargement, ConfirmSuppression, EnTetePage, Modal, cx, useToast,
} from '../ui'
import { Gantt, statutVisuel, estEnRetard, type EchelleGantt, type GroupeGantt, type TacheGantt } from '../components/Gantt'

const TYPES_DEP = [
  { valeur: 'FD', label: 'Fin → Début' },
  { valeur: 'DD', label: 'Début → Début' },
  { valeur: 'FF', label: 'Fin → Fin' },
  { valeur: 'DF', label: 'Début → Fin' },
]

// ─────────────────────────── Modal tâche (WBS) ───────────────────────────────

function ModalTache({
  tache,
  lots,
  toutesTaches,
  onFermer,
  onEnregistre,
}: {
  tache: any | null // null = création
  lots: any[]
  toutesTaches: any[]
  onFermer: () => void
  onEnregistre: () => Promise<void>
}) {
  const { notifier } = useToast()
  const [valeurs, setValeurs] = useState<any>({
    nom: tache?.nom ?? '',
    lotId: tache?.lotId ?? lots[0]?.id ?? '',
    dureeJours: tache?.dureeJours ?? 1,
    dateDebutSouhaitee: tache?.dateDebutSouhaitee ? String(tache.dateDebutSouhaitee).slice(0, 10) : '',
    avancement: tache?.avancement ?? 0,
    estJalon: tache?.estJalon ?? false,
    responsableId: tache?.responsableId ?? '',
  })
  const [deps, setDeps] = useState<{ predecesseurId: string; type: string; lagJours: number }[]>(
    (tache?.predecesseurs ?? []).map((d: any) => ({ predecesseurId: d.predecesseurId, type: d.type, lagJours: d.lagJours }))
  )
  const [ressources, setRessources] = useState<{ employeId?: string; materielId?: string }[]>(
    (tache?.ressources ?? []).map((r: any) => ({ employeId: r.employeId ?? undefined, materielId: r.materielId ?? undefined }))
  )
  const [employes, setEmployes] = useState<any[]>([])
  const [materiels, setMateriels] = useState<any[]>([])
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    get('/api/employes').then(setEmployes).catch(() => {})
    get('/api/materiels').then(setMateriels).catch(() => {})
  }, [])

  const candidatesPred = toutesTaches.filter((t) => t.id !== tache?.id)

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnCours(true)
    try {
      const corps = {
        ...valeurs,
        dureeJours: Number(valeurs.dureeJours) || 0,
        avancement: Number(valeurs.avancement) || 0,
        dateDebutSouhaitee: valeurs.dateDebutSouhaitee || null,
        responsableId: valeurs.responsableId || null,
      }
      const enregistree = tache ? await put(`/api/taches/${tache.id}`, corps) : await post('/api/taches', corps)
      const tacheId = enregistree.id

      // Synchroniser les dépendances
      const existantes: any[] = tache?.predecesseurs ?? []
      for (const ex of existantes) {
        const encore = deps.find((d) => d.predecesseurId === ex.predecesseurId && d.type === ex.type && d.lagJours === ex.lagJours)
        if (!encore) await supprimer(`/api/dependances/${ex.id}`)
      }
      for (const d of deps) {
        const deja = existantes.find((ex) => ex.predecesseurId === d.predecesseurId && ex.type === d.type && ex.lagJours === d.lagJours)
        if (!deja && d.predecesseurId) {
          await post('/api/dependances', { predecesseurId: d.predecesseurId, successeurId: tacheId, type: d.type, lagJours: Number(d.lagJours) || 0 })
        }
      }
      // Synchroniser les ressources
      const ressourcesAvant: any[] = tache?.ressources ?? []
      for (const r of ressourcesAvant) await supprimer(`/api/tache-ressources/${r.id}`)
      for (const r of ressources) {
        if (r.employeId || r.materielId) {
          await post('/api/tache-ressources', { tacheId, employeId: r.employeId || null, materielId: r.materielId || null })
        }
      }
      notifier('succes', tache ? 'Tâche modifiée.' : 'Tâche créée.')
      await onEnregistre()
      onFermer()
    } catch (err: any) {
      notifier('erreur', err.message ?? 'Enregistrement impossible.')
    } finally {
      setEnCours(false)
    }
  }

  const ch = (k: string, v: any) => setValeurs((x: any) => ({ ...x, [k]: v }))

  return (
    <Modal titre={tache ? `Modifier — ${tache.nom}` : 'Nouvelle tâche'} ouvert onFermer={onFermer} large>
      <form onSubmit={enregistrer}>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Nom de la tâche" requis colSpan={2}>
            <input className="champ" value={valeurs.nom} onChange={(e) => ch('nom', e.target.value)} required />
          </Champ>
          <Champ label="Lot" requis>
            <select className="champ" value={valeurs.lotId} onChange={(e) => ch('lotId', e.target.value)} required>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>{l.nom}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Durée (jours ouvrés)">
            <input className="champ" type="number" min={0} step="0.5" value={valeurs.dureeJours} onChange={(e) => ch('dureeJours', e.target.value)} disabled={valeurs.estJalon} />
          </Champ>
          <Champ label="Début souhaité (au plus tôt)">
            <input className="champ" type="date" value={valeurs.dateDebutSouhaitee} onChange={(e) => ch('dateDebutSouhaitee', e.target.value)} />
          </Champ>
          <Champ label="Avancement (%)">
            <input className="champ" type="number" min={0} max={100} value={valeurs.avancement} onChange={(e) => ch('avancement', e.target.value)} />
          </Champ>
          <Champ label="Responsable">
            <select className="champ" value={valeurs.responsableId} onChange={(e) => ch('responsableId', e.target.value)}>
              <option value="">—</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.nom} ({e.poste})</option>
              ))}
            </select>
          </Champ>
          <Champ label="Jalon (durée 0)">
            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primaire" checked={valeurs.estJalon} onChange={(e) => ch('estJalon', e.target.checked)} />
              Cette tâche est un jalon
            </label>
          </Champ>
        </div>

        {/* Dépendances */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="etiquette !mb-0">Dépendances (prédécesseurs)</label>
            <button type="button" className="text-xs font-medium text-primaire hover:underline" onClick={() => setDeps((d) => [...d, { predecesseurId: '', type: 'FD', lagJours: 0 }])}>
              + Ajouter une dépendance
            </button>
          </div>
          {deps.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">Aucune dépendance — la tâche démarre au plus tôt.</p>}
          <div className="space-y-2">
            {deps.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="champ flex-1"
                  value={d.predecesseurId}
                  onChange={(e) => setDeps((x) => x.map((y, j) => (j === i ? { ...y, predecesseurId: e.target.value } : y)))}
                >
                  <option value="">— choisir la tâche précédente —</option>
                  {candidatesPred.map((t) => (
                    <option key={t.id} value={t.id}>{t.lot?.nom ? `[${t.lot.nom}] ` : ''}{t.nom}</option>
                  ))}
                </select>
                <select
                  className="champ w-36"
                  value={d.type}
                  onChange={(e) => setDeps((x) => x.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))}
                >
                  {TYPES_DEP.map((t) => (
                    <option key={t.valeur} value={t.valeur}>{t.label}</option>
                  ))}
                </select>
                <input
                  className="champ w-24"
                  type="number"
                  title="Décalage (jours)"
                  value={d.lagJours}
                  onChange={(e) => setDeps((x) => x.map((y, j) => (j === i ? { ...y, lagJours: Number(e.target.value) } : y)))}
                />
                <button type="button" className="btn-danger-doux !p-1.5" onClick={() => setDeps((x) => x.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ressources */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="etiquette !mb-0">Ressources affectées</label>
            <div className="flex gap-3">
              <button type="button" className="text-xs font-medium text-primaire hover:underline" onClick={() => setRessources((r) => [...r, { employeId: '' }])}>
                + Employé
              </button>
              <button type="button" className="text-xs font-medium text-primaire hover:underline" onClick={() => setRessources((r) => [...r, { materielId: '' }])}>
                + Matériel
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {ressources.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {'employeId' in r ? (
                  <select
                    className="champ flex-1"
                    value={r.employeId ?? ''}
                    onChange={(e) => setRessources((x) => x.map((y, j) => (j === i ? { employeId: e.target.value } : y)))}
                  >
                    <option value="">— employé —</option>
                    {employes.map((e) => (
                      <option key={e.id} value={e.id}>{e.nom} ({e.poste})</option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="champ flex-1"
                    value={r.materielId ?? ''}
                    onChange={(e) => setRessources((x) => x.map((y, j) => (j === i ? { materielId: e.target.value } : y)))}
                  >
                    <option value="">— matériel —</option>
                    {materiels.map((m) => (
                      <option key={m.id} value={m.id}>{m.designation}</option>
                    ))}
                  </select>
                )}
                <button type="button" className="btn-danger-doux !p-1.5" onClick={() => setRessources((x) => x.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-discret" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn-primaire" disabled={enCours}>
            {enCours && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────── Modèles de WBS ─────────────────────────────────

function ModalModeles({
  chantierId,
  nbTaches,
  onFermer,
  onApplique,
}: {
  chantierId: string
  nbTaches: number
  onFermer: () => void
  onApplique: () => Promise<void>
}) {
  const { notifier } = useToast()
  const [modeles, setModeles] = useState<any[] | null>(null)
  const [nomModele, setNomModele] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = () => get('/api/modeles-wbs').then(setModeles).catch((e) => notifier('erreur', e.message))
  useEffect(() => {
    charger()
  }, [])

  return (
    <Modal titre="Modèles de WBS" ouvert onFermer={onFermer} large>
      <p className="mb-4 text-sm text-slate-500">
        Appliquez une structure type (lots + tâches + dépendances) en un clic, puis ajustez les durées et lancez le calcul CPM.
      </p>
      {!modeles && <p className="py-6 text-center text-sm text-slate-400">Chargement…</p>}
      <div className="space-y-2">
        {modeles?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800">{m.nom}</div>
              {m.description && <div className="text-xs text-slate-500">{m.description}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                {m.lots.map((l: any, i: number) => (
                  <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {l.lot} ({l.nbTaches})
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-400">
              {m.nbLots} lots · {m.nbTaches} tâches
            </div>
            <button
              className="btn-primaire !px-3 !py-1.5 text-xs"
              disabled={enCours !== null}
              onClick={async () => {
                setEnCours(m.id)
                try {
                  const rep = await post(`/api/chantiers/${chantierId}/appliquer-modele`, { modeleId: m.id })
                  notifier('succes', rep.message)
                  await onApplique()
                  onFermer()
                } catch (e: any) {
                  notifier('erreur', e.message)
                } finally {
                  setEnCours(null)
                }
              }}
            >
              {enCours === m.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Appliquer
            </button>
            <button
              className="btn-danger-doux !p-1.5"
              title="Supprimer ce modèle"
              onClick={async () => {
                try {
                  await supprimer(`/api/modeles-wbs/${m.id}`)
                  await charger()
                } catch (e: any) {
                  notifier('erreur', e.message)
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {nbTaches > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Enregistrer le planning actuel comme modèle</h4>
          <div className="flex items-center gap-2">
            <input
              className="champ flex-1"
              placeholder="Nom du modèle (ex. Villa R+2 standard)"
              value={nomModele}
              onChange={(e) => setNomModele(e.target.value)}
            />
            <button
              className="btn-secondaire !py-2 text-xs"
              disabled={!nomModele.trim() || enCours !== null}
              onClick={async () => {
                setEnCours('save')
                try {
                  await post(`/api/chantiers/${chantierId}/enregistrer-modele`, { nom: nomModele.trim() })
                  notifier('succes', `Modèle « ${nomModele.trim()} » enregistré — réutilisable sur tous les chantiers.`)
                  setNomModele('')
                  await charger()
                } catch (e: any) {
                  notifier('erreur', e.message)
                } finally {
                  setEnCours(null)
                }
              }}
            >
              <Save size={13} /> Enregistrer ({nbTaches} tâches)
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ────────────────────────────── Onglet Préparer ─────────────────────────────

function OngletPreparer({
  planning,
  recharger,
  onCalculer,
  calculEnCours,
}: {
  planning: any
  recharger: () => Promise<void>
  onCalculer: () => void
  calculEnCours: boolean
}) {
  const { peutEcrire } = useAuth()
  const { notifier } = useToast()
  const ecriture = peutEcrire(['CHEF_PROJET', 'CONDUCTEUR'])
  const [nomLot, setNomLot] = useState('')
  const [modalTache, setModalTache] = useState<{ tache: any | null } | null>(null)
  const [suppression, setSuppression] = useState<{ type: 'lot' | 'tache'; cible: any } | null>(null)
  const [modelesOuverts, setModelesOuverts] = useState(false)

  const toutesTaches = planning.lots.flatMap((l: any) => l.taches.map((t: any) => ({ ...t, lot: { nom: l.nom } })))

  const ajouterLot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomLot.trim()) return
    await post('/api/lots', { chantierId: planning.chantier.id, nom: nomLot.trim(), ordre: planning.lots.length + 1 })
    setNomLot('')
    notifier('succes', 'Lot créé.')
    await recharger()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Construisez la WBS : créez des <b>lots</b> (Fondation, Élévation, Toiture…) puis leurs <b>tâches</b> avec durées et dépendances.
        </p>
        {ecriture && (
          <div className="flex items-center gap-2">
            <button className="btn-secondaire" onClick={() => setModelesOuverts(true)} title="Appliquer ou enregistrer un modèle de WBS">
              <BookTemplate size={15} />
              Modèles
            </button>
            <button className="btn-primaire" onClick={onCalculer} disabled={calculEnCours || toutesTaches.length === 0}>
              {calculEnCours ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
              Calculer le planning (CPM)
            </button>
          </div>
        )}
      </div>

      {ecriture && (
        <form onSubmit={ajouterLot} className="mb-4 flex items-center gap-2">
          <Layers size={16} className="text-slate-400" />
          <input className="champ max-w-xs" placeholder="Nom du nouveau lot (ex. Fondation)" value={nomLot} onChange={(e) => setNomLot(e.target.value)} />
          <button className="btn-secondaire !py-2" type="submit" disabled={!nomLot.trim()}>
            <Plus size={15} /> Ajouter le lot
          </button>
        </form>
      )}

      {planning.lots.length === 0 && (
        <div className="carte p-10 text-center text-sm text-slate-400">Aucun lot. Commencez par créer un lot ci-dessus.</div>
      )}

      <div className="space-y-4">
        {planning.lots.map((lot: any) => (
          <div key={lot.id} className="carte overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-700">{lot.nom}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {lot.taches.length} tâche{lot.taches.length > 1 ? 's' : ''}
                </span>
              </div>
              {ecriture && (
                <button className="btn-danger-doux !p-1.5" title="Supprimer le lot" onClick={() => setSuppression({ type: 'lot', cible: lot })}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Tâche</th>
                  <th className="px-2 py-2 font-medium">Durée</th>
                  <th className="px-2 py-2 font-medium">Début souhaité</th>
                  <th className="px-2 py-2 font-medium">Dépendances</th>
                  <th className="px-2 py-2 font-medium">Ressources</th>
                  <th className="px-2 py-2 font-medium text-center">Avancement</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lot.taches.map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2">
                      <span className={cx(t.estJalon && 'font-semibold text-purple-700')}>
                        {t.estJalon && '◆ '}
                        {t.nom}
                      </span>
                      {t.estCritique && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">critique</span>}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{t.estJalon ? 'jalon' : `${t.dureeJours} j`}</td>
                    <td className="px-2 py-2 text-slate-600">{t.dateDebutSouhaitee ? dateFr(t.dateDebutSouhaitee) : '—'}</td>
                    <td className="px-2 py-2">
                      {t.predecesseurs.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.predecesseurs.map((d: any) => (
                            <span key={d.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600" title={`${d.predecesseur?.nom} (${d.type}${d.lagJours ? `, ${d.lagJours > 0 ? '+' : ''}${d.lagJours} j` : ''})`}>
                              {d.predecesseur?.nom?.slice(0, 22)} · {d.type}
                              {d.lagJours ? `${d.lagJours > 0 ? '+' : ''}${d.lagJours}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {t.ressources.map((r: any) => (
                          <span key={r.id} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                            {r.employe?.nom ?? r.materiel?.designation}
                          </span>
                        ))}
                        {t.ressources.length === 0 && <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-medium">{Math.round(t.avancement)} %</td>
                    <td className="px-2 py-2">
                      {ecriture && (
                        <div className="flex items-center justify-end gap-1">
                          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-primaire hover:text-primaire" onClick={() => setModalTache({ tache: t })}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn-danger-doux !p-1.5" onClick={() => setSuppression({ type: 'tache', cible: t })}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {lot.taches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-xs text-slate-400">Aucune tâche dans ce lot.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {ecriture && (
              <div className="border-t border-slate-100 px-4 py-2">
                <button className="text-xs font-medium text-primaire hover:underline" onClick={() => setModalTache({ tache: { lotId: lot.id, __creation: true } })}>
                  + Ajouter une tâche dans « {lot.nom} »
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalTache && (
        <ModalTache
          tache={modalTache.tache?.__creation ? null : modalTache.tache}
          lots={planning.lots}
          toutesTaches={toutesTaches}
          onFermer={() => setModalTache(null)}
          onEnregistre={recharger}
        />
      )}

      {modelesOuverts && (
        <ModalModeles
          chantierId={planning.chantier.id}
          nbTaches={toutesTaches.length}
          onFermer={() => setModelesOuverts(false)}
          onApplique={recharger}
        />
      )}

      <ConfirmSuppression
        ouvert={!!suppression}
        onFermer={() => setSuppression(null)}
        message={
          suppression?.type === 'lot'
            ? `Supprimer le lot « ${suppression.cible.nom} » et toutes ses tâches ?`
            : `Supprimer la tâche « ${suppression?.cible?.nom} » ?`
        }
        onConfirmer={async () => {
          if (!suppression) return
          await supprimer(`/api/${suppression.type === 'lot' ? 'lots' : 'taches'}/${suppression.cible.id}`)
          notifier('succes', 'Supprimé.')
          await recharger()
        }}
      />
    </div>
  )
}

// ─────────────────────────── Onglet Chronogramme ────────────────────────────

function versGroupes(donnees: any[], tous: boolean): { groupes: GroupeGantt[]; taches: TacheGantt[] } {
  const groupes: GroupeGantt[] = []
  const toutes: TacheGantt[] = []
  for (const bloc of donnees) {
    for (const lot of bloc.lots) {
      const taches: TacheGantt[] = lot.taches.map((t: any) => ({
        id: t.id,
        nom: t.nom,
        debut: t.dateDebut ? new Date(t.dateDebut) : null,
        fin: t.dateFin ? new Date(t.dateFin) : null,
        duree: t.dureeJours,
        avancement: t.avancement,
        critique: t.estCritique,
        jalon: t.estJalon,
        marge: t.margeTotale,
      }))
      toutes.push(...taches)
      if (taches.length) {
        groupes.push({
          id: lot.id,
          label: tous ? `${bloc.chantier.nom} — ${lot.nom}` : lot.nom,
          taches,
        })
      }
    }
  }
  return { groupes, taches: toutes }
}

function OngletChronogramme({
  chantier,
  onEditerTache,
  rechargementCle,
  onRecalculer,
  calculEnCours,
}: {
  chantier: any
  onEditerTache: (tacheId: string) => void
  rechargementCle: number
  onRecalculer: () => void
  calculEnCours: boolean
}) {
  const navigate = useNavigate()
  const { notifier } = useToast()
  const { peutEcrire } = useAuth()
  const [echelle, setEchelle] = useState<EchelleGantt>('semaines')
  const [selection, setSelection] = useState<string>(chantier.id)
  const [donnees, setDonnees] = useState<any[] | null>(null)
  const [chantiers, setChantiers] = useState<any[]>([])
  const [alertes, setAlertes] = useState<any[]>([])
  const [alertesOuvertes, setAlertesOuvertes] = useState(false)
  const [baselines, setBaselines] = useState<any[]>([])
  const [baselinesOuvertes, setBaselinesOuvertes] = useState(false)
  const [comparaison, setComparaison] = useState<any>(null)
  const [menuExport, setMenuExport] = useState(false)
  const refExportPng = useRef<(() => void) | null>(null)
  const tous = selection === 'tous'

  useEffect(() => {
    get('/api/chantiers').then((rows) => setChantiers(rows.filter((c: any) => c.planningCalcule || c.id === chantier.id))).catch(() => {})
  }, [chantier.id])

  const charger = useCallback(async () => {
    const rep = await get(`/api/planification/gantt?chantierId=${tous ? 'tous' : selection}`)
    setDonnees(rep)
    const cible = tous ? '/api/planification/alertes' : `/api/chantiers/${selection}/alertes`
    get(cible).then(setAlertes).catch(() => setAlertes([]))
    if (!tous) get(`/api/chantiers/${selection}/baselines`).then(setBaselines).catch(() => setBaselines([]))
  }, [selection, tous])

  useEffect(() => {
    charger().catch((e) => notifier('erreur', e.message))
  }, [charger, rechargementCle])

  const { groupes, taches } = useMemo(() => versGroupes(donnees ?? [], tous), [donnees, tous])

  const aujourdHui = new Date()
  const stats = useMemo(() => {
    const critiques = taches.filter((t) => t.critique && t.avancement < 100).length
    const enRetard = taches.filter((t) => estEnRetard(t, aujourdHui)).length
    const poids = taches.reduce((s, t) => s + Math.max(t.duree, 0.5), 0)
    const avancement = poids ? taches.reduce((s, t) => s + t.avancement * Math.max(t.duree, 0.5), 0) / poids : 0
    const fins = taches.filter((t) => t.fin).map((t) => t.fin!.getTime())
    return {
      total: taches.length,
      critiques,
      enRetard,
      avancement: Math.round(avancement),
      finPrevue: fins.length ? new Date(Math.max(...fins)) : null,
    }
  }, [taches])

  const baselineMap = useMemo(() => {
    if (!comparaison) return undefined
    const map = new Map<string, { debut: Date; fin: Date }>()
    for (const l of comparaison.lignes) {
      if (l.debutPrevu && l.finPrevue) map.set(l.tacheId, { debut: new Date(l.debutPrevu), fin: new Date(l.finPrevue) })
    }
    return map
  }, [comparaison])

  // Glisser-déposer : déplacer = contrainte de début ; étirer = durée. Puis recalcul CPM.
  const editable = !tous && peutEcrire(['CHEF_PROJET', 'CONDUCTEUR'])
  const trouverTache = (id: string) => taches.find((t) => t.id === id)
  const deplacerTache = async (tacheId: string, deltaJours: number) => {
    const t = trouverTache(tacheId)
    if (!t?.debut) return
    try {
      const nouvelleDate = new Date(t.debut.getTime() + deltaJours * 86400000)
      await put(`/api/taches/${tacheId}`, { dateDebutSouhaitee: nouvelleDate.toISOString().slice(0, 10) })
      await post(`/api/chantiers/${selection}/planifier`)
      await charger()
      notifier('succes', `« ${t.nom} » décalée de ${deltaJours > 0 ? '+' : ''}${deltaJours} j — planning recalculé (les dépendances restent prioritaires).`)
    } catch (e: any) {
      notifier('erreur', e.message)
      await charger()
    }
  }
  const redimensionnerTache = async (tacheId: string, deltaJours: number) => {
    const t = trouverTache(tacheId)
    if (!t || t.jalon) return
    try {
      const nouvelleDuree = Math.max(0.5, t.duree + deltaJours)
      await put(`/api/taches/${tacheId}`, { dureeJours: nouvelleDuree })
      await post(`/api/chantiers/${selection}/planifier`)
      await charger()
      notifier('succes', `« ${t.nom} » : durée ${nouvelleDuree} j — planning recalculé.`)
    } catch (e: any) {
      notifier('erreur', e.message)
      await charger()
    }
  }

  if (!donnees) return <Chargement texte="Chargement du chronogramme…" />

  return (
    <div>
      {/* Barre d'outils */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="champ w-64"
          value={selection}
          onChange={(e) => {
            const v = e.target.value
            setComparaison(null)
            if (v !== 'tous' && v !== chantier.id) navigate(`/planification/${v}?onglet=gantt`)
            else setSelection(v)
          }}
        >
          {chantiers.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <button className={cx('btn-discret', tous && '!border-primaire !text-primaire')} onClick={() => { setComparaison(null); setSelection(tous ? chantier.id : 'tous') }}>
          Tous les chantiers
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {(['jours', 'semaines', 'mois'] as EchelleGantt[]).map((e) => (
              <button
                key={e}
                className={cx('rounded-md px-3 py-1.5 font-medium capitalize', echelle === e ? 'bg-primaire text-white' : 'text-slate-500 hover:text-slate-700')}
                onClick={() => setEchelle(e)}
              >
                {e}
              </button>
            ))}
          </div>
          {peutEcrire(['CHEF_PROJET', 'CONDUCTEUR']) && !tous && (
            <button className="btn-primaire !py-2" onClick={onRecalculer} disabled={calculEnCours}>
              {calculEnCours ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Recalculer
            </button>
          )}
          <button
            className="relative inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            onClick={() => setAlertesOuvertes(true)}
          >
            <Bell size={14} />
            Alertes
            {alertes.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {alertes.length}
              </span>
            )}
          </button>
          {!tous && (
            <button className="btn-discret" onClick={() => setBaselinesOuvertes(true)}>
              <Camera size={14} />
              Baselines
              {comparaison && <span className="rounded bg-slate-200 px-1.5 text-[10px]">{comparaison.baseline.nom}</span>}
            </button>
          )}
          <div className="relative">
            <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700" onClick={() => setMenuExport((m) => !m)}>
              <Download size={14} />
              Exporter
              <ChevronDown size={13} />
            </button>
            {menuExport && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" onMouseLeave={() => setMenuExport(false)}>
                {!tous && (
                  <a className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={urlExport(`/api/exports/chantiers/${selection}/planning-pdf`)} target="_blank" rel="noreferrer">
                    <FileText size={14} className="text-red-500" /> PDF
                  </a>
                )}
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { refExportPng.current?.(); setMenuExport(false) }}>
                  <Image size={14} className="text-blue-500" /> PNG
                </button>
                {!tous && (
                  <a className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={urlExport(`/api/exports/chantiers/${selection}/planning-xlsx`)} target="_blank" rel="noreferrer">
                    <FileSpreadsheet size={14} className="text-green-600" /> Excel
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <CarteKpi titre="Tâches" valeur={stats.total} />
        <CarteKpi titre="Critiques" valeur={<span className="text-red-600">{stats.critiques}</span>} />
        <CarteKpi titre="En retard" valeur={<span className="text-orange-500">{stats.enRetard}</span>} />
        <CarteKpi titre="Avancement" valeur={`${stats.avancement} %`} />
        <CarteKpi titre="Fin prévue" valeur={<span className="text-[17px]">{stats.finPrevue ? dateFr(stats.finPrevue) : '—'}</span>} />
      </div>

      {taches.length === 0 ? (
        <div className="carte p-10 text-center text-sm text-slate-400">
          Aucune tâche planifiée. Passez par l'onglet « Préparer » puis lancez le calcul CPM.
        </div>
      ) : (
        <>
          {editable && (
            <p className="mb-2 text-xs text-slate-400">
              💡 Glissez une barre pour décaler son début souhaité, étirez son bord droit pour changer la durée — le CPM est recalculé aussitôt.
            </p>
          )}
          <Gantt
            groupes={groupes}
            echelle={echelle}
            onEditer={onEditerTache}
            baseline={baselineMap}
            refExport={refExportPng}
            onDeplacer={editable ? deplacerTache : undefined}
            onRedimensionner={editable ? redimensionnerTache : undefined}
          />
        </>
      )}

      {/* Panneau alertes */}
      <Modal titre={`Alertes (${alertes.length})`} ouvert={alertesOuvertes} onFermer={() => setAlertesOuvertes(false)} large>
        {alertes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucune alerte — tout est sous contrôle. ✔</p>
        ) : (
          <div className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5', a.gravite === 'haute' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50')}>
                <AlertTriangle size={16} className={cx('mt-0.5 shrink-0', a.gravite === 'haute' ? 'text-red-500' : 'text-orange-500')} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {a.type.replace(/_/g, ' ')} {tous && a.chantierNom ? `— ${a.chantierNom}` : ''}
                  </div>
                  <div className="text-sm text-slate-700">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Panneau baselines */}
      <Modal titre="Baselines (instantanés du planning)" ouvert={baselinesOuvertes} onFermer={() => setBaselinesOuvertes(false)} large>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">Figez le planning courant pour comparer plus tard le prévu et le réalisé.</p>
          {peutEcrire(['CHEF_PROJET', 'CONDUCTEUR']) && (
            <button
              className="btn-primaire !py-1.5 text-xs"
              onClick={async () => {
                try {
                  await post(`/api/chantiers/${selection}/baselines`, { nom: `Baseline du ${dateFr(new Date())}` })
                  notifier('succes', 'Baseline créée.')
                  setBaselines(await get(`/api/chantiers/${selection}/baselines`))
                } catch (e: any) {
                  notifier('erreur', e.message)
                }
              }}
            >
              <Camera size={13} /> Créer une baseline
            </button>
          )}
        </div>
        {baselines.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune baseline pour ce chantier.</p>}
        <div className="space-y-2">
          {baselines.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-700">{b.nom}</div>
                <div className="text-xs text-slate-400">{dateFr(b.dateSnapshot)} · {b.nbTaches} tâches</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondaire !px-2.5 !py-1 text-xs"
                  onClick={async () => {
                    const comp = await get(`/api/baselines/${b.id}/comparaison`)
                    setComparaison(comp)
                    setBaselinesOuvertes(false)
                    notifier('succes', 'Comparaison affichée sur le Gantt (barres grises = prévu).')
                  }}
                >
                  Comparer
                </button>
                {peutEcrire(['CHEF_PROJET', 'CONDUCTEUR']) && (
                  <button
                    className="btn-danger-doux !p-1.5"
                    onClick={async () => {
                      await supprimer(`/api/baselines/${b.id}`)
                      setBaselines(await get(`/api/chantiers/${selection}/baselines`))
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {comparaison && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">Glissements vs « {comparaison.baseline.nom} »</h4>
              <button className="text-xs text-slate-500 underline" onClick={() => setComparaison(null)}>Masquer la comparaison</button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tâche</th>
                    <th className="px-3 py-2">Fin prévue</th>
                    <th className="px-3 py-2">Fin actuelle</th>
                    <th className="px-3 py-2 text-right">Glissement</th>
                  </tr>
                </thead>
                <tbody>
                  {comparaison.lignes.map((l: any) => (
                    <tr key={l.tacheId} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{l.nom}</td>
                      <td className="px-3 py-1.5">{dateFr(l.finPrevue)}</td>
                      <td className="px-3 py-1.5">{dateFr(l.finActuelle)}</td>
                      <td className={cx('px-3 py-1.5 text-right font-semibold', (l.glissementJours ?? 0) > 0 ? 'text-red-600' : (l.glissementJours ?? 0) < 0 ? 'text-green-600' : 'text-slate-400')}>
                        {l.glissementJours == null ? '—' : l.glissementJours > 0 ? `+${l.glissementJours} j` : `${l.glissementJours} j`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────── Onglet Discussion ──────────────────────────────

function OngletDiscussion({ chantierId }: { chantierId: string }) {
  const { notifier } = useToast()
  const { utilisateur } = useAuth()
  const [commentaires, setCommentaires] = useState<any[] | null>(null)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(
    () => get(`/api/chantiers/${chantierId}/commentaires`).then(setCommentaires).catch((e) => notifier('erreur', e.message)),
    [chantierId]
  )
  useEffect(() => {
    charger()
  }, [charger])

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texte.trim()) return
    setEnvoi(true)
    try {
      await post(`/api/chantiers/${chantierId}/commentaires`, { texte: texte.trim() })
      setTexte('')
      await charger()
    } catch (err: any) {
      notifier('erreur', err.message)
    } finally {
      setEnvoi(false)
    }
  }

  const initiales = (nom: string) =>
    nom.split(' ').map((m) => m[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="mx-auto max-w-3xl">
      {utilisateur?.role !== 'LECTURE' && (
        <form onSubmit={envoyer} className="carte mb-4 flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
            {initiales(utilisateur?.nom ?? '?')}
          </div>
          <div className="flex-1">
            <textarea
              className="champ"
              rows={2}
              placeholder="Écrire un message à l'équipe du chantier… (consignes, points bloquants, décisions)"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <button className="btn-primaire !py-1.5 text-xs" disabled={envoi || !texte.trim()}>
                {envoi ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Publier
              </button>
            </div>
          </div>
        </form>
      )}

      {!commentaires && <Chargement texte="Chargement de la discussion…" />}
      {commentaires && commentaires.length === 0 && (
        <div className="carte p-10 text-center text-sm text-slate-400">
          Aucun message pour le moment — lancez la discussion de chantier.
        </div>
      )}
      <div className="space-y-3">
        {commentaires?.map((c) => (
          <div key={c.id} className="carte flex items-start gap-3 p-4 [animation:apparition_0.3s_ease-out]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
              {initiales(c.auteurNom)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-800">{c.auteurNom}</span>
                <span className="text-[11px] text-slate-400">{new Date(c.date).toLocaleString('fr-FR')}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{c.texte}</p>
            </div>
            {(utilisateur?.role === 'ADMIN' || c.auteurId === utilisateur?.id) && (
              <button
                className="btn-danger-doux !p-1.5"
                title="Supprimer ce message"
                onClick={async () => {
                  await supprimer(`/api/commentaires/${c.id}`)
                  await charger()
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────── Page principale ────────────────────────────

export function PlanificationDetail() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const { notifier } = useToast()
  const [planning, setPlanning] = useState<any>(null)
  const [erreurCpm, setErreurCpm] = useState('')
  const [calculEnCours, setCalculEnCours] = useState(false)
  const [rechargementCle, setRechargementCle] = useState(0)
  const [tacheEnEdition, setTacheEnEdition] = useState<any>(null)
  const onglet = params.get('onglet') === 'gantt' ? 'gantt' : params.get('onglet') === 'discussion' ? 'discussion' : 'preparer'

  const recharger = useCallback(async () => {
    const rep = await get(`/api/chantiers/${id}/planning`)
    setPlanning(rep)
    setRechargementCle((k) => k + 1)
  }, [id])

  useEffect(() => {
    recharger().catch((e) => notifier('erreur', e.message))
  }, [recharger])

  const calculer = async () => {
    setCalculEnCours(true)
    setErreurCpm('')
    try {
      const rep = await post(`/api/chantiers/${id}/planifier`)
      setPlanning(rep)
      setRechargementCle((k) => k + 1)
      notifier('succes', `Planning calculé — fin prévue le ${dateFr(rep.finProjet)}.`)
      setParams({ onglet: 'gantt' })
    } catch (e: any) {
      setErreurCpm(e.message ?? 'Calcul impossible.')
      notifier('erreur', e.message ?? 'Calcul impossible.')
    } finally {
      setCalculEnCours(false)
    }
  }

  if (!planning) return <Chargement texte="Chargement du chantier…" />
  const { chantier } = planning
  const nbTaches = planning.lots.reduce((s: number, l: any) => s + l.taches.length, 0)

  const editerDepuisGantt = (tacheId: string) => {
    for (const lot of planning.lots) {
      const t = lot.taches.find((x: any) => x.id === tacheId)
      if (t) {
        setTacheEnEdition(t)
        return
      }
    }
  }

  return (
    <div>
      <div className="mb-1">
        <Link to="/planification" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primaire">
          <ArrowLeft size={13} /> Retour à la planification
        </Link>
      </div>
      <EnTetePage
        titre={chantier.nom}
        sousTitre={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge statut={chantier.statut} />
            {chantier.ville && <span>📍 {chantier.ville}</span>}
            <span>{dateFr(chantier.dateDebut)} → {dateFr(chantier.dateFin)}</span>
            {chantier.planningCalcule && chantier.finPrevue && (
              <span className="font-medium text-green-700">✔ Fin prévue CPM : {dateFr(chantier.finPrevue)}</span>
            )}
          </span>
        }
      />

      {erreurCpm && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erreurCpm}
        </div>
      )}

      {/* Onglets */}
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        <button
          className={cx(
            'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium',
            onglet === 'preparer' ? 'border-primaire text-primaire' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
          onClick={() => setParams({})}
        >
          <ClipboardEdit size={15} /> Préparer
        </button>
        <button
          className={cx(
            'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium',
            onglet === 'gantt' ? 'border-primaire text-primaire' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
          onClick={() => setParams({ onglet: 'gantt' })}
        >
          <GanttChartSquare size={15} /> Chronogramme
          <span className={cx('rounded-full px-1.5 py-0.5 text-[10px] font-bold', onglet === 'gantt' ? 'bg-blue-100 text-primaire' : 'bg-slate-100 text-slate-500')}>
            {nbTaches}
          </span>
        </button>
        <button
          className={cx(
            'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium',
            onglet === 'discussion' ? 'border-primaire text-primaire' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
          onClick={() => setParams({ onglet: 'discussion' })}
        >
          <MessageSquare size={15} /> Discussion
        </button>
      </div>

      {onglet === 'preparer' ? (
        <OngletPreparer planning={planning} recharger={recharger} onCalculer={calculer} calculEnCours={calculEnCours} />
      ) : onglet === 'discussion' ? (
        <OngletDiscussion chantierId={chantier.id} />
      ) : (
        <OngletChronogramme
          chantier={chantier}
          onEditerTache={editerDepuisGantt}
          rechargementCle={rechargementCle}
          onRecalculer={calculer}
          calculEnCours={calculEnCours}
        />
      )}

      {tacheEnEdition && (
        <ModalTache
          tache={tacheEnEdition}
          lots={planning.lots}
          toutesTaches={planning.lots.flatMap((l: any) => l.taches.map((t: any) => ({ ...t, lot: { nom: l.nom } })))}
          onFermer={() => setTacheEnEdition(null)}
          onEnregistre={recharger}
        />
      )}
    </div>
  )
}
