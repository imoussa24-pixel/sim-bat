import fs from 'fs'
import path from 'path'

// Chargement minimal du fichier .env (sans dépendance externe)
function chargerEnv() {
  const fichier = path.join(process.cwd(), '.env')
  if (!fs.existsSync(fichier)) return
  for (const ligne of fs.readFileSync(fichier, 'utf-8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/i)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
  }
}
chargerEnv()

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./dev.db'

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'simbat-dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'simbat-dev-refresh',
  accessTokenDuree: '30m',
  refreshTokenDureeJours: 7,
}
