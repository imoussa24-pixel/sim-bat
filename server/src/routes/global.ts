import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { h, ApiError } from '../lib/http'
import { auditer } from '../lib/audit'
import { authRequis } from '../auth'
import { etatStocks } from '../lib/metier'
import { alertesChantier, type Alerte } from './planning'

export const routerGlobal = Router()
routerGlobal.use(authRequis)

// ─────────────────────────── Recherche globale ──────────────────────────────

export interface ResultatRecherche {
  type: string
  id: string
  titre: string
  sous: string
}

routerGlobal.get(
  '/recherche',
  h(async (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase()
    if (q.length < 2) return res.json([])
    const contient = (...valeurs: (string | null | undefined)[]) =>
      valeurs.some((v) => v && v.toLowerCase().includes(q))
    const LIMITE = 4

    const [clients, projets, chantiers, devis, factures, employes, materiels] = await Promise.all([
      prisma.client.findMany({ where: { deletedAt: null } }),
      prisma.projet.findMany({ where: { deletedAt: null }, include: { client: { select: { nom: true } } } }),
      prisma.chantier.findMany({ where: { deletedAt: null } }),
      prisma.devis.findMany({ where: { deletedAt: null }, include: { client: { select: { nom: true } } } }),
      prisma.facture.findMany({ where: { deletedAt: null }, include: { client: { select: { nom: true } } } }),
      prisma.employe.findMany({ where: { deletedAt: null } }),
      prisma.materiel.findMany({ where: { deletedAt: null } }),
    ])

    const resultats: ResultatRecherche[] = [
      ...clients
        .filter((c) => contient(c.nom, c.ville, c.tel, c.nif))
        .slice(0, LIMITE)
        .map((c) => ({ type: 'client', id: c.id, titre: c.nom, sous: [c.type, c.ville].filter(Boolean).join(' · ') })),
      ...projets
        .filter((p) => contient(p.nom, p.description, p.localites, p.client?.nom))
        .slice(0, LIMITE)
        .map((p) => ({ type: 'projet', id: p.id, titre: p.nom, sous: `${p.statut}${p.client ? ' · ' + p.client.nom : ''}` })),
      ...chantiers
        .filter((c) => contient(c.nom, c.ville))
        .slice(0, LIMITE)
        .map((c) => ({ type: 'chantier', id: c.id, titre: c.nom, sous: [c.statut, c.ville].filter(Boolean).join(' · ') })),
      ...devis
        .filter((d) => contient(d.numero, d.objet, d.client?.nom))
        .slice(0, LIMITE)
        .map((d) => ({ type: 'devis', id: d.id, titre: `${d.numero} — ${d.objet ?? ''}`, sous: `${d.statut}${d.client ? ' · ' + d.client.nom : ''}` })),
      ...factures
        .filter((f) => contient(f.numero, f.objet, f.client?.nom))
        .slice(0, LIMITE)
        .map((f) => ({ type: 'facture', id: f.id, titre: `${f.numero} — ${f.objet ?? ''}`, sous: `${f.statut}${f.client ? ' · ' + f.client.nom : ''}` })),
      ...employes
        .filter((e) => contient(e.nom, e.poste, e.qualification))
        .slice(0, LIMITE)
        .map((e) => ({ type: 'employe', id: e.id, titre: e.nom, sous: e.poste })),
      ...materiels
        .filter((m) => contient(m.designation, m.type, m.numeroSerie))
        .slice(0, LIMITE)
        .map((m) => ({ type: 'materiel', id: m.id, titre: m.designation, sous: [m.type, m.etat].filter(Boolean).join(' · ') })),
    ]
    res.json(resultats.slice(0, 20))
  })
)

// ───────────────────── Discussion / journal par chantier ────────────────────

routerGlobal.get(
  '/chantiers/:id/commentaires',
  h(async (req, res) => {
    const commentaires = await prisma.commentaire.findMany({
      where: { chantierId: req.params.id },
      orderBy: { date: 'desc' },
      take: 200,
    })
    res.json(commentaires)
  })
)

routerGlobal.post(
  '/chantiers/:id/commentaires',
  h(async (req, res) => {
    if (req.user?.role === 'LECTURE') throw new ApiError(403, 'Le rôle lecture seule ne peut pas commenter.')
    const { texte } = z.object({ texte: z.string().min(1, 'Message vide').max(2000) }).parse(req.body)
    const chantier = await prisma.chantier.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!chantier) throw new ApiError(404, 'Chantier introuvable.')
    const commentaire = await prisma.commentaire.create({
      data: { chantierId: chantier.id, auteurId: req.user!.id, auteurNom: req.user!.nom, texte },
    })
    auditer(req, 'CREATE', 'commentaires', commentaire.id, `Sur ${chantier.nom}`)
    res.status(201).json(commentaire)
  })
)

routerGlobal.delete(
  '/commentaires/:id',
  h(async (req, res) => {
    const commentaire = await prisma.commentaire.findUnique({ where: { id: req.params.id } })
    if (!commentaire) throw new ApiError(404, 'Commentaire introuvable.')
    if (req.user?.role !== 'ADMIN' && commentaire.auteurId !== req.user?.id) {
      throw new ApiError(403, 'Vous ne pouvez supprimer que vos propres messages.')
    }
    await prisma.commentaire.delete({ where: { id: req.params.id } })
    res.json({ message: 'Supprimé.' })
  })
)

// ─────────────────────────── Alertes globales ───────────────────────────────

routerGlobal.get(
  '/alertes/globales',
  h(async (_req, res) => {
    const alertes: (Alerte & { lien?: string })[] = []

    // Alertes chantiers (retards, dépassement fin, budget, surcharges)
    const chantiersPlanifies = await prisma.chantier.findMany({
      where: { deletedAt: null, planningCalcule: true, statut: { not: 'Terminé' } },
      select: { id: true },
    })
    for (const c of chantiersPlanifies) {
      for (const a of await alertesChantier(c.id)) {
        alertes.push({ ...a, lien: `/planification/${c.id}?onglet=gantt` })
      }
    }

    // Stock bas
    const [materiaux, etats] = await Promise.all([
      prisma.materiau.findMany({ where: { deletedAt: null } }),
      etatStocks(),
    ])
    for (const m of materiaux) {
      const e = etats.get(m.id)
      if (e?.enAlerte) {
        alertes.push({
          type: 'STOCK_BAS',
          gravite: e.stockTotal <= 0 ? 'haute' : 'moyenne',
          message: `Stock bas : « ${m.designation} » — ${e.stockTotal} ${m.unite} restant(s) (seuil ${m.seuilAlerte}).`,
          lien: '/stock',
        })
      }
    }

    // Factures en retard
    const maintenant = new Date()
    const factures = await prisma.facture.findMany({
      where: { deletedAt: null, statut: { notIn: ['brouillon', 'payée'] }, echeance: { lt: maintenant } },
      include: { client: { select: { nom: true } }, paiements: { where: { deletedAt: null } } },
    })
    for (const f of factures) {
      const paye = f.paiements.filter((p) => p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
      const reste = f.montant - paye
      if (reste > 0.5) {
        const jours = Math.floor((maintenant.getTime() - f.echeance!.getTime()) / 86400000)
        alertes.push({
          type: 'FACTURE_RETARD' as any,
          gravite: jours > 15 ? 'haute' : 'moyenne',
          message: `Facture ${f.numero} (${f.client?.nom ?? '—'}) en retard de ${jours} j — reste ${Math.round(reste).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F.`,
          lien: '/factures',
        })
      }
    }

    // Maintenances à échéance sous 14 jours (ou dépassées)
    const bientot = new Date(maintenant.getTime() + 14 * 86400000)
    const maintenances = await prisma.maintenance.findMany({
      where: {
        deletedAt: null,
        statut: 'planifiée',
        OR: [{ datePlanifiee: { lte: bientot } }, { prochaineEcheance: { lte: bientot } }],
      },
      include: { materiel: { select: { designation: true } } },
    })
    for (const m of maintenances) {
      const echeance = m.datePlanifiee ?? m.prochaineEcheance
      const depassee = echeance && echeance < maintenant
      alertes.push({
        type: 'MAINTENANCE' as any,
        gravite: depassee ? 'haute' : 'moyenne',
        message: `Maintenance ${m.type} « ${m.materiel.designation} » ${depassee ? 'en retard' : 'à prévoir'} (échéance ${echeance?.toLocaleDateString('fr-FR') ?? '—'}).`,
        lien: '/maintenance',
      })
    }

    const ordre = { haute: 0, moyenne: 1 } as Record<string, number>
    alertes.sort((a, b) => (ordre[a.gravite] ?? 2) - (ordre[b.gravite] ?? 2))
    res.json({ total: alertes.length, hautes: alertes.filter((a) => a.gravite === 'haute').length, alertes })
  })
)
