import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, FileSignature, FileText, Loader2, Plus, Receipt, Save, Trash2 } from 'lucide-react'
import { get, post, put, urlExport } from '../lib/api'
import { fcfa, dateFr } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, Champ, Chargement, EnTetePage, Modal, useToast } from '../ui'

interface Ligne {
  designation: string
  unite: string
  quantite: number
  prixUnitaire: number
}

function ModalFacture({ devis, onFermer, onCree }: { devis: any; onFermer: () => void; onCree: () => void }) {
  const { notifier } = useToast()
  const [type, setType] = useState<'acompte' | 'situation' | 'solde'>('acompte')
  const [pourcentage, setPourcentage] = useState(30)
  const [retenue, setRetenue] = useState(5)
  const [echeance, setEcheance] = useState('')
  const [enCours, setEnCours] = useState(false)
  const montant = (devis.totalTTC * pourcentage) / 100

  return (
    <Modal titre={`Créer une facture depuis ${devis.numero}`} ouvert onFermer={onFermer}>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Type de facture">
          <select className="champ" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="acompte">Acompte</option>
            <option value="situation">Situation (avancement)</option>
            <option value="solde">Solde</option>
          </select>
        </Champ>
        <Champ label="Pourcentage du TTC (%)">
          <input className="champ" type="number" min={1} max={100} value={pourcentage} onChange={(e) => setPourcentage(Number(e.target.value))} />
        </Champ>
        <Champ label="Retenue de garantie (%)">
          <input className="champ" type="number" min={0} max={20} value={retenue} onChange={(e) => setRetenue(Number(e.target.value))} />
        </Champ>
        <Champ label="Échéance">
          <input className="champ" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </Champ>
      </div>
      <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Montant de la facture : <b>{fcfa(montant)}</b> ({pourcentage} % de {fcfa(devis.totalTTC)} TTC)
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-discret" onClick={onFermer}>Annuler</button>
        <button
          className="btn-primaire"
          disabled={enCours}
          onClick={async () => {
            setEnCours(true)
            try {
              const f = await post(`/api/devis/${devis.id}/creer-facture`, {
                type, pourcentage, retenueGarantie: retenue,
                ...(echeance ? { echeance } : {}),
              })
              notifier('succes', `Facture ${f.numero} créée (brouillon).`)
              onCree()
              onFermer()
            } catch (e: any) {
              notifier('erreur', e.message)
            } finally {
              setEnCours(false)
            }
          }}
        >
          {enCours && <Loader2 size={14} className="animate-spin" />}
          Créer la facture
        </button>
      </div>
    </Modal>
  )
}

export function DevisDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notifier } = useToast()
  const { peutEcrire } = useAuth()
  const ecriture = peutEcrire(['COMPTABLE', 'CHEF_PROJET'])
  const [devis, setDevis] = useState<any>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [modifie, setModifie] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [modalFacture, setModalFacture] = useState(false)

  const charger = useCallback(async () => {
    const d = await get(`/api/devis/${id}`)
    setDevis(d)
    setLignes(d.lignes.map((l: any) => ({ designation: l.designation, unite: l.unite, quantite: l.quantite, prixUnitaire: l.prixUnitaire })))
    setModifie(false)
  }, [id])

  useEffect(() => {
    charger().catch((e) => notifier('erreur', e.message))
  }, [charger])

  if (!devis) return <Chargement texte="Chargement du devis…" />

  const totalBrut = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
  const totalHT = Math.max(0, totalBrut - (devis.remise || 0))
  const tva = totalHT * (devis.tvaTaux / 100)
  const totalTTC = totalHT + tva

  const majLigne = (i: number, patch: Partial<Ligne>) => {
    setLignes((x) => x.map((l, j) => (j === i ? { ...l, ...patch } : l)))
    setModifie(true)
  }

  const enregistrerLignes = async () => {
    setEnregistrement(true)
    try {
      await put(`/api/devis/${id}/lignes`, lignes.filter((l) => l.designation.trim()))
      notifier('succes', 'Lignes enregistrées.')
      await charger()
    } catch (e: any) {
      notifier('erreur', e.message)
    } finally {
      setEnregistrement(false)
    }
  }

  const changerStatut = async (statut: string) => {
    try {
      await put(`/api/devis/${id}`, { statut })
      notifier('succes', `Devis marqué « ${statut} ».`)
      await charger()
    } catch (e: any) {
      notifier('erreur', e.message)
    }
  }

  return (
    <div>
      <div className="mb-1">
        <Link to="/devis" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primaire">
          <ArrowLeft size={13} /> Retour aux devis
        </Link>
      </div>
      <EnTetePage
        titre={`${devis.numero}${devis.version > 1 ? ` (v${devis.version})` : ''}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge statut={devis.statut} />
            <span>{devis.objet}</span>
            <span className="text-slate-400">· {devis.client?.nom ?? 'Sans client'} · {dateFr(devis.date)}</span>
            {devis.contrat && <span className="font-medium text-emerald-600">Contrat {devis.contrat.numero} signé</span>}
          </span>
        }
        actions={
          <>
            <a className="btn-discret" href={urlExport(`/api/exports/devis/${devis.id}/pdf`)} target="_blank" rel="noreferrer">
              <FileText size={15} className="text-red-500" /> PDF
            </a>
            {ecriture && (
              <>
                <button
                  className="btn-discret"
                  onClick={async () => {
                    const copie = await post(`/api/devis/${devis.id}/dupliquer`)
                    notifier('succes', `Version ${copie.version} créée (${copie.numero}).`)
                    navigate(`/devis/${copie.id}`)
                  }}
                >
                  <Copy size={15} /> Dupliquer (v{devis.version + 1})
                </button>
                {!devis.contrat && (
                  <button
                    className="btn-secondaire"
                    onClick={async () => {
                      try {
                        const c = await post(`/api/devis/${devis.id}/convertir-contrat`, { creerProjet: !devis.projetId })
                        notifier('succes', `Contrat ${c.numero} créé${!devis.projetId ? ' avec son projet' : ''}.`)
                        await charger()
                      } catch (e: any) {
                        notifier('erreur', e.message)
                      }
                    }}
                  >
                    <FileSignature size={15} /> Convertir en contrat
                  </button>
                )}
                <button className="btn-primaire" onClick={() => setModalFacture(true)}>
                  <Receipt size={15} /> Créer une facture
                </button>
              </>
            )}
          </>
        }
      />

      {/* Statut rapide + exonération */}
      {ecriture && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Changer le statut :</span>
          {['brouillon', 'envoyé', 'accepté', 'refusé'].map((s) => (
            <button
              key={s}
              className={`rounded-full border px-3 py-1 font-medium ${devis.statut === s ? 'border-primaire bg-primaire text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-primaire'}`}
              onClick={() => changerStatut(s)}
            >
              {s}
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-slate-200" />
          <button
            className={`rounded-full border px-3 py-1 font-medium transition-colors ${devis.tvaTaux === 0 ? 'border-purple-500 bg-purple-600 text-white shadow-md shadow-purple-500/25' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-400'}`}
            title="Les marchés publics et certains financements sont exonérés de TVA"
            onClick={async () => {
              const nouveauTaux = devis.tvaTaux === 0 ? 19 : 0
              await put(`/api/devis/${id}`, { tvaTaux: nouveauTaux })
              notifier('succes', nouveauTaux === 0 ? 'Devis marqué exonéré de TVA (marché public).' : 'TVA 19 % rétablie.')
              await charger()
            }}
          >
            {devis.tvaTaux === 0 ? '✓ Exonéré de TVA (marché public)' : 'Marquer exonéré de TVA'}
          </button>
        </div>
      )}

      {/* Lignes d'ouvrage */}
      <div className="carte overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-3 py-3 font-medium">N°</th>
              <th className="px-3 py-3 font-medium">Désignation de l'ouvrage</th>
              <th className="w-24 px-3 py-3 font-medium">Unité</th>
              <th className="w-28 px-3 py-3 text-right font-medium">Quantité</th>
              <th className="w-36 px-3 py-3 text-right font-medium">P.U. (FCFA)</th>
              <th className="w-36 px-3 py-3 text-right font-medium">Total</th>
              {ecriture && <th className="w-12 px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  {ecriture ? (
                    <input className="champ !py-1.5" value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })} placeholder="Désignation…" />
                  ) : (
                    l.designation
                  )}
                </td>
                <td className="px-3 py-2">
                  {ecriture ? <input className="champ !py-1.5" value={l.unite} onChange={(e) => majLigne(i, { unite: e.target.value })} /> : l.unite}
                </td>
                <td className="px-3 py-2 text-right">
                  {ecriture ? (
                    <input className="champ !py-1.5 text-right" type="number" step="any" value={l.quantite} onChange={(e) => majLigne(i, { quantite: Number(e.target.value) })} />
                  ) : (
                    l.quantite
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {ecriture ? (
                    <input className="champ !py-1.5 text-right" type="number" step="any" value={l.prixUnitaire} onChange={(e) => majLigne(i, { prixUnitaire: Number(e.target.value) })} />
                  ) : (
                    fcfa(l.prixUnitaire)
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{fcfa(l.quantite * l.prixUnitaire)}</td>
                {ecriture && (
                  <td className="px-3 py-2">
                    <button className="btn-danger-doux !p-1.5" onClick={() => { setLignes((x) => x.filter((_, j) => j !== i)); setModifie(true) }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Aucune ligne — ajoutez les ouvrages du devis.</td></tr>
            )}
          </tbody>
        </table>
        {ecriture && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <button
              className="inline-flex items-center gap-1 text-xs font-medium text-primaire hover:underline"
              onClick={() => { setLignes((x) => [...x, { designation: '', unite: 'u', quantite: 1, prixUnitaire: 0 }]); setModifie(true) }}
            >
              <Plus size={13} /> Ajouter une ligne
            </button>
            {modifie && (
              <button className="btn-primaire !py-1.5 text-xs" onClick={enregistrerLignes} disabled={enregistrement}>
                {enregistrement ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Enregistrer les lignes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="mt-4 flex justify-end">
        <div className="carte w-80 p-4 text-sm">
          {devis.remise > 0 && (
            <>
              <div className="flex justify-between py-1 text-slate-600"><span>Montant brut</span><span>{fcfa(totalBrut)}</span></div>
              <div className="flex justify-between py-1 text-slate-600"><span>Remise</span><span>- {fcfa(devis.remise)}</span></div>
            </>
          )}
          <div className="flex justify-between py-1 text-slate-600"><span>Total HT</span><span className="font-medium">{fcfa(totalHT)}</span></div>
          {devis.tvaTaux > 0 ? (
            <div className="flex justify-between py-1 text-slate-600"><span>TVA {devis.tvaTaux} %</span><span>{fcfa(tva)}</span></div>
          ) : (
            <div className="flex justify-between py-1 text-purple-600"><span>TVA</span><span className="font-medium">Exonéré (marché public)</span></div>
          )}
          <div className="mt-1 flex justify-between rounded-lg bg-primaire px-3 py-2 font-semibold text-white"><span>{devis.tvaTaux > 0 ? 'TOTAL TTC' : 'TOTAL NET'}</span><span>{fcfa(totalTTC)}</span></div>
        </div>
      </div>

      {modalFacture && <ModalFacture devis={{ ...devis, totalTTC }} onFermer={() => setModalFacture(false)} onCree={charger} />}
    </div>
  )
}
