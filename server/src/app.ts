import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import swaggerUi from 'swagger-ui-express'
import { routerAuth } from './auth'
import { ENTITES } from './entites'
import { creerRouteurCrud } from './crud'
import { routerPlanning } from './routes/planning'
import { routerGlobal } from './routes/global'
import { routerParametres } from './routes/parametres'
import { routerModeles } from './routes/modeles'
import { routerFinance } from './routes/finance'
import { routerStats } from './routes/stats'
import { routerExports } from './routes/exports'
import { routerFichiers, DOSSIER_UPLOADS } from './routes/fichiers'
import { middlewareErreurs } from './lib/http'
import { construireOpenApi } from './openapi'

export function creerApp() {
  const app = express()
  app.set('trust proxy', 1) // derrière le proxy Render/nginx : req.ip = vraie IP client
  app.use(cors())
  app.use(express.json({ limit: '12mb' }))

  // Santé
  app.get('/api/sante', (_req, res) => res.json({ statut: 'ok', application: 'SIM-BAT', horodatage: new Date() }))

  // Authentification
  app.use('/api/auth', routerAuth)

  // Routes métier spécifiques (déclarées avant les CRUD pour prendre la priorité)
  app.use('/api', routerGlobal)
  app.use('/api', routerParametres)
  app.use('/api', routerModeles)
  app.use('/api', routerPlanning)
  app.use('/api', routerFinance)
  app.use('/api', routerStats)
  app.use('/api', routerExports)
  app.use('/api', routerFichiers)

  // CRUD génériques
  for (const entite of ENTITES) {
    app.use(`/api/${entite.nom}`, creerRouteurCrud(entite))
  }

  // Documentation OpenAPI / Swagger
  const openapi = construireOpenApi()
  app.get('/api/openapi.json', (_req, res) => res.json(openapi))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'SIM-BAT — API' }))

  // Fichiers uploadés
  app.use('/uploads', express.static(DOSSIER_UPLOADS))

  // Frontend compilé (production) : servi si client/dist existe
  const distClient = path.join(process.cwd(), '..', 'client', 'dist')
  if (fs.existsSync(distClient)) {
    app.use(express.static(distClient))
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(distClient, 'index.html')))
  }

  app.use(middlewareErreurs)
  return app
}
