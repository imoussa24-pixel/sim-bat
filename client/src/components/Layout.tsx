import React, { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Building2, CalendarRange, ClipboardList, CreditCard, FileText,
  HardHat, Home, ListChecks, LogOut, Package, Receipt, ArrowLeftRight,
  Users, Truck, Wallet, Wrench, FolderKanban, Search, Settings, Menu, X, HelpCircle, Moon, Sun,
} from 'lucide-react'
import { useAuth } from '../auth'
import { Chargement, cx } from '../ui'
import { appliquerTheme, themeInitial, type Theme } from '../lib/theme'
import { PaletteCommandes } from './PaletteCommandes'
import { CentreAlertes } from './CentreAlertes'
import { AideRaccourcis } from './AideRaccourcis'

interface Item {
  vers: string
  label: string
  icone: React.ReactNode
}

function Section({ titre, items }: { titre?: string; items: Item[] }) {
  return (
    <div className="mb-2">
      {titre && (
        <div className="px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">
          {titre}
        </div>
      )}
      {items.map((item) => (
        <NavLink
          key={item.vers}
          to={item.vers}
          end={item.vers === '/'}
          className={({ isActive }) =>
            cx(
              'group relative mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-200',
              isActive
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 font-medium text-white shadow-lg shadow-blue-900/40'
                : 'text-slate-300 hover:translate-x-0.5 hover:bg-white/5 hover:text-white'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute -left-2 h-5 w-1 rounded-r-full bg-amber-400" />}
              <span className={cx('transition-transform duration-200', !isActive && 'opacity-75 group-hover:scale-110 group-hover:opacity-100')}>
                {item.icone}
              </span>
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export function Layout() {
  const { utilisateur, deconnecter } = useAuth()
  const location = useLocation()
  const [paletteOuverte, setPaletteOuverte] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const [aideOuverte, setAideOuverte] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => themeInitial())

  const basculerTheme = () => {
    const nouveau: Theme = theme === 'sombre' ? 'clair' : 'sombre'
    appliquerTheme(nouveau)
    setTheme(nouveau)
  }

  // Ferme le tiroir mobile à chaque navigation
  useEffect(() => {
    setMenuMobile(false)
  }, [location.pathname])
  const initiales = (utilisateur?.nom ?? '?')
    .split(' ')
    .map((m) => m[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Raccourcis globaux : Ctrl/Cmd+K (recherche) et ? (aide)
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement
      const dansChamp = /^(INPUT|TEXTAREA|SELECT)$/.test(cible?.tagName) || cible?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOuverte((o) => !o)
      } else if (e.key === '?' && !dansChamp) {
        e.preventDefault()
        setAideOuverte((o) => !o)
      }
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* Bouton menu mobile */}
      <button
        className="fixed left-3 top-3 z-50 rounded-xl bg-sidebar p-2.5 text-white shadow-lg lg:hidden"
        onClick={() => setMenuMobile((m) => !m)}
        title="Menu"
      >
        {menuMobile ? <X size={18} /> : <Menu size={18} />}
      </button>
      {menuMobile && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setMenuMobile(false)} />}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-gradient-to-b from-[#1e2430] via-[#1e2430] to-[#171c26] shadow-2xl shadow-black/30 transition-transform duration-300',
          menuMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/50">
            <Building2 size={20} />
          </div>
          <div>
            <div className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-base font-bold leading-none text-transparent">
              BatiFlow
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">SIM-BAT · Gestion BTP</div>
          </div>
        </div>

        {/* Recherche globale + alertes */}
        <div className="px-2 pt-3">
          <button
            className="mx-2 mb-1 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            onClick={() => setPaletteOuverte(true)}
          >
            <Search size={14} />
            Rechercher…
            <kbd className="ml-auto rounded border border-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">Ctrl K</kbd>
          </button>
          <CentreAlertes />
        </div>

        <nav className="flex-1 overflow-y-auto pb-3">
          <Section items={[{ vers: '/', label: 'Tableau de bord', icone: <Home size={16} /> }]} />
          <Section
            titre="Gestion"
            items={[
              { vers: '/clients', label: 'Clients', icone: <Users size={16} /> },
              { vers: '/projets', label: 'Projets', icone: <FolderKanban size={16} /> },
              { vers: '/chantiers', label: 'Chantiers', icone: <HardHat size={16} /> },
              { vers: '/planification', label: 'Planification', icone: <CalendarRange size={16} /> },
              { vers: '/taches', label: 'Tâches', icone: <ListChecks size={16} /> },
              { vers: '/rapports', label: 'Rapports chantier', icone: <FileText size={16} /> },
            ]}
          />
          <Section
            titre="Ressources"
            items={[
              { vers: '/employes', label: 'Employés', icone: <ClipboardList size={16} /> },
              { vers: '/materiels', label: 'Matériels', icone: <Truck size={16} /> },
              { vers: '/mouvements-materiel', label: 'Mouvements matériel', icone: <ArrowLeftRight size={16} /> },
              { vers: '/stock', label: 'Stock matériaux', icone: <Package size={16} /> },
              { vers: '/maintenance', label: 'Maintenance', icone: <Wrench size={16} /> },
            ]}
          />
          <Section
            titre="Finance"
            items={[
              { vers: '/devis', label: 'Devis', icone: <FileText size={16} /> },
              { vers: '/factures', label: 'Factures', icone: <Receipt size={16} /> },
              { vers: '/depenses', label: 'Dépenses', icone: <Wallet size={16} /> },
              { vers: '/paiements', label: 'Paiements', icone: <CreditCard size={16} /> },
            ]}
          />
          <Section
            titre="Analyse statistique"
            items={[{ vers: '/analyse', label: 'Dashboard', icone: <BarChart3 size={16} /> }]}
          />
          {utilisateur?.role === 'ADMIN' && (
            <Section
              titre="Administration"
              items={[{ vers: '/parametres', label: 'Paramètres', icone: <Settings size={16} /> }]}
            />
          )}
        </nav>

        {/* Utilisateur */}
        <div className="border-t border-white/10 bg-black/10 p-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-900/40 ring-2 ring-white/10">
              {initiales}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">{utilisateur?.nom}</div>
              <div className="truncate text-[11px] text-slate-400">{utilisateur?.email}</div>
            </div>
            <button
              onClick={basculerTheme}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-amber-300"
              title={theme === 'sombre' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'sombre' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setAideOuverte(true)}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              title="Aide & raccourcis clavier (?)"
            >
              <HelpCircle size={16} />
            </button>
          </div>
          <button
            onClick={deconnecter}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={13} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="ml-0 flex-1 bg-fond p-4 pt-16 lg:ml-60 lg:p-6 lg:pt-6">
        <div key={location.pathname} className="animation-page">
          <Suspense fallback={<Chargement />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <PaletteCommandes ouverte={paletteOuverte} onFermer={() => setPaletteOuverte(false)} />
      <AideRaccourcis ouvert={aideOuverte} onFermer={() => setAideOuverte(false)} />
    </div>
  )
}
