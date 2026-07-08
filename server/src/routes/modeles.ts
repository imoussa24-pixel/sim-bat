import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { h, ApiError } from '../lib/http'
import { auditer } from '../lib/audit'
import { authRequis, verifierRole } from '../auth'

export const routerModeles = Router()
routerModeles.use(authRequis)

// Structure d'un modèle :
// [{ lot, ordre, taches: [{ cle, nom, duree, jalon?, deps?: [{ pred, type, lag }] }] }]

interface TacheModele {
  cle: string
  nom: string
  duree: number
  jalon?: boolean
  deps?: { pred: string; type?: 'FD' | 'DD' | 'FF' | 'DF'; lag?: number }[]
}
interface LotModele {
  lot: string
  ordre: number
  taches: TacheModele[]
}

const MODELES_DEFAUT: { nom: string; description: string; lots: LotModele[] }[] = [
  {
    nom: 'Villa R+1 (gros œuvre + finitions)',
    description: 'Construction d’une villa duplex : fondation, élévation, toiture et finitions.',
    lots: [
      {
        lot: 'Fondation', ordre: 1,
        taches: [
          { cle: 'F1', nom: 'Implantation et piquetage', duree: 1 },
          { cle: 'F2', nom: 'Fouilles en rigole', duree: 3, deps: [{ pred: 'F1' }] },
          { cle: 'F3', nom: 'Béton de propreté', duree: 1, deps: [{ pred: 'F2' }] },
          { cle: 'F4', nom: 'Semelles filantes + amorces', duree: 4, deps: [{ pred: 'F3' }] },
          { cle: 'F5', nom: 'Soubassement + remblai', duree: 3, deps: [{ pred: 'F4' }] },
          { cle: 'F6', nom: 'Réception des fondations', duree: 0, jalon: true, deps: [{ pred: 'F5' }] },
        ],
      },
      {
        lot: 'Élévation', ordre: 2,
        taches: [
          { cle: 'E1', nom: 'Dallage RDC', duree: 2, deps: [{ pred: 'F6' }] },
          { cle: 'E2', nom: 'Maçonnerie RDC', duree: 6, deps: [{ pred: 'E1' }] },
          { cle: 'E3', nom: 'Plancher haut RDC', duree: 5, deps: [{ pred: 'E2', type: 'DD', lag: 3 }] },
          { cle: 'E4', nom: 'Maçonnerie étage', duree: 6, deps: [{ pred: 'E3' }] },
          { cle: 'E5', nom: 'Chaînage haut', duree: 2, deps: [{ pred: 'E4' }] },
        ],
      },
      {
        lot: 'Toiture', ordre: 3,
        taches: [
          { cle: 'T1', nom: 'Charpente', duree: 3, deps: [{ pred: 'E5' }] },
          { cle: 'T2', nom: 'Couverture', duree: 3, deps: [{ pred: 'T1' }] },
          { cle: 'T3', nom: 'Étanchéité terrasse', duree: 2, deps: [{ pred: 'T2', type: 'FF', lag: 1 }] },
        ],
      },
      {
        lot: 'Finitions', ordre: 4,
        taches: [
          { cle: 'N1', nom: 'Enduits intérieurs/extérieurs', duree: 6, deps: [{ pred: 'E5' }] },
          { cle: 'N2', nom: 'Électricité + plomberie', duree: 5, deps: [{ pred: 'N1', type: 'DD', lag: 2 }] },
          { cle: 'N3', nom: 'Carrelage', duree: 5, deps: [{ pred: 'N1' }] },
          { cle: 'N4', nom: 'Menuiseries', duree: 3, deps: [{ pred: 'N3' }] },
          { cle: 'N5', nom: 'Peinture générale', duree: 4, deps: [{ pred: 'N4' }, { pred: 'T2' }] },
          { cle: 'N6', nom: 'Réception provisoire', duree: 0, jalon: true, deps: [{ pred: 'N5' }, { pred: 'N2' }, { pred: 'T3' }] },
        ],
      },
    ],
  },
  {
    nom: 'École 3 classes',
    description: 'Bloc pédagogique de 3 classes avec bureau et latrines.',
    lots: [
      {
        lot: 'Fondation', ordre: 1,
        taches: [
          { cle: 'F1', nom: 'Implantation', duree: 1 },
          { cle: 'F2', nom: 'Fouilles', duree: 3, deps: [{ pred: 'F1' }] },
          { cle: 'F3', nom: 'Béton de propreté', duree: 1, deps: [{ pred: 'F2' }] },
          { cle: 'F4', nom: 'Semelles + amorces', duree: 4, deps: [{ pred: 'F3' }] },
          { cle: 'F5', nom: 'Remblai compacté', duree: 2, deps: [{ pred: 'F4' }] },
        ],
      },
      {
        lot: 'Élévation', ordre: 2,
        taches: [
          { cle: 'E1', nom: 'Soubassement', duree: 3, deps: [{ pred: 'F5' }] },
          { cle: 'E2', nom: 'Dallage', duree: 2, deps: [{ pred: 'E1' }] },
          { cle: 'E3', nom: 'Murs en agglos', duree: 8, deps: [{ pred: 'E2' }] },
          { cle: 'E4', nom: 'Chaînage haut', duree: 3, deps: [{ pred: 'E3' }] },
        ],
      },
      {
        lot: 'Toiture', ordre: 3,
        taches: [
          { cle: 'T1', nom: 'Charpente bois', duree: 3, deps: [{ pred: 'E4' }] },
          { cle: 'T2', nom: 'Couverture tôle', duree: 3, deps: [{ pred: 'T1' }] },
          { cle: 'T3', nom: 'Plafonds', duree: 4, deps: [{ pred: 'T2' }] },
        ],
      },
      {
        lot: 'Finitions', ordre: 4,
        taches: [
          { cle: 'N1', nom: 'Enduits', duree: 6, deps: [{ pred: 'E4' }] },
          { cle: 'N2', nom: 'Peinture', duree: 5, deps: [{ pred: 'N1' }, { pred: 'T3' }] },
          { cle: 'N3', nom: 'Livraison', duree: 0, jalon: true, deps: [{ pred: 'N2' }] },
        ],
      },
    ],
  },
  {
    nom: 'Bâtiment courant R+2 (gros œuvre)',
    description: 'Structure béton armé : fondations, superstructure par niveau, toiture terrasse.',
    lots: [
      {
        lot: 'Fondation', ordre: 1,
        taches: [
          { cle: 'F1', nom: 'Installation de chantier', duree: 2 },
          { cle: 'F2', nom: 'Terrassements', duree: 4, deps: [{ pred: 'F1' }] },
          { cle: 'F3', nom: 'Fondations BA', duree: 8, deps: [{ pred: 'F2' }] },
          { cle: 'F4', nom: 'Réception fondations', duree: 0, jalon: true, deps: [{ pred: 'F3' }] },
        ],
      },
      {
        lot: 'Superstructure', ordre: 2,
        taches: [
          { cle: 'S1', nom: 'Poteaux + voiles RDC', duree: 5, deps: [{ pred: 'F4' }] },
          { cle: 'S2', nom: 'Plancher haut RDC', duree: 6, deps: [{ pred: 'S1' }] },
          { cle: 'S3', nom: 'Poteaux + voiles R+1', duree: 5, deps: [{ pred: 'S2' }] },
          { cle: 'S4', nom: 'Plancher haut R+1', duree: 6, deps: [{ pred: 'S3' }] },
          { cle: 'S5', nom: 'Poteaux + voiles R+2', duree: 5, deps: [{ pred: 'S4' }] },
          { cle: 'S6', nom: 'Plancher terrasse', duree: 6, deps: [{ pred: 'S5' }] },
        ],
      },
      {
        lot: 'Toiture', ordre: 3,
        taches: [
          { cle: 'T1', nom: 'Forme de pente + étanchéité', duree: 4, deps: [{ pred: 'S6' }] },
          { cle: 'T2', nom: 'Acrotères + protection', duree: 3, deps: [{ pred: 'T1' }] },
        ],
      },
      {
        lot: 'Clos & couvert', ordre: 4,
        taches: [
          { cle: 'C1', nom: 'Maçonnerie de remplissage', duree: 10, deps: [{ pred: 'S4', type: 'DD', lag: 4 }] },
          { cle: 'C2', nom: 'Menuiseries extérieures', duree: 4, deps: [{ pred: 'C1' }] },
          { cle: 'C3', nom: 'Hors d’eau / hors d’air', duree: 0, jalon: true, deps: [{ pred: 'C2' }, { pred: 'T2' }] },
        ],
      },
    ],
  },
]

/** Crée les modèles par défaut au premier accès (bases existantes comme neuves). */
async function assurerModelesDefaut() {
  const n = await prisma.modeleWbs.count()
  if (n > 0) return
  for (const m of MODELES_DEFAUT) {
    await prisma.modeleWbs.create({
      data: { nom: m.nom, description: m.description, donneesJson: JSON.stringify(m.lots) },
    })
  }
}

routerModeles.get(
  '/modeles-wbs',
  h(async (_req, res) => {
    await assurerModelesDefaut()
    const modeles = await prisma.modeleWbs.findMany({ orderBy: { createdAt: 'asc' } })
    res.json(
      modeles.map((m) => {
        const lots: LotModele[] = JSON.parse(m.donneesJson)
        return {
          id: m.id,
          nom: m.nom,
          description: m.description,
          nbLots: lots.length,
          nbTaches: lots.reduce((s, l) => s + l.taches.length, 0),
          lots: lots.map((l) => ({ lot: l.lot, nbTaches: l.taches.length })),
        }
      })
    )
  })
)

routerModeles.delete(
  '/modeles-wbs/:id',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    await prisma.modeleWbs.delete({ where: { id: req.params.id } })
    auditer(req, 'DELETE', 'modeles-wbs', req.params.id)
    res.json({ message: 'Modèle supprimé.' })
  })
)

// Enregistrer le planning d'un chantier comme modèle réutilisable
routerModeles.post(
  '/chantiers/:id/enregistrer-modele',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { nom, description } = z
      .object({ nom: z.string().min(1, 'Nom requis'), description: z.string().optional() })
      .parse(req.body)
    const lots = await prisma.lot.findMany({
      where: { chantierId: req.params.id, deletedAt: null },
      orderBy: { ordre: 'asc' },
      include: {
        taches: {
          where: { deletedAt: null },
          orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
          include: { predecesseurs: true },
        },
      },
    })
    const toutes = lots.flatMap((l) => l.taches)
    if (!toutes.length) throw new ApiError(422, 'Aucune tâche à enregistrer dans ce chantier.')
    const cleDe = new Map(toutes.map((t, i) => [t.id, `T${i + 1}`]))
    const donnees: LotModele[] = lots
      .filter((l) => l.taches.length)
      .map((l, i) => ({
        lot: l.nom,
        ordre: i + 1,
        taches: l.taches.map((t) => ({
          cle: cleDe.get(t.id)!,
          nom: t.nom,
          duree: t.dureeJours,
          jalon: t.estJalon || undefined,
          deps: t.predecesseurs
            .filter((d) => cleDe.has(d.predecesseurId))
            .map((d) => ({
              pred: cleDe.get(d.predecesseurId)!,
              type: d.type as any,
              lag: d.lagJours || undefined,
            })),
        })),
      }))
    const modele = await prisma.modeleWbs.create({
      data: { nom, description: description ?? null, donneesJson: JSON.stringify(donnees) },
    })
    auditer(req, 'CREATE', 'modeles-wbs', modele.id, `Depuis chantier ${req.params.id}`)
    res.status(201).json({ id: modele.id, nom: modele.nom })
  })
)

// Appliquer un modèle à un chantier (ajoute lots + tâches + dépendances)
routerModeles.post(
  '/chantiers/:id/appliquer-modele',
  h(async (req, res) => {
    verifierRole(req, ['CHEF_PROJET', 'CONDUCTEUR'])
    const { modeleId } = z.object({ modeleId: z.string().min(1) }).parse(req.body)
    const [chantier, modele] = await Promise.all([
      prisma.chantier.findFirst({ where: { id: req.params.id, deletedAt: null } }),
      prisma.modeleWbs.findUnique({ where: { id: modeleId } }),
    ])
    if (!chantier) throw new ApiError(404, 'Chantier introuvable.')
    if (!modele) throw new ApiError(404, 'Modèle introuvable.')
    const lots: LotModele[] = JSON.parse(modele.donneesJson)
    const nbLotsExistants = await prisma.lot.count({ where: { chantierId: chantier.id, deletedAt: null } })

    const idParCle = new Map<string, string>()
    let ordreTache = 0
    for (const [iLot, lm] of lots.entries()) {
      const lot = await prisma.lot.create({
        data: { chantierId: chantier.id, nom: lm.lot, ordre: nbLotsExistants + iLot + 1 },
      })
      for (const tm of lm.taches) {
        const tache = await prisma.tache.create({
          data: {
            lotId: lot.id,
            nom: tm.nom,
            dureeJours: tm.jalon ? 0 : tm.duree,
            estJalon: !!tm.jalon,
            ordre: ordreTache++,
          },
        })
        idParCle.set(tm.cle, tache.id)
      }
    }
    for (const lm of lots) {
      for (const tm of lm.taches) {
        for (const dep of tm.deps ?? []) {
          const predId = idParCle.get(dep.pred)
          const succId = idParCle.get(tm.cle)
          if (predId && succId) {
            await prisma.dependanceTache.create({
              data: { predecesseurId: predId, successeurId: succId, type: dep.type ?? 'FD', lagJours: dep.lag ?? 0 },
            })
          }
        }
      }
    }
    auditer(req, 'CREATE', 'chantiers', chantier.id, `Modèle « ${modele.nom} » appliqué`)
    res.json({ message: `Modèle « ${modele.nom} » appliqué : ${lots.length} lots et ${idParCle.size} tâches créés. Lancez le calcul CPM.` })
  })
)
