import './config'
import fs from 'fs'
import path from 'path'
import { creerApp } from './app'
import { config } from './config'
import { purgerTokensExpires } from './auth'

const app = creerApp()

app.listen(config.port, () => {
  console.log(`✔ API SIM-BAT démarrée : http://localhost:${config.port}`)
  console.log(`  Documentation : http://localhost:${config.port}/api/docs`)
})

// Purge des refresh tokens expirés toutes les heures
setInterval(purgerTokensExpires, 3600000)

// ── Sauvegarde automatique quotidienne de la base (14 dernières conservées) ──
function sauvegardeAutomatique() {
  try {
    const source = path.join(process.cwd(), 'prisma', 'dev.db')
    if (!fs.existsSync(source)) return
    const dossier = path.join(process.cwd(), 'sauvegardes')
    if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })
    const jour = new Date().toISOString().slice(0, 10)
    const cible = path.join(dossier, `simbat-${jour}.db`)
    if (!fs.existsSync(cible)) {
      fs.copyFileSync(source, cible)
      console.log(`✔ Sauvegarde automatique : sauvegardes/simbat-${jour}.db`)
    }
    // Rotation : ne garder que les 14 plus récentes
    const fichiers = fs
      .readdirSync(dossier)
      .filter((f) => f.startsWith('simbat-') && f.endsWith('.db'))
      .sort()
    for (const ancien of fichiers.slice(0, Math.max(0, fichiers.length - 14))) {
      fs.unlinkSync(path.join(dossier, ancien))
    }
  } catch (e) {
    console.error('Sauvegarde automatique impossible :', e)
  }
}
sauvegardeAutomatique()
setInterval(sauvegardeAutomatique, 6 * 3600000) // revérifie toutes les 6 h
