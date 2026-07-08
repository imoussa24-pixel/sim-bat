import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageConnexion, RouteProtegee } from './auth'
import { Layout } from './components/Layout'

// Chargement paresseux : chaque page devient un chunk séparé (bundle initial allégé)
const paresseux = (importeur: () => Promise<any>, nom: string) =>
  lazy(() => importeur().then((m) => ({ default: m[nom] })))

const TableauDeBord = paresseux(() => import('./pages/TableauDeBord'), 'TableauDeBord')
const Clients = paresseux(() => import('./pages/Clients'), 'Clients')
const Projets = paresseux(() => import('./pages/Projets'), 'Projets')
const Chantiers = paresseux(() => import('./pages/Chantiers'), 'Chantiers')
const Planification = paresseux(() => import('./pages/Planification'), 'Planification')
const PlanificationDetail = paresseux(() => import('./pages/PlanificationDetail'), 'PlanificationDetail')
const Taches = paresseux(() => import('./pages/Taches'), 'Taches')
const Employes = paresseux(() => import('./pages/Employes'), 'Employes')
const Materiels = paresseux(() => import('./pages/Materiels'), 'Materiels')
const MouvementsMateriel = paresseux(() => import('./pages/MouvementsMateriel'), 'MouvementsMateriel')
const Stock = paresseux(() => import('./pages/Stock'), 'Stock')
const Maintenance = paresseux(() => import('./pages/Maintenance'), 'Maintenance')
const Devis = paresseux(() => import('./pages/Devis'), 'Devis')
const DevisDetail = paresseux(() => import('./pages/DevisDetail'), 'DevisDetail')
const Factures = paresseux(() => import('./pages/Factures'), 'Factures')
const Depenses = paresseux(() => import('./pages/Depenses'), 'Depenses')
const Paiements = paresseux(() => import('./pages/Paiements'), 'Paiements')
const Analyse = paresseux(() => import('./pages/Analyse'), 'Analyse')
const Parametres = paresseux(() => import('./pages/Parametres'), 'Parametres')
const RapportsChantier = paresseux(() => import('./pages/RapportsChantier'), 'RapportsChantier')

export default function App() {
  return (
    <Routes>
      <Route
        path="/connexion"
        element={
          <Suspense fallback={null}>
            <PageConnexion />
          </Suspense>
        }
      />
      <Route
        element={
          <RouteProtegee>
            <Layout />
          </RouteProtegee>
        }
      >
        <Route path="/" element={<TableauDeBord />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/projets" element={<Projets />} />
        <Route path="/chantiers" element={<Chantiers />} />
        <Route path="/planification" element={<Planification />} />
        <Route path="/planification/:id" element={<PlanificationDetail />} />
        <Route path="/taches" element={<Taches />} />
        <Route path="/rapports" element={<RapportsChantier />} />
        <Route path="/employes" element={<Employes />} />
        <Route path="/materiels" element={<Materiels />} />
        <Route path="/mouvements-materiel" element={<MouvementsMateriel />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/devis/:id" element={<DevisDetail />} />
        <Route path="/factures" element={<Factures />} />
        <Route path="/depenses" element={<Depenses />} />
        <Route path="/paiements" element={<Paiements />} />
        <Route path="/analyse" element={<Analyse />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
