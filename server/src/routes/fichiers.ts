import { Router } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { h, ApiError } from '../lib/http'
import { authRequis } from '../auth'

export const DOSSIER_UPLOADS = path.join(process.cwd(), 'uploads')

export const routerFichiers = Router()
routerFichiers.use(authRequis)

/** Upload d'un justificatif encodé en base64 (data URL). */
routerFichiers.post(
  '/fichiers',
  h(async (req, res) => {
    const { nom, contenu } = z
      .object({
        nom: z.string().min(1),
        contenu: z.string().min(1), // data URL : data:<mime>;base64,<données>
      })
      .parse(req.body)
    const m = contenu.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) throw new ApiError(400, 'Format de fichier invalide (data URL attendue).')
    const donnees = Buffer.from(m[2], 'base64')
    if (donnees.length > 8 * 1024 * 1024) throw new ApiError(413, 'Fichier trop volumineux (8 Mo max).')
    if (!fs.existsSync(DOSSIER_UPLOADS)) fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true })
    const nomSur = nom.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const nomFichier = `${crypto.randomBytes(8).toString('hex')}-${nomSur}`
    fs.writeFileSync(path.join(DOSSIER_UPLOADS, nomFichier), donnees)
    res.status(201).json({ url: `/uploads/${nomFichier}`, nom: nomSur })
  })
)
