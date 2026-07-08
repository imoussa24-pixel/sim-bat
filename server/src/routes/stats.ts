import { Router } from 'express'
import { prisma } from '../db'
import { h } from '../lib/http'
import { authRequis } from '../auth'
import { calculerDepensesChantiers, totauxDevis } from '../lib/metier'
import { avancementAttendu } from '../cpm/engine'
import { calendrierEntreprise } from '../lib/metier'

export const routerStats = Router()
routerStats.use(authRequis)

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Retourne les 12 derniers mois [{cle: '2026-07', label: 'juil. 26'}] */
function douzeDerniersMois(): { cle: string; label: string }[] {
  const out: { cle: string; label: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MOIS_COURTS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    })
  }
  return out
}

function cleMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─────────────────────────── Tableau de bord ────────────────────────────────

routerStats.get(
  '/stats/tableau-de-bord',
  h(async (_req, res) => {
    const [nbContrats, nbChantiers, nbProjets, nbClients, factures, contrats, chantiers] = await Promise.all([
      prisma.contrat.count({ where: { deletedAt: null } }),
      prisma.chantier.count({ where: { deletedAt: null } }),
      prisma.projet.count({ where: { deletedAt: null } }),
      prisma.client.count({ where: { deletedAt: null } }),
      prisma.facture.findMany({ where: { deletedAt: null, statut: { not: 'brouillon' } } }),
      prisma.contrat.findMany({ where: { deletedAt: null }, include: { client: { select: { nom: true } } } }),
      prisma.chantier.findMany({ where: { deletedAt: null }, select: { statut: true } }),
    ])

    const mois = douzeDerniersMois()
    const caMap = new Map(mois.map((m) => [m.cle, 0]))
    for (const f of factures) {
      const cle = cleMois(f.date)
      if (caMap.has(cle)) caMap.set(cle, caMap.get(cle)! + f.montant)
    }
    const contratsMap = new Map(mois.map((m) => [m.cle, 0]))
    for (const c of contrats) {
      const cle = cleMois(c.dateSignature)
      if (contratsMap.has(cle)) contratsMap.set(cle, contratsMap.get(cle)! + 1)
    }

    const parStatut = new Map<string, number>()
    for (const c of chantiers) parStatut.set(c.statut, (parStatut.get(c.statut) ?? 0) + 1)

    res.json({
      compteurs: { contrats: nbContrats, chantiers: nbChantiers, projets: nbProjets, clients: nbClients },
      caParMois: mois.map((m) => ({ mois: m.label, total: caMap.get(m.cle) ?? 0 })),
      contratsParMois: mois.map((m) => ({ mois: m.label, total: contratsMap.get(m.cle) ?? 0 })),
      chantiersParStatut: ['En attente', 'En cours', 'Terminé'].map((s) => ({
        statut: s,
        total: parStatut.get(s) ?? 0,
      })),
      topContrats: contrats
        .sort((a, b) => b.montant - a.montant)
        .slice(0, 5)
        .map((c) => ({
          numero: c.numero,
          objet: c.objet ?? c.numero,
          client: c.client?.nom ?? '—',
          montant: c.montant,
        })),
    })
  })
)

// ──────────────────────── Analyse statistique avancée ───────────────────────

routerStats.get(
  '/stats/analyse',
  h(async (_req, res) => {
    const [chantiers, facturesToutes, paiements, depensesRows, materiels, clients, facturesEmises] = await Promise.all([
      prisma.chantier.findMany({
        where: { deletedAt: null },
        include: { projet: { select: { id: true, nom: true } } },
      }),
      prisma.facture.findMany({ where: { deletedAt: null } }),
      prisma.paiement.findMany({ where: { deletedAt: null } }),
      prisma.depense.findMany({ where: { deletedAt: null } }),
      prisma.materiel.findMany({ where: { deletedAt: null } }),
      prisma.client.findMany({ where: { deletedAt: null } }),
      prisma.facture.findMany({
        where: { deletedAt: null, statut: { notIn: ['brouillon', 'payée'] } },
        include: { client: { select: { nom: true } }, paiements: { where: { deletedAt: null } } },
      }),
    ])
    const depenses = await calculerDepensesChantiers()

    // Rentabilité par chantier : budget vs dépensé vs facturé (via projet)
    const factureParProjet = new Map<string, number>()
    for (const f of facturesToutes) {
      if (f.projetId && f.statut !== 'brouillon') {
        factureParProjet.set(f.projetId, (factureParProjet.get(f.projetId) ?? 0) + f.montant)
      }
    }
    const chantiersParProjet = new Map<string, number>()
    for (const c of chantiers) {
      if (c.projetId) chantiersParProjet.set(c.projetId, (chantiersParProjet.get(c.projetId) ?? 0) + 1)
    }
    const rentabilite = chantiers.map((c) => {
      const depense = depenses.get(c.id)?.total ?? 0
      // Facturé du projet réparti à parts égales entre ses chantiers
      const facture = c.projetId
        ? (factureParProjet.get(c.projetId) ?? 0) / Math.max(1, chantiersParProjet.get(c.projetId) ?? 1)
        : 0
      return {
        id: c.id,
        nom: c.nom,
        ville: c.ville,
        statut: c.statut,
        budget: c.budget,
        depense,
        facture: Math.round(facture),
        marge: Math.round(facture - depense),
        avancement: c.avancement,
      }
    })

    // CA (encaissements) / dépenses / marge par mois
    const mois = douzeDerniersMois()
    const ca = new Map(mois.map((m) => [m.cle, 0]))
    const dep = new Map(mois.map((m) => [m.cle, 0]))
    for (const p of paiements) {
      const cle = cleMois(p.date)
      if (!ca.has(cle)) continue
      if (p.sens === 'encaissement') ca.set(cle, ca.get(cle)! + p.montant)
      else dep.set(cle, dep.get(cle)! + p.montant)
    }
    for (const d of depensesRows) {
      const cle = cleMois(d.date)
      if (dep.has(cle)) dep.set(cle, dep.get(cle)! + d.montant)
    }
    const caDepensesParMois = mois.map((m) => ({
      mois: m.label,
      ca: ca.get(m.cle) ?? 0,
      depenses: dep.get(m.cle) ?? 0,
      marge: (ca.get(m.cle) ?? 0) - (dep.get(m.cle) ?? 0),
    }))

    // Courbe en S : avancement planifié cumulé vs réel pour les chantiers planifiés
    const calendrier = await calendrierEntreprise()
    const courbesS: { chantierId: string; nom: string; points: { date: string; planifie: number; reel: number | null }[] }[] = []
    const planifies = chantiers.filter((c) => c.planningCalcule && c.dateDebut && c.finPrevue)
    for (const c of planifies.slice(0, 4)) {
      const taches = await prisma.tache.findMany({
        where: { deletedAt: null, lot: { chantierId: c.id, deletedAt: null } },
        select: { dateDebut: true, dateFin: true, dureeJours: true, avancement: true },
      })
      if (!taches.length) continue
      const debut = new Date(c.dateDebut!)
      const fin = new Date(Math.max(c.finPrevue!.getTime(), Date.now()))
      const poidsTotal = taches.reduce((s, t) => s + Math.max(t.dureeJours, 0.5), 0)
      const points: { date: string; planifie: number; reel: number | null }[] = []
      const pas = Math.max(7, Math.round((fin.getTime() - debut.getTime()) / 86400000 / 12))
      const avancementReel = taches.reduce((s, t) => s + t.avancement * Math.max(t.dureeJours, 0.5), 0) / poidsTotal
      const auj = new Date()
      for (let d = new Date(debut); d <= fin; d = new Date(d.getTime() + pas * 86400000)) {
        const planifie =
          taches.reduce(
            (s, t) => s + avancementAttendu(t.dateDebut, t.dateFin, d, calendrier) * Math.max(t.dureeJours, 0.5),
            0
          ) / poidsTotal
        // Réel : interpolation linéaire de 0 (début) à l'avancement actuel (aujourd'hui)
        let reel: number | null = null
        if (d <= auj && auj > debut) {
          const fraction = Math.min(1, (d.getTime() - debut.getTime()) / (auj.getTime() - debut.getTime()))
          reel = Math.round(avancementReel * fraction)
        }
        points.push({
          date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          planifie: Math.round(planifie),
          reel,
        })
      }
      courbesS.push({ chantierId: c.id, nom: c.nom, points })
    }

    // Taux d'utilisation des matériels
    const affectes = materiels.filter((m) => m.chantierId && m.etat !== 'panne').length
    const enPanne = materiels.filter((m) => m.etat === 'panne').length
    const disponibles = materiels.length - affectes - enPanne
    const utilisationMateriels = {
      total: materiels.length,
      affectes,
      disponibles,
      enPanne,
      taux: materiels.length ? Math.round((affectes / materiels.length) * 100) : 0,
    }

    // Top clients par CA facturé
    const caParClient = new Map<string, number>()
    for (const f of facturesToutes) {
      if (f.clientId && f.statut !== 'brouillon') {
        caParClient.set(f.clientId, (caParClient.get(f.clientId) ?? 0) + f.montant)
      }
    }
    const nomClient = new Map(clients.map((c) => [c.id, c.nom]))
    const topClients = [...caParClient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total]) => ({ client: nomClient.get(id) ?? '—', total }))

    // Impayés
    const maintenant = new Date()
    const impayes = facturesEmises
      .map((f) => {
        const paye = f.paiements.filter((p) => p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
        return {
          id: f.id,
          numero: f.numero,
          client: f.client?.nom ?? '—',
          montant: f.montant,
          paye,
          reste: f.montant - paye,
          echeance: f.echeance,
          enRetard: !!f.echeance && f.echeance < maintenant,
        }
      })
      .filter((f) => f.reste > 0.5)
      .sort((a, b) => b.reste - a.reste)

    res.json({
      rentabilite,
      caDepensesParMois,
      courbesS,
      utilisationMateriels,
      topClients,
      impayes: { lignes: impayes, total: impayes.reduce((s, f) => s + f.reste, 0) },
    })
  })
)

// ─────────────────── Plan de trésorerie prévisionnel (13 semaines) ──────────

routerStats.get(
  '/stats/tresorerie',
  h(async (_req, res) => {
    const maintenant = new Date()
    const aujourdHui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
    // Lundi de la semaine courante
    const lundi = new Date(aujourdHui.getTime() - ((aujourdHui.getDay() + 6) % 7) * 86400000)
    const NB_SEMAINES = 13

    const [factures, maintenances, pointages, depenses] = await Promise.all([
      prisma.facture.findMany({
        where: { deletedAt: null, statut: { notIn: ['brouillon', 'payée'] } },
        include: { client: { select: { nom: true } }, paiements: { where: { deletedAt: null } } },
      }),
      prisma.maintenance.findMany({
        where: { deletedAt: null, statut: 'planifiée', datePlanifiee: { gte: lundi } },
        include: { materiel: { select: { designation: true } } },
      }),
      prisma.pointage.findMany({
        where: { present: true, date: { gte: new Date(aujourdHui.getTime() - 28 * 86400000) } },
        include: { employe: { select: { tauxJournalier: true } } },
      }),
      prisma.depense.findMany({
        where: { deletedAt: null, date: { gte: new Date(aujourdHui.getTime() - 56 * 86400000) } },
      }),
    ])

    // Hypothèses : paie hebdo = moyenne 4 dernières semaines ; dépenses hebdo = moyenne 8 dernières semaines
    const paieHebdo = Math.round(pointages.reduce((s, p) => s + p.employe.tauxJournalier, 0) / 4)
    const depensesHebdo = Math.round(depenses.reduce((s, d) => s + d.montant, 0) / 8)

    const semaines = Array.from({ length: NB_SEMAINES }, (_, i) => {
      const du = new Date(lundi.getTime() + i * 7 * 86400000)
      const au = new Date(du.getTime() + 6 * 86400000)
      return { du, au, entrees: 0, sortiesPaie: paieHebdo, sortiesDepenses: depensesHebdo, sortiesMaintenance: 0 }
    })
    const indexSemaine = (d: Date) => {
      const idx = Math.floor((new Date(d).getTime() - lundi.getTime()) / (7 * 86400000))
      return Math.min(NB_SEMAINES - 1, Math.max(0, idx))
    }

    const echeancesAVenir: { libelle: string; date: Date; montant: number; type: string }[] = []
    for (const f of factures) {
      const paye = f.paiements.filter((p) => p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
      const reste = f.montant - paye
      if (reste <= 0.5) continue
      const echeance = f.echeance && f.echeance > aujourdHui ? f.echeance : aujourdHui // en retard → attendu immédiatement
      semaines[indexSemaine(echeance)].entrees += reste
      echeancesAVenir.push({ libelle: `${f.numero} — ${f.client?.nom ?? ''}`, date: echeance, montant: reste, type: 'encaissement' })
    }
    for (const m of maintenances) {
      if (!m.datePlanifiee || m.cout <= 0) continue
      semaines[indexSemaine(m.datePlanifiee)].sortiesMaintenance += m.cout
      echeancesAVenir.push({ libelle: `Maintenance ${m.materiel.designation}`, date: m.datePlanifiee, montant: m.cout, type: 'decaissement' })
    }

    let cumul = 0
    const resultat = semaines.map((s, i) => {
      const sorties = s.sortiesPaie + s.sortiesDepenses + s.sortiesMaintenance
      const solde = s.entrees - sorties
      cumul += solde
      const numero = (() => {
        const d = new Date(Date.UTC(s.du.getFullYear(), s.du.getMonth(), s.du.getDate()))
        const jour = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - jour)
        const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7)
      })()
      return {
        semaine: `S${numero}`,
        du: s.du,
        au: s.au,
        entrees: Math.round(s.entrees),
        sorties: Math.round(sorties),
        solde: Math.round(solde),
        cumul: Math.round(cumul),
        courante: i === 0,
      }
    })

    echeancesAVenir.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    res.json({
      semaines: resultat,
      hypotheses: { paieHebdo, depensesHebdo },
      echeances: echeancesAVenir.slice(0, 12),
    })
  })
)

// Journal d'audit (ADMIN)
routerStats.get(
  '/audit',
  h(async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.json([])
    const logs = await prisma.auditLog.findMany({ orderBy: { date: 'desc' }, take: 200 })
    res.json(logs)
  })
)
