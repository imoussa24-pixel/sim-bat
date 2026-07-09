import { Keyboard } from 'lucide-react'
import { Modal } from '../ui'

const RACCOURCIS: { touches: string[]; description: string }[] = [
  { touches: ['Ctrl', 'K'], description: 'Recherche globale & navigation rapide' },
  { touches: ['?'], description: 'Afficher cette aide' },
  { touches: ['Échap'], description: 'Fermer une fenêtre ou un panneau' },
  { touches: ['↑', '↓'], description: 'Naviguer dans les résultats de recherche' },
  { touches: ['Entrée'], description: 'Ouvrir l’élément sélectionné' },
]

function Touche({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[26px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
      {children}
    </kbd>
  )
}

export function AideRaccourcis({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  return (
    <Modal
      titre={
        <span className="flex items-center gap-2">
          <Keyboard size={17} className="text-primaire" />
          Raccourcis clavier
        </span>
      }
      ouvert={ouvert}
      onFermer={onFermer}
    >
      <div className="divide-y divide-slate-100">
        {RACCOURCIS.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-600">{r.description}</span>
            <span className="flex items-center gap-1">
              {r.touches.map((t, j) => (
                <span key={j} className="flex items-center gap-1">
                  {j > 0 && <span className="text-xs text-slate-300">+</span>}
                  <Touche>{t}</Touche>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Astuce : la recherche globale <b>Ctrl K</b> retrouve instantanément un client, un chantier ou une facture
        et permet aussi de naviguer entre les pages.
      </p>
    </Modal>
  )
}
