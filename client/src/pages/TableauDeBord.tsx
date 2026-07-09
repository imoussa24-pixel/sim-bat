import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { FileSignature, HardHat, FolderKanban, RefreshCw, Users } from 'lucide-react'
import { get } from '../lib/api'
import { fcfa, fcfaCompact } from '../lib/format'
import { useAuth } from '../auth'
import { CarteKpi, Chargement, EnTetePage, useToast } from '../ui'
import { BanniereBienvenue } from '../components/BanniereBienvenue'

const COULEURS_DONUT: Record<string, string> = {
  'En attente': '#475569',
  'En cours': '#2563eb',
  'Terminé': '#16a34a',
}

export function TableauDeBord() {
  const [donnees, setDonnees] = useState<any>(null)
  const [chargement, setChargement] = useState(true)
  const { notifier } = useToast()
  const { utilisateur } = useAuth()

  const charger = async () => {
    setChargement(true)
    try {
      setDonnees(await get('/api/stats/tableau-de-bord'))
    } catch (e: any) {
      notifier('erreur', e.message ?? 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  if (chargement && !donnees) return <Chargement texte="Chargement du tableau de bord…" />
  if (!donnees) return null

  const { compteurs, caParMois, contratsParMois, chantiersParStatut, topContrats } = donnees

  return (
    <div>
      <EnTetePage
        titre="Tableau de bord"
        sousTitre="Vue d'ensemble de l'activité de l'entreprise"
        actions={
          <button className="btn-secondaire" onClick={charger} disabled={chargement}>
            <RefreshCw size={15} className={chargement ? 'animate-spin' : ''} />
            Actualiser
          </button>
        }
      />

      <BanniereBienvenue compteurs={compteurs} nomUtilisateur={utilisateur?.nom} />

      {/* Cartes KPI */}
      <div className="grille-animee grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CarteKpi titre="Contrats" valeur={compteurs.contrats} icone={<FileSignature size={20} />} couleur="bg-indigo-50 text-indigo-600" />
        <CarteKpi titre="Chantiers" valeur={compteurs.chantiers} icone={<HardHat size={20} />} couleur="bg-orange-50 text-orange-600" />
        <CarteKpi titre="Projets" valeur={compteurs.projets} icone={<FolderKanban size={20} />} couleur="bg-blue-50 text-primaire" />
        <CarteKpi titre="Clients" valeur={compteurs.clients} icone={<Users size={20} />} couleur="bg-green-50 text-green-600" />
      </div>

      <h2 className="mb-4 mt-8 text-lg font-bold tracking-tight2 text-slate-800">Analyses</h2>
      <div className="grille-animee grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* CA par mois */}
        <div className="carte p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Chiffre d'affaires par mois</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={caParMois} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="degradeCa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                tickFormatter={(v) => fcfaCompact(v)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={[0, (max: number) => Math.max(60_000_000, Math.ceil(max / 10_000_000) * 10_000_000)]}
              />
              <Tooltip formatter={(v: any) => [fcfa(v), 'CA facturé']} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#degradeCa)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Contrats signés par mois */}
        <div className="carte p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Contrats signés par mois</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contratsParMois} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip formatter={(v: any) => [v, 'Contrats signés']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chantiers par statut */}
        <div className="carte p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Répartition des chantiers par statut</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chantiersParStatut}
                dataKey="total"
                nameKey="statut"
                innerRadius={62}
                outerRadius={95}
                paddingAngle={3}
                strokeWidth={2}
              >
                {chantiersParStatut.map((e: any) => (
                  <Cell key={e.statut} fill={COULEURS_DONUT[e.statut] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} chantier(s)`, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={9} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 contrats */}
        <div className="carte p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Top 5 contrats par montant</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topContrats} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fcfaCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                type="category"
                dataKey="numero"
                width={110}
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v: any) => [fcfa(v), 'Montant']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.objet ?? ''}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="montant" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
