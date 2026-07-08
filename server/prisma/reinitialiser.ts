// ─────────────────────────────────────────────────────────────────────────────
// SIM-BAT — Remise à zéro pour passage en utilisation réelle
// Supprime TOUTES les données métier (clients, projets, chantiers, finance…)
// mais CONSERVE : comptes utilisateurs, paramètres entreprise/calendrier,
// modèles de WBS. Une sauvegarde de la base est faite avant.
//
// Usage :  npm run reinitialiser -- --confirmer
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  if (!process.argv.includes('--confirmer')) {
    console.log('⚠  Cette commande supprime toutes les données métier (les comptes,')
    console.log('   paramètres et modèles WBS sont conservés).')
    console.log('')
    console.log('   Pour confirmer :  npm run reinitialiser -- --confirmer')
    process.exit(1)
  }

  // Sauvegarde préalable
  const source = path.join(process.cwd(), 'prisma', 'dev.db')
  const dossier = path.join(process.cwd(), 'sauvegardes')
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })
  const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const cible = path.join(dossier, `avant-reinitialisation-${horodatage}.db`)
  fs.copyFileSync(source, cible)
  console.log(`✔ Sauvegarde créée : sauvegardes/${path.basename(cible)}`)

  console.log('— Suppression des données métier…')
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
  await prisma.rapportJournalier.deleteMany()
  await prisma.commentaire.deleteMany()
  await prisma.materiel.deleteMany()
  await prisma.employe.deleteMany()
  await prisma.chantier.deleteMany()
  await prisma.projet.deleteMany()
  await prisma.client.deleteMany()

  const [utilisateurs, modeles] = await Promise.all([prisma.utilisateur.count(), prisma.modeleWbs.count()])
  console.log('✔ Base remise à zéro.')
  console.log(`  Conservés : ${utilisateurs} compte(s) utilisateur, paramètres entreprise/calendrier, ${modeles} modèle(s) WBS.`)
  console.log('')
  console.log('Prochaines étapes conseillées :')
  console.log('  1. Connectez-vous et changez les mots de passe (Paramètres → Utilisateurs).')
  console.log('  2. Vérifiez les infos entreprise et le calendrier ouvré (Paramètres).')
  console.log('  3. Importez vos clients/employés/matériaux (Paramètres → Import Excel).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
