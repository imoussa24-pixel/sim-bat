# SIM-BAT — Gestion d'entreprise BTP

Application web complète de gestion pour entreprises de construction (BTP) en Afrique de l'Ouest,
entièrement en **français**, devise **FCFA (XOF)**, dates au format **JJ/MM/AAAA**.

Couvre tout le cycle de vie : clients, projets, chantiers, **planification Gantt/CPM**,
ressources humaines et matérielles, stocks, maintenance, finance (devis → contrats → factures →
paiements, dépenses) et analyse statistique.

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 18 + TypeScript + Vite, TailwindCSS, Recharts, Gantt SVG custom |
| Backend | Node.js + Express + TypeScript, API REST documentée (OpenAPI/Swagger) |
| Base de données | SQLite via Prisma (aucun serveur à installer) + migrations |
| Auth | JWT + refresh tokens, 6 rôles (Admin, Chef de projet, Conducteur, Comptable, Magasinier, Lecture seule) |
| Exports | PDF (pdfkit) : devis, factures, planning Gantt · Excel (exceljs) : états financiers, stocks, planning |
| Moteur CPM | Maison, côté backend, testé unitairement (17 tests vitest) |

## Démarrage rapide

Prérequis : **Node.js ≥ 18**.

```bash
# 1. Installer les dépendances
npm install
npm --prefix server install
npm --prefix client install

# 2. Créer la base + données de démonstration
npm --prefix server run migrate     # (déjà fait si server/prisma/dev.db existe)
npm run seed

# 3. Lancer en développement (API :4000 + client :5173)
npm run dev
```

Ouvrez ensuite **http://localhost:5173**.

### Production

```bash
npm run build      # compile serveur + client
npm start          # sert l'API ET le frontend compilé sur http://localhost:4000
```

## Passer en utilisation réelle

1. **Remise à zéro** (garde vos comptes, paramètres et modèles WBS ; sauvegarde automatique avant) :
   ```bash
   npm run reinitialiser
   ```
2. **Sécuriser** : changez les mots de passe dans Paramètres → Utilisateurs (supprimez les comptes démo inutiles) et remplacez les secrets JWT dans `server/.env`.
3. **Configurer** : Paramètres → Entreprise (en-têtes PDF) et Calendrier ouvré (jours fériés de l'année).
4. **Charger vos données** : Paramètres → Import Excel (clients, employés, matériaux) ou saisie directe.
5. **Démarrer au quotidien** : double-cliquez sur **`DEMARRER-SIMBAT.bat`** (ou `npm start`) → http://localhost:4000.

Pour un accès multi-postes sur le réseau local : lancez `npm start` sur un poste « serveur » et ouvrez `http://<ip-du-poste>:4000` depuis les autres.

## Déploiement sur Render (essai gratuit, accès à distance)

Le dépôt contient un blueprint [render.yaml](render.yaml) : service web + PostgreSQL, tous deux sur le plan gratuit.

1. Créez un dépôt GitHub **privé** et poussez le code :
   ```bash
   git remote add origin https://github.com/<votre-compte>/sim-bat.git
   git push -u origin main
   ```
2. Sur [dashboard.render.com](https://dashboard.render.com) : **New + → Blueprint** → connectez GitHub → choisissez le dépôt → **Apply**. Render crée la base et le service, génère les secrets JWT, construit et démarre tout.
3. Au premier démarrage, la base vide est remplie avec la démo (`admin@simbat.ne` / `admin123` — **changez-le immédiatement** puisque l'URL est publique).

Limites du plan gratuit à connaître : mise en veille après 15 min d'inactivité (réveil ≈ 50 s), fichiers uploadés (photos, justificatifs) perdus à chaque redéploiement (les données restent en PostgreSQL), base gratuite expirant après 30 jours (email de Render avant échéance). En local, rien ne change : SQLite reste utilisé.

## Comptes de démonstration (mot de passe : `admin123`)

| Email | Rôle |
|---|---|
| admin@simbat.ne | Administrateur |
| chef@simbat.ne | Chef de projet |
| conducteur@simbat.ne | Conducteur de travaux |
| comptable@simbat.ne | Comptable |
| magasinier@simbat.ne | Magasinier |
| lecture@simbat.ne | Lecture seule |

## Modules

- **Tableau de bord** : 4 KPI (contrats, chantiers, projets, clients) + 4 graphiques (CA/mois en aire, contrats signés/mois, donut chantiers par statut, top 5 contrats).
- **Clients** : CRUD + historique complet (projets, contrats, factures, solde).
- **Projets** : vue grille/liste, filtres pilules par statut avec compteurs, avancement agrégé des chantiers.
- **Chantiers** : budget vs **dépensé** (dépenses + main-d'œuvre pointée + matériaux sortis), effectif, chef.
- **Planification** (module clé) :
  - Onglet **Préparer** : WBS par lots (Fondation, Élévation, Toiture…), tâches avec durées, dépendances FD/DD/FF/DF + décalages, ressources, jalons.
  - Onglet **Chronogramme** : Gantt SVG (échelles Jours/Semaines/Mois), chemin critique rouge, marges en pointillés, ligne rouge « aujourd'hui », lots repliables, baselines superposées, sélecteur multi-chantiers.
  - **Moteur CPM** : tri topologique avec détection de cycles (erreur explicite), passes avant/arrière ES/EF/LS/LF, marge totale = LS − ES, calendrier ouvré configurable (6 j/7 + jours fériés, `PUT /api/parametres/calendrier`).
  - **Baselines** : snapshots + comparaison prévu/réel avec glissements en jours.
  - **Alertes** : tâches en retard vs avancement attendu, fin CPM > fin contractuelle, budget consommé > 90 %, surcharge de ressources.
- **Tâches** : vue transversale filtrable (chantier, lot, statut, responsable) + mise à jour rapide de l'avancement.
- **Employés** : dossier + **pointage journalier** par chantier → alimente le coût main-d'œuvre.
- **Matériels / Mouvements** : parc, transferts (l'affectation suit automatiquement la destination).
- **Stock matériaux** : entrées (prix moyen pondéré automatique), sorties, inventaires, alertes stock bas, valorisation.
- **Maintenance** : préventive/curative, coûts, prochaines échéances.
- **Devis** : lignes d'ouvrage, TVA/remise, versions (duplication), **conversion → contrat (+ projet) → factures**, PDF en-tête entreprise.
- **Factures** : acompte/situation/solde, retenue de garantie, numérotation auto `FAC-AAAA-NNN`, statut recalculé selon paiements et échéance, PDF.
- **Dépenses** : par chantier et catégorie, justificatif uploadé.
- **Paiements** : encaissements/décaissements (espèces, virement, chèque, mobile money), reste à payer.
- **Analyse statistique** : **points d'attention automatiques** (dépassements budget, factures en retard, marges négatives…), rentabilité par chantier (table triable avec jauges), CA/dépenses/marge 12 mois avec tendances, **courbe en S**, utilisation du parc, top clients, impayés filtrables, journal d'audit (admin).

## Terrain & pilotage

- **Rapports journaliers de chantier** (menu Gestion) : météo, effectif (repris automatiquement du pointage), travaux réalisés, incidents, besoins et **photos** — export **PDF signé-visable**.
- **Plan de trésorerie prévisionnel 13 semaines** (Analyse → Trésorerie 90 j) : entrées attendues par échéance de facture, sorties estimées (paie moyenne, dépenses courantes, maintenances planifiées), flux cumulé et liste des prochaines échéances.
- **Discussion par chantier** (Planification → onglet Discussion) : fil de messages horodaté par l'équipe.
- **Glisser-déposer sur le Gantt** : déplacez une barre (décale le début souhaité) ou étirez son bord droit (change la durée) — le CPM est recalculé instantanément.
- **Partage WhatsApp** du résumé des alertes en un clic depuis le centre d'alertes.
- **Exonération TVA marchés publics** : bouton dédié sur chaque devis, mention « Exonéré » portée sur le PDF.
- **Mobile** : sidebar en tiroir avec bouton menu, application installable (manifest PWA).
- **Sauvegarde automatique quotidienne** de la base dans `server/sauvegardes/` (14 dernières conservées) + **import Excel** (clients, employés, matériaux) avec modèles téléchargeables (Paramètres → Import).

## Administration & automatisations

- **Page Paramètres** (admin) : gestion des **utilisateurs et rôles**, informations de l'entreprise (en-têtes PDF), **calendrier ouvré** (jours travaillés + jours fériés, appliqué au CPM), **corbeille** (restauration des éléments supprimés) et **sauvegarde de la base en un clic**.
- **Situation de travaux automatique** (page Factures → « Situation auto ») : le montant est calculé depuis l'avancement réel des chantiers du contrat (montant × avancement − déjà facturé), retenue de garantie et échéance comprises.
- **Modèles de WBS** (Planification → Préparer → « Modèles ») : 3 modèles fournis (Villa R+1, École 3 classes, Bâtiment R+2) à appliquer en un clic — lots, tâches et dépendances créés d'un coup — et possibilité d'**enregistrer n'importe quel planning comme modèle** réutilisable.

## Productivité & confort

- **Palette de commandes `Ctrl+K`** : recherche globale instantanée dans les clients, projets, chantiers, devis, factures, employés et matériels + navigation clavier (↑↓, Entrée).
- **Centre d'alertes global** (cloche dans la sidebar, rafraîchi toutes les 90 s) : agrège les retards de tâches, dépassements de délai et de budget, stocks bas, factures en retard et maintenances à échéance — chaque alerte est cliquable.
- **Performance** : interface découpée en chunks (chargement initial ≈ 68 kB gzip, les graphiques ne sont chargés que sur les pages qui les utilisent).
- **Robustesse** : garde-fou anti-écran-blanc (error boundary) et protection anti force brute à la connexion (5 essais / 15 min).

## API

- Documentation interactive : **http://localhost:4000/api/docs** (Swagger UI)
- Spécification : `GET /api/openapi.json`
- Authentification : `POST /api/auth/connexion` → `Authorization: Bearer <accessToken>` (+ `POST /api/auth/rafraichir`).

## Tests

```bash
npm test        # 17 tests unitaires du moteur CPM (dépendances, marges, cycles, calendrier, jalons)
```

## Structure

```
SIM-BAT/
├── server/            # API Express + Prisma + moteur CPM
│   ├── prisma/        # schema.prisma, migrations, seed.ts (données Niger 12 mois)
│   └── src/
│       ├── cpm/       # moteur CPM + tests
│       ├── routes/    # planification, finance, stats, exports PDF/Excel, fichiers
│       ├── crud.ts    # factory CRUD générique (zod + soft delete + audit)
│       └── entites.ts # registre des 20 entités
└── client/            # React + Vite + Tailwind
    └── src/
        ├── components/  # Layout (sidebar BatiFlow), PageCrud générique, Gantt SVG
        └── pages/       # 18 pages métier
```

## Règles métier implémentées

1. Avancement chantier = moyenne des tâches pondérée par durée ; avancement projet = moyenne des chantiers pondérée par budget.
2. « Dépensé » chantier = dépenses directes + (pointages présents × taux journalier) + (sorties stock × prix unitaire).
3. Alertes automatiques : budget > 90 %, fin prévue CPM > fin contractuelle, retard tâche, surcharge ressource, stock bas.
4. Suppression avec confirmation partout + **soft delete** (restauration possible en base).
5. Montants au format « 6 709 998 F », dates JJ/MM/AAAA.
6. Journal d'audit de toutes les mutations (qui, quoi, quand).
