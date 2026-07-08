import { Router } from 'express'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'
import { prisma } from '../db'
import { h, ApiError } from '../lib/http'
import { auditer } from '../lib/audit'
import { authRequis } from '../auth'
import { infosEntreprise, ecrireParametre } from '../lib/metier'

export const routerParametres = Router()
routerParametres.use(authRequis)

function adminRequis(req: any) {
  if (req.user?.role !== 'ADMIN') {
    throw new ApiError(403, 'Réservé aux administrateurs.')
  }
}

// ─────────────────────── Informations entreprise ────────────────────────────

routerParametres.get(
  '/parametres/entreprise',
  h(async (_req, res) => {
    res.json(await infosEntreprise())
  })
)

routerParametres.put(
  '/parametres/entreprise',
  h(async (req, res) => {
    adminRequis(req)
    const data = z
      .object({
        nom: z.string().min(1, 'Nom requis'),
        adresse: z.string().default(''),
        tel: z.string().default(''),
        email: z.string().default(''),
        nif: z.string().default(''),
      })
      .parse(req.body)
    await Promise.all([
      ecrireParametre('entreprise_nom', data.nom),
      ecrireParametre('entreprise_adresse', data.adresse),
      ecrireParametre('entreprise_tel', data.tel),
      ecrireParametre('entreprise_email', data.email),
      ecrireParametre('entreprise_nif', data.nif),
    ])
    auditer(req, 'UPDATE', 'parametres', 'entreprise')
    res.json(await infosEntreprise())
  })
)

// ───────────────────────── Sauvegarde de la base ────────────────────────────

routerParametres.get(
  '/parametres/sauvegarde',
  h(async (req, res) => {
    adminRequis(req)
    const fichier = path.join(process.cwd(), 'prisma', 'dev.db')
    if (!fs.existsSync(fichier)) throw new ApiError(404, 'Base de données introuvable.')
    auditer(req, 'EXPORT', 'parametres', 'sauvegarde')
    const nom = `sauvegarde-simbat-${new Date().toISOString().slice(0, 10)}.db`
    res.download(fichier, nom)
  })
)

// ──────────────────────────── Corbeille ─────────────────────────────────────

const ENTITES_CORBEILLE: { modele: string; type: string; libelle: (r: any) => string }[] = [
  { modele: 'client', type: 'clients', libelle: (r) => r.nom },
  { modele: 'projet', type: 'projets', libelle: (r) => r.nom },
  { modele: 'chantier', type: 'chantiers', libelle: (r) => r.nom },
  { modele: 'lot', type: 'lots', libelle: (r) => r.nom },
  { modele: 'tache', type: 'taches', libelle: (r) => r.nom },
  { modele: 'employe', type: 'employes', libelle: (r) => r.nom },
  { modele: 'materiel', type: 'materiels', libelle: (r) => r.designation },
  { modele: 'materiau', type: 'materiaux', libelle: (r) => r.designation },
  { modele: 'mouvementMateriel', type: 'mouvements-materiel', libelle: (r) => `Mouvement du ${r.date?.toLocaleDateString?.('fr-FR') ?? ''}` },
  { modele: 'stockMouvement', type: 'stock-mouvements', libelle: (r) => `Mouvement de stock (${r.type})` },
  { modele: 'maintenance', type: 'maintenances', libelle: (r) => r.description ?? 'Intervention' },
  { modele: 'devis', type: 'devis', libelle: (r) => `${r.numero} — ${r.objet ?? ''}` },
  { modele: 'contrat', type: 'contrats', libelle: (r) => `${r.numero} — ${r.objet ?? ''}` },
  { modele: 'facture', type: 'factures', libelle: (r) => `${r.numero} — ${r.objet ?? ''}` },
  { modele: 'depense', type: 'depenses', libelle: (r) => `${r.categorie} — ${r.description ?? r.fournisseur ?? ''}` },
  { modele: 'paiement', type: 'paiements', libelle: (r) => `${r.sens} ${r.reference ?? ''}` },
  { modele: 'utilisateur', type: 'utilisateurs', libelle: (r) => `${r.nom} (${r.email})` },
]

routerParametres.get(
  '/corbeille',
  h(async (req, res) => {
    adminRequis(req)
    const resultats: { type: string; id: string; libelle: string; supprimeLe: Date }[] = []
    for (const e of ENTITES_CORBEILLE) {
      const rows = await (prisma as any)[e.modele].findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        take: 50,
      })
      for (const r of rows) {
        resultats.push({ type: e.type, id: r.id, libelle: e.libelle(r), supprimeLe: r.deletedAt })
      }
    }
    resultats.sort((a, b) => new Date(b.supprimeLe).getTime() - new Date(a.supprimeLe).getTime())
    res.json(resultats.slice(0, 100))
  })
)

// ─────────────────────────── Import Excel ───────────────────────────────────

interface ConfigImport {
  modele: string
  colonnes: { entete: string; champ: string; requis?: boolean; nombre?: boolean }[]
}

const IMPORTS: Record<string, ConfigImport> = {
  clients: {
    modele: 'client',
    colonnes: [
      { entete: 'Nom', champ: 'nom', requis: true },
      { entete: 'Type', champ: 'type' }, // particulier | entreprise | administration
      { entete: 'Téléphone', champ: 'tel' },
      { entete: 'Email', champ: 'email' },
      { entete: 'Adresse', champ: 'adresse' },
      { entete: 'Ville', champ: 'ville' },
      { entete: 'NIF', champ: 'nif' },
      { entete: 'Contact', champ: 'contact' },
    ],
  },
  employes: {
    modele: 'employe',
    colonnes: [
      { entete: 'Nom', champ: 'nom', requis: true },
      { entete: 'Poste', champ: 'poste', requis: true },
      { entete: 'Qualification', champ: 'qualification' },
      { entete: 'Téléphone', champ: 'tel' },
      { entete: 'Taux journalier', champ: 'tauxJournalier', nombre: true },
      { entete: 'Statut', champ: 'statut' }, // actif | congé | parti
    ],
  },
  materiaux: {
    modele: 'materiau',
    colonnes: [
      { entete: 'Désignation', champ: 'designation', requis: true },
      { entete: 'Unité', champ: 'unite', requis: true },
      { entete: "Seuil d'alerte", champ: 'seuilAlerte', nombre: true },
      { entete: 'Prix unitaire', champ: 'prixUnitaire', nombre: true },
    ],
  },
}

// Modèle Excel vierge à télécharger
routerParametres.get(
  '/imports/:type/modele',
  h(async (req, res) => {
    const config = IMPORTS[req.params.type]
    if (!config) throw new ApiError(400, 'Type d’import inconnu (clients, employes, materiaux).')
    const wb = new ExcelJS.Workbook()
    const feuille = wb.addWorksheet('Import')
    feuille.columns = config.colonnes.map((c) => ({ header: c.entete, key: c.champ, width: 22 }))
    const entete = feuille.getRow(1)
    entete.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="modele-import-${req.params.type}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  })
)

routerParametres.post(
  '/imports/:type',
  h(async (req, res) => {
    adminRequis(req)
    const config = IMPORTS[req.params.type]
    if (!config) throw new ApiError(400, 'Type d’import inconnu (clients, employes, materiaux).')
    const { contenu } = z.object({ contenu: z.string().min(10) }).parse(req.body)
    const m = contenu.match(/^data:[^;]+;base64,(.+)$/)
    if (!m) throw new ApiError(400, 'Fichier invalide (data URL attendue).')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(m[1], 'base64') as any)
    const feuille = wb.worksheets[0]
    if (!feuille) throw new ApiError(400, 'Classeur vide.')

    // Correspondance des colonnes par en-tête (ligne 1), insensible à la casse/accents
    const normaliser = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    const indexParChamp = new Map<string, number>()
    feuille.getRow(1).eachCell((cellule, col) => {
      const val = normaliser(String(cellule.value ?? ''))
      const colonne = config.colonnes.find((c) => normaliser(c.entete) === val)
      if (colonne) indexParChamp.set(colonne.champ, col)
    })
    const manquantes = config.colonnes.filter((c) => c.requis && !indexParChamp.has(c.champ))
    if (manquantes.length) {
      throw new ApiError(400, `Colonnes obligatoires introuvables : ${manquantes.map((c) => c.entete).join(', ')}. Téléchargez le modèle fourni.`)
    }

    let crees = 0
    const erreurs: string[] = []
    for (let i = 2; i <= feuille.rowCount; i++) {
      const ligne = feuille.getRow(i)
      const donnees: Record<string, any> = {}
      let vide = true
      for (const c of config.colonnes) {
        const col = indexParChamp.get(c.champ)
        if (!col) continue
        let v: any = ligne.getCell(col).value
        if (v && typeof v === 'object' && 'text' in v) v = (v as any).text
        if (v != null && v !== '') vide = false
        if (c.nombre) v = v == null || v === '' ? 0 : Number(v)
        donnees[c.champ] = v == null || v === '' ? (c.nombre ? 0 : null) : c.nombre ? Number(v) : String(v).trim()
      }
      if (vide) continue
      const manquant = config.colonnes.find((c) => c.requis && !donnees[c.champ])
      if (manquant) {
        erreurs.push(`Ligne ${i} : « ${manquant.entete} » manquant.`)
        continue
      }
      try {
        await (prisma as any)[config.modele].create({ data: donnees })
        crees++
      } catch (e: any) {
        erreurs.push(`Ligne ${i} : ${e.message?.slice(0, 80) ?? 'erreur'}`)
      }
    }
    auditer(req, 'IMPORT', req.params.type, undefined, `${crees} créés, ${erreurs.length} erreurs`)
    res.json({ crees, erreurs: erreurs.slice(0, 20) })
  })
)

routerParametres.post(
  '/corbeille/restaurer',
  h(async (req, res) => {
    adminRequis(req)
    const { type, id } = z.object({ type: z.string(), id: z.string() }).parse(req.body)
    const entite = ENTITES_CORBEILLE.find((e) => e.type === type)
    if (!entite) throw new ApiError(400, 'Type inconnu.')
    await (prisma as any)[entite.modele].update({ where: { id }, data: { deletedAt: null } })
    auditer(req, 'RESTORE', type, id)
    res.json({ message: 'Élément restauré.' })
  })
)
