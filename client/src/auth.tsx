import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Loader2, LogIn } from 'lucide-react'
import { ecrireSession, lireSession, post, surChangementSession, type Utilisateur } from './lib/api'

interface ContexteAuth {
  utilisateur: Utilisateur | null
  connecter: (email: string, motDePasse: string) => Promise<void>
  deconnecter: () => void
  peutEcrire: (roles: string[]) => boolean
}

const Contexte = createContext<ContexteAuth>(null as any)
export const useAuth = () => useContext(Contexte)

export function FournisseurAuth({ children }: { children: React.ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(() => lireSession()?.utilisateur ?? null)

  useEffect(() => surChangementSession(setUtilisateur), [])

  const connecter = async (email: string, motDePasse: string) => {
    const session = await post('/api/auth/connexion', { email, motDePasse })
    ecrireSession(session)
  }

  const deconnecter = () => {
    const session = lireSession()
    if (session?.refreshToken) post('/api/auth/deconnexion', { refreshToken: session.refreshToken }).catch(() => {})
    ecrireSession(null)
  }

  const peutEcrire = (roles: string[]) => {
    if (!utilisateur) return false
    if (utilisateur.role === 'ADMIN') return true
    if (utilisateur.role === 'LECTURE') return false
    return roles.includes(utilisateur.role)
  }

  return <Contexte.Provider value={{ utilisateur, connecter, deconnecter, peutEcrire }}>{children}</Contexte.Provider>
}

export function RouteProtegee({ children }: { children: React.ReactNode }) {
  const { utilisateur } = useAuth()
  const location = useLocation()
  if (!utilisateur) return <Navigate to="/connexion" state={{ de: location.pathname }} replace />
  return <>{children}</>
}

export function PageConnexion() {
  const { utilisateur, connecter } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('admin@simbat.ne')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (utilisateur) navigate((location.state as any)?.de ?? '/', { replace: true })
  }, [utilisateur])

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setEnCours(true)
    try {
      await connecter(email, motDePasse)
    } catch (err: any) {
      setErreur(err.message ?? 'Connexion impossible.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#151a24] via-[#1e2430] to-[#101623] p-4">
      {/* Halos décoratifs animés */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl [animation:flottement_9s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl [animation:flottement_11s_ease-in-out_infinite_reverse]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl [animation:flottement_13s_ease-in-out_infinite]" />
      {/* Grille discrète */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="relative w-full max-w-md [animation:surgir_0.5s_cubic-bezier(0.22,1,0.36,1)]">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-900/50">
            <Building2 size={26} />
          </div>
          <div>
            <div className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-2xl font-bold leading-none text-transparent">BatiFlow</div>
            <div className="text-xs text-slate-400">SIM-BAT — Gestion d'entreprise BTP</div>
          </div>
        </div>
        <form onSubmit={soumettre} className="carte border-white/40 bg-white/95 p-6 !shadow-2xl backdrop-blur-xl">
          <h1 className="mb-1 text-lg font-semibold text-slate-800">Connexion</h1>
          <p className="mb-4 text-sm text-slate-500">Accédez à votre espace de gestion.</p>
          {erreur && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erreur}</div>}
          <label className="etiquette">Email</label>
          <input className="champ mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          <label className="etiquette">Mot de passe</label>
          <input className="champ mb-4" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="admin123" required />
          <button className="btn-primaire w-full justify-center" disabled={enCours}>
            {enCours ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Se connecter
          </button>
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <div className="font-medium text-slate-600">Comptes de démonstration (mot de passe : admin123)</div>
            admin@simbat.ne · chef@simbat.ne · conducteur@simbat.ne · comptable@simbat.ne · magasinier@simbat.ne · lecture@simbat.ne
          </div>
        </form>
      </div>
    </div>
  )
}
