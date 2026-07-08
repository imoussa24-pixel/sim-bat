import { prisma } from '../db'
import { CALENDRIER_DEFAUT, type CalendrierOuvre } from '../cpm/engine'

// ───────────────────────── Numérotation automatique ─────────────────────────

/** Génère le prochain numéro de pièce : PREFIX-AAAA-NNN (ex. FAC-2026-007). */
export async function prochainNumero(modele: 'devis' | 'facture' | 'contrat', prefix: string): Promise<string> {
  const annee = new Date().getFullYear()
  const motif = `${prefix}-${annee}-`
  const rows: { numero: string }[] = await (prisma as any)[modele].findMany({
    where: { numero: { startsWith: motif } },
    select: { numero: true },
  })
  let max = 0
  for (const r of rows) {
    const n = parseInt(r.numero.slice(motif.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${motif}${String(max + 1).padStart(3, '0')}`
}

// ─────────────────────────── Totaux devis / factures ────────────────────────

export function totauxDevis(devis: { lignes?: { quantite: number; prixUnitaire: number }[]; tvaTaux: number; remise: number }) {
  const brut = (devis.lignes ?? []).reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
  const totalHT = Math.max(0, brut - (devis.remise || 0))
  const tva = totalHT * ((devis.tvaTaux || 0) / 100)
  return { totalBrut: brut, totalHT, tva, totalTTC: totalHT + tva }
}

/** Recalcule le statut d'une facture selon ses paiements et son échéance. */
export async function recalculerStatutFacture(factureId: string) {
  const f = await prisma.facture.findUnique({ where: { id: factureId }, include: { paiements: true } })
  if (!f || f.deletedAt) return
  if (f.statut === 'brouillon') return // pas d'automatisme tant que non émise
  const paye = f.paiements.filter((p) => !p.deletedAt && p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
  let statut: string
  if (paye >= f.montant - 0.5) statut = 'payée'
  else if (paye > 0) statut = 'partiellement payée'
  else statut = 'envoyée'
  if (statut !== 'payée' && f.echeance && f.echeance < new Date()) statut = 'en retard'
  if (statut !== f.statut) await prisma.facture.update({ where: { id: factureId }, data: { statut } })
}

// ─────────────────────── Coûts agrégés par chantier ─────────────────────────

export interface DepenseChantier {
  depensesDirectes: number
  mainOeuvre: number
  materiaux: number
  total: number
}

/** « Dépensé » = dépenses directes + coût main-d'œuvre (pointages × taux) + matériaux sortis du stock. */
export async function calculerDepensesChantiers(): Promise<Map<string, DepenseChantier>> {
  const [depenses, pointages, sorties] = await Promise.all([
    prisma.depense.findMany({ where: { deletedAt: null, chantierId: { not: null } } }),
    prisma.pointage.findMany({ where: { present: true }, include: { employe: { select: { tauxJournalier: true } } } }),
    prisma.stockMouvement.findMany({
      where: { deletedAt: null, type: 'sortie', chantierId: { not: null } },
      include: { materiau: { select: { prixUnitaire: true } } },
    }),
  ])
  const map = new Map<string, DepenseChantier>()
  const obtenir = (id: string) => {
    let e = map.get(id)
    if (!e) {
      e = { depensesDirectes: 0, mainOeuvre: 0, materiaux: 0, total: 0 }
      map.set(id, e)
    }
    return e
  }
  for (const d of depenses) obtenir(d.chantierId!).depensesDirectes += d.montant
  for (const p of pointages) obtenir(p.chantierId).mainOeuvre += p.employe.tauxJournalier
  for (const s of sorties) obtenir(s.chantierId!).materiaux += s.quantite * (s.prixUnitaire ?? s.materiau.prixUnitaire)
  for (const e of map.values()) e.total = e.depensesDirectes + e.mainOeuvre + e.materiaux
  return map
}

/** Avancement chantier = moyenne des avancements des tâches pondérée par leur durée. */
export async function recalculerAvancementChantier(chantierId: string) {
  const taches = await prisma.tache.findMany({
    where: { deletedAt: null, lot: { chantierId, deletedAt: null } },
    select: { dureeJours: true, avancement: true },
  })
  if (!taches.length) return
  const poidsTotal = taches.reduce((s, t) => s + Math.max(t.dureeJours, 0.5), 0)
  const avancement =
    taches.reduce((s, t) => s + t.avancement * Math.max(t.dureeJours, 0.5), 0) / Math.max(poidsTotal, 0.001)
  await prisma.chantier.update({
    where: { id: chantierId },
    data: { avancement: Math.round(avancement * 10) / 10 },
  })
}

// ─────────────────────────── Stocks matériaux ───────────────────────────────

export interface EtatStock {
  materiauId: string
  stockTotal: number
  parDepot: { depot: string; chantierId: string | null; quantite: number }[]
  enAlerte: boolean
  valorisation: number
}

export async function etatStocks(): Promise<Map<string, EtatStock>> {
  const [materiaux, mouvements, chantiers] = await Promise.all([
    prisma.materiau.findMany({ where: { deletedAt: null } }),
    prisma.stockMouvement.findMany({ where: { deletedAt: null }, orderBy: { date: 'asc' } }),
    prisma.chantier.findMany({ where: { deletedAt: null }, select: { id: true, nom: true } }),
  ])
  const nomChantier = new Map(chantiers.map((c) => [c.id, c.nom]))
  const map = new Map<string, EtatStock>()
  for (const m of materiaux) {
    map.set(m.id, { materiauId: m.id, stockTotal: 0, parDepot: [], enAlerte: false, valorisation: 0 })
  }
  const parCle = new Map<string, number>() // `${materiauId}|${chantierId ?? ''}` → quantité
  for (const mv of mouvements) {
    // Une sortie est une consommation (imputée au chantier pour les coûts) prélevée
    // en priorité sur le stock du lieu s'il existe, sinon sur le dépôt central.
    const cleLieu = `${mv.materiauId}|${mv.chantierId ?? ''}`
    const cleDepot = `${mv.materiauId}|`
    if (mv.type === 'entree') {
      parCle.set(cleLieu, (parCle.get(cleLieu) ?? 0) + mv.quantite)
    } else if (mv.type === 'sortie') {
      const stockLieu = parCle.get(cleLieu) ?? 0
      const cle = stockLieu >= mv.quantite ? cleLieu : cleDepot
      parCle.set(cle, (parCle.get(cle) ?? 0) - mv.quantite)
    } else {
      parCle.set(cleLieu, mv.quantite) // inventaire : valeur constatée
    }
  }
  for (const [cle, qte] of parCle) {
    const [materiauId, chantierId] = cle.split('|')
    const etat = map.get(materiauId)
    if (!etat) continue
    etat.stockTotal += qte
    etat.parDepot.push({
      depot: chantierId ? (nomChantier.get(chantierId) ?? 'Chantier') : 'Dépôt central',
      chantierId: chantierId || null,
      quantite: qte,
    })
  }
  for (const m of materiaux) {
    const etat = map.get(m.id)!
    etat.enAlerte = etat.stockTotal <= m.seuilAlerte
    etat.valorisation = etat.stockTotal * m.prixUnitaire
  }
  return map
}

/** Met à jour le prix unitaire moyen pondéré d'un matériau après une entrée. */
export async function majPrixMoyenPondere(materiauId: string, quantiteEntree: number, prixEntree: number) {
  if (!prixEntree || quantiteEntree <= 0) return
  const m = await prisma.materiau.findUnique({ where: { id: materiauId } })
  if (!m) return
  const etats = await etatStocks()
  const stockApres = etats.get(materiauId)?.stockTotal ?? quantiteEntree
  const stockAvant = Math.max(0, stockApres - quantiteEntree)
  const nouveauPrix =
    stockAvant + quantiteEntree <= 0
      ? prixEntree
      : (stockAvant * m.prixUnitaire + quantiteEntree * prixEntree) / (stockAvant + quantiteEntree)
  await prisma.materiau.update({ where: { id: materiauId }, data: { prixUnitaire: Math.round(nouveauPrix) } })
}

// ───────────────────────────── Paramètres ───────────────────────────────────

export async function lireParametre(cle: string, defaut: string): Promise<string> {
  const p = await prisma.parametre.findUnique({ where: { cle } })
  return p?.valeur ?? defaut
}

export async function ecrireParametre(cle: string, valeur: string) {
  await prisma.parametre.upsert({ where: { cle }, create: { cle, valeur }, update: { valeur } })
}

export async function calendrierEntreprise(): Promise<CalendrierOuvre> {
  try {
    const brut = await lireParametre('calendrier', '')
    if (!brut) return CALENDRIER_DEFAUT
    const parse = JSON.parse(brut)
    return {
      joursOuvres: Array.isArray(parse.joursOuvres) && parse.joursOuvres.length ? parse.joursOuvres : CALENDRIER_DEFAUT.joursOuvres,
      feries: Array.isArray(parse.feries) ? parse.feries : [],
    }
  } catch {
    return CALENDRIER_DEFAUT
  }
}

export async function infosEntreprise() {
  return {
    nom: await lireParametre('entreprise_nom', 'SIM-BAT BTP'),
    adresse: await lireParametre('entreprise_adresse', 'Boulevard Mali Béro, Niamey — NIGER'),
    tel: await lireParametre('entreprise_tel', '+227 20 73 45 67'),
    email: await lireParametre('entreprise_email', 'contact@simbat.ne'),
    nif: await lireParametre('entreprise_nif', 'NIF 12345/R'),
  }
}
