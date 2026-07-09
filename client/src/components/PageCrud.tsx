import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Pencil, Plus, Trash2, Paperclip } from 'lucide-react'
import { get, post, put, supprimer } from '../lib/api'
import { useAuth } from '../auth'
import { Champ, Chargement, ConfirmSuppression, EnTetePage, EtatVide, Modal, Recherche, Tableau, useToast, type Colonne } from '../ui'

export type TypeChampForm = 'texte' | 'nombre' | 'date' | 'select' | 'textarea' | 'case' | 'fichier'

export interface OptionSelect {
  valeur: string
  label: string
}

export interface ChampForm {
  nom: string
  label: string
  type: TypeChampForm
  options?: OptionSelect[] | (() => Promise<OptionSelect[]>)
  requis?: boolean
  colSpan?: number
  placeholder?: string
  etape?: string // pas de nombre (step)
}

/** Charge des options depuis une ressource API : optionsDepuis('clients', 'nom'). */
export function optionsDepuis(ressource: string, champLabel: string | ((r: any) => string)) {
  return async (): Promise<OptionSelect[]> => {
    const rows = await get<any[]>(`/api/${ressource}`)
    return rows.map((r) => ({
      valeur: r.id,
      label: typeof champLabel === 'function' ? champLabel(r) : String(r[champLabel] ?? r.id),
    }))
  }
}

export function FormulaireModal({
  titre,
  ouvert,
  onFermer,
  champs,
  valeursInitiales,
  onSoumettre,
  large,
}: {
  titre: string
  ouvert: boolean
  onFermer: () => void
  champs: ChampForm[]
  valeursInitiales?: Record<string, any>
  onSoumettre: (valeurs: Record<string, any>) => Promise<void>
  large?: boolean
}) {
  const [valeurs, setValeurs] = useState<Record<string, any>>({})
  const [optionsChargees, setOptionsChargees] = useState<Record<string, OptionSelect[]>>({})
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const { notifier } = useToast()

  useEffect(() => {
    if (!ouvert) return
    setErreur('')
    const init: Record<string, any> = {}
    for (const c of champs) {
      let v = valeursInitiales?.[c.nom]
      if (c.type === 'date' && v) v = String(v).slice(0, 10)
      if (c.type === 'case') v = !!v
      init[c.nom] = v ?? (c.type === 'case' ? false : '')
    }
    setValeurs(init)
    for (const c of champs) {
      if (c.type === 'select' && typeof c.options === 'function') {
        c.options().then((opts) => setOptionsChargees((o) => ({ ...o, [c.nom]: opts })))
      }
    }
  }, [ouvert])

  const changer = (nom: string, v: any) => setValeurs((x) => ({ ...x, [nom]: v }))

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    try {
      const nettoyees: Record<string, any> = {}
      for (const c of champs) {
        let v = valeurs[c.nom]
        if (c.type === 'nombre') v = v === '' || v == null ? null : Number(v)
        nettoyees[c.nom] = v
      }
      await onSoumettre(nettoyees)
      onFermer()
    } catch (err: any) {
      setErreur(err.message ?? 'Erreur lors de l’enregistrement.')
      notifier('erreur', err.message ?? 'Erreur lors de l’enregistrement.')
    } finally {
      setEnCours(false)
    }
  }

  const televerser = async (c: ChampForm, fichier: File) => {
    const lecteur = new FileReader()
    lecteur.onload = async () => {
      try {
        const rep = await post('/api/fichiers', { nom: fichier.name, contenu: lecteur.result })
        changer(c.nom, rep.url)
        notifier('succes', 'Justificatif téléversé.')
      } catch (err: any) {
        notifier('erreur', err.message ?? 'Téléversement impossible.')
      }
    }
    lecteur.readAsDataURL(fichier)
  }

  return (
    <Modal titre={titre} ouvert={ouvert} onFermer={onFermer} large={large}>
      <form onSubmit={soumettre}>
        {erreur && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erreur}</div>}
        <div className="grid grid-cols-2 gap-3">
          {champs.map((c) => {
            const options = Array.isArray(c.options) ? c.options : (optionsChargees[c.nom] ?? [])
            return (
              <Champ key={c.nom} label={c.label} requis={c.requis} colSpan={c.colSpan ?? (c.type === 'textarea' ? 2 : 1)}>
                {c.type === 'select' ? (
                  <select className="champ" value={valeurs[c.nom] ?? ''} onChange={(e) => changer(c.nom, e.target.value)} required={c.requis}>
                    <option value="">—</option>
                    {options.map((o) => (
                      <option key={o.valeur} value={o.valeur}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : c.type === 'textarea' ? (
                  <textarea className="champ" rows={3} value={valeurs[c.nom] ?? ''} onChange={(e) => changer(c.nom, e.target.value)} placeholder={c.placeholder} />
                ) : c.type === 'case' ? (
                  <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primaire focus:ring-blue-200"
                      checked={!!valeurs[c.nom]}
                      onChange={(e) => changer(c.nom, e.target.checked)}
                    />
                    Oui
                  </label>
                ) : c.type === 'fichier' ? (
                  <div className="flex items-center gap-2">
                    <label className="btn-discret cursor-pointer text-xs">
                      <Paperclip size={13} />
                      {valeurs[c.nom] ? 'Remplacer' : 'Joindre un fichier'}
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && televerser(c, e.target.files[0])} />
                    </label>
                    {valeurs[c.nom] && (
                      <a href={valeurs[c.nom]} target="_blank" rel="noreferrer" className="truncate text-xs text-primaire underline">
                        Voir le justificatif
                      </a>
                    )}
                  </div>
                ) : (
                  <input
                    className="champ"
                    type={c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                    step={c.etape ?? (c.type === 'nombre' ? 'any' : undefined)}
                    value={valeurs[c.nom] ?? ''}
                    onChange={(e) => changer(c.nom, e.target.value)}
                    required={c.requis}
                    placeholder={c.placeholder}
                  />
                )}
              </Champ>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <button type="submit" className="btn-primaire" disabled={enCours}>
            {enCours && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function usePageCrud<T extends { id: string }>(ressource: string, params?: Record<string, string>) {
  const [lignes, setLignes] = useState<T[]>([])
  const [chargement, setChargement] = useState(true)
  const [parametresUrl] = useSearchParams()
  const qUrl = parametresUrl.get('q')
  const [q, setQ] = useState(qUrl ?? '')

  // La palette de commandes navigue avec ?q=… : on synchronise la recherche locale
  useEffect(() => {
    if (qUrl != null) setQ(qUrl)
  }, [qUrl])

  const recharger = useCallback(async () => {
    const query = new URLSearchParams({ ...(params ?? {}), ...(q ? { q } : {}) }).toString()
    const donnees = await get<T[]>(`/api/${ressource}${query ? `?${query}` : ''}`)
    setLignes(donnees)
    setChargement(false)
  }, [ressource, q, JSON.stringify(params)])

  useEffect(() => {
    const minuteur = setTimeout(() => {
      recharger().catch(() => setChargement(false))
    }, q ? 250 : 0)
    return () => clearTimeout(minuteur)
  }, [recharger])

  return { lignes, chargement, q, setQ, recharger }
}

export function PageCrud<T extends { id: string }>({
  titre,
  sousTitre,
  ressource,
  colonnes,
  champs,
  rolesEcriture,
  boutonCreer,
  transformer,
  actionsSupplementaires,
  enTeteSupplement,
  large,
  libelleSuppression,
}: {
  titre: string
  sousTitre?: string
  ressource: string
  colonnes: Colonne<T>[]
  champs: ChampForm[]
  rolesEcriture: string[]
  boutonCreer?: string
  transformer?: (valeurs: Record<string, any>, edition: T | null) => Record<string, any>
  actionsSupplementaires?: (ligne: T, recharger: () => Promise<void>) => React.ReactNode
  enTeteSupplement?: React.ReactNode
  large?: boolean
  libelleSuppression?: (ligne: T) => string
}) {
  const { lignes, chargement, q, setQ, recharger } = usePageCrud<T>(ressource)
  const { peutEcrire } = useAuth()
  const { notifier } = useToast()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [edition, setEdition] = useState<T | null>(null)
  const [suppression, setSuppression] = useState<T | null>(null)
  const ecriture = peutEcrire(rolesEcriture)

  const colonnesAvecActions = useMemo<Colonne<T>[]>(() => {
    const base = [...colonnes]
    base.push({
      titre: '',
      align: 'right',
      largeur: '130px',
      rendu: (l) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {actionsSupplementaires?.(l, recharger)}
          {ecriture && (
            <>
              <button
                title="Modifier"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-primaire hover:text-primaire"
                onClick={() => {
                  setEdition(l)
                  setModalOuvert(true)
                }}
              >
                <Pencil size={14} />
              </button>
              <button title="Supprimer" className="btn-danger-doux !p-1.5" onClick={() => setSuppression(l)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    })
    return base
  }, [colonnes, ecriture, actionsSupplementaires, recharger])

  return (
    <div>
      <EnTetePage
        titre={titre}
        sousTitre={sousTitre ?? `${lignes.length} élément${lignes.length > 1 ? 's' : ''}`}
        actions={
          <>
            {enTeteSupplement}
            <Recherche valeur={q} onChange={setQ} />
            {ecriture && (
              <button
                className="btn-primaire"
                onClick={() => {
                  setEdition(null)
                  setModalOuvert(true)
                }}
              >
                <Plus size={16} />
                {boutonCreer ?? 'Nouveau'}
              </button>
            )}
          </>
        }
      />
      {chargement ? (
        <Chargement />
      ) : lignes.length === 0 && !q ? (
        <EtatVide
          titre={`Aucun élément pour « ${titre} »`}
          description={
            ecriture
              ? `Commencez par créer votre premier élément — cela ne prend qu'un instant.`
              : `La liste est vide pour le moment.`
          }
          action={
            ecriture ? (
              <button
                className="btn-primaire"
                onClick={() => {
                  setEdition(null)
                  setModalOuvert(true)
                }}
              >
                <Plus size={16} />
                {boutonCreer ?? 'Nouveau'}
              </button>
            ) : undefined
          }
        />
      ) : (
        <Tableau colonnes={colonnesAvecActions} lignes={lignes} vide={q ? `Aucun résultat pour « ${q} ».` : undefined} />
      )}

      <FormulaireModal
        titre={edition ? `Modifier — ${titre}` : (boutonCreer ?? 'Nouveau')}
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
        champs={champs}
        valeursInitiales={edition ?? undefined}
        large={large}
        onSoumettre={async (valeurs) => {
          const corps = transformer ? transformer(valeurs, edition) : valeurs
          if (edition) {
            await put(`/api/${ressource}/${edition.id}`, corps)
            notifier('succes', 'Modifications enregistrées.')
          } else {
            await post(`/api/${ressource}`, corps)
            notifier('succes', 'Élément créé.')
          }
          await recharger()
        }}
      />

      <ConfirmSuppression
        ouvert={!!suppression}
        onFermer={() => setSuppression(null)}
        message={suppression && libelleSuppression ? libelleSuppression(suppression) : undefined}
        onConfirmer={async () => {
          if (!suppression) return
          try {
            await supprimer(`/api/${ressource}/${suppression.id}`)
            notifier('succes', 'Élément supprimé.')
            await recharger()
          } catch (err: any) {
            notifier('erreur', err.message ?? 'Suppression impossible.')
          }
        }}
      />
    </div>
  )
}
