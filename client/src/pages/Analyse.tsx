import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BadgeAlert, CircleDollarSign,
  FileSpreadsheet, Lightbulb, ScrollText, TrendingUp, Truck, Wallet,
} from 'lucide-react'
import { get, urlExport } from '../lib/api'
import { fcfa, fcfaCompact, dateFr } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, CarteKpi, Chargement, EnTetePage, cx, useToast } from '../ui'

// ─────────────────────── Insights automatiques ──────────────────────────────

interface Insight {
  gravite: 'haute' | 'moyenne' | 'info'
  texte: string
  ancre?: string
}

function calculerInsights(d: any): Insight[] {
  const insights: Insight[] = []
  for (const c of d.rentabilite) {
    const conso = c.budget > 0 ? c.depense / c.budget : 0
    if (conso > 1) {
      insights.push({
        gravite: 'haute',
        texte: `Le chantier « ${c.nom} » dépasse son budget : ${Math.round(conso * 100)} % consommés (${fcfa(c.depense)} sur ${fcfa(c.budget)}).`,
        ancre: 'avancement',
      })
    } else if (conso > 0.9 && c.statut !== 'Terminé') {
      insights.push({
        gravite: 'moyenne',
        texte: `« ${c.nom} » approche de son budget : ${Math.round(conso * 100)} % déjà consommés.`,
        ancre: 'avancement',
      })
    }
  }
  const enRetard = d.impayes.lignes.filter((f: any) => f.enRetard)
  if (enRetard.length) {
    insights.push({
      gravite: 'haute',
      texte: `${enRetard.length} facture(s) en retard de paiement pour un total de ${fcfa(enRetard.reduce((s: number, f: any) => s + f.reste, 0))} — pensez aux relances.`,
      ancre: 'impayes',
    })
  }
  if (d.utilisationMateriels.enPanne > 0) {
    insights.push({
      gravite: 'moyenne',
      texte: `${d.utilisationMateriels.enPanne} matériel(s) en panne — vérifiez le module Maintenance.`,
      ancre: 'ressources',
    })
  }
  const troisDerniers = d.caDepensesParMois.slice(-3)
  const margesNegatives = troisDerniers.filter((m: any) => m.marge < 0).length
  if (margesNegatives >= 2) {
    insights.push({
      gravite: 'moyenne',
      texte: `La marge mensuelle est négative sur ${margesNegatives} des 3 derniers mois — surveillez la trésorerie.`,
      ancre: 'finances',
    })
  }
  if (!insights.length) {
    insights.push({ gravite: 'info', texte: 'Aucun point critique détecté ce mois-ci — les indicateurs sont au vert. 👍' })
  }
  return insights
}

const STYLE_INSIGHT: Record<Insight['gravite'], string> = {
  haute: 'border-red-200 bg-red-50/80 text-red-800',
  moyenne: 'border-orange-200 bg-orange-50/80 text-orange-800',
  info: 'border-green-200 bg-green-50/80 text-green-800',
}

// ────────────────────────────── Page ────────────────────────────────────────

type CleTri = 'budget' | 'depense' | 'facture' | 'marge' | 'conso'

export function Analyse() {
  const [donnees, setDonnees] = useState<any>(null)
  const [courbeIdx, setCourbeIdx] = useState(0)
  const [audit, setAudit] = useState<any[] | null>(null)
  const [tri, setTri] = useState<{ cle: CleTri; desc: boolean }>({ cle: 'marge', desc: true })
  const [filtreImpayes, setFiltreImpayes] = useState<'tous' | 'retard'>('tous')
  const [ancreActive, setAncreActive] = useState('finances')
  const { notifier } = useToast()
  const { utilisateur } = useAuth()

  const [tresorerie, setTresorerie] = useState<any>(null)

  useEffect(() => {
    get('/api/stats/analyse').then(setDonnees).catch((e) => notifier('erreur', e.message))
    get('/api/stats/tresorerie').then(setTresorerie).catch(() => {})
    if (utilisateur?.role === 'ADMIN') get('/api/audit').then(setAudit).catch(() => {})
  }, [])

  const insights = useMemo(() => (donnees ? calculerInsights(donnees) : []), [donnees])

  const rentabiliteTriee = useMemo(() => {
    if (!donnees) return []
    const valeur = (c: any): number => (tri.cle === 'conso' ? (c.budget > 0 ? c.depense / c.budget : 0) : c[tri.cle])
    return [...donnees.rentabilite].sort((a, b) => (valeur(b) - valeur(a)) * (tri.desc ? 1 : -1))
  }, [donnees, tri])

  if (!donnees) return <Chargement texte="Chargement des analyses…" />
  const { caDepensesParMois, courbesS, utilisationMateriels, topClients, impayes } = donnees
  const courbe = courbesS[courbeIdx]

  // Tendances mois courant vs mois précédent
  const moisN = caDepensesParMois[caDepensesParMois.length - 1]
  const moisN1 = caDepensesParMois[caDepensesParMois.length - 2]
  const tendanceCa = moisN1?.ca ? ((moisN.ca - moisN1.ca) / moisN1.ca) * 100 : null
  const tendanceDep = moisN1?.depenses ? ((moisN.depenses - moisN1.depenses) / moisN1.depenses) * 100 : null

  const donneesUtilisation = [
    { nom: 'Affectés', valeur: utilisationMateriels.affectes, couleur: '#2563eb' },
    { nom: 'Disponibles', valeur: utilisationMateriels.disponibles, couleur: '#16a34a' },
    { nom: 'En panne', valeur: utilisationMateriels.enPanne, couleur: '#dc2626' },
  ].filter((d) => d.valeur > 0)

  const impayesVisibles = filtreImpayes === 'retard' ? impayes.lignes.filter((f: any) => f.enRetard) : impayes.lignes

  const allerA = (ancre: string) => {
    setAncreActive(ancre)
    document.getElementById(ancre)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const EnTeteTri = ({ cle, label }: { cle: CleTri; label: string }) => (
    <button
      className={cx(
        'inline-flex items-center gap-1 transition-colors hover:text-primaire',
        tri.cle === cle && 'text-primaire'
      )}
      onClick={() => setTri((t) => ({ cle, desc: t.cle === cle ? !t.desc : true }))}
      title="Cliquer pour trier"
    >
      {label}
      {tri.cle === cle ? (tri.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
    </button>
  )

  return (
    <div>
      <EnTetePage
        titre="Analyse statistique"
        sousTitre="Lecture rapide de la santé de l'entreprise — points d'attention calculés automatiquement"
        actions={
          <a className="btn-discret" href={urlExport('/api/exports/finance-xlsx')} target="_blank" rel="noreferrer">
            <FileSpreadsheet size={15} className="text-green-600" /> États financiers Excel
          </a>
        }
      />

      {/* Points d'attention */}
      <div className="carte grille-animee mb-5 space-y-2 border-l-4 border-l-amber-400 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Lightbulb size={16} className="text-amber-500" />
          Points d'attention
        </div>
        {insights.map((ins, i) => (
          <button
            key={i}
            className={cx(
              'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-transform hover:scale-[1.005]',
              STYLE_INSIGHT[ins.gravite]
            )}
            onClick={() => ins.ancre && allerA(ins.ancre)}
          >
            {ins.gravite === 'info' ? <TrendingUp size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
            <span>{ins.texte}</span>
          </button>
        ))}
      </div>

      {/* Navigation par sections */}
      <div className="sticky top-0 z-30 -mx-1 mb-5 flex gap-2 rounded-xl bg-fond/90 px-1 py-2 backdrop-blur">
        {[
          { id: 'finances', label: '💰 Finances' },
          { id: 'tresorerie', label: '📊 Trésorerie 90 j' },
          { id: 'avancement', label: '📈 Avancement & rentabilité' },
          { id: 'ressources', label: '🚜 Ressources' },
          { id: 'impayes', label: '⚠ Impayés' },
        ].map((s) => (
          <button
            key={s.id}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
              ancreActive === s.id
                ? 'border-primaire bg-primaire text-white shadow-md shadow-blue-600/25'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primaire hover:text-primaire'
            )}
            onClick={() => allerA(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* KPI avec tendances */}
      <div className="grille-animee mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CarteKpi
          titre={`CA encaissé — ${moisN.mois}`}
          valeur={fcfa(moisN.ca)}
          tendance={tendanceCa}
          icone={<CircleDollarSign size={20} />}
          couleur="bg-blue-50 text-primaire"
          sous="vs mois précédent"
        />
        <CarteKpi
          titre={`Dépenses — ${moisN.mois}`}
          valeur={fcfa(moisN.depenses)}
          tendance={tendanceDep != null ? -tendanceDep : null}
          icone={<Wallet size={20} />}
          couleur="bg-orange-50 text-orange-500"
          sous="▲ vert = dépenses en baisse"
        />
        <CarteKpi
          titre="Marge cumulée (12 mois)"
          valeur={fcfa(caDepensesParMois.reduce((s: number, m: any) => s + m.marge, 0))}
          icone={<TrendingUp size={20} />}
          couleur="bg-green-50 text-green-600"
        />
        <CarteKpi
          titre="Impayés à encaisser"
          valeur={<span className="text-orange-600">{fcfa(impayes.total)}</span>}
          icone={<BadgeAlert size={20} />}
          couleur="bg-red-50 text-red-500"
          sous={`${impayes.lignes.length} facture(s)`}
        />
      </div>

      {/* ─── Section Finances ─── */}
      <div id="finances" className="grille-animee grid scroll-mt-16 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="carte p-4">
          <h3 className="text-sm font-semibold text-slate-700">CA encaissé, dépenses et marge par mois</h3>
          <p className="mb-3 text-xs text-slate-400">Barres bleues = encaissements clients · barres orange = sorties d'argent · ligne verte = marge.</p>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={caDepensesParMois} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 10.5, fill: '#64748b' }} tickLine={false} />
              <YAxis tickFormatter={(v) => fcfaCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(v: any, n: any) => [fcfa(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={9} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
              <Bar name="CA encaissé" dataKey="ca" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar name="Dépenses" dataKey="depenses" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Line name="Marge" type="monotone" dataKey="marge" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="carte p-4">
          <h3 className="text-sm font-semibold text-slate-700">Top clients</h3>
          <p className="mb-3 text-xs text-slate-400">Classement par chiffre d'affaires facturé (hors brouillons).</p>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fcfaCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
              <YAxis type="category" dataKey="client" width={150} tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: any) => [fcfa(v), 'CA facturé']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {topClients.map((_: any, i: number) => (
                  <Cell key={i} fill={['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'][i] ?? '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Section Trésorerie prévisionnelle ─── */}
      {tresorerie && (
        <div id="tresorerie" className="mt-4 grid scroll-mt-16 grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="carte p-4 xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700">Trésorerie prévisionnelle — 13 semaines</h3>
            <p className="mb-3 text-xs text-slate-400">
              Entrées = échéances des factures non payées (les retards sont attendus immédiatement) · Sorties = paie estimée
              ({fcfa(tresorerie.hypotheses.paieHebdo)}/sem) + dépenses courantes ({fcfa(tresorerie.hypotheses.depensesHebdo)}/sem) + maintenances planifiées.
            </p>
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={tresorerie.semaines} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="semaine" tick={{ fontSize: 10.5, fill: '#64748b' }} tickLine={false} />
                <YAxis tickFormatter={(v) => fcfaCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={54} />
                <Tooltip formatter={(v: any, n: any) => [fcfa(v), n]} labelFormatter={(l, p: any) => `${l} (${dateFr(p?.[0]?.payload?.du)} → ${dateFr(p?.[0]?.payload?.au)})`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconSize={9} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                <Bar name="Entrées attendues" dataKey="entrees" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar name="Sorties prévues" dataKey="sorties" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Line name="Flux cumulé" type="monotone" dataKey="cumul" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 2.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="carte overflow-hidden p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Prochaines échéances</h3>
            </div>
            <div className="max-h-[330px] divide-y divide-slate-50 overflow-y-auto">
              {tresorerie.echeances.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-400">Aucune échéance à venir.</p>
              )}
              {tresorerie.echeances.map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', e.type === 'encaissement' ? 'bg-green-500' : 'bg-orange-500')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-700">{e.libelle}</div>
                    <div className="text-[11px] text-slate-400">{dateFr(e.date)}</div>
                  </div>
                  <span className={cx('text-xs font-semibold', e.type === 'encaissement' ? 'text-green-600' : 'text-orange-600')}>
                    {e.type === 'encaissement' ? '+' : '−'} {fcfa(e.montant)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Section Avancement & rentabilité ─── */}
      <div id="avancement" className="mt-4 scroll-mt-16">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="carte p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Courbe en S — planifié vs réel</h3>
              {courbesS.length > 1 && (
                <select className="champ !w-56 !py-1 text-xs" value={courbeIdx} onChange={(e) => setCourbeIdx(Number(e.target.value))}>
                  {courbesS.map((c: any, i: number) => (
                    <option key={c.chantierId} value={i}>{c.nom}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Si la courbe verte (réel) passe <b>sous</b> la bleue (planifié CPM), le chantier prend du retard.
            </p>
            {courbe ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={courbe.points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: '#64748b' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v} %`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip formatter={(v: any, n: any) => [`${v} %`, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconSize={9} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                  <Line name="Planifié (CPM)" type="monotone" dataKey="planifie" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  <Line name="Réel" type="monotone" dataKey="reel" stroke="#16a34a" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 2.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">Aucun chantier avec planning calculé.</p>
            )}
          </div>

          <div className="carte overflow-hidden p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Rentabilité par chantier</h3>
              <p className="text-xs text-slate-400">Cliquez sur les en-têtes pour trier. La jauge indique la part du budget consommée.</p>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Chantier</th>
                    <th className="px-3 py-2.5 text-right font-medium"><EnTeteTri cle="budget" label="Budget" /></th>
                    <th className="px-3 py-2.5 text-right font-medium"><EnTeteTri cle="depense" label="Dépensé" /></th>
                    <th className="px-3 py-2.5 text-right font-medium"><EnTeteTri cle="marge" label="Marge" /></th>
                    <th className="px-3 py-2.5 font-medium" style={{ width: 140 }}><EnTeteTri cle="conso" label="Conso. budget" /></th>
                  </tr>
                </thead>
                <tbody>
                  {rentabiliteTriee.map((c: any) => {
                    const conso = c.budget > 0 ? Math.min(150, Math.round((c.depense / c.budget) * 100)) : 0
                    return (
                      <tr key={c.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800">{c.nom}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            {c.ville} <Badge statut={c.statut} className="!px-1.5 !text-[10px]" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs">{fcfa(c.budget)}</td>
                        <td className="px-3 py-2.5 text-right text-xs">{fcfa(c.depense)}</td>
                        <td className={cx('px-3 py-2.5 text-right text-xs font-semibold', c.marge >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {fcfa(c.marge)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={cx('h-full rounded-full transition-all duration-700', conso > 100 ? 'bg-red-500' : conso > 90 ? 'bg-orange-400' : 'bg-primaire')}
                                style={{ width: `${Math.min(100, conso)}%` }}
                              />
                            </div>
                            <span className={cx('w-11 text-right text-xs font-semibold', conso > 100 ? 'text-red-600' : conso > 90 ? 'text-orange-600' : 'text-slate-600')}>
                              {conso} %
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section Ressources ─── */}
      <div id="ressources" className="mt-4 grid scroll-mt-16 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="carte p-4">
          <h3 className="text-sm font-semibold text-slate-700">Parc matériel</h3>
          <p className="mb-3 text-xs text-slate-400">
            Taux d'utilisation : <b>{utilisationMateriels.taux} %</b> ({utilisationMateriels.affectes} affectés sur {utilisationMateriels.total}).
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={donneesUtilisation} dataKey="valeur" nameKey="nom" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {donneesUtilisation.map((d) => (
                  <Cell key={d.nom} fill={d.couleur} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} matériel(s)`, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={9} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="carte flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-primaire">
            <Truck size={26} />
          </div>
          <div className="text-3xl font-bold text-slate-800">{utilisationMateriels.taux} %</div>
          <div className="text-sm text-slate-500">du parc matériel est actuellement affecté sur des chantiers</div>
          <div className="mt-1 grid w-full max-w-sm grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-blue-50 px-2 py-2"><div className="text-lg font-bold text-primaire">{utilisationMateriels.affectes}</div><div className="text-[11px] text-slate-500">Affectés</div></div>
            <div className="rounded-lg bg-green-50 px-2 py-2"><div className="text-lg font-bold text-green-600">{utilisationMateriels.disponibles}</div><div className="text-[11px] text-slate-500">Disponibles</div></div>
            <div className="rounded-lg bg-red-50 px-2 py-2"><div className="text-lg font-bold text-red-600">{utilisationMateriels.enPanne}</div><div className="text-[11px] text-slate-500">En panne</div></div>
          </div>
        </div>
      </div>

      {/* ─── Section Impayés ─── */}
      <div id="impayes" className="carte mt-4 scroll-mt-16 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Impayés — total : <span className="text-orange-600">{fcfa(impayes.total)}</span>
            </h3>
            <p className="text-xs text-slate-400">Factures émises non soldées, triées par montant restant.</p>
          </div>
          <div className="flex gap-1.5">
            {[
              { v: 'tous', l: `Tous (${impayes.lignes.length})` },
              { v: 'retard', l: `En retard (${impayes.lignes.filter((f: any) => f.enRetard).length})` },
            ].map((o) => (
              <button
                key={o.v}
                className={cx(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  filtreImpayes === o.v ? 'border-orange-400 bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-400'
                )}
                onClick={() => setFiltreImpayes(o.v as any)}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium">Facture</th>
              <th className="px-3 py-2.5 font-medium">Client</th>
              <th className="px-3 py-2.5 font-medium">Échéance</th>
              <th className="px-3 py-2.5 text-right font-medium">Montant</th>
              <th className="px-3 py-2.5 text-right font-medium">Payé</th>
              <th className="px-3 py-2.5 text-right font-medium">Reste</th>
            </tr>
          </thead>
          <tbody>
            {impayesVisibles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucun impayé. 👍</td></tr>
            )}
            {impayesVisibles.map((f: any) => (
              <tr key={f.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-orange-50/40">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold">{f.numero}</td>
                <td className="px-3 py-2.5">{f.client}</td>
                <td className={cx('px-3 py-2.5 text-xs', f.enRetard && 'font-semibold text-red-600')}>
                  {dateFr(f.echeance)} {f.enRetard && '⚠'}
                </td>
                <td className="px-3 py-2.5 text-right">{fcfa(f.montant)}</td>
                <td className="px-3 py-2.5 text-right text-green-600">{fcfa(f.paye)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-orange-600">{fcfa(f.reste)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Journal d'audit (ADMIN) */}
      {audit && audit.length > 0 && (
        <div className="carte mt-4 overflow-x-auto">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <ScrollText size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Journal d'audit (200 dernières actions)</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-1.5 text-slate-400">{new Date(a.date).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-600">{a.userNom ?? 'Système'}</td>
                    <td className="px-3 py-1.5">
                      <span className={cx('rounded px-1.5 py-0.5 font-semibold', a.action === 'DELETE' ? 'bg-red-50 text-red-600' : a.action === 'CREATE' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600')}>
                        {a.action}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{a.entite}</td>
                    <td className="max-w-md truncate px-3 py-1.5 text-slate-400">{a.details ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
