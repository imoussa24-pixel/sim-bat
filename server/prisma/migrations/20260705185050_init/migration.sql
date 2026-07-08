-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'particulier',
    "tel" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "nif" TEXT,
    "contact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Projet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "responsableId" TEXT,
    "budget" REAL NOT NULL DEFAULT 0,
    "dateDebut" DATETIME,
    "livraisonPrevue" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "avancement" REAL NOT NULL DEFAULT 0,
    "localites" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Projet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Projet_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Employe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chantier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projetId" TEXT,
    "nom" TEXT NOT NULL,
    "ville" TEXT,
    "dateDebut" DATETIME,
    "dateFin" DATETIME,
    "budget" REAL NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "avancement" REAL NOT NULL DEFAULT 0,
    "chefId" TEXT,
    "planningCalcule" BOOLEAN NOT NULL DEFAULT false,
    "finPrevue" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Chantier_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chantier_chefId_fkey" FOREIGN KEY ("chefId") REFERENCES "Employe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Lot_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dureeJours" REAL NOT NULL DEFAULT 1,
    "dateDebutSouhaitee" DATETIME,
    "dateDebut" DATETIME,
    "dateFin" DATETIME,
    "avancement" REAL NOT NULL DEFAULT 0,
    "estJalon" BOOLEAN NOT NULL DEFAULT false,
    "estCritique" BOOLEAN NOT NULL DEFAULT false,
    "margeTotale" REAL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "responsableId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Tache_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tache_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Employe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DependanceTache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predecesseurId" TEXT NOT NULL,
    "successeurId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FD',
    "lagJours" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "DependanceTache_predecesseurId_fkey" FOREIGN KEY ("predecesseurId") REFERENCES "Tache" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DependanceTache_successeurId_fkey" FOREIGN KEY ("successeurId") REFERENCES "Tache" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TacheRessource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tacheId" TEXT NOT NULL,
    "employeId" TEXT,
    "materielId" TEXT,
    CONSTRAINT "TacheRessource_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "Tache" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TacheRessource_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TacheRessource_materielId_fkey" FOREIGN KEY ("materielId") REFERENCES "Materiel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dateSnapshot" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "donneesJson" TEXT NOT NULL,
    CONSTRAINT "Baseline_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "qualification" TEXT,
    "tel" TEXT,
    "tauxJournalier" REAL NOT NULL DEFAULT 0,
    "chantierId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Employe_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Pointage_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pointage_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Materiel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "designation" TEXT NOT NULL,
    "type" TEXT,
    "numeroSerie" TEXT,
    "etat" TEXT NOT NULL DEFAULT 'bon',
    "coutHoraire" REAL NOT NULL DEFAULT 0,
    "chantierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Materiel_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MouvementMateriel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materielId" TEXT NOT NULL,
    "origine" TEXT,
    "destination" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsableId" TEXT,
    "motif" TEXT,
    "etatDepart" TEXT,
    "etatArrivee" TEXT,
    "deletedAt" DATETIME,
    CONSTRAINT "MouvementMateriel_materielId_fkey" FOREIGN KEY ("materielId") REFERENCES "Materiel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MouvementMateriel_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Employe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Materiau" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "seuilAlerte" REAL NOT NULL DEFAULT 0,
    "prixUnitaire" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "StockMouvement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materiauId" TEXT NOT NULL,
    "chantierId" TEXT,
    "type" TEXT NOT NULL,
    "quantite" REAL NOT NULL,
    "prixUnitaire" REAL,
    "fournisseur" TEXT,
    "motif" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "StockMouvement_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "Materiau" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMouvement_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materielId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'préventive',
    "datePlanifiee" DATETIME,
    "dateRealisee" DATETIME,
    "cout" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "pieces" TEXT,
    "technicien" TEXT,
    "prochaineEcheance" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'planifiée',
    "deletedAt" DATETIME,
    CONSTRAINT "Maintenance_materielId_fkey" FOREIGN KEY ("materielId") REFERENCES "Materiel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" TEXT,
    "projetId" TEXT,
    "objet" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "tvaTaux" REAL NOT NULL DEFAULT 19,
    "remise" REAL NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Devis_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LigneDevis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "devisId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'u',
    "quantite" REAL NOT NULL DEFAULT 1,
    "prixUnitaire" REAL NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LigneDevis_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "devisId" TEXT,
    "clientId" TEXT,
    "projetId" TEXT,
    "objet" TEXT,
    "montant" REAL NOT NULL DEFAULT 0,
    "dateSignature" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Contrat_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contrat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contrat_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "contratId" TEXT,
    "projetId" TEXT,
    "clientId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'situation',
    "objet" TEXT,
    "montant" REAL NOT NULL DEFAULT 0,
    "avancementPct" REAL,
    "retenueGarantie" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "echeance" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Facture_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Facture_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Facture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'divers',
    "fournisseur" TEXT,
    "description" TEXT,
    "montant" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justificatifUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Depense_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factureId" TEXT,
    "sens" TEXT NOT NULL DEFAULT 'encaissement',
    "mode" TEXT NOT NULL DEFAULT 'virement',
    "tiers" TEXT,
    "montant" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userNom" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL PRIMARY KEY,
    "valeur" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DependanceTache_predecesseurId_successeurId_key" ON "DependanceTache"("predecesseurId", "successeurId");

-- CreateIndex
CREATE UNIQUE INDEX "Pointage_employeId_date_key" ON "Pointage"("employeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Devis_numero_key" ON "Devis"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_numero_key" ON "Contrat"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_devisId_key" ON "Contrat"("devisId");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_numero_key" ON "Facture"("numero");
