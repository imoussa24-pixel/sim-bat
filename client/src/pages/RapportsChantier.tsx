import { useState } from 'react'
import { Camera, FileText, Loader2, Plus, Trash2, X } from 'lucide-react'
import { get, post, put, supprimer, urlExport } from '../lib/api'
import { dateFr, dateIso } from '../lib/format'
import { useAuth } from '../auth'
import { Champ, Chargement, ConfirmSuppression, EnTetePage, Modal, Recherche, cx, useToast } from '../ui'
import { usePageCrud } from '../components/PageCrud'

const METEOS = ['ensoleillé', 'nuageux', 'pluie', 'vent de sable', 'harmattan']
const ICONE_METEO: Record<string, string> = {
  'ensoleillé': '☀️', 'nuageux': '⛅', 'pluie': '🌧', 'vent de sable': '🌪', 'harmattan': '🌫',
}

function ModalRapport({
  rapport,
  onFermer,
  onEnregistre,
}: {
  rapport: any | null
  onFermer: () => void
  onEnregistre: () => Promise<void>
}) {
  const { notifier } = useToast()
  const [chantiers, setChantiers] = useState<any[]>([])
  const [valeurs, setValeurs] = useState<any>({
    chantierId: rapport?.chantierId ?? '',
    date: rapport?.date ? String(rapport.date).slice(0, 10) : dateIso(new Date()),
    meteo: rapport?.meteo ?? 'ensoleillé',
    effectif: rapport?.effectif ?? 0,
    travauxRealises: rapport?.travauxRealises ?? '',
    incidents: rapport?.incidents ?? '',
    besoins: rapport?.besoins ?? '',
  })
  const [photos, setPhotos] = useState<string[]>(() => {
    try {
      return JSON.parse(rapport?.photos ?? '[]')
    } catch {
      return []
    }
  })
  const [enCours, setEnCours] = useState(false)
  const [televersement, setTeleversement] = useState(false)

  useState(() => {
    get('/api/chantiers').then((rows) => {
      setChantiers(rows)
      if (!valeurs.chantierId && rows.length) {
        const enCoursCh = rows.find((c: any) => c.statut === 'En cours') ?? rows[0]
        setValeurs((v: any) => ({ ...v, chantierId: enCoursCh.id }))
      }
    })
  })

  const ch = (k: string, v: any) => setValeurs((x: any) => ({ ...x, [k]: v }))

  const ajouterPhoto = (fichier: File) => {
    if (!/image\/(jpe?g|png)/.test(fichier.type)) {
      notifier('erreur', 'Formats acceptés : JPG ou PNG.')
      return
    }
    setTeleversement(true)
    const lecteur = new FileReader()
    lecteur.onload = async () => {
      try {
        const rep = await post('/api/fichiers', { nom: fichier.name, contenu: lecteur.result })
        setPhotos((p) => [...p, rep.url])
      } catch (e: any) {
        notifier('erreur', e.message)
      } finally {
        setTeleversement(false)
      }
    }
    lecteur.readAsDataURL(fichier)
  }

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnCours(true)
    try {
      const corps = {
        ...valeurs,
        effectif: Number(valeurs.effectif) || 0,
        incidents: valeurs.incidents || null,
        besoins: valeurs.besoins || null,
        photos: JSON.stringify(photos),
      }
      if (rapport) await put(`/api/rapports-journaliers/${rapport.id}`, corps)
      else await post('/api/rapports-journaliers', corps)
      notifier('succes', rapport ? 'Rapport modifié.' : 'Rapport enregistré.')
      await onEnregistre()
      onFermer()
    } catch (err: any) {
      notifier('erreur', err.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal titre={rapport ? `Rapport du ${dateFr(rapport.date)}` : 'Nouveau rapport journalier'} ouvert onFermer={onFermer} large>
      <form onSubmit={enregistrer}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Champ label="Chantier" requis colSpan={2}>
            <select className="champ" value={valeurs.chantierId} onChange={(e) => ch('chantierId', e.target.value)} required>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Date">
            <input className="champ" type="date" value={valeurs.date} onChange={(e) => ch('date', e.target.value)} />
          </Champ>
          <Champ label="Météo">
            <select className="champ" value={valeurs.meteo} onChange={(e) => ch('meteo', e.target.value)}>
              {METEOS.map((m) => (
                <option key={m} value={m}>{ICONE_METEO[m]} {m}</option>
              ))}
            </select>
          </Champ>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Champ label="Effectif présent (0 = repris automatiquement du pointage du jour)">
            <input className="champ !w-40" type="number" min={0} value={valeurs.effectif} onChange={(e) => ch('effectif', e.target.value)} />
          </Champ>
          <Champ label="Travaux réalisés" requis>
            <textarea className="champ" rows={3} value={valeurs.travauxRealises} onChange={(e) => ch('travauxRealises', e.target.value)} required placeholder="Coulage plancher haut RDC zone A, maçonnerie pignon Est…" />
          </Champ>
          <Champ label="Incidents / observations">
            <textarea className="champ" rows={2} value={valeurs.incidents} onChange={(e) => ch('incidents', e.target.value)} placeholder="Panne bétonnière 2 h, pluie l'après-midi…" />
          </Champ>
          <Champ label="Besoins (matériaux, matériel, main-d'œuvre)">
            <textarea className="champ" rows={2} value={valeurs.besoins} onChange={(e) => ch('besoins', e.target.value)} placeholder="200 sacs ciment pour lundi, prévoir vibreur de secours…" />
          </Champ>
        </div>

        {/* Photos */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="etiquette !mb-0">Photos du jour ({photos.length})</label>
            <label className={cx('btn-discret cursor-pointer text-xs', televersement && 'opacity-50')}>
              {televersement ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              Ajouter une photo
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && ajouterPhoto(e.target.files[0])} />
            </label>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-slate-200">
                  <img src={p} alt={`photo ${i + 1}`} className="h-24 w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 hidden rounded-full bg-red-600 p-1 text-white group-hover:block"
                    onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-discret" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn-primaire" disabled={enCours}>
            {enCours && <Loader2 size={14} className="animate-spin" />}
            Enregistrer le rapport
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function RapportsChantier() {
  const { lignes, chargement, q, setQ, recharger } = usePageCrud<any>('rapports-journaliers')
  const { peutEcrire } = useAuth()
  const { notifier } = useToast()
  const [modal, setModal] = useState<{ rapport: any | null } | null>(null)
  const [suppression, setSuppression] = useState<any>(null)
  const ecriture = peutEcrire(['CHEF_PROJET', 'CONDUCTEUR'])

  if (chargement) return <Chargement texte="Chargement des rapports…" />

  return (
    <div>
      <EnTetePage
        titre="Rapports journaliers"
        sousTitre="Journal de chantier : météo, effectif, travaux, incidents et photos — exportable en PDF"
        actions={
          <>
            <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un rapport…" />
            {ecriture && (
              <button className="btn-primaire" onClick={() => setModal({ rapport: null })}>
                <Plus size={16} /> Nouveau rapport
              </button>
            )}
          </>
        }
      />

      {lignes.length === 0 && (
        <div className="carte p-12 text-center text-sm text-slate-400">
          Aucun rapport journalier. Créez le premier depuis le bouton « Nouveau rapport ».
        </div>
      )}

      <div className="grille-animee grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lignes.map((r: any) => {
          let photos: string[] = []
          try {
            photos = JSON.parse(r.photos ?? '[]')
          } catch { /* ignore */ }
          return (
            <div key={r.id} className="carte carte-interactive flex flex-col overflow-hidden">
              {photos.length > 0 && (
                <div className="flex h-28 gap-0.5 overflow-hidden">
                  {photos.slice(0, 3).map((p, i) => (
                    <img key={i} src={p} alt="" className="h-full min-w-0 flex-1 object-cover" />
                  ))}
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{r.chantier?.nom}</div>
                    <div className="text-xs text-slate-400">
                      {dateFr(r.date)} · {ICONE_METEO[r.meteo] ?? ''} {r.meteo ?? '—'} · 👷 {r.effectif}
                    </div>
                  </div>
                </div>
                <p className="mb-2 line-clamp-3 text-xs text-slate-600">{r.travauxRealises}</p>
                {r.incidents && (
                  <p className="mb-2 line-clamp-2 rounded-lg bg-orange-50 px-2 py-1 text-[11px] text-orange-700">⚠ {r.incidents}</p>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <span className="text-[11px] text-slate-400">par {r.redacteurNom ?? '—'}</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-400 hover:text-red-500"
                      title="Exporter en PDF"
                      href={urlExport(`/api/exports/rapports-journaliers/${r.id}/pdf`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={14} />
                    </a>
                    {ecriture && (
                      <>
                        <button className="btn-secondaire !px-2.5 !py-1.5 text-xs" onClick={() => setModal({ rapport: r })}>
                          Modifier
                        </button>
                        <button className="btn-danger-doux !p-1.5" onClick={() => setSuppression(r)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modal && <ModalRapport rapport={modal.rapport} onFermer={() => setModal(null)} onEnregistre={recharger} />}
      <ConfirmSuppression
        ouvert={!!suppression}
        onFermer={() => setSuppression(null)}
        message={suppression ? `Supprimer le rapport du ${dateFr(suppression.date)} (${suppression.chantier?.nom}) ?` : undefined}
        onConfirmer={async () => {
          await supprimer(`/api/rapports-journaliers/${suppression.id}`)
          notifier('succes', 'Rapport supprimé.')
          await recharger()
        }}
      />
    </div>
  )
}
