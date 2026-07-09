import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Fontes bundlées (fonctionnent hors-ligne, sans CDN)
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import App from './App'
import { FournisseurAuth } from './auth'
import { FournisseurToasts } from './ui'
import './index.css'

/** Garde-fou : évite l'écran blanc en cas d'erreur d'exécution imprévue. */
class BarriereErreur extends React.Component<{ children: React.ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null }
  static getDerivedStateFromError(erreur: Error) {
    return { erreur }
  }
  componentDidCatch(erreur: Error) {
    console.error('Erreur applicative interceptée :', erreur)
  }
  render() {
    if (this.state.erreur) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-fond p-6">
          <div className="carte max-w-md p-8 text-center [animation:surgir_0.3s_ease-out]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-3xl">⚠</div>
            <h1 className="mb-2 text-lg font-bold text-slate-800">Une erreur inattendue est survenue</h1>
            <p className="mb-5 text-sm text-slate-500">
              L'incident a été consigné dans la console. Vous pouvez recharger l'application sans perdre vos données.
            </p>
            <button className="btn-primaire mx-auto" onClick={() => window.location.reload()}>
              Recharger l'application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BarriereErreur>
      <BrowserRouter>
        <FournisseurToasts>
          <FournisseurAuth>
            <App />
          </FournisseurAuth>
        </FournisseurToasts>
      </BrowserRouter>
    </BarriereErreur>
  </React.StrictMode>
)
