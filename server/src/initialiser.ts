// ─────────────────────────────────────────────────────────────────────────────
// Initialisation au déploiement (Render, etc.) : si la base est vide,
// charge le jeu de données de démonstration. Sinon, ne touche à rien.
// Exécuté avant le démarrage du serveur : node dist/src/initialiser.js
// ─────────────────────────────────────────────────────────────────────────────
import './config'
import { PrismaClient } from '@prisma/client'
import { executerSeed } from './seed-donnees'

const prisma = new PrismaClient()

async function main() {
  const utilisateurs = await prisma.utilisateur.count()
  if (utilisateurs > 0) {
    console.log(`✔ Base déjà initialisée (${utilisateurs} utilisateur(s)) — aucun seed.`)
    return
  }
  console.log('— Base vide : chargement du jeu de démonstration…')
  await executerSeed(prisma)
  console.log('✔ Démo chargée. Connexion : admin@simbat.ne / admin123 (à changer !)')
}

main()
  .catch((e) => {
    console.error('Initialisation impossible :', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
