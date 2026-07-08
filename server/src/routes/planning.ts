import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { h, ApiError } from '../lib/http'
import { auditer } from '../lib/audit'
import { authRequis, verifierRole } from '../auth'
import { calculerCpm, avancementAttendu, type TacheCpm, type DependanceCpm } from '../cpm/engine'
import { calendrierEntreprise, calculerDepensesChantiers, recalculerAvancementChantier, ecrireParametre } from '../lib/metier'

export const routerPlanning = Router()
routerPlanning.use(authRequis)

// ─────────────────────── Chargement du planning d'un chantier ───────────────

async function chargerPlanning(chantierId: string) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, deletedAt: null },
    include: { projet: { select: { id: true, nom: true } }, chef: { select: { id: true, nom: true } } },
  })
  if (!chantier) throw new ApiError(404, 'Chantier introuvable.')
  const lots = await prisma.lot.findMany({
    where: { chantierId, deletedAt: null },
    orderBy: { ordre: 'asc' },
    include: {
      taches: {
        where: { deletedAt: null },
        orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
        include: {
          predecesseurs: { include: { predecesseur: { select: { id: true, nom: true } } } },
          responsable: { select: { id: true, nom: true } },
          ressources: {
            include: {
              employe: { select: { id: true, nom: true } },
              materiel: { select: { id: true, designation: true } },
            },
          },
        },
      },
    },
  })
  return { chantier, lots }
}

routerPlanning.get(
  '/chantiers/:id/planning',
  h(async (req, res) => {
    const { chantier, lots } = await chargerPlanning(req.params.id)
    res.json({ chantier, lots })
  })
)

// ───────────────────────────── Calcul CPM ───────────────────────────────────

routerPlanning.post(
  '/chantiers/:id/planifier',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { chantier, lots } = await chargerPlanning(req.params.id)
    const taches = lots.flatMap((l) => l.taches)
    if (!taches.length) throw new ApiError(422, 'Aucune tâche à planifier. Ajoutez des lots et des tâches dans l’onglet « Préparer ».')

    const calendrier = await calendrierEntreprise()
    const tachesCpm: TacheCpm[] = taches.map((t) => ({
      id: t.id,
      nom: t.nom,
      duree: t.estJalon ? 0 : Math.max(0, t.dureeJours),
      contrainteDebut: t.dateDebutSouhaitee,
    }))
    const deps: DependanceCpm[] = taches.flatMap((t) =>
      t.predecesseurs.map((d) => ({
        predecesseurId: d.predecesseurId,
        successeurId: d.successeurId,
        type: d.type as DependanceCpm['type'],
        lagJours: d.lagJours,
      }))
    )
    const debutProjet = chantier.dateDebut ?? new Date()
    const resultat = calculerCpm(tachesCpm, deps, debutProjet, calendrier) // CpmError → 422 via middleware

    await prisma.$transaction([
      ...resultat.taches.map((r) =>
        prisma.tache.update({
          where: { id: r.id },
          data: {
            dateDebut: r.dateDebut,
            dateFin: r.dateFin,
            margeTotale: r.margeTotale,
            estCritique: r.estCritique,
          },
        })
      ),
      prisma.chantier.update({
        where: { id: chantier.id },
        data: { planningCalcule: true, finPrevue: resultat.finProjet },
      }),
    ])
    await recalculerAvancementChantier(chantier.id)
    auditer(req, 'CPM', 'chantiers', chantier.id, `Planning recalculé — ${resultat.taches.length} tâches, fin prévue ${resultat.finProjet.toISOString().slice(0, 10)}`)
    const apres = await chargerPlanning(req.params.id)
    res.json({ ...apres, finProjet: resultat.finProjet, dureeProjetJours: resultat.dureeProjetJours, cheminCritique: resultat.cheminCritique })
  })
)

// ─────────────────────────────── Alertes ────────────────────────────────────

export interface Alerte {
  type: 'RETARD_TACHE' | 'DEPASSEMENT_FIN' | 'BUDGET' | 'SURCHARGE_RESSOURCE' | 'STOCK_BAS'
  gravite: 'haute' | 'moyenne'
  message: string
  chantierId?: string
  chantierNom?: string
}

export async function alertesChantier(chantierId: string): Promise<Alerte[]> {
  const { chantier, lots } = await chargerPlanning(chantierId)
  const calendrier = await calendrierEntreprise()
  const alertes: Alerte[] = []
  const maintenant = new Date()
  const taches = lots.flatMap((l) => l.taches)

  for (const t of taches) {
    if (t.avancement >= 100 || !t.dateDebut || !t.dateFin) continue
    const attendu = avancementAttendu(t.dateDebut, t.dateFin, maintenant, calendrier)
    if (t.avancement < attendu - 5) {
      alertes.push({
        type: 'RETARD_TACHE',
        gravite: attendu - t.avancement > 30 ? 'haute' : 'moyenne',
        message: `Tâche « ${t.nom} » en retard : ${Math.round(t.avancement)} % réalisé contre ${attendu} % attendu au ${maintenant.toLocaleDateString('fr-FR')}.`,
        chantierId,
        chantierNom: chantier.nom,
      })
    }
  }

  if (chantier.finPrevue && chantier.dateFin && chantier.finPrevue > chantier.dateFin) {
    const joursEcart = Math.ceil((chantier.finPrevue.getTime() - chantier.dateFin.getTime()) / 86400000)
    alertes.push({
      type: 'DEPASSEMENT_FIN',
      gravite: 'haute',
      message: `La fin prévue par le planning (${chantier.finPrevue.toLocaleDateString('fr-FR')}) dépasse la date de fin contractuelle (${chantier.dateFin.toLocaleDateString('fr-FR')}) de ${joursEcart} jour(s).`,
      chantierId,
      chantierNom: chantier.nom,
    })
  }

  const depenses = await calculerDepensesChantiers()
  const depense = depenses.get(chantierId)?.total ?? 0
  if (chantier.budget > 0 && depense > chantier.budget * 0.9) {
    alertes.push({
      type: 'BUDGET',
      gravite: depense > chantier.budget ? 'haute' : 'moyenne',
      message:
        depense > chantier.budget
          ? `Budget dépassé : ${Math.round((depense / chantier.budget) * 100)} % du budget consommé.`
          : `Attention : ${Math.round((depense / chantier.budget) * 100)} % du budget déjà consommé.`,
      chantierId,
      chantierNom: chantier.nom,
    })
  }

  // Surcharge : une même ressource affectée à des tâches qui se chevauchent
  const parRessource = new Map<string, { nom: string; taches: { nom: string; debut: Date; fin: Date }[] }>()
  for (const t of taches) {
    if (!t.dateDebut || !t.dateFin) continue
    for (const r of t.ressources) {
      const cle = r.employeId ? `E:${r.employeId}` : r.materielId ? `M:${r.materielId}` : ''
      if (!cle) continue
      const nom = r.employe?.nom ?? r.materiel?.designation ?? '?'
      if (!parRessource.has(cle)) parRessource.set(cle, { nom, taches: [] })
      parRessource.get(cle)!.taches.push({ nom: t.nom, debut: t.dateDebut, fin: t.dateFin })
    }
  }
  for (const { nom, taches: liste } of parRessource.values()) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        if (liste[i].debut <= liste[j].fin && liste[j].debut <= liste[i].fin) {
          alertes.push({
            type: 'SURCHARGE_RESSOURCE',
            gravite: 'moyenne',
            message: `« ${nom} » est affecté(e) simultanément à « ${liste[i].nom} » et « ${liste[j].nom} ».`,
            chantierId,
            chantierNom: chantier.nom,
          })
        }
      }
    }
  }

  return alertes
}

routerPlanning.get(
  '/chantiers/:id/alertes',
  h(async (req, res) => {
    res.json(await alertesChantier(req.params.id))
  })
)

routerPlanning.get(
  '/planification/alertes',
  h(async (_req, res) => {
    const chantiers = await prisma.chantier.findMany({ where: { deletedAt: null, planningCalcule: true }, select: { id: true } })
    const tout: Alerte[] = []
    for (const c of chantiers) tout.push(...(await alertesChantier(c.id)))
    res.json(tout)
  })
)

// ─────────────────────────────── Baselines ──────────────────────────────────

routerPlanning.post(
  '/chantiers/:id/baselines',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { nom } = z.object({ nom: z.string().min(1).default('Baseline') }).parse(req.body ?? {})
    const { chantier, lots } = await chargerPlanning(req.params.id)
    if (!chantier.planningCalcule) throw new ApiError(422, 'Calculez d’abord le planning avant de créer une baseline.')
    const snapshot = lots.flatMap((l) =>
      l.taches.map((t) => ({
        id: t.id,
        nom: t.nom,
        lot: l.nom,
        dateDebut: t.dateDebut,
        dateFin: t.dateFin,
        dureeJours: t.dureeJours,
        avancement: t.avancement,
      }))
    )
    const baseline = await prisma.baseline.create({
      data: { chantierId: chantier.id, nom, donneesJson: JSON.stringify(snapshot) },
    })
    auditer(req, 'CREATE', 'baselines', baseline.id, `Baseline « ${nom} » sur ${chantier.nom}`)
    res.status(201).json(baseline)
  })
)

routerPlanning.get(
  '/chantiers/:id/baselines',
  h(async (req, res) => {
    const baselines = await prisma.baseline.findMany({
      where: { chantierId: req.params.id },
      orderBy: { dateSnapshot: 'desc' },
    })
    res.json(baselines.map(({ donneesJson, ...b }) => ({ ...b, nbTaches: JSON.parse(donneesJson).length })))
  })
)

routerPlanning.get(
  '/baselines/:id/comparaison',
  h(async (req, res) => {
    const baseline = await prisma.baseline.findUnique({ where: { id: req.params.id } })
    if (!baseline) throw new ApiError(404, 'Baseline introuvable.')
    const { lots } = await chargerPlanning(baseline.chantierId)
    const actuelles = new Map(lots.flatMap((l) => l.taches.map((t) => [t.id, { ...t, lotNom: l.nom }])))
    const snapshot: any[] = JSON.parse(baseline.donneesJson)
    const lignes = snapshot.map((s) => {
      const actuelle = actuelles.get(s.id)
      const finPrevue = s.dateFin ? new Date(s.dateFin) : null
      const finActuelle = actuelle?.dateFin ?? null
      const glissementJours =
        finPrevue && finActuelle ? Math.round((finActuelle.getTime() - finPrevue.getTime()) / 86400000) : null
      return {
        tacheId: s.id,
        nom: s.nom,
        lot: s.lot,
        debutPrevu: s.dateDebut,
        finPrevue: s.dateFin,
        debutActuel: actuelle?.dateDebut ?? null,
        finActuelle,
        glissementJours,
        supprimee: !actuelle,
      }
    })
    res.json({ baseline: { id: baseline.id, nom: baseline.nom, dateSnapshot: baseline.dateSnapshot }, lignes })
  })
)

routerPlanning.delete(
  '/baselines/:id',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    await prisma.baseline.delete({ where: { id: req.params.id } })
    auditer(req, 'DELETE', 'baselines', req.params.id)
    res.json({ message: 'Supprimé.' })
  })
)

// ──────────────────────── Vue d'ensemble planification ──────────────────────

routerPlanning.get(
  '/planification/apercu',
  h(async (_req, res) => {
    const chantiers = await prisma.chantier.findMany({
      where: { deletedAt: null },
      include: { projet: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const depenses = await calculerDepensesChantiers()
    const lots = await prisma.lot.findMany({
      where: { deletedAt: null },
      select: { chantierId: true, _count: { select: { taches: { where: { deletedAt: null } } } } },
    })
    const nbTaches = new Map<string, number>()
    for (const l of lots) nbTaches.set(l.chantierId, (nbTaches.get(l.chantierId) ?? 0) + l._count.taches)
    const liste = chantiers.map((c) => ({
      ...c,
      depense: depenses.get(c.id)?.total ?? 0,
      nbTaches: nbTaches.get(c.id) ?? 0,
    }))
    res.json({
      compteurs: {
        total: chantiers.length,
        calcules: chantiers.filter((c) => c.planningCalcule).length,
        enCours: chantiers.filter((c) => c.statut === 'En cours').length,
        termines: chantiers.filter((c) => c.statut === 'Terminé').length,
      },
      chantiers: liste,
    })
  })
)

// Gantt multi-chantiers : ?chantierId=xxx ou tous
routerPlanning.get(
  '/planification/gantt',
  h(async (req, res) => {
    const chantierId = typeof req.query.chantierId === 'string' ? req.query.chantierId : ''
    const where =
      chantierId && chantierId !== 'tous'
        ? { id: chantierId, deletedAt: null }
        : { deletedAt: null, planningCalcule: true }
    const chantiers = await prisma.chantier.findMany({ where, orderBy: { nom: 'asc' } })
    const resultat = []
    for (const c of chantiers) {
      const { lots } = await chargerPlanning(c.id)
      resultat.push({ chantier: c, lots })
    }
    res.json(resultat)
  })
)

// ─────────────────────────── Tâches transversales ───────────────────────────

routerPlanning.get(
  '/taches-transversales',
  h(async (req, res) => {
    const taches = await prisma.tache.findMany({
      where: { deletedAt: null, lot: { deletedAt: null, chantier: { deletedAt: null } } },
      include: {
        lot: { include: { chantier: { select: { id: true, nom: true } } } },
        responsable: { select: { id: true, nom: true } },
      },
      orderBy: [{ dateDebut: 'asc' }],
    })
    res.json(taches)
  })
)

routerPlanning.patch(
  '/taches/:id/avancement',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { avancement } = z.object({ avancement: z.coerce.number().min(0).max(100) }).parse(req.body)
    const tache = await prisma.tache.update({
      where: { id: req.params.id },
      data: { avancement },
      include: { lot: true },
    })
    await recalculerAvancementChantier(tache.lot.chantierId)
    auditer(req, 'UPDATE', 'taches', tache.id, `Avancement → ${avancement} %`)
    res.json(tache)
  })
)

// ─────────────────────────────── Pointages ──────────────────────────────────

routerPlanning.get(
  '/pointages',
  h(async (req, res) => {
    const chantierId = String(req.query.chantierId ?? '')
    const dateStr = String(req.query.date ?? '')
    if (!chantierId || !dateStr) throw new ApiError(400, 'chantierId et date sont requis.')
    const jour = new Date(dateStr)
    const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate())
    const fin = new Date(debut.getTime() + 86400000)
    const [employes, pointages] = await Promise.all([
      prisma.employe.findMany({
        where: { deletedAt: null, statut: 'actif', chantierId },
        orderBy: { nom: 'asc' },
      }),
      prisma.pointage.findMany({ where: { chantierId, date: { gte: debut, lt: fin } } }),
    ])
    const parEmploye = new Map(pointages.map((p) => [p.employeId, p]))
    res.json(
      employes.map((e) => ({
        employe: e,
        present: parEmploye.get(e.id)?.present ?? null,
      }))
    )
  })
)

routerPlanning.post(
  '/pointages/journee',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { chantierId, date, presences } = z
      .object({
        chantierId: z.string().min(1),
        date: z.coerce.date(),
        presences: z.array(z.object({ employeId: z.string(), present: z.boolean() })),
      })
      .parse(req.body)
    const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    for (const p of presences) {
      await prisma.pointage.upsert({
        where: { employeId_date: { employeId: p.employeId, date: jour } },
        create: { employeId: p.employeId, chantierId, date: jour, present: p.present },
        update: { present: p.present, chantierId },
      })
    }
    auditer(req, 'UPDATE', 'pointages', chantierId, `Pointage du ${jour.toLocaleDateString('fr-FR')} — ${presences.length} employés`)
    res.json({ message: 'Pointage enregistré.' })
  })
)

// ─────────────────────── Calendrier ouvré (paramètres) ──────────────────────

routerPlanning.get(
  '/parametres/calendrier',
  h(async (_req, res) => {
    res.json(await calendrierEntreprise())
  })
)

routerPlanning.put(
  '/parametres/calendrier',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET'])
    const data = z
      .object({
        joursOuvres: z.array(z.number().min(0).max(6)).min(1, 'Au moins un jour ouvré'),
        feries: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ')),
      })
      .parse(req.body)
    await ecrireParametre('calendrier', JSON.stringify(data))
    auditer(req, 'UPDATE', 'parametres', 'calendrier')
    res.json(data)
  })
)
