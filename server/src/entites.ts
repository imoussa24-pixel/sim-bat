import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { EntiteDef } from './crud'
import {
  calculerDepensesChantiers,
  etatStocks,
  majPrixMoyenPondere,
  prochainNumero,
  recalculerStatutFacture,
  recalculerAvancementChantier,
  totauxDevis,
} from './lib/metier'

export const STATUTS_PROJET = ['Démarré', 'Planifié', 'En cours', 'Arrêté', 'Livré', 'En pause', 'Terminé', 'Annulé']
export const STATUTS_CHANTIER = ['En attente', 'En cours', 'Terminé']
export const CATEGORIES_DEPENSE = ['matériaux', "main-d'œuvre", 'sous-traitance', 'carburant', 'location', 'divers']
export const MODES_PAIEMENT = ['espèces', 'virement', 'chèque', 'mobile money']

/** Moyenne pondérée par budget des avancements des chantiers d'un projet. */
async function enrichirProjets(rows: any[]) {
  const depenses = await calculerDepensesChantiers()
  return rows.map((p) => {
    const chantiers = (p.chantiers ?? []).filter((c: any) => !c.deletedAt)
    let avancement = p.avancement
    if (chantiers.length) {
      const poids = chantiers.reduce((s: number, c: any) => s + Math.max(c.budget, 1), 0)
      avancement = chantiers.reduce((s: number, c: any) => s + c.avancement * Math.max(c.budget, 1), 0) / poids
    }
    const depense = chantiers.reduce((s: number, c: any) => s + (depenses.get(c.id)?.total ?? 0), 0)
    return { ...p, avancement: Math.round(avancement * 10) / 10, nbChantiers: chantiers.length, depense }
  })
}

async function enrichirChantiers(rows: any[]) {
  const depenses = await calculerDepensesChantiers()
  const effectifs = await prisma.employe.groupBy({
    by: ['chantierId'],
    where: { deletedAt: null, statut: 'actif', chantierId: { not: null } },
    _count: { _all: true },
  })
  const effectifMap = new Map(effectifs.map((e) => [e.chantierId, e._count._all]))
  const nbTaches = await prisma.tache.groupBy({
    by: ['lotId'],
    where: { deletedAt: null },
    _count: { _all: true },
  })
  const lots = await prisma.lot.findMany({ where: { deletedAt: null }, select: { id: true, chantierId: true } })
  const tachesParChantier = new Map<string, number>()
  const lotVersChantier = new Map(lots.map((l) => [l.id, l.chantierId]))
  for (const n of nbTaches) {
    const cid = lotVersChantier.get(n.lotId)
    if (cid) tachesParChantier.set(cid, (tachesParChantier.get(cid) ?? 0) + n._count._all)
  }
  return rows.map((c) => ({
    ...c,
    depense: depenses.get(c.id)?.total ?? 0,
    detailDepense: depenses.get(c.id) ?? null,
    effectif: effectifMap.get(c.id) ?? 0,
    nbTaches: tachesParChantier.get(c.id) ?? 0,
  }))
}

async function enrichirMateriaux(rows: any[]) {
  const etats = await etatStocks()
  return rows.map((m) => {
    const e = etats.get(m.id)
    return {
      ...m,
      stockTotal: e?.stockTotal ?? 0,
      parDepot: e?.parDepot ?? [],
      enAlerte: e?.enAlerte ?? true,
      valorisation: e?.valorisation ?? 0,
    }
  })
}

async function enrichirDevis(rows: any[]) {
  return rows.map((d) => ({ ...d, ...totauxDevis(d) }))
}

async function enrichirFactures(rows: any[]) {
  const maintenant = new Date()
  return rows.map((f) => {
    const paye = (f.paiements ?? [])
      .filter((p: any) => !p.deletedAt && p.sens === 'encaissement')
      .reduce((s: number, p: any) => s + p.montant, 0)
    let statut = f.statut
    if (statut !== 'brouillon' && statut !== 'payée' && f.echeance && new Date(f.echeance) < maintenant && paye < f.montant - 0.5) {
      statut = 'en retard'
    }
    const montantRetenue = (f.montant * (f.retenueGarantie || 0)) / 100
    return { ...f, statut, totalPaye: paye, resteAPayer: Math.max(0, f.montant - paye), montantRetenue }
  })
}

export const ENTITES: EntiteDef[] = [
  {
    nom: 'clients',
    modele: 'client',
    titre: 'Client',
    rolesEcriture: ['CHEF_PROJET', 'COMPTABLE'],
    recherche: ['nom', 'ville', 'tel', 'email', 'nif', 'contact'],
    filtres: ['type', 'ville'],
    orderBy: { nom: 'asc' },
    champs: {
      nom: { type: 'string', requis: true, label: 'Nom / Raison sociale' },
      type: { type: 'enum', valeurs: ['particulier', 'entreprise', 'administration'], label: 'Type' },
      tel: { type: 'string', label: 'Téléphone' },
      email: { type: 'string', label: 'Email' },
      adresse: { type: 'string', label: 'Adresse' },
      ville: { type: 'string', label: 'Ville' },
      nif: { type: 'string', label: 'NIF' },
      contact: { type: 'string', label: 'Personne de contact' },
    },
  },
  {
    nom: 'projets',
    modele: 'projet',
    titre: 'Projet',
    rolesEcriture: ['CHEF_PROJET'],
    recherche: ['nom', 'description', 'client.nom', 'localites'],
    filtres: ['statut', 'clientId'],
    include: { client: true, responsable: true, chantiers: { select: { id: true, budget: true, avancement: true, deletedAt: true } } },
    enrichir: enrichirProjets,
    champs: {
      nom: { type: 'string', requis: true, label: 'Nom du projet' },
      description: { type: 'text', label: 'Description' },
      clientId: { type: 'string', label: 'Client' },
      responsableId: { type: 'string', label: 'Responsable' },
      budget: { type: 'number', label: 'Budget (FCFA)' },
      dateDebut: { type: 'date', label: 'Date de début' },
      livraisonPrevue: { type: 'date', label: 'Livraison prévue' },
      statut: { type: 'enum', valeurs: STATUTS_PROJET, label: 'Statut' },
      avancement: { type: 'number', label: 'Avancement (%)' },
      localites: { type: 'string', label: 'Localité(s)' },
    },
  },
  {
    nom: 'chantiers',
    modele: 'chantier',
    titre: 'Chantier',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    recherche: ['nom', 'ville', 'projet.nom'],
    filtres: ['statut', 'projetId'],
    include: { projet: { include: { client: true } }, chef: true },
    enrichir: enrichirChantiers,
    champs: {
      nom: { type: 'string', requis: true, label: 'Nom du chantier' },
      projetId: { type: 'string', label: 'Projet' },
      ville: { type: 'string', label: 'Ville' },
      dateDebut: { type: 'date', label: 'Date de début' },
      dateFin: { type: 'date', label: 'Date de fin contractuelle' },
      budget: { type: 'number', label: 'Budget (FCFA)' },
      statut: { type: 'enum', valeurs: STATUTS_CHANTIER, label: 'Statut' },
      avancement: { type: 'number', label: 'Avancement (%)' },
      chefId: { type: 'string', label: 'Chef de chantier' },
    },
  },
  {
    nom: 'lots',
    modele: 'lot',
    titre: 'Lot',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    filtres: ['chantierId'],
    orderBy: { ordre: 'asc' },
    champs: {
      chantierId: { type: 'string', requis: true, label: 'Chantier' },
      nom: { type: 'string', requis: true, label: 'Nom du lot' },
      ordre: { type: 'number', label: 'Ordre' },
    },
  },
  {
    nom: 'taches',
    modele: 'tache',
    titre: 'Tâche',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    filtres: ['lotId', 'responsableId'],
    orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
    include: {
      lot: { include: { chantier: { select: { id: true, nom: true } } } },
      responsable: { select: { id: true, nom: true } },
      predecesseurs: true,
      ressources: { include: { employe: { select: { id: true, nom: true } }, materiel: { select: { id: true, designation: true } } } },
    },
    apresMutation: async (row) => {
      const lot = await prisma.lot.findUnique({ where: { id: row.lotId } })
      if (lot) await recalculerAvancementChantier(lot.chantierId)
    },
    champs: {
      lotId: { type: 'string', requis: true, label: 'Lot' },
      nom: { type: 'string', requis: true, label: 'Nom de la tâche' },
      dureeJours: { type: 'number', label: 'Durée (jours)' },
      dateDebutSouhaitee: { type: 'date', label: 'Début souhaité' },
      avancement: { type: 'number', label: 'Avancement (%)' },
      estJalon: { type: 'boolean', label: 'Jalon' },
      ordre: { type: 'number', label: 'Ordre' },
      responsableId: { type: 'string', label: 'Responsable' },
    },
  },
  {
    nom: 'dependances',
    modele: 'dependanceTache',
    titre: 'Dépendance',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    filtres: ['predecesseurId', 'successeurId'],
    softDelete: false,
    orderBy: { id: 'asc' },
    avantCreer: async (data) => {
      if (data.predecesseurId === data.successeurId) {
        const { ApiError } = await import('./lib/http')
        throw new ApiError(400, 'Une tâche ne peut pas dépendre d’elle-même.')
      }
      return data
    },
    champs: {
      predecesseurId: { type: 'string', requis: true, label: 'Tâche précédente' },
      successeurId: { type: 'string', requis: true, label: 'Tâche suivante' },
      type: { type: 'enum', valeurs: ['FD', 'DD', 'FF', 'DF'], label: 'Type' },
      lagJours: { type: 'number', label: 'Décalage (jours)' },
    },
  },
  {
    nom: 'tache-ressources',
    modele: 'tacheRessource',
    titre: 'Ressource affectée',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    filtres: ['tacheId'],
    softDelete: false,
    orderBy: { id: 'asc' },
    include: { employe: { select: { id: true, nom: true } }, materiel: { select: { id: true, designation: true } } },
    champs: {
      tacheId: { type: 'string', requis: true, label: 'Tâche' },
      employeId: { type: 'string', label: 'Employé' },
      materielId: { type: 'string', label: 'Matériel' },
    },
  },
  {
    nom: 'employes',
    modele: 'employe',
    titre: 'Employé',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    recherche: ['nom', 'poste', 'qualification', 'tel'],
    filtres: ['statut', 'chantierId', 'poste'],
    include: { chantier: { select: { id: true, nom: true } } },
    orderBy: { nom: 'asc' },
    champs: {
      nom: { type: 'string', requis: true, label: 'Nom complet' },
      poste: { type: 'string', requis: true, label: 'Poste' },
      qualification: { type: 'string', label: 'Qualification' },
      tel: { type: 'string', label: 'Téléphone' },
      tauxJournalier: { type: 'number', label: 'Taux journalier (FCFA)' },
      chantierId: { type: 'string', label: 'Chantier affecté' },
      statut: { type: 'enum', valeurs: ['actif', 'congé', 'parti'], label: 'Statut' },
    },
  },
  {
    nom: 'materiels',
    modele: 'materiel',
    titre: 'Matériel',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR', 'MAGASINIER'],
    recherche: ['designation', 'type', 'numeroSerie'],
    filtres: ['etat', 'chantierId', 'type'],
    include: { chantier: { select: { id: true, nom: true } } },
    orderBy: { designation: 'asc' },
    champs: {
      designation: { type: 'string', requis: true, label: 'Désignation' },
      type: { type: 'string', label: 'Type' },
      numeroSerie: { type: 'string', label: 'Immatriculation / N° série' },
      etat: { type: 'enum', valeurs: ['bon', 'moyen', 'panne'], label: 'État' },
      coutHoraire: { type: 'number', label: 'Coût horaire (FCFA)' },
      chantierId: { type: 'string', label: 'Affectation' },
    },
  },
  {
    nom: 'mouvements-materiel',
    modele: 'mouvementMateriel',
    titre: 'Mouvement de matériel',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR', 'MAGASINIER'],
    recherche: ['origine', 'destination', 'motif', 'materiel.designation'],
    filtres: ['materielId'],
    include: { materiel: { select: { id: true, designation: true } }, responsable: { select: { id: true, nom: true } } },
    orderBy: { date: 'desc' },
    apresMutation: async (row, action) => {
      if (action !== 'CREATE') return
      // Met à jour l'affectation du matériel selon la destination (nom de chantier ou dépôt)
      if (!row.destination || /dépôt|depot/i.test(row.destination)) {
        await prisma.materiel.update({ where: { id: row.materielId }, data: { chantierId: null } }).catch(() => {})
        return
      }
      const chantier = await prisma.chantier.findFirst({ where: { nom: row.destination, deletedAt: null } })
      if (chantier) {
        await prisma.materiel.update({ where: { id: row.materielId }, data: { chantierId: chantier.id } }).catch(() => {})
      }
    },
    champs: {
      materielId: { type: 'string', requis: true, label: 'Matériel' },
      origine: { type: 'string', label: 'Origine' },
      destination: { type: 'string', label: 'Destination' },
      date: { type: 'date', label: 'Date' },
      responsableId: { type: 'string', label: 'Responsable' },
      motif: { type: 'string', label: 'Motif' },
      etatDepart: { type: 'string', label: 'État au départ' },
      etatArrivee: { type: 'string', label: "État à l'arrivée" },
    },
  },
  {
    nom: 'materiaux',
    modele: 'materiau',
    titre: 'Matériau',
    rolesEcriture: ['MAGASINIER', 'CONDUCTEUR', 'CHEF_PROJET'],
    recherche: ['designation', 'unite'],
    orderBy: { designation: 'asc' },
    enrichir: enrichirMateriaux,
    champs: {
      designation: { type: 'string', requis: true, label: 'Désignation' },
      unite: { type: 'string', requis: true, label: 'Unité' },
      seuilAlerte: { type: 'number', label: "Seuil d'alerte" },
      prixUnitaire: { type: 'number', label: 'Prix unitaire moyen (FCFA)' },
    },
  },
  {
    nom: 'stock-mouvements',
    modele: 'stockMouvement',
    titre: 'Mouvement de stock',
    rolesEcriture: ['MAGASINIER', 'CONDUCTEUR', 'CHEF_PROJET'],
    recherche: ['fournisseur', 'motif', 'materiau.designation'],
    filtres: ['materiauId', 'chantierId', 'type'],
    include: { materiau: true, chantier: { select: { id: true, nom: true } } },
    orderBy: { date: 'desc' },
    apresMutation: async (row, action) => {
      if (action === 'CREATE' && row.type === 'entree' && row.prixUnitaire) {
        await majPrixMoyenPondere(row.materiauId, row.quantite, row.prixUnitaire)
      }
    },
    champs: {
      materiauId: { type: 'string', requis: true, label: 'Matériau' },
      chantierId: { type: 'string', label: 'Chantier (vide = dépôt central)' },
      type: { type: 'enum', valeurs: ['entree', 'sortie', 'inventaire'], label: 'Type' },
      quantite: { type: 'number', requis: true, label: 'Quantité' },
      prixUnitaire: { type: 'number', label: 'Prix unitaire (FCFA)' },
      fournisseur: { type: 'string', label: 'Fournisseur' },
      motif: { type: 'string', label: 'Motif' },
      date: { type: 'date', label: 'Date' },
    },
  },
  {
    nom: 'maintenances',
    modele: 'maintenance',
    titre: 'Maintenance',
    rolesEcriture: ['MAGASINIER', 'CONDUCTEUR', 'CHEF_PROJET'],
    recherche: ['description', 'technicien', 'pieces', 'materiel.designation'],
    filtres: ['materielId', 'type', 'statut'],
    include: { materiel: { select: { id: true, designation: true } } },
    orderBy: { datePlanifiee: 'desc' },
    champs: {
      materielId: { type: 'string', requis: true, label: 'Matériel' },
      type: { type: 'enum', valeurs: ['préventive', 'curative'], label: 'Type' },
      datePlanifiee: { type: 'date', label: 'Date planifiée' },
      dateRealisee: { type: 'date', label: 'Date réalisée' },
      cout: { type: 'number', label: 'Coût (FCFA)' },
      description: { type: 'text', label: 'Description' },
      pieces: { type: 'string', label: 'Pièces' },
      technicien: { type: 'string', label: 'Technicien' },
      prochaineEcheance: { type: 'date', label: 'Prochaine échéance' },
      statut: { type: 'enum', valeurs: ['planifiée', 'réalisée'], label: 'Statut' },
    },
  },
  {
    nom: 'devis',
    modele: 'devis',
    titre: 'Devis',
    rolesEcriture: ['COMPTABLE', 'CHEF_PROJET'],
    recherche: ['numero', 'objet', 'client.nom'],
    filtres: ['statut', 'clientId', 'projetId'],
    include: { client: true, projet: { select: { id: true, nom: true } }, lignes: { orderBy: { ordre: 'asc' } }, contrat: true },
    enrichir: enrichirDevis,
    avantCreer: async (data) => ({ ...data, numero: await prochainNumero('devis', 'DEV') }),
    champs: {
      clientId: { type: 'string', label: 'Client' },
      projetId: { type: 'string', label: 'Projet' },
      objet: { type: 'string', label: 'Objet' },
      date: { type: 'date', label: 'Date' },
      statut: { type: 'enum', valeurs: ['brouillon', 'envoyé', 'accepté', 'refusé'], label: 'Statut' },
      tvaTaux: { type: 'number', label: 'TVA (%)' },
      remise: { type: 'number', label: 'Remise (FCFA)' },
      notes: { type: 'text', label: 'Notes' },
    },
  },
  {
    nom: 'lignes-devis',
    modele: 'ligneDevis',
    titre: 'Ligne de devis',
    rolesEcriture: ['COMPTABLE', 'CHEF_PROJET'],
    filtres: ['devisId'],
    softDelete: false,
    orderBy: { ordre: 'asc' },
    champs: {
      devisId: { type: 'string', requis: true, label: 'Devis' },
      designation: { type: 'string', requis: true, label: "Désignation de l'ouvrage" },
      unite: { type: 'string', label: 'Unité' },
      quantite: { type: 'number', label: 'Quantité' },
      prixUnitaire: { type: 'number', label: 'Prix unitaire (FCFA)' },
      ordre: { type: 'number', label: 'Ordre' },
    },
  },
  {
    nom: 'contrats',
    modele: 'contrat',
    titre: 'Contrat',
    rolesEcriture: ['COMPTABLE'],
    recherche: ['numero', 'objet', 'client.nom'],
    filtres: ['clientId', 'projetId'],
    include: { client: true, projet: { select: { id: true, nom: true } }, devis: { select: { id: true, numero: true } } },
    orderBy: { dateSignature: 'desc' },
    avantCreer: async (data) => ({ ...data, numero: await prochainNumero('contrat', 'CTR') }),
    champs: {
      devisId: { type: 'string', label: 'Devis lié' },
      clientId: { type: 'string', label: 'Client' },
      projetId: { type: 'string', label: 'Projet' },
      objet: { type: 'string', label: 'Objet' },
      montant: { type: 'number', label: 'Montant (FCFA)' },
      dateSignature: { type: 'date', label: 'Date de signature' },
    },
  },
  {
    nom: 'factures',
    modele: 'facture',
    titre: 'Facture',
    rolesEcriture: ['COMPTABLE'],
    recherche: ['numero', 'objet', 'client.nom'],
    filtres: ['statut', 'clientId', 'projetId', 'type'],
    include: {
      client: true,
      projet: { select: { id: true, nom: true } },
      contrat: { select: { id: true, numero: true } },
      paiements: true,
    },
    enrichir: enrichirFactures,
    avantCreer: async (data) => ({ ...data, numero: await prochainNumero('facture', 'FAC') }),
    champs: {
      contratId: { type: 'string', label: 'Contrat' },
      projetId: { type: 'string', label: 'Projet' },
      clientId: { type: 'string', label: 'Client' },
      type: { type: 'enum', valeurs: ['acompte', 'situation', 'solde'], label: 'Type' },
      objet: { type: 'string', label: 'Objet' },
      montant: { type: 'number', label: 'Montant (FCFA)' },
      avancementPct: { type: 'number', label: 'Avancement facturé (%)' },
      retenueGarantie: { type: 'number', label: 'Retenue de garantie (%)' },
      date: { type: 'date', label: 'Date' },
      echeance: { type: 'date', label: 'Échéance' },
      statut: { type: 'enum', valeurs: ['brouillon', 'envoyée', 'partiellement payée', 'payée', 'en retard'], label: 'Statut' },
    },
  },
  {
    nom: 'depenses',
    modele: 'depense',
    titre: 'Dépense',
    rolesEcriture: ['COMPTABLE', 'CONDUCTEUR', 'CHEF_PROJET'],
    recherche: ['fournisseur', 'description', 'chantier.nom'],
    filtres: ['chantierId', 'categorie'],
    include: { chantier: { select: { id: true, nom: true } } },
    orderBy: { date: 'desc' },
    champs: {
      chantierId: { type: 'string', label: 'Chantier' },
      categorie: { type: 'enum', valeurs: CATEGORIES_DEPENSE, label: 'Catégorie' },
      fournisseur: { type: 'string', label: 'Fournisseur' },
      description: { type: 'string', label: 'Description' },
      montant: { type: 'number', requis: true, label: 'Montant (FCFA)' },
      date: { type: 'date', label: 'Date' },
      justificatifUrl: { type: 'string', label: 'Justificatif' },
    },
  },
  {
    nom: 'paiements',
    modele: 'paiement',
    titre: 'Paiement',
    rolesEcriture: ['COMPTABLE'],
    recherche: ['reference', 'tiers', 'facture.numero'],
    filtres: ['sens', 'mode', 'factureId'],
    include: { facture: { include: { client: { select: { id: true, nom: true } } } } },
    orderBy: { date: 'desc' },
    apresMutation: async (row) => {
      if (row.factureId) await recalculerStatutFacture(row.factureId)
    },
    champs: {
      factureId: { type: 'string', label: 'Facture liée' },
      sens: { type: 'enum', valeurs: ['encaissement', 'decaissement'], label: 'Sens' },
      mode: { type: 'enum', valeurs: MODES_PAIEMENT, label: 'Mode' },
      tiers: { type: 'string', label: 'Client / Fournisseur' },
      montant: { type: 'number', requis: true, label: 'Montant (FCFA)' },
      date: { type: 'date', label: 'Date' },
      reference: { type: 'string', label: 'Référence' },
    },
  },
  {
    nom: 'rapports-journaliers',
    modele: 'rapportJournalier',
    titre: 'Rapport journalier',
    rolesEcriture: ['CHEF_PROJET', 'CONDUCTEUR'],
    recherche: ['travauxRealises', 'incidents', 'besoins', 'chantier.nom', 'redacteurNom'],
    filtres: ['chantierId'],
    include: { chantier: { select: { id: true, nom: true, ville: true } } },
    orderBy: { date: 'desc' },
    avantCreer: async (data, req) => {
      const complete = { ...data, redacteurNom: (req as any).user?.nom ?? null }
      // Effectif automatique depuis le pointage du jour si non renseigné
      if ((!complete.effectif || complete.effectif === 0) && complete.chantierId && complete.date) {
        const jour = new Date(complete.date)
        const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate())
        const fin = new Date(debut.getTime() + 86400000)
        complete.effectif = await prisma.pointage.count({
          where: { chantierId: complete.chantierId, present: true, date: { gte: debut, lt: fin } },
        })
      }
      return complete
    },
    champs: {
      chantierId: { type: 'string', requis: true, label: 'Chantier' },
      date: { type: 'date', label: 'Date' },
      meteo: { type: 'enum', valeurs: ['ensoleillé', 'nuageux', 'pluie', 'vent de sable', 'harmattan'], label: 'Météo' },
      effectif: { type: 'number', label: 'Effectif présent (0 = auto depuis le pointage)' },
      travauxRealises: { type: 'text', requis: true, label: 'Travaux réalisés' },
      incidents: { type: 'text', label: 'Incidents / observations' },
      besoins: { type: 'text', label: 'Besoins (matériaux, matériel…)' },
      photos: { type: 'string', label: 'Photos (JSON)' },
    },
  },
  {
    nom: 'utilisateurs',
    modele: 'utilisateur',
    titre: 'Utilisateur',
    rolesEcriture: [], // ADMIN uniquement (vérifierRole laisse toujours passer ADMIN)
    rolesLecture: [], // liste visible par ADMIN uniquement
    recherche: ['nom', 'email'],
    orderBy: { nom: 'asc' },
    enrichir: async (rows) => rows.map(({ motDePasseHash, ...r }) => r),
    avantCreer: async (data) => {
      const { motDePasse, ...reste } = data
      if (!motDePasse) {
        const { ApiError } = await import('./lib/http')
        throw new ApiError(400, 'Le mot de passe est requis.')
      }
      return { ...reste, motDePasseHash: await bcrypt.hash(motDePasse, 10) }
    },
    avantModifier: async (data) => {
      const { motDePasse, ...reste } = data
      if (motDePasse) return { ...reste, motDePasseHash: await bcrypt.hash(motDePasse, 10) }
      return reste
    },
    champs: {
      nom: { type: 'string', requis: true, label: 'Nom' },
      email: { type: 'string', requis: true, label: 'Email' },
      role: { type: 'enum', valeurs: ['ADMIN', 'CHEF_PROJET', 'CONDUCTEUR', 'COMPTABLE', 'MAGASINIER', 'LECTURE'], label: 'Rôle' },
      motDePasse: { type: 'string', label: 'Mot de passe' },
      actif: { type: 'boolean', label: 'Actif' },
    },
  },
]
