import { useEffect, useState } from 'react'
import {
  Archive, Building2, CalendarDays, Database, Download, FileUp, Loader2, Plus,
  RotateCcw, Save, Trash2, Users, X,
} from 'lucide-react'
import { get, post, put, urlExport } from '../lib/api'
import { dateFr } from '../lib/format'
import { useAuth } from '../auth'
import { Champ, EnTetePage, cx, useToast } from '../ui'
import { PageCrud, type ChampForm } from '../components/PageCrud'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const CHAMPS_UTILISATEUR: ChampForm[] = [
  { nom: 'nom', label: 'Nom complet', type: 'texte', requis: true },
  { nom: 'email', label: 'Email', type: 'texte', requis: true },
  {
    nom: 'role', label: 'Rôle', type: 'select', requis: true,
    options: [
      { valeur: 'ADMIN', label: 'Administrateur' },
      { valeur: 'CHEF_PROJET', label: 'Chef de projet' },
      { valeur: 'CONDUCTEUR', label: 'Conducteur de travaux' },
      { valeur: 'COMPTABLE', label: 'Comptable' },
      { valeur: 'MAGASINIER', label: 'Magasinier' },
      { valeur: 'LECTURE', label: 'Lecture seule' },
    ],
  },
  { nom: 'motDePasse', label: 'Mot de passe (laisser vide pour ne pas changer)', type: 'texte' },
  { nom: 'actif', label: 'Compte actif', type: 'case' },
]

const LIBELLE_ROLE: Record<string, string> = {
  ADMIN: 'Administrateur', CHEF_PROJET: 'Chef de projet', CONDUCTEUR: 'Conducteur de travaux',
  COMPTABLE: 'Comptable', MAGASINIER: 'Magasinier', LECTURE: 'Lecture seule',
}

// ─────────────────────────── Onglet Entreprise ──────────────────────────────

function OngletEntreprise() {
  const { notifier } = useToast()
  const [valeurs, setValeurs] = useState<any>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    get('/api/parametres/entreprise').then(setValeurs).catch((e) => notifier('erreur', e.message))
  }, [])

  if (!valeurs) return <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>
  const ch = (k: string, v: string) => setValeurs((x: any) => ({ ...x, [k]: v }))

  return (
    <form
      className="carte max-w-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setEnCours(true)
        try {
          await put('/api/parametres/entreprise', valeurs)
          notifier('succes', 'Informations enregistrées — elles apparaîtront sur les PDF (devis, factures, plannings).')
        } catch (err: any) {
          notifier('erreur', err.message)
        } finally {
          setEnCours(false)
        }
      }}
    >
      <p className="mb-4 text-sm text-slate-500">
        Ces informations figurent dans l'en-tête de tous les documents exportés (devis, factures, plannings PDF).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Raison sociale" requis colSpan={2}>
          <input className="champ" value={valeurs.nom} onChange={(e) => ch('nom', e.target.value)} required />
        </Champ>
        <Champ label="Adresse" colSpan={2}>
          <input className="champ" value={valeurs.adresse} onChange={(e) => ch('adresse', e.target.value)} />
        </Champ>
        <Champ label="Téléphone">
          <input className="champ" value={valeurs.tel} onChange={(e) => ch('tel', e.target.value)} />
        </Champ>
        <Champ label="Email">
          <input className="champ" value={valeurs.email} onChange={(e) => ch('email', e.target.value)} />
        </Champ>
        <Champ label="NIF / RCCM" colSpan={2}>
          <input className="champ" value={valeurs.nif} onChange={(e) => ch('nif', e.target.value)} />
        </Champ>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-primaire" disabled={enCours}>
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────── Onglet Calendrier ──────────────────────────────

function OngletCalendrier() {
  const { notifier } = useToast()
  const [calendrier, setCalendrier] = useState<{ joursOuvres: number[]; feries: string[] } | null>(null)
  const [nouveauFerie, setNouveauFerie] = useState('')
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    get('/api/parametres/calendrier').then(setCalendrier).catch((e) => notifier('erreur', e.message))
  }, [])

  if (!calendrier) return <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>

  const basculerJour = (j: number) =>
    setCalendrier((c) => {
      if (!c) return c
      const jours = c.joursOuvres.includes(j) ? c.joursOuvres.filter((x) => x !== j) : [...c.joursOuvres, j].sort()
      return { ...c, joursOuvres: jours }
    })

  const enregistrer = async () => {
    if (!calendrier.joursOuvres.length) {
      notifier('erreur', 'Il faut au moins un jour ouvré par semaine.')
      return
    }
    setEnCours(true)
    try {
      await put('/api/parametres/calendrier', calendrier)
      notifier('succes', 'Calendrier enregistré — il sera utilisé au prochain calcul CPM de chaque chantier.')
    } catch (e: any) {
      notifier('erreur', e.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="carte max-w-2xl p-5">
      <p className="mb-4 text-sm text-slate-500">
        Le moteur CPM planifie uniquement sur les jours ouvrés et saute les jours fériés. Recalculez ensuite les plannings pour appliquer les changements.
      </p>
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Jours travaillés</h4>
      <div className="mb-5 flex flex-wrap gap-2">
        {JOURS.map((nom, j) => (
          <button
            key={j}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
              calendrier.joursOuvres.includes(j)
                ? 'border-primaire bg-primaire text-white shadow-md shadow-blue-600/25'
                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
            )}
            onClick={() => basculerJour(j)}
          >
            {nom}
          </button>
        ))}
      </div>

      <h4 className="mb-2 text-sm font-semibold text-slate-700">Jours fériés ({calendrier.feries.length})</h4>
      <div className="mb-3 flex flex-wrap gap-2">
        {calendrier.feries.sort().map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {dateFr(f)}
            <button
              className="text-slate-400 hover:text-red-500"
              onClick={() => setCalendrier((c) => (c ? { ...c, feries: c.feries.filter((x) => x !== f) } : c))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {calendrier.feries.length === 0 && <span className="text-xs text-slate-400">Aucun jour férié configuré.</span>}
      </div>
      <div className="mb-5 flex items-center gap-2">
        <input className="champ !w-44" type="date" value={nouveauFerie} onChange={(e) => setNouveauFerie(e.target.value)} />
        <button
          className="btn-secondaire !py-2 text-xs"
          disabled={!nouveauFerie}
          onClick={() => {
            if (nouveauFerie && !calendrier.feries.includes(nouveauFerie)) {
              setCalendrier((c) => (c ? { ...c, feries: [...c.feries, nouveauFerie] } : c))
              setNouveauFerie('')
            }
          }}
        >
          <Plus size={13} /> Ajouter le férié
        </button>
      </div>
      <div className="flex justify-end">
        <button className="btn-primaire" onClick={enregistrer} disabled={enCours}>
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer le calendrier
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────── Onglet Corbeille ──────────────────────────────

function OngletCorbeille() {
  const { notifier } = useToast()
  const [elements, setElements] = useState<any[] | null>(null)

  const charger = () => get('/api/corbeille').then(setElements).catch((e) => notifier('erreur', e.message))
  useEffect(() => {
    charger()
  }, [])

  if (!elements) return <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>

  return (
    <div className="carte max-w-3xl overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">
          Les éléments supprimés sont conservés en base (suppression douce). Vous pouvez les restaurer ici.
        </p>
      </div>
      {elements.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-400">La corbeille est vide. 🧹</p>}
      <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
        {elements.map((e) => (
          <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60">
            <Archive size={15} className="shrink-0 text-slate-300" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-700">{e.libelle}</div>
              <div className="text-xs text-slate-400">
                {e.type} · supprimé le {dateFr(e.supprimeLe)}
              </div>
            </div>
            <button
              className="btn-secondaire !px-3 !py-1.5 text-xs"
              onClick={async () => {
                try {
                  await post('/api/corbeille/restaurer', { type: e.type, id: e.id })
                  notifier('succes', 'Élément restauré.')
                  await charger()
                } catch (err: any) {
                  notifier('erreur', err.message)
                }
              }}
            >
              <RotateCcw size={13} /> Restaurer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────── Onglet Import ─────────────────────────────────

const TYPES_IMPORT = [
  { valeur: 'clients', label: 'Clients' },
  { valeur: 'employes', label: 'Employés' },
  { valeur: 'materiaux', label: 'Matériaux (stock)' },
]

function OngletImport() {
  const { notifier } = useToast()
  const [type, setType] = useState('clients')
  const [resultat, setResultat] = useState<{ crees: number; erreurs: string[] } | null>(null)
  const [enCours, setEnCours] = useState(false)

  const importer = (fichier: File) => {
    setEnCours(true)
    setResultat(null)
    const lecteur = new FileReader()
    lecteur.onload = async () => {
      try {
        const rep = await post(`/api/imports/${type}`, { contenu: lecteur.result })
        setResultat(rep)
        notifier('succes', `${rep.crees} élément(s) importé(s).`)
      } catch (e: any) {
        notifier('erreur', e.message)
      } finally {
        setEnCours(false)
      }
    }
    lecteur.readAsDataURL(fichier)
  }

  return (
    <div className="carte max-w-2xl p-5">
      <p className="mb-4 text-sm text-slate-500">
        Importez vos données existantes depuis Excel : téléchargez le modèle, remplissez-le (une ligne par élément),
        puis chargez le fichier. Les colonnes sont reconnues par leur en-tête.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="etiquette">Type de données</label>
          <select className="champ !w-52" value={type} onChange={(e) => { setType(e.target.value); setResultat(null) }}>
            {TYPES_IMPORT.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.label}</option>
            ))}
          </select>
        </div>
        <a className="btn-discret" href={urlExport(`/api/imports/${type}/modele`)} target="_blank" rel="noreferrer">
          <Download size={15} /> Télécharger le modèle
        </a>
        <label className={cx('btn-primaire cursor-pointer', enCours && 'pointer-events-none opacity-60')}>
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          Charger le fichier rempli
          <input
            type="file"
            className="hidden"
            accept=".xlsx"
            onChange={(e) => e.target.files?.[0] && importer(e.target.files[0])}
          />
        </label>
      </div>
      {resultat && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <div className="font-medium text-green-700">✔ {resultat.crees} élément(s) créé(s)</div>
          {resultat.erreurs.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-red-600">
              {resultat.erreurs.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Onglet Sauvegarde ──────────────────────────────

function OngletSauvegarde() {
  return (
    <div className="carte max-w-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primaire">
          <Database size={22} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-700">Sauvegarde de la base de données</h4>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Toutes les données (clients, chantiers, plannings, finance…) tiennent dans un seul fichier.
            Téléchargez-le régulièrement et conservez-le en lieu sûr (clé USB, cloud). Pour restaurer,
            remplacez le fichier <code className="rounded bg-slate-100 px-1 text-xs">server/prisma/dev.db</code> puis redémarrez l'application.
          </p>
          <a className="btn-primaire inline-flex" href={urlExport('/api/parametres/sauvegarde')} target="_blank" rel="noreferrer">
            <Download size={15} />
            Télécharger la sauvegarde du {dateFr(new Date())}
          </a>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────── Page ──────────────────────────────────────

const ONGLETS = [
  { id: 'utilisateurs', label: 'Utilisateurs', icone: <Users size={15} /> },
  { id: 'entreprise', label: 'Entreprise', icone: <Building2 size={15} /> },
  { id: 'calendrier', label: 'Calendrier ouvré', icone: <CalendarDays size={15} /> },
  { id: 'import', label: 'Import Excel', icone: <FileUp size={15} /> },
  { id: 'corbeille', label: 'Corbeille', icone: <Trash2 size={15} /> },
  { id: 'sauvegarde', label: 'Sauvegarde', icone: <Database size={15} /> },
]

export function Parametres() {
  const { utilisateur } = useAuth()
  const [onglet, setOnglet] = useState('utilisateurs')

  if (utilisateur?.role !== 'ADMIN') {
    return (
      <div className="carte mx-auto mt-16 max-w-md p-8 text-center">
        <h1 className="mb-2 text-lg font-bold text-slate-800">Accès réservé</h1>
        <p className="text-sm text-slate-500">Seuls les administrateurs peuvent accéder aux paramètres de l'application.</p>
      </div>
    )
  }

  return (
    <div>
      <EnTetePage titre="Paramètres" sousTitre="Administration : comptes, entreprise, calendrier ouvré, corbeille et sauvegardes" />
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={cx(
              'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              onglet === o.id ? 'border-primaire text-primaire' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
            onClick={() => setOnglet(o.id)}
          >
            {o.icone}
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'utilisateurs' && (
        <PageCrud
          titre="Utilisateurs"
          sousTitre="Comptes d'accès à l'application et rôles"
          ressource="utilisateurs"
          boutonCreer="Nouvel utilisateur"
          rolesEcriture={[]}
          champs={CHAMPS_UTILISATEUR}
          libelleSuppression={(u: any) => `Désactiver et supprimer le compte « ${u.nom} » (${u.email}) ?`}
          colonnes={[
            { titre: 'Nom', rendu: (u: any) => <span className="font-medium text-slate-800">{u.nom}</span> },
            { titre: 'Email', rendu: (u: any) => u.email },
            {
              titre: 'Rôle',
              rendu: (u: any) => (
                <span
                  className={cx(
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                    u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : u.role === 'LECTURE' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'
                  )}
                >
                  {LIBELLE_ROLE[u.role] ?? u.role}
                </span>
              ),
            },
            { titre: 'Actif', align: 'center', rendu: (u: any) => (u.actif ? <span className="text-green-600">●</span> : <span className="text-slate-300">●</span>) },
            { titre: 'Créé le', rendu: (u: any) => dateFr(u.createdAt) },
          ]}
        />
      )}
      {onglet === 'entreprise' && <OngletEntreprise />}
      {onglet === 'calendrier' && <OngletCalendrier />}
      {onglet === 'import' && <OngletImport />}
      {onglet === 'corbeille' && <OngletCorbeille />}
      {onglet === 'sauvegarde' && <OngletSauvegarde />}
    </div>
  )
}
