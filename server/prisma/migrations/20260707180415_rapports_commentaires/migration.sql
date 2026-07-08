-- CreateTable
CREATE TABLE "RapportJournalier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meteo" TEXT,
    "effectif" INTEGER NOT NULL DEFAULT 0,
    "travauxRealises" TEXT NOT NULL,
    "incidents" TEXT,
    "besoins" TEXT,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "redacteurNom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "RapportJournalier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Commentaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "auteurId" TEXT,
    "auteurNom" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Commentaire_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
