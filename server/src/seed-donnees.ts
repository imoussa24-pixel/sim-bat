// ─────────────────────────────────────────────────────────────────────────────
// SIM-BAT — Seed de démonstration (entreprise BTP au Niger)
// Clients, projets, chantiers (Niamey, Zinder, Dosso, Maradi, Doutchi),
// plannings CPM avec lots Fondation/Élévation/Toiture, 12 mois de finance.
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { calculerCpm, type TacheCpm, type DependanceCpm, type CalendrierOuvre } from './cpm/engine'


const d = (annee: number, mois: number, jour: number) => new Date(annee, mois - 1, jour)

const CALENDRIER: CalendrierOuvre = {
  joursOuvres: [1, 2, 3, 4, 5, 6],
  feries: ['2026-01-01', '2026-03-20', '2026-04-24', '2026-05-01', '2026-05-27', '2026-08-03', '2026-12-18', '2026-12-25'],
}

async function vider(prisma: PrismaClient) {
  // Ordre respectant les clés étrangères
  await prisma.auditLog.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.paiement.deleteMany()
  await prisma.facture.deleteMany()
  await prisma.contrat.deleteMany()
  await prisma.ligneDevis.deleteMany()
  await prisma.devis.deleteMany()
  await prisma.depense.deleteMany()
  await prisma.maintenance.deleteMany()
  await prisma.stockMouvement.deleteMany()
  await prisma.materiau.deleteMany()
  await prisma.mouvementMateriel.deleteMany()
  await prisma.tacheRessource.deleteMany()
  await prisma.dependanceTache.deleteMany()
  await prisma.baseline.deleteMany()
  await prisma.tache.deleteMany()
  await prisma.lot.deleteMany()
  await prisma.pointage.deleteMany()
  await prisma.materiel.deleteMany()
  await prisma.employe.deleteMany()
  await prisma.chantier.deleteMany()
  await prisma.projet.deleteMany()
  await prisma.client.deleteMany()
  await prisma.utilisateur.deleteMany()
  await prisma.parametre.deleteMany()
}

export async function executerSeed(prisma: PrismaClient) {
  console.log('— Nettoyage de la base…')
  await vider(prisma)

  // ───────────────────────────── Paramètres ─────────────────────────────────
  console.log('— Paramètres entreprise & calendrier…')
  await prisma.parametre.createMany({
    data: [
      { cle: 'entreprise_nom', valeur: 'SIM-BAT BTP' },
      { cle: 'entreprise_adresse', valeur: 'Boulevard Mali Béro, Plateau — Niamey, NIGER' },
      { cle: 'entreprise_tel', valeur: '+227 20 73 45 67' },
      { cle: 'entreprise_email', valeur: 'contact@simbat.ne' },
      { cle: 'entreprise_nif', valeur: 'NIF 45872/R — RCCM NE-NIM-2018-B-1245' },
      { cle: 'calendrier', valeur: JSON.stringify(CALENDRIER) },
    ],
  })

  // ───────────────────────────── Utilisateurs ───────────────────────────────
  console.log('— Utilisateurs…')
  const hash = bcrypt.hashSync('admin123', 10)
  await prisma.utilisateur.createMany({
    data: [
      { nom: 'Administrateur', email: 'admin@simbat.ne', motDePasseHash: hash, role: 'ADMIN' },
      { nom: 'I. Moussa', email: 'imoussa24@gmail.com', motDePasseHash: hash, role: 'ADMIN' },
      { nom: 'Aïcha Diallo', email: 'chef@simbat.ne', motDePasseHash: hash, role: 'CHEF_PROJET' },
      { nom: 'Seydou Maïga', email: 'conducteur@simbat.ne', motDePasseHash: hash, role: 'CONDUCTEUR' },
      { nom: 'Fatima Hassane', email: 'comptable@simbat.ne', motDePasseHash: hash, role: 'COMPTABLE' },
      { nom: 'Ali Soumana', email: 'magasinier@simbat.ne', motDePasseHash: hash, role: 'MAGASINIER' },
      { nom: 'Invité', email: 'lecture@simbat.ne', motDePasseHash: hash, role: 'LECTURE' },
    ],
  })

  // ─────────────────────────────── Clients ──────────────────────────────────
  console.log('— Clients…')
  const clientsData = [
    { nom: 'Banque Atlantique Niger', type: 'entreprise', tel: '+227 20 73 98 10', email: 'dg@ba-niger.ne', adresse: 'Rond-point Justice', ville: 'Niamey', nif: 'NIF 10254/P', contact: 'M. Ousmane Kane' },
    { nom: 'Société Immobilière du Sahel', type: 'entreprise', tel: '+227 96 45 12 78', email: 'contact@sis.ne', adresse: 'Avenue de la Mairie', ville: 'Maradi', nif: 'NIF 20871/P', contact: 'Mme Rakia Souley' },
    { nom: 'ONG Alafia', type: 'entreprise', tel: '+227 90 11 22 33', email: 'projets@alafia.org', adresse: 'Quartier Koira Tegui', ville: 'Doutchi', nif: 'NIF 30412/A', contact: 'M. Ismaël Adamou' },
    { nom: "Ministère de l'Hydraulique", type: 'administration', tel: '+227 20 72 21 09', email: 'dgh@hydraulique.gouv.ne', adresse: 'Avenue des Ministères', ville: 'Niamey', nif: 'ETAT-NE-004', contact: 'Direction Générale' },
    { nom: 'Mairie de Dosso', type: 'administration', tel: '+227 20 65 00 41', email: 'st@mairie-dosso.ne', adresse: 'Hôtel de ville', ville: 'Dosso', nif: 'ETAT-NE-112', contact: 'Service technique' },
    { nom: 'Mairie de Zinder', type: 'administration', tel: '+227 20 51 02 87', email: 'st@mairie-zinder.ne', adresse: 'Hôtel de ville', ville: 'Zinder', nif: 'ETAT-NE-089', contact: 'M. le Maire' },
    { nom: 'El Hadj Souleymane Abdou', type: 'particulier', tel: '+227 96 87 45 21', email: '', adresse: 'Quartier Sabon Gari', ville: 'Maradi', nif: '', contact: '' },
    { nom: 'Hôtel Sahel', type: 'entreprise', tel: '+227 20 73 24 31', email: 'direction@hotelsahel.ne', adresse: 'Corniche Gamkallé', ville: 'Niamey', nif: 'NIF 08541/P', contact: 'M. Karim Bagnou' },
  ]
  const clients: any[] = []
  for (const c of clientsData) clients.push(await prisma.client.create({ data: c }))
  const [cBanque, cSIS, cAlafia, cHydro, cDosso, cZinder] = clients

  // ─────────────────────────────── Employés ─────────────────────────────────
  console.log('— Employés…')
  const employesData = [
    { nom: 'Amadou Issoufou', poste: 'conducteur de travaux', qualification: 'BTS Génie civil', tel: '+227 96 10 20 30', tauxJournalier: 15000 },
    { nom: 'Halima Boubacar', poste: "chef d'équipe", qualification: 'CAP Maçonnerie', tel: '+227 90 45 67 12', tauxJournalier: 10000 },
    { nom: 'Moussa Adamou', poste: 'maçon', qualification: 'Qualifié N2', tel: '+227 97 33 44 55', tauxJournalier: 6000 },
    { nom: 'Ibrahim Oumarou', poste: 'maçon', qualification: 'Qualifié N1', tel: '+227 98 12 34 56', tauxJournalier: 6000 },
    { nom: 'Souley Garba', poste: 'ferrailleur', qualification: 'Qualifié N2', tel: '+227 96 78 90 12', tauxJournalier: 6500 },
    { nom: 'Abdou Salifou', poste: 'coffreur', qualification: 'Qualifié N2', tel: '+227 90 23 45 67', tauxJournalier: 6500 },
    { nom: 'Mariama Alzouma', poste: "chef d'équipe", qualification: 'CAP Construction', tel: '+227 96 54 32 10', tauxJournalier: 10000 },
    { nom: 'Hassane Idé', poste: 'maçon', qualification: 'Qualifié N1', tel: '+227 97 65 43 21', tauxJournalier: 6000 },
    { nom: 'Boubé Mounkaila', poste: 'manœuvre', qualification: '', tel: '+227 98 76 54 32', tauxJournalier: 3500 },
    { nom: 'Zeinabou Maïga', poste: 'conducteur de travaux', qualification: 'Ingénieur GC', tel: '+227 90 88 77 66', tauxJournalier: 14000 },
    { nom: 'Issa Djibo', poste: 'chauffeur', qualification: 'Permis C/E', tel: '+227 96 11 22 33', tauxJournalier: 5500 },
    { nom: 'Oumar Sani', poste: 'grutier', qualification: 'CACES', tel: '+227 97 44 55 66', tauxJournalier: 8000 },
  ]
  const employes: any[] = []
  for (const e of employesData) employes.push(await prisma.employe.create({ data: { ...e, statut: 'actif' } }))

  // ─────────────────────────── Projets & chantiers ──────────────────────────
  console.log('— Projets & chantiers…')
  const pSiege = await prisma.projet.create({
    data: {
      nom: 'Siège Banque Atlantique Niamey',
      description: 'Construction du siège régional R+4 avec parking souterrain et façades vitrées.',
      clientId: cBanque.id, responsableId: employes[9].id, budget: 250_000_000,
      dateDebut: d(2025, 8, 4), livraisonPrevue: d(2026, 12, 15), statut: 'En cours', localites: 'Niamey',
    },
  })
  const pImmeuble = await prisma.projet.create({
    data: {
      nom: 'Immeuble R+3 Maradi',
      description: "Immeuble mixte commerces et bureaux, quartier Sabon Gari.",
      clientId: cSIS.id, responsableId: employes[0].id, budget: 120_000_000,
      dateDebut: d(2026, 5, 11), livraisonPrevue: d(2026, 8, 15), statut: 'En cours', localites: 'Maradi',
    },
  })
  const pEcole = await prisma.projet.create({
    data: {
      nom: 'École primaire 6 classes Doutchi',
      description: 'Construction de 2 blocs de 3 classes, bureau directeur et latrines.',
      clientId: cAlafia.id, responsableId: employes[0].id, budget: 45_000_000,
      dateDebut: d(2026, 7, 13), livraisonPrevue: d(2026, 9, 30), statut: 'Planifié', localites: 'Doutchi',
    },
  })
  const pChateau = await prisma.projet.create({
    data: {
      nom: "Château d'eau 200 m³ + forage Niamey",
      description: "Château d'eau métallique 200 m³ sur 15 m, forage équipé et réseau de distribution.",
      clientId: cHydro.id, responsableId: employes[9].id, budget: 95_000_000,
      dateDebut: d(2026, 4, 6), livraisonPrevue: d(2026, 10, 30), statut: 'Démarré', localites: 'Niamey',
    },
  })
  const pLotissement = await prisma.projet.create({
    data: {
      nom: 'Lotissement résidentiel Dosso',
      description: 'Viabilisation de 120 parcelles : voiries, assainissement et bornage.',
      clientId: cDosso.id, responsableId: employes[9].id, budget: 85_000_000,
      dateDebut: d(2025, 9, 1), livraisonPrevue: d(2026, 2, 28), statut: 'Livré', localites: 'Dosso',
    },
  })
  const pMarche = await prisma.projet.create({
    data: {
      nom: 'Réhabilitation marché central Zinder',
      description: 'Réfection des hangars, reprise du réseau électrique et des allées.',
      clientId: cZinder.id, responsableId: employes[0].id, budget: 60_000_000,
      dateDebut: d(2026, 3, 2), livraisonPrevue: d(2026, 11, 30), statut: 'En pause', localites: 'Zinder',
    },
  })

  const chImmeuble = await prisma.chantier.create({
    data: {
      projetId: pImmeuble.id, nom: 'Immeuble R+3 Maradi', ville: 'Maradi',
      dateDebut: d(2026, 5, 11), dateFin: d(2026, 7, 15), budget: 120_000_000,
      statut: 'En cours', chefId: employes[0].id,
    },
  })
  const chEcole = await prisma.chantier.create({
    data: {
      projetId: pEcole.id, nom: 'École primaire 6 classes Doutchi', ville: 'Doutchi',
      dateDebut: d(2026, 7, 13), dateFin: d(2026, 9, 30), budget: 45_000_000,
      statut: 'En attente', chefId: employes[1].id,
    },
  })
  const chChateau = await prisma.chantier.create({
    data: {
      projetId: pChateau.id, nom: "Château d'eau 200 m³ Niamey", ville: 'Niamey',
      dateDebut: d(2026, 4, 6), dateFin: d(2026, 10, 15), budget: 95_000_000,
      statut: 'En cours', avancement: 22, chefId: employes[9].id,
    },
  })
  const chSiegeGO = await prisma.chantier.create({
    data: {
      projetId: pSiege.id, nom: 'Siège BA — Gros œuvre', ville: 'Niamey',
      dateDebut: d(2025, 8, 4), dateFin: d(2026, 6, 30), budget: 150_000_000,
      statut: 'En cours', avancement: 88, chefId: employes[6].id,
    },
  })
  await prisma.chantier.create({
    data: {
      projetId: pSiege.id, nom: 'Siège BA — Second œuvre', ville: 'Niamey',
      dateDebut: d(2026, 8, 3), dateFin: d(2026, 12, 10), budget: 80_000_000,
      statut: 'En attente', chefId: employes[6].id,
    },
  })
  const chMarche = await prisma.chantier.create({
    data: {
      projetId: pMarche.id, nom: 'Marché central Zinder — Hangars', ville: 'Zinder',
      dateDebut: d(2026, 3, 2), dateFin: d(2026, 8, 31), budget: 20_000_000,
      statut: 'En cours', avancement: 45, chefId: employes[1].id,
    },
  })
  const chDosso = await prisma.chantier.create({
    data: {
      projetId: pLotissement.id, nom: 'Lotissement Dosso — Voiries', ville: 'Dosso',
      dateDebut: d(2025, 9, 1), dateFin: d(2026, 2, 28), budget: 70_000_000,
      statut: 'Terminé', avancement: 100, chefId: employes[9].id,
    },
  })

  // Affectations employés
  await prisma.employe.update({ where: { id: employes[0].id }, data: { chantierId: chImmeuble.id } })
  await prisma.employe.update({ where: { id: employes[1].id }, data: { chantierId: chImmeuble.id } })
  await prisma.employe.update({ where: { id: employes[2].id }, data: { chantierId: chImmeuble.id } })
  await prisma.employe.update({ where: { id: employes[3].id }, data: { chantierId: chImmeuble.id } })
  await prisma.employe.update({ where: { id: employes[4].id }, data: { chantierId: chImmeuble.id } })
  await prisma.employe.update({ where: { id: employes[5].id }, data: { chantierId: chSiegeGO.id } })
  await prisma.employe.update({ where: { id: employes[6].id }, data: { chantierId: chSiegeGO.id } })
  await prisma.employe.update({ where: { id: employes[7].id }, data: { chantierId: chSiegeGO.id } })
  await prisma.employe.update({ where: { id: employes[8].id }, data: { chantierId: chMarche.id } })
  await prisma.employe.update({ where: { id: employes[9].id }, data: { chantierId: chChateau.id } })

  // ──────────────── Planification : Immeuble R+3 Maradi ─────────────────────
  console.log('— Planning CPM Immeuble R+3 Maradi…')
  const lotsImm = {
    fondation: await prisma.lot.create({ data: { chantierId: chImmeuble.id, nom: 'Fondation', ordre: 1 } }),
    elevation: await prisma.lot.create({ data: { chantierId: chImmeuble.id, nom: 'Élévation', ordre: 2 } }),
    toiture: await prisma.lot.create({ data: { chantierId: chImmeuble.id, nom: 'Toiture', ordre: 3 } }),
    finitions: await prisma.lot.create({ data: { chantierId: chImmeuble.id, nom: 'Finitions', ordre: 4 } }),
  }

  type TacheSeed = {
    cle: string; lot: string; nom: string; duree: number; avancement?: number; jalon?: boolean
    deps?: { pred: string; type?: 'FD' | 'DD' | 'FF' | 'DF'; lag?: number }[]
    responsable?: number; ressources?: number[]
  }
  const tachesImm: TacheSeed[] = [
    { cle: 'T1', lot: 'fondation', nom: 'Implantation et piquetage', duree: 2, avancement: 100, responsable: 0 },
    { cle: 'T2', lot: 'fondation', nom: 'Fouilles en rigole', duree: 4, avancement: 100, deps: [{ pred: 'T1' }], ressources: [2, 3] },
    { cle: 'T3', lot: 'fondation', nom: 'Béton de propreté', duree: 2, avancement: 100, deps: [{ pred: 'T2' }] },
    { cle: 'T4', lot: 'fondation', nom: 'Ferraillage des semelles', duree: 3, avancement: 100, deps: [{ pred: 'T3' }], ressources: [4] },
    { cle: 'T5', lot: 'fondation', nom: 'Coulage des semelles', duree: 2, avancement: 100, deps: [{ pred: 'T4' }], ressources: [2, 3, 4] },
    { cle: 'T6', lot: 'fondation', nom: 'Réception des fondations', duree: 0, jalon: true, avancement: 100, deps: [{ pred: 'T5' }], responsable: 0 },
    { cle: 'T7', lot: 'elevation', nom: 'Poteaux et voiles RDC', duree: 5, avancement: 100, deps: [{ pred: 'T6' }], ressources: [2, 3] },
    { cle: 'T8', lot: 'elevation', nom: 'Maçonnerie agglos RDC', duree: 8, avancement: 100, deps: [{ pred: 'T7' }], ressources: [2, 3], responsable: 1 },
    { cle: 'T9', lot: 'elevation', nom: 'Plancher haut RDC', duree: 8, avancement: 100, deps: [{ pred: 'T8', type: 'DD', lag: 4 }], ressources: [4] },
    { cle: 'T10', lot: 'elevation', nom: 'Poteaux étage', duree: 6, avancement: 100, deps: [{ pred: 'T9' }] },
    { cle: 'T11', lot: 'elevation', nom: 'Maçonnerie agglos étage', duree: 8, avancement: 85, deps: [{ pred: 'T10' }], ressources: [2, 3], responsable: 1 },
    { cle: 'T12', lot: 'toiture', nom: 'Charpente métallique', duree: 4, avancement: 40, deps: [{ pred: 'T11' }] },
    { cle: 'T13', lot: 'toiture', nom: 'Couverture bac alu', duree: 3, deps: [{ pred: 'T12' }] },
    { cle: 'T14', lot: 'toiture', nom: 'Étanchéité terrasse', duree: 2, deps: [{ pred: 'T13', type: 'FF', lag: 1 }] },
    { cle: 'T15', lot: 'finitions', nom: 'Enduits intérieurs', duree: 8, deps: [{ pred: 'T11' }], ressources: [2, 3] },
    { cle: 'T16', lot: 'finitions', nom: 'Carrelage sols', duree: 6, deps: [{ pred: 'T15' }] },
    { cle: 'T17', lot: 'finitions', nom: 'Peinture générale', duree: 5, deps: [{ pred: 'T16' }, { pred: 'T13' }] },
    { cle: 'T18', lot: 'finitions', nom: 'Réception provisoire', duree: 0, jalon: true, deps: [{ pred: 'T17' }, { pred: 'T14' }], responsable: 0 },
  ]

  async function creerPlanning(chantierId: string, dateDebut: Date, lots: Record<string, any>, taches: TacheSeed[]) {
    const idParCle = new Map<string, string>()
    let ordre = 0
    for (const t of taches) {
      const tache = await prisma.tache.create({
        data: {
          lotId: lots[t.lot].id,
          nom: t.nom,
          dureeJours: t.duree,
          avancement: t.avancement ?? 0,
          estJalon: t.jalon ?? false,
          ordre: ordre++,
          responsableId: t.responsable != null ? employes[t.responsable].id : null,
        },
      })
      idParCle.set(t.cle, tache.id)
      for (const r of t.ressources ?? []) {
        await prisma.tacheRessource.create({ data: { tacheId: tache.id, employeId: employes[r].id } })
      }
    }
    for (const t of taches) {
      for (const dep of t.deps ?? []) {
        await prisma.dependanceTache.create({
          data: {
            predecesseurId: idParCle.get(dep.pred)!,
            successeurId: idParCle.get(t.cle)!,
            type: dep.type ?? 'FD',
            lagJours: dep.lag ?? 0,
          },
        })
      }
    }
    // Calcul CPM et enregistrement
    const tachesCpm: TacheCpm[] = taches.map((t) => ({
      id: idParCle.get(t.cle)!,
      nom: t.nom,
      duree: t.jalon ? 0 : t.duree,
    }))
    const depsCpm: DependanceCpm[] = taches.flatMap((t) =>
      (t.deps ?? []).map((dep) => ({
        predecesseurId: idParCle.get(dep.pred)!,
        successeurId: idParCle.get(t.cle)!,
        type: (dep.type ?? 'FD') as DependanceCpm['type'],
        lagJours: dep.lag ?? 0,
      }))
    )
    const resultat = calculerCpm(tachesCpm, depsCpm, dateDebut, CALENDRIER)
    for (const r of resultat.taches) {
      await prisma.tache.update({
        where: { id: r.id },
        data: { dateDebut: r.dateDebut, dateFin: r.dateFin, margeTotale: r.margeTotale, estCritique: r.estCritique },
      })
    }
    // Avancement pondéré par durée
    const poids = taches.reduce((s, t) => s + Math.max(t.duree, 0.5), 0)
    const avancement = taches.reduce((s, t) => s + (t.avancement ?? 0) * Math.max(t.duree, 0.5), 0) / poids
    await prisma.chantier.update({
      where: { id: chantierId },
      data: { planningCalcule: true, finPrevue: resultat.finProjet, avancement: Math.round(avancement * 10) / 10 },
    })
    return { idParCle, finProjet: resultat.finProjet }
  }

  const planImm = await creerPlanning(chImmeuble.id, d(2026, 5, 11), lotsImm, tachesImm)

  // Baseline « Planning contractuel » avec dates initiales plus optimistes (glissement visible)
  const tachesActuelles = await prisma.tache.findMany({
    where: { lot: { chantierId: chImmeuble.id } },
    include: { lot: true },
    orderBy: { ordre: 'asc' },
  })
  const snapshot = tachesActuelles.map((t) => ({
    id: t.id,
    nom: t.nom,
    lot: t.lot.nom,
    dateDebut: t.dateDebut ? new Date(t.dateDebut.getTime() - 4 * 86400000) : null,
    dateFin: t.dateFin ? new Date(t.dateFin.getTime() - 4 * 86400000) : null,
    dureeJours: t.dureeJours,
    avancement: 0,
  }))
  await prisma.baseline.create({
    data: {
      chantierId: chImmeuble.id,
      nom: 'Planning contractuel',
      dateSnapshot: d(2026, 5, 11),
      donneesJson: JSON.stringify(snapshot),
    },
  })

  // ──────────────── Planification : École Doutchi ───────────────────────────
  console.log('— Planning CPM École Doutchi…')
  const lotsEcole = {
    fondation: await prisma.lot.create({ data: { chantierId: chEcole.id, nom: 'Fondation', ordre: 1 } }),
    elevation: await prisma.lot.create({ data: { chantierId: chEcole.id, nom: 'Élévation', ordre: 2 } }),
    toiture: await prisma.lot.create({ data: { chantierId: chEcole.id, nom: 'Toiture', ordre: 3 } }),
    finitions: await prisma.lot.create({ data: { chantierId: chEcole.id, nom: 'Finitions', ordre: 4 } }),
  }
  const tachesEcole: TacheSeed[] = [
    { cle: 'E1', lot: 'fondation', nom: 'Implantation', duree: 1, responsable: 1 },
    { cle: 'E2', lot: 'fondation', nom: 'Fouilles en rigole', duree: 3, deps: [{ pred: 'E1' }] },
    { cle: 'E3', lot: 'fondation', nom: 'Béton de propreté', duree: 1, deps: [{ pred: 'E2' }] },
    { cle: 'E4', lot: 'fondation', nom: 'Semelles et amorces poteaux', duree: 4, deps: [{ pred: 'E3' }] },
    { cle: 'E5', lot: 'fondation', nom: 'Remblai compacté', duree: 2, deps: [{ pred: 'E4' }] },
    { cle: 'E6', lot: 'elevation', nom: 'Soubassement', duree: 3, deps: [{ pred: 'E5' }] },
    { cle: 'E7', lot: 'elevation', nom: 'Dallage', duree: 2, deps: [{ pred: 'E6' }] },
    { cle: 'E8', lot: 'elevation', nom: 'Murs en agglos', duree: 8, deps: [{ pred: 'E7' }] },
    { cle: 'E9', lot: 'elevation', nom: 'Chaînage haut', duree: 3, deps: [{ pred: 'E8' }] },
    { cle: 'E10', lot: 'toiture', nom: 'Charpente bois', duree: 3, deps: [{ pred: 'E9' }] },
    { cle: 'E11', lot: 'toiture', nom: 'Couverture tôle 27/100', duree: 3, deps: [{ pred: 'E10' }] },
    { cle: 'E12', lot: 'toiture', nom: 'Plafonds', duree: 4, deps: [{ pred: 'E11' }] },
    { cle: 'E13', lot: 'finitions', nom: 'Enduits int. et ext.', duree: 6, deps: [{ pred: 'E9' }] },
    { cle: 'E14', lot: 'finitions', nom: 'Peinture', duree: 5, deps: [{ pred: 'E13' }, { pred: 'E12' }] },
    { cle: 'E15', lot: 'finitions', nom: 'Livraison école', duree: 0, jalon: true, deps: [{ pred: 'E14' }] },
  ]
  await creerPlanning(chEcole.id, d(2026, 7, 13), lotsEcole, tachesEcole)

  // ─────────────────────────────── Pointages ────────────────────────────────
  console.log('— Pointages (45 jours)…')
  let graine = 42
  const alea = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648
    return graine / 2147483648
  }
  const pointages: any[] = []
  const equipeImm = [employes[0], employes[1], employes[2], employes[3], employes[4]]
  const equipeSiege = [employes[5], employes[6], employes[7]]
  const aujourdHui = new Date()
  for (let i = 55; i >= 0; i--) {
    const jour = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate() - i)
    if (jour.getDay() === 0) continue // dimanche
    if (jour >= d(2026, 5, 11)) {
      for (const e of equipeImm) pointages.push({ employeId: e.id, chantierId: chImmeuble.id, date: jour, present: alea() > 0.08 })
    }
    for (const e of equipeSiege) pointages.push({ employeId: e.id, chantierId: chSiegeGO.id, date: jour, present: alea() > 0.1 })
  }
  await prisma.pointage.createMany({ data: pointages })

  // ─────────────────────────────── Matériels ────────────────────────────────
  console.log('— Matériels, mouvements & maintenance…')
  const materielsData = [
    { designation: 'Bétonnière 350 L', type: 'Équipement béton', numeroSerie: 'BET-350-014', etat: 'bon', coutHoraire: 3500, chantierId: chImmeuble.id },
    { designation: 'Camion benne Mercedes Actros', type: 'Véhicule', numeroSerie: 'NE-2456-RN', etat: 'bon', coutHoraire: 12000, chantierId: chImmeuble.id },
    { designation: 'Grue mobile 25 t', type: 'Levage', numeroSerie: 'GRU-25T-002', etat: 'moyen', coutHoraire: 25000, chantierId: chSiegeGO.id },
    { designation: 'Groupe électrogène 40 kVA', type: 'Énergie', numeroSerie: 'GE-40-118', etat: 'bon', coutHoraire: 4500, chantierId: chChateau.id },
    { designation: 'Compacteur à plaque', type: 'Compactage', numeroSerie: 'CPQ-090-07', etat: 'panne', coutHoraire: 2500, chantierId: null },
    { designation: 'Vibreur à béton', type: 'Équipement béton', numeroSerie: 'VIB-045-21', etat: 'bon', coutHoraire: 1200, chantierId: chImmeuble.id },
    { designation: 'Pick-up Toyota Hilux', type: 'Véhicule', numeroSerie: 'NE-8821-RN', etat: 'bon', coutHoraire: 6000, chantierId: null },
    { designation: 'Échafaudage métallique (lot 200 m²)', type: 'Structure', numeroSerie: 'ECH-200-03', etat: 'moyen', coutHoraire: 1800, chantierId: chSiegeGO.id },
  ]
  const materiels: any[] = []
  for (const m of materielsData) materiels.push(await prisma.materiel.create({ data: m }))

  await prisma.mouvementMateriel.createMany({
    data: [
      { materielId: materiels[2].id, origine: 'Dépôt central', destination: 'Siège BA — Gros œuvre', date: d(2026, 3, 9), responsableId: employes[10].id, motif: 'Levage plancher R+2', etatDepart: 'bon', etatArrivee: 'bon' },
      { materielId: materiels[0].id, origine: 'Lotissement Dosso — Voiries', destination: 'Immeuble R+3 Maradi', date: d(2026, 5, 12), responsableId: employes[10].id, motif: 'Démarrage chantier Maradi', etatDepart: 'bon', etatArrivee: 'bon' },
      { materielId: materiels[4].id, origine: 'Marché central Zinder — Hangars', destination: 'Dépôt central', date: d(2026, 6, 20), responsableId: employes[10].id, motif: 'Retour pour réparation (panne moteur)', etatDepart: 'panne', etatArrivee: 'panne' },
      { materielId: materiels[1].id, origine: 'Dépôt central', destination: 'Immeuble R+3 Maradi', date: d(2026, 5, 11), responsableId: employes[10].id, motif: 'Transport matériaux', etatDepart: 'bon', etatArrivee: 'bon' },
    ],
  })

  await prisma.maintenance.createMany({
    data: [
      { materielId: materiels[4].id, type: 'curative', datePlanifiee: d(2026, 7, 10), cout: 380000, description: 'Remplacement moteur thermique', pieces: 'Moteur Honda GX390, courroie', technicien: 'Garage Toudou', statut: 'planifiée' },
      { materielId: materiels[0].id, type: 'préventive', datePlanifiee: d(2026, 5, 2), dateRealisee: d(2026, 5, 3), cout: 45000, description: 'Graissage, contrôle couronne et pignon', technicien: 'Atelier interne', prochaineEcheance: d(2026, 8, 3), statut: 'réalisée' },
      { materielId: materiels[1].id, type: 'préventive', datePlanifiee: d(2026, 6, 8), dateRealisee: d(2026, 6, 8), cout: 85000, description: 'Vidange + filtres', pieces: 'Huile 15W40, filtres GO/air', technicien: 'Garage Sonidep', prochaineEcheance: d(2026, 9, 8), statut: 'réalisée' },
      { materielId: materiels[2].id, type: 'préventive', datePlanifiee: d(2026, 7, 20), cout: 250000, description: 'Contrôle réglementaire câbles et flèche', technicien: 'APAVE Sahel', statut: 'planifiée' },
      { materielId: materiels[3].id, type: 'curative', datePlanifiee: d(2026, 4, 18), dateRealisee: d(2026, 4, 19), cout: 120000, description: 'Remplacement régulateur de tension', technicien: 'Électro-Services Niamey', statut: 'réalisée' },
    ],
  })

  // ─────────────────────────── Stock matériaux ──────────────────────────────
  console.log('— Stock matériaux…')
  const materiauxData = [
    { designation: 'Ciment CPJ 45 (sac 50 kg)', unite: 'sac', seuilAlerte: 100, prixUnitaire: 6500 },
    { designation: 'Fer à béton Ø8', unite: 'barre', seuilAlerte: 200, prixUnitaire: 3500 },
    { designation: 'Fer à béton Ø12', unite: 'barre', seuilAlerte: 150, prixUnitaire: 7500 },
    { designation: 'Sable fin', unite: 'm³', seuilAlerte: 20, prixUnitaire: 15000 },
    { designation: 'Gravier 5/15', unite: 'm³', seuilAlerte: 20, prixUnitaire: 22000 },
    { designation: 'Agglos 15×20×40', unite: 'unité', seuilAlerte: 500, prixUnitaire: 450 },
    { designation: 'Planche de coffrage', unite: 'unité', seuilAlerte: 50, prixUnitaire: 4000 },
    { designation: "Fil d'attache", unite: 'kg', seuilAlerte: 20, prixUnitaire: 1500 },
    { designation: 'Pointes 80', unite: 'kg', seuilAlerte: 20, prixUnitaire: 1200 },
    { designation: 'Peinture FOM (pot 25 kg)', unite: 'pot', seuilAlerte: 10, prixUnitaire: 18000 },
  ]
  const materiaux: any[] = []
  for (const m of materiauxData) materiaux.push(await prisma.materiau.create({ data: m }))

  const mvtStock = (materiau: any, type: string, quantite: number, date: Date, opts: any = {}) => ({
    materiauId: materiau.id, type, quantite, date,
    chantierId: opts.chantierId ?? null, prixUnitaire: opts.pu ?? null,
    fournisseur: opts.fournisseur ?? null, motif: opts.motif ?? null,
  })
  await prisma.stockMouvement.createMany({
    data: [
      // Entrées dépôt central
      mvtStock(materiaux[0], 'entree', 800, d(2026, 4, 15), { pu: 6400, fournisseur: 'SNC Ciment Niger' }),
      mvtStock(materiaux[0], 'entree', 400, d(2026, 6, 2), { pu: 6600, fournisseur: 'SNC Ciment Niger' }),
      mvtStock(materiaux[1], 'entree', 600, d(2026, 4, 20), { pu: 3500, fournisseur: 'Quincaillerie Alher' }),
      mvtStock(materiaux[2], 'entree', 450, d(2026, 4, 20), { pu: 7500, fournisseur: 'Quincaillerie Alher' }),
      mvtStock(materiaux[3], 'entree', 120, d(2026, 5, 5), { pu: 15000, fournisseur: 'Carrière Say' }),
      mvtStock(materiaux[4], 'entree', 90, d(2026, 5, 5), { pu: 22000, fournisseur: 'Carrière Say' }),
      mvtStock(materiaux[5], 'entree', 6000, d(2026, 5, 8), { pu: 450, fournisseur: 'Briqueterie Maradi' }),
      mvtStock(materiaux[6], 'entree', 300, d(2026, 5, 8), { pu: 4000, fournisseur: 'Scierie Gamkallé' }),
      mvtStock(materiaux[7], 'entree', 80, d(2026, 5, 8), { pu: 1500, fournisseur: 'Quincaillerie Alher' }),
      mvtStock(materiaux[8], 'entree', 60, d(2026, 5, 8), { pu: 1200, fournisseur: 'Quincaillerie Alher' }),
      mvtStock(materiaux[9], 'entree', 40, d(2026, 6, 10), { pu: 18000, fournisseur: 'Peintures du Sahel' }),
      // Sorties vers chantiers
      mvtStock(materiaux[0], 'sortie', 620, d(2026, 5, 20), { chantierId: chImmeuble.id, motif: 'Fondations + élévation RDC' }),
      mvtStock(materiaux[0], 'sortie', 480, d(2026, 6, 18), { chantierId: chImmeuble.id, motif: 'Élévation étage + planchers' }),
      mvtStock(materiaux[1], 'sortie', 350, d(2026, 5, 22), { chantierId: chImmeuble.id, motif: 'Ferraillage semelles et poteaux' }),
      mvtStock(materiaux[2], 'sortie', 280, d(2026, 5, 22), { chantierId: chImmeuble.id, motif: 'Ferraillage planchers' }),
      mvtStock(materiaux[3], 'sortie', 70, d(2026, 5, 25), { chantierId: chImmeuble.id, motif: 'Béton et mortier' }),
      mvtStock(materiaux[4], 'sortie', 55, d(2026, 5, 25), { chantierId: chImmeuble.id, motif: 'Béton' }),
      mvtStock(materiaux[5], 'sortie', 4200, d(2026, 6, 5), { chantierId: chImmeuble.id, motif: 'Maçonnerie RDC + étage' }),
      mvtStock(materiaux[6], 'sortie', 180, d(2026, 5, 28), { chantierId: chSiegeGO.id, motif: 'Coffrage voiles' }),
      mvtStock(materiaux[7], 'sortie', 45, d(2026, 6, 1), { chantierId: chImmeuble.id, motif: 'Attaches ferraillage' }),
      mvtStock(materiaux[8], 'sortie', 25, d(2026, 6, 1), { chantierId: chSiegeGO.id, motif: 'Coffrages' }),
    ],
  })

  // ──────────────────────────────── Devis ───────────────────────────────────
  console.log('— Devis, contrats, factures, paiements…')
  type LigneSeed = [string, string, number, number]
  async function creerDevis(
    numero: string, client: any, projetId: string | null, objet: string, date: Date,
    statut: string, lignes: LigneSeed[], tvaTaux = 19, remise = 0
  ) {
    return prisma.devis.create({
      data: {
        numero, clientId: client.id, projetId, objet, date, statut, tvaTaux, remise,
        lignes: {
          create: lignes.map(([designation, unite, quantite, prixUnitaire], i) => ({
            designation, unite, quantite, prixUnitaire, ordre: i,
          })),
        },
      },
      include: { lignes: true },
    })
  }

  const devSiege = await creerDevis('DEV-2025-001', cBanque, pSiege.id, 'Construction siège régional R+4 Niamey', d(2025, 7, 10), 'accepté', [
    ['Installation de chantier et études', 'ff', 1, 12_000_000],
    ['Terrassements généraux', 'm³', 4500, 3500],
    ['Fondations et infrastructure béton armé', 'm³', 850, 95_000],
    ['Superstructure R+4 (poteaux, voiles, planchers)', 'm³', 980, 98_000],
    ['Façades vitrées et menuiseries aluminium', 'm²', 1200, 65_000],
  ])
  const devDosso = await creerDevis('DEV-2025-002', cDosso, pLotissement.id, 'Viabilisation lotissement 120 parcelles Dosso', d(2025, 8, 5), 'accepté', [
    ['Ouverture et profilage des voiries', 'km', 6.5, 4_800_000],
    ['Assainissement pluvial (caniveaux)', 'ml', 3800, 8500],
    ['Bornage et lotissement', 'parcelle', 120, 85_000],
  ])
  const devImm = await creerDevis('DEV-2026-001', cSIS, pImmeuble.id, 'Immeuble R+3 commerces et bureaux Maradi', d(2026, 2, 12), 'accepté', [
    ['Installation de chantier', 'ff', 1, 4_500_000],
    ['Fondations superficielles BA', 'm³', 220, 92_000],
    ['Élévation R+3 (BA + maçonnerie)', 'm²', 1450, 38_000],
    ['Toiture terrasse + étanchéité', 'm²', 420, 22_000],
    ['Finitions (enduits, carrelage, peinture)', 'm²', 1450, 12_000],
  ])
  const devEcole = await creerDevis('DEV-2026-002', cAlafia, pEcole.id, 'École primaire 6 classes Doutchi', d(2026, 5, 20), 'accepté', [
    ['Bloc 3 classes (×2)', 'bloc', 2, 15_500_000],
    ['Bureau directeur + magasin', 'ff', 1, 4_200_000],
    ['Bloc latrines 4 cabines', 'ff', 1, 2_800_000],
  ])
  const devChateau = await creerDevis('DEV-2026-003', cHydro, pChateau.id, "Château d'eau métallique 200 m³ + forage", d(2026, 3, 15), 'accepté', [
    ['Forage équipé 120 m', 'ff', 1, 18_000_000],
    ['Château d’eau métallique 200 m³ / 15 m', 'ff', 1, 48_000_000],
    ['Réseau de distribution PVC Ø110', 'ml', 2600, 4200],
  ])
  await creerDevis('DEV-2026-004', cZinder, pMarche.id, 'Réhabilitation hangars marché central Zinder', d(2026, 6, 8), 'envoyé', [
    ['Dépose et réfection couvertures hangars', 'm²', 2400, 14_500],
    ['Reprise réseau électrique', 'ff', 1, 9_800_000],
    ['Réfection des allées pavées', 'm²', 1800, 8500],
  ])
  await creerDevis('DEV-2026-005', clients[6], null, 'Villa duplex R+1 Maradi', d(2026, 6, 25), 'brouillon', [
    ['Gros œuvre villa duplex 240 m²', 'ff', 1, 22_000_000],
    ['Second œuvre et finitions', 'ff', 1, 13_500_000],
  ])

  const ttc = (devis: any) => {
    const ht = devis.lignes.reduce((s: number, l: any) => s + l.quantite * l.prixUnitaire, 0) - (devis.remise || 0)
    return Math.round(ht * (1 + devis.tvaTaux / 100))
  }

  // ─────────────────────────────── Contrats ─────────────────────────────────
  const ctrSiege = await prisma.contrat.create({
    data: { numero: 'CTR-2025-001', devisId: devSiege.id, clientId: cBanque.id, projetId: pSiege.id, objet: devSiege.objet, montant: ttc(devSiege), dateSignature: d(2025, 8, 1) },
  })
  const ctrDosso = await prisma.contrat.create({
    data: { numero: 'CTR-2025-002', devisId: devDosso.id, clientId: cDosso.id, projetId: pLotissement.id, objet: devDosso.objet, montant: ttc(devDosso), dateSignature: d(2025, 8, 28) },
  })
  const ctrImm = await prisma.contrat.create({
    data: { numero: 'CTR-2026-001', devisId: devImm.id, clientId: cSIS.id, projetId: pImmeuble.id, objet: devImm.objet, montant: ttc(devImm), dateSignature: d(2026, 3, 2) },
  })
  const ctrEcole = await prisma.contrat.create({
    data: { numero: 'CTR-2026-002', devisId: devEcole.id, clientId: cAlafia.id, projetId: pEcole.id, objet: devEcole.objet, montant: ttc(devEcole), dateSignature: d(2026, 6, 10) },
  })
  const ctrChateau = await prisma.contrat.create({
    data: { numero: 'CTR-2026-003', devisId: devChateau.id, clientId: cHydro.id, projetId: pChateau.id, objet: devChateau.objet, montant: ttc(devChateau), dateSignature: d(2026, 4, 1) },
  })
  await prisma.contrat.create({
    data: { numero: 'CTR-2026-004', clientId: clients[7].id, objet: 'Clôture et guérite Hôtel Sahel', montant: 14_500_000, dateSignature: d(2026, 5, 15) },
  })

  // ─────────────────────────────── Factures ─────────────────────────────────
  // CA mensuel croissant sur 12 mois (août 2025 → juillet 2026)
  type FactureSeed = {
    numero: string; date: Date; type: string; montant: number; contrat?: any; projetId?: string | null
    client: any; statut: string; echeance: Date; retenue?: number; avancementPct?: number | null; objet: string
    paiements?: { montant: number; date: Date; mode: string }[]
  }
  const facturesSeed: FactureSeed[] = [
    { numero: 'FAC-2025-001', date: d(2025, 8, 10), type: 'acompte', montant: 8_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'payée', echeance: d(2025, 9, 10), objet: 'Acompte de démarrage — Siège BA', paiements: [{ montant: 8_000_000, date: d(2025, 8, 25), mode: 'virement' }] },
    { numero: 'FAC-2025-002', date: d(2025, 9, 15), type: 'situation', montant: 12_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'payée', echeance: d(2025, 10, 15), retenue: 5, avancementPct: 8, objet: 'Situation n°1 — Terrassements', paiements: [{ montant: 12_000_000, date: d(2025, 10, 2), mode: 'virement' }] },
    { numero: 'FAC-2025-003', date: d(2025, 10, 12), type: 'situation', montant: 15_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'payée', echeance: d(2025, 11, 12), retenue: 5, avancementPct: 15, objet: 'Situation n°2 — Fondations', paiements: [{ montant: 15_000_000, date: d(2025, 11, 3), mode: 'virement' }] },
    { numero: 'FAC-2025-004', date: d(2025, 11, 8), type: 'acompte', montant: 10_000_000, contrat: ctrDosso, projetId: pLotissement.id, client: cDosso, statut: 'payée', echeance: d(2025, 12, 8), objet: 'Acompte — Lotissement Dosso', paiements: [{ montant: 10_000_000, date: d(2025, 12, 1), mode: 'chèque' }] },
    { numero: 'FAC-2025-005', date: d(2025, 12, 10), type: 'situation', montant: 18_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'payée', echeance: d(2026, 1, 10), retenue: 5, avancementPct: 26, objet: 'Situation n°3 — Élévation R+1', paiements: [{ montant: 18_000_000, date: d(2026, 1, 5), mode: 'virement' }] },
    { numero: 'FAC-2026-001', date: d(2026, 1, 14), type: 'situation', montant: 22_000_000, contrat: ctrDosso, projetId: pLotissement.id, client: cDosso, statut: 'payée', echeance: d(2026, 2, 14), retenue: 5, avancementPct: 45, objet: 'Situation n°1 — Voiries Dosso', paiements: [{ montant: 22_000_000, date: d(2026, 2, 8), mode: 'virement' }] },
    { numero: 'FAC-2026-002', date: d(2026, 2, 11), type: 'situation', montant: 25_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'payée', echeance: d(2026, 3, 11), retenue: 5, avancementPct: 42, objet: 'Situation n°4 — Élévation R+3', paiements: [{ montant: 25_000_000, date: d(2026, 3, 4), mode: 'virement' }] },
    { numero: 'FAC-2026-003', date: d(2026, 3, 9), type: 'acompte', montant: 24_000_000, contrat: ctrImm, projetId: pImmeuble.id, client: cSIS, statut: 'payée', echeance: d(2026, 4, 9), objet: 'Acompte 20 % — Immeuble R+3 Maradi', paiements: [{ montant: 24_000_000, date: d(2026, 3, 28), mode: 'virement' }] },
    { numero: 'FAC-2026-004', date: d(2026, 3, 20), type: 'situation', montant: 6_000_000, contrat: ctrDosso, projetId: pLotissement.id, client: cDosso, statut: 'payée', echeance: d(2026, 4, 20), retenue: 5, avancementPct: 78, objet: 'Situation n°2 — Assainissement Dosso', paiements: [{ montant: 6_000_000, date: d(2026, 4, 15), mode: 'chèque' }] },
    { numero: 'FAC-2026-005', date: d(2026, 4, 10), type: 'acompte', montant: 28_500_000, contrat: ctrChateau, projetId: pChateau.id, client: cHydro, statut: 'payée', echeance: d(2026, 5, 10), objet: "Acompte 30 % — Château d'eau Niamey", paiements: [{ montant: 28_500_000, date: d(2026, 5, 6), mode: 'virement' }] },
    { numero: 'FAC-2026-006', date: d(2026, 4, 24), type: 'situation', montant: 9_500_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'partiellement payée', echeance: d(2026, 5, 24), retenue: 5, avancementPct: 58, objet: 'Situation n°5 — Façades', paiements: [{ montant: 5_000_000, date: d(2026, 5, 20), mode: 'virement' }] },
    { numero: 'FAC-2026-007', date: d(2026, 5, 12), type: 'situation', montant: 30_000_000, contrat: ctrImm, projetId: pImmeuble.id, client: cSIS, statut: 'payée', echeance: d(2026, 6, 12), retenue: 5, avancementPct: 35, objet: 'Situation n°1 — Fondations + RDC Maradi', paiements: [{ montant: 30_000_000, date: d(2026, 6, 5), mode: 'virement' }] },
    { numero: 'FAC-2026-008', date: d(2026, 5, 28), type: 'acompte', montant: 12_000_000, contrat: ctrEcole, projetId: pEcole.id, client: cAlafia, statut: 'partiellement payée', echeance: d(2026, 6, 28), objet: 'Acompte — École Doutchi', paiements: [{ montant: 7_000_000, date: d(2026, 6, 22), mode: 'mobile money' }] },
    { numero: 'FAC-2026-009', date: d(2026, 6, 9), type: 'situation', montant: 40_000_000, contrat: ctrSiege, projetId: pSiege.id, client: cBanque, statut: 'partiellement payée', echeance: d(2026, 7, 9), retenue: 5, avancementPct: 74, objet: 'Situation n°6 — Second œuvre partiel', paiements: [{ montant: 20_000_000, date: d(2026, 6, 30), mode: 'virement' }] },
    { numero: 'FAC-2026-010', date: d(2026, 6, 15), type: 'situation', montant: 8_000_000, contrat: ctrEcole, projetId: pEcole.id, client: cAlafia, statut: 'en retard', echeance: d(2026, 6, 30), objet: 'Situation n°1 — Études et implantation école', paiements: [] },
    { numero: 'FAC-2026-011', date: d(2026, 7, 1), type: 'situation', montant: 25_000_000, contrat: ctrChateau, projetId: pChateau.id, client: cHydro, statut: 'envoyée', echeance: d(2026, 7, 31), retenue: 5, avancementPct: 30, objet: "Situation n°1 — Forage réalisé", paiements: [] },
    { numero: 'FAC-2026-012', date: d(2026, 7, 3), type: 'solde', montant: 30_000_000, contrat: ctrDosso, projetId: pLotissement.id, client: cDosso, statut: 'envoyée', echeance: d(2026, 8, 2), retenue: 5, objet: 'Solde — Lotissement Dosso', paiements: [] },
  ]
  for (const f of facturesSeed) {
    const facture = await prisma.facture.create({
      data: {
        numero: f.numero, date: f.date, type: f.type, montant: f.montant,
        contratId: f.contrat?.id ?? null, projetId: f.projetId ?? null, clientId: f.client.id,
        statut: f.statut, echeance: f.echeance, retenueGarantie: f.retenue ?? 0,
        avancementPct: f.avancementPct ?? null, objet: f.objet,
      },
    })
    for (const p of f.paiements ?? []) {
      await prisma.paiement.create({
        data: {
          factureId: facture.id, sens: 'encaissement', mode: p.mode, montant: p.montant,
          date: p.date, tiers: f.client.nom, reference: `ENC-${f.numero.slice(4)}`,
        },
      })
    }
  }

  // Décaissements fournisseurs
  await prisma.paiement.createMany({
    data: [
      { sens: 'decaissement', mode: 'virement', tiers: 'SNC Ciment Niger', montant: 5_120_000, date: d(2026, 4, 18), reference: 'DEC-2026-041' },
      { sens: 'decaissement', mode: 'chèque', tiers: 'Quincaillerie Alher', montant: 5_475_000, date: d(2026, 4, 25), reference: 'DEC-2026-042' },
      { sens: 'decaissement', mode: 'espèces', tiers: 'Carrière Say', montant: 3_780_000, date: d(2026, 5, 10), reference: 'DEC-2026-043' },
      { sens: 'decaissement', mode: 'virement', tiers: 'Briqueterie Maradi', montant: 2_700_000, date: d(2026, 5, 15), reference: 'DEC-2026-044' },
      { sens: 'decaissement', mode: 'mobile money', tiers: 'Garage Sonidep', montant: 85_000, date: d(2026, 6, 8), reference: 'DEC-2026-045' },
    ],
  })

  // ─────────────────────────────── Dépenses ─────────────────────────────────
  console.log('— Dépenses par chantier…')
  const dep = (chantierId: string | null, categorie: string, montant: number, date: Date, fournisseur: string, description: string) => ({
    chantierId, categorie, montant, date, fournisseur, description,
  })
  await prisma.depense.createMany({
    data: [
      // Siège BA — Gros œuvre (budget 150 M) : ~95 M étalés
      dep(chSiegeGO.id, 'matériaux', 14_500_000, d(2025, 9, 20), 'SNC Ciment Niger', 'Ciment + aciers fondations'),
      dep(chSiegeGO.id, 'sous-traitance', 8_000_000, d(2025, 10, 15), 'Forage Plus', 'Pieux et parois'),
      dep(chSiegeGO.id, 'matériaux', 12_800_000, d(2025, 11, 12), 'Quincaillerie Alher', 'Aciers superstructure'),
      dep(chSiegeGO.id, "main-d'œuvre", 6_500_000, d(2025, 12, 30), 'Tâcherons groupés', 'Coffrage-ferraillage T4'),
      dep(chSiegeGO.id, 'matériaux', 11_200_000, d(2026, 1, 18), 'SNC Ciment Niger', 'Béton planchers hauts'),
      dep(chSiegeGO.id, 'location', 7_500_000, d(2026, 2, 10), 'Sahel Levage', 'Location grue (3 mois)'),
      dep(chSiegeGO.id, 'matériaux', 13_400_000, d(2026, 3, 14), 'Alu Négoce', 'Menuiseries aluminium'),
      dep(chSiegeGO.id, 'carburant', 1_850_000, d(2026, 4, 8), 'Station NP Plateau', 'Gasoil groupe + engins'),
      dep(chSiegeGO.id, 'matériaux', 9_800_000, d(2026, 5, 12), 'Peintures du Sahel', 'Second œuvre'),
      dep(chSiegeGO.id, 'sous-traitance', 8_900_000, d(2026, 6, 15), 'Électro-Services', 'Lots électricité/plomberie'),
      // Immeuble R+3 Maradi (budget 120 M)
      dep(chImmeuble.id, 'matériaux', 16_800_000, d(2026, 5, 18), 'SNC Ciment Niger', 'Ciment, aciers, agrégats'),
      dep(chImmeuble.id, 'carburant', 1_150_000, d(2026, 5, 30), 'Station NP Maradi', 'Gasoil bétonnière + camion'),
      dep(chImmeuble.id, 'matériaux', 19_500_000, d(2026, 6, 12), 'Briqueterie Maradi', 'Agglos + planchers'),
      dep(chImmeuble.id, 'sous-traitance', 7_800_000, d(2026, 6, 25), 'Charpente Katsina', 'Charpente métallique'),
      dep(chImmeuble.id, 'location', 2_400_000, d(2026, 6, 28), 'Sahel Levage', 'Grue mobile (levage charpente)'),
      dep(chImmeuble.id, "main-d'œuvre", 3_200_000, d(2026, 7, 2), 'Tâcherons Maradi', 'Équipe maçonnerie complémentaire'),
      dep(chImmeuble.id, 'matériaux', 8_600_000, d(2026, 7, 4), 'Carreaux Plus', 'Carrelage + faïence'),
      // Marché Zinder (budget 20 M) → dépassement volontaire ~97 %
      dep(chMarche.id, 'matériaux', 8_200_000, d(2026, 4, 10), 'Tôles Zinder', 'Couvertures hangars'),
      dep(chMarche.id, "main-d'œuvre", 6_800_000, d(2026, 5, 15), 'Tâcherons Zinder', 'Dépose + pose couverture'),
      dep(chMarche.id, 'divers', 4_500_000, d(2026, 6, 10), 'Mairie Zinder', 'Frais de dégagement des étals'),
      // Château d'eau Niamey (budget 95 M)
      dep(chChateau.id, 'sous-traitance', 14_500_000, d(2026, 4, 22), 'Forage Plus', 'Forage 120 m équipé'),
      dep(chChateau.id, 'matériaux', 4_800_000, d(2026, 5, 20), 'Métal Sahel', 'Aciers cuve (1er lot)'),
      dep(chChateau.id, 'carburant', 750_000, d(2026, 6, 18), 'Station NP Gamkallé', 'Groupe électrogène'),
      // Lotissement Dosso (budget 70 M) : terminé
      dep(chDosso.id, 'location', 12_000_000, d(2025, 9, 25), 'TP Location', 'Niveleuse + compacteur'),
      dep(chDosso.id, 'matériaux', 18_500_000, d(2025, 10, 20), 'Carrière Say', 'Latérite + concassé'),
      dep(chDosso.id, "main-d'œuvre", 9_800_000, d(2025, 11, 28), 'Tâcherons Dosso', 'Caniveaux maçonnés'),
      dep(chDosso.id, 'matériaux', 11_400_000, d(2025, 12, 15), 'SNC Ciment Niger', 'Ciment caniveaux + bordures'),
      dep(chDosso.id, 'sous-traitance', 6_200_000, d(2026, 1, 20), 'Géomètre Expert', 'Bornage 120 parcelles'),
      dep(chDosso.id, 'carburant', 2_900_000, d(2026, 1, 30), 'Station NP Dosso', 'Gasoil engins (cumul)'),
    ],
  })

  // ── Récapitulatif
  const finImm = planImm.finProjet
  console.log('✔ Seed terminé.')
  console.log(`  Immeuble R+3 Maradi : fin prévue CPM = ${finImm.toLocaleDateString('fr-FR')} (contractuel 15/07/2026 → alerte dépassement)`)
  console.log('  Comptes de démonstration (mot de passe : admin123) :')
  console.log('    admin@simbat.ne / imoussa24@gmail.com (Admin), chef@simbat.ne, conducteur@simbat.ne,')
  console.log('    comptable@simbat.ne, magasinier@simbat.ne, lecture@simbat.ne')
}
