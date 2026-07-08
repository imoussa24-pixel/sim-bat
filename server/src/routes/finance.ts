import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { h, ApiError } from '../lib/http'
import { auditer } from '../lib/audit'
import { authRequis, verifierRole } from '../auth'
import { prochainNumero, totauxDevis } from '../lib/metier'

export const routerFinance = Router()
routerFinance.use(authRequis)

async function chargerDevis(id: string) {
  const devis = await prisma.devis.findFirst({
    where: { id, deletedAt: null },
    include: { lignes: { orderBy: { ordre: 'asc' } }, client: true, projet: true, contrat: true },
  })
  if (!devis) throw new ApiError(404, 'Devis introuvable.')
  return devis
}

// Duplication d'un devis (nouvelle version)
routerFinance.post(
  '/devis/:id/dupliquer',
  h(async (req, res) => {
    verifierRole(req, ['COMPTABLE', 'CHEF_PROJET'])
    const source = await chargerDevis(req.params.id)
    const copie = await prisma.devis.create({
      data: {
        numero: await prochainNumero('devis', 'DEV'),
        clientId: source.clientId,
        projetId: source.projetId,
        objet: source.objet,
        statut: 'brouillon',
        tvaTaux: source.tvaTaux,
        remise: source.remise,
        version: source.version + 1,
        notes: source.notes,
        lignes: {
          create: source.lignes.map((l) => ({
            designation: l.designation,
            unite: l.unite,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            ordre: l.ordre,
          })),
        },
      },
      include: { lignes: true },
    })
    auditer(req, 'CREATE', 'devis', copie.id, `Duplication de ${source.numero} (v${copie.version})`)
    res.status(201).json(copie)
  })
)

// Conversion devis → contrat (+ projet optionnel)
routerFinance.post(
  '/devis/:id/convertir-contrat',
  h(async (req, res) => {
    verifierRole(req, ['COMPTABLE', 'CHEF_PROJET'])
    const { creerProjet } = z.object({ creerProjet: z.boolean().optional() }).parse(req.body ?? {})
    const devis = await chargerDevis(req.params.id)
    if (devis.contrat) throw new ApiError(409, `Ce devis a déjà été converti (contrat ${devis.contrat.numero}).`)
    const { totalTTC } = totauxDevis(devis)

    let projetId = devis.projetId
    if (creerProjet && !projetId) {
      const projet = await prisma.projet.create({
        data: {
          nom: devis.objet || `Projet ${devis.numero}`,
          clientId: devis.clientId,
          budget: totalTTC,
          statut: 'Planifié',
          dateDebut: new Date(),
        },
      })
      projetId = projet.id
      await prisma.devis.update({ where: { id: devis.id }, data: { projetId } })
    }

    const contrat = await prisma.contrat.create({
      data: {
        numero: await prochainNumero('contrat', 'CTR'),
        devisId: devis.id,
        clientId: devis.clientId,
        projetId,
        objet: devis.objet,
        montant: totalTTC,
        dateSignature: new Date(),
      },
      include: { client: true, projet: true },
    })
    if (devis.statut !== 'accepté') {
      await prisma.devis.update({ where: { id: devis.id }, data: { statut: 'accepté' } })
    }
    auditer(req, 'CREATE', 'contrats', contrat.id, `Conversion du devis ${devis.numero} → ${contrat.numero}`)
    res.status(201).json(contrat)
  })
)

// Création de facture depuis un devis / contrat
routerFinance.post(
  '/devis/:id/creer-facture',
  h(async (req, res) => {
    verifierRole(req, ['COMPTABLE', 'CHEF_PROJET'])
    const params = z
      .object({
        type: z.enum(['acompte', 'situation', 'solde']).default('acompte'),
        pourcentage: z.coerce.number().min(0).max(100).optional(),
        montant: z.coerce.number().min(0).optional(),
        echeance: z.coerce.date().optional(),
        retenueGarantie: z.coerce.number().min(0).max(20).default(0),
      })
      .parse(req.body ?? {})
    const devis = await chargerDevis(req.params.id)
    const { totalTTC } = totauxDevis(devis)
    const montant = params.montant ?? (params.pourcentage != null ? (totalTTC * params.pourcentage) / 100 : totalTTC)
    const facture = await prisma.facture.create({
      data: {
        numero: await prochainNumero('facture', 'FAC'),
        contratId: devis.contrat?.id ?? null,
        projetId: devis.projetId,
        clientId: devis.clientId,
        type: params.type,
        objet: `${params.type === 'acompte' ? 'Acompte' : params.type === 'solde' ? 'Solde' : 'Situation'} — ${devis.objet ?? devis.numero}`,
        montant: Math.round(montant),
        avancementPct: params.pourcentage ?? null,
        retenueGarantie: params.retenueGarantie,
        echeance: params.echeance ?? new Date(Date.now() + 30 * 86400000),
        statut: 'brouillon',
      },
      include: { client: true },
    })
    auditer(req, 'CREATE', 'factures', facture.id, `Facture ${facture.numero} depuis devis ${devis.numero}`)
    res.status(201).json(facture)
  })
)

// Remplacement en bloc des lignes d'un devis (éditeur)
routerFinance.put(
  '/devis/:id/lignes',
  h(async (req, res) => {
    verifierRole(req, ['COMPTABLE', 'CHEF_PROJET'])
    const lignes = z
      .array(
        z.object({
          designation: z.string().min(1),
          unite: z.string().default('u'),
          quantite: z.coerce.number().default(1),
          prixUnitaire: z.coerce.number().default(0),
        })
      )
      .parse(req.body)
    const devis = await chargerDevis(req.params.id)
    await prisma.$transaction([
      prisma.ligneDevis.deleteMany({ where: { devisId: devis.id } }),
      prisma.ligneDevis.createMany({
        data: lignes.map((l, i) => ({ ...l, devisId: devis.id, ordre: i })),
      }),
    ])
    auditer(req, 'UPDATE', 'devis', devis.id, `Lignes mises à jour (${lignes.length})`)
    res.json(await chargerDevis(req.params.id))
  })
)

// ─────────────────── Situation de travaux automatique ───────────────────────

/** Avancement réel d'un contrat : moyenne pondérée (par budget) des chantiers de son projet. */
async function apercuSituation(contratId: string) {
  const contrat = await prisma.contrat.findFirst({
    where: { id: contratId, deletedAt: null },
    include: { client: true, projet: true },
  })
  if (!contrat) throw new ApiError(404, 'Contrat introuvable.')

  let avancement = 0
  if (contrat.projetId) {
    const chantiers = await prisma.chantier.findMany({
      where: { projetId: contrat.projetId, deletedAt: null },
      select: { budget: true, avancement: true },
    })
    if (chantiers.length) {
      const poids = chantiers.reduce((s, c) => s + Math.max(c.budget, 1), 0)
      avancement = chantiers.reduce((s, c) => s + c.avancement * Math.max(c.budget, 1), 0) / poids
    } else {
      avancement = contrat.projet?.avancement ?? 0
    }
  }
  avancement = Math.round(avancement * 10) / 10

  const factures = await prisma.facture.findMany({
    where: { contratId: contrat.id, deletedAt: null, statut: { not: 'brouillon' } },
  })
  const brouillons = await prisma.facture.findMany({
    where: { contratId: contrat.id, deletedAt: null, statut: 'brouillon' },
  })
  const dejaFacture = factures.reduce((s, f) => s + f.montant, 0)
  const enBrouillon = brouillons.reduce((s, f) => s + f.montant, 0)
  const montantAvancement = (contrat.montant * avancement) / 100
  const montantPropose = Math.max(0, Math.round(montantAvancement - dejaFacture - enBrouillon))

  return {
    contrat: { id: contrat.id, numero: contrat.numero, objet: contrat.objet, montant: contrat.montant, client: contrat.client?.nom ?? null },
    avancementPct: avancement,
    montantAvancement: Math.round(montantAvancement),
    dejaFacture,
    enBrouillon,
    montantPropose,
  }
}

routerFinance.get(
  '/contrats/:id/situation-apercu',
  h(async (req, res) => {
    res.json(await apercuSituation(req.params.id))
  })
)

routerFinance.post(
  '/contrats/:id/situation',
  h(async (req, res) => {
    verifierRole(req, ['COMPTABLE', 'CHEF_PROJET'])
    const params = z
      .object({
        montant: z.coerce.number().min(1).optional(),
        retenueGarantie: z.coerce.number().min(0).max(20).default(5),
        echeance: z.coerce.date().optional(),
      })
      .parse(req.body ?? {})
    const apercu = await apercuSituation(req.params.id)
    const montant = params.montant ?? apercu.montantPropose
    if (montant <= 0) {
      throw new ApiError(422, 'Rien à facturer : l’avancement actuel est déjà couvert par les factures émises.')
    }
    const contrat = await prisma.contrat.findUnique({ where: { id: req.params.id } })
    const nbSituations = await prisma.facture.count({ where: { contratId: req.params.id, type: 'situation', deletedAt: null } })
    const facture = await prisma.facture.create({
      data: {
        numero: await prochainNumero('facture', 'FAC'),
        contratId: req.params.id,
        projetId: contrat?.projetId ?? null,
        clientId: contrat?.clientId ?? null,
        type: 'situation',
        objet: `Situation n°${nbSituations + 1} — ${apercu.contrat.objet ?? apercu.contrat.numero} (avancement ${apercu.avancementPct} %)`,
        montant: Math.round(montant),
        avancementPct: apercu.avancementPct,
        retenueGarantie: params.retenueGarantie,
        echeance: params.echeance ?? new Date(Date.now() + 30 * 86400000),
        statut: 'brouillon',
      },
      include: { client: true },
    })
    auditer(req, 'CREATE', 'factures', facture.id, `Situation auto depuis ${apercu.contrat.numero} (${apercu.avancementPct} %)`)
    res.status(201).json(facture)
  })
)

// Historique complet d'un client
routerFinance.get(
  '/clients/:id/historique',
  h(async (req, res) => {
    const client = await prisma.client.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!client) throw new ApiError(404, 'Client introuvable.')
    const [projets, devis, contrats, factures] = await Promise.all([
      prisma.projet.findMany({ where: { clientId: client.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.devis.findMany({
        where: { clientId: client.id, deletedAt: null },
        include: { lignes: true },
        orderBy: { date: 'desc' },
      }),
      prisma.contrat.findMany({ where: { clientId: client.id, deletedAt: null }, orderBy: { dateSignature: 'desc' } }),
      prisma.facture.findMany({
        where: { clientId: client.id, deletedAt: null },
        include: { paiements: { where: { deletedAt: null } } },
        orderBy: { date: 'desc' },
      }),
    ])
    const totalFacture = factures.reduce((s, f) => s + f.montant, 0)
    const totalPaye = factures.reduce(
      (s, f) => s + f.paiements.filter((p) => p.sens === 'encaissement').reduce((x, p) => x + p.montant, 0),
      0
    )
    res.json({
      client,
      projets,
      devis: devis.map((d) => ({ ...d, ...totauxDevis(d) })),
      contrats,
      factures: factures.map((f) => ({
        ...f,
        totalPaye: f.paiements.filter((p) => p.sens === 'encaissement').reduce((x, p) => x + p.montant, 0),
      })),
      solde: { totalFacture, totalPaye, resteAPayer: totalFacture - totalPaye },
    })
  })
)
