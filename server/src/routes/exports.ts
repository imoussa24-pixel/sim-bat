import { Router, type Response } from 'express'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { prisma } from '../db'
import { DOSSIER_UPLOADS } from './fichiers'
import { h, ApiError } from '../lib/http'
import { authRequis } from '../auth'
import { totauxDevis, infosEntreprise, calculerDepensesChantiers, etatStocks } from '../lib/metier'

export const routerExports = Router()
routerExports.use(authRequis)

// ────────────────────────────── Helpers ─────────────────────────────────────

const fmtF = (n: number) =>
  `${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

function debuterPdf(res: Response, nomFichier: string, paysage = false) {
  const doc = new PDFDocument({ size: 'A4', layout: paysage ? 'landscape' : 'portrait', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`)
  doc.pipe(res)
  return doc
}

async function enTetePdf(doc: PDFKit.PDFDocument, titre: string, sousTitre: string) {
  const ent = await infosEntreprise()
  doc.rect(40, 40, doc.page.width - 80, 70).fill('#1e2430')
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(20).text(ent.nom, 55, 55)
  doc
    .font('Helvetica')
    .fontSize(8)
    .fill('#cbd5e1')
    .text(`${ent.adresse}  •  Tél : ${ent.tel}`, 55, 82, { width: 300, lineBreak: false, ellipsis: true })
    .text(`${ent.email}  •  ${ent.nif}`, 55, 93, { width: 300, lineBreak: false, ellipsis: true })
  doc
    .fill('#f59e0b')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(titre, 360, 60, { align: 'right', width: doc.page.width - 415 })
  doc
    .fill('#e2e8f0')
    .font('Helvetica')
    .fontSize(9)
    .text(sousTitre, 360, 82, { align: 'right', width: doc.page.width - 415 })
  doc.fill('#000000').moveDown(3)
  doc.y = 130
}

function tableauPdf(
  doc: PDFKit.PDFDocument,
  colonnes: { titre: string; largeur: number; align?: 'left' | 'right' | 'center' }[],
  lignes: string[][],
  x = 40
) {
  const hauteurLigne = 20
  let y = doc.y
  const totalLargeur = colonnes.reduce((s, c) => s + c.largeur, 0)
  // entête
  doc.rect(x, y, totalLargeur, hauteurLigne).fill('#2563eb')
  let cx = x
  doc.font('Helvetica-Bold').fontSize(8.5).fill('#ffffff')
  for (const c of colonnes) {
    doc.text(c.titre, cx + 4, y + 6, { width: c.largeur - 8, align: c.align ?? 'left' })
    cx += c.largeur
  }
  y += hauteurLigne
  doc.font('Helvetica').fontSize(8.5)
  lignes.forEach((ligne, i) => {
    if (y > doc.page.height - 70) {
      doc.addPage()
      y = 50
    }
    if (i % 2 === 1) doc.rect(x, y, totalLargeur, hauteurLigne).fill('#f1f5f9')
    doc.fill('#0f172a')
    let lx = x
    ligne.forEach((cellule, j) => {
      doc.text(cellule, lx + 4, y + 6, {
        width: colonnes[j].largeur - 8,
        align: colonnes[j].align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      })
      lx += colonnes[j].largeur
    })
    y += hauteurLigne
  })
  doc.rect(x, doc.y > y ? doc.y : y, 0, 0) // no-op pour garder le flux
  doc.y = y + 8
}

// ────────────────────────────── Devis PDF ───────────────────────────────────

routerExports.get(
  '/exports/devis/:id/pdf',
  h(async (req, res) => {
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { client: true, projet: true, lignes: { orderBy: { ordre: 'asc' } } },
    })
    if (!devis) throw new ApiError(404, 'Devis introuvable.')
    const totaux = totauxDevis(devis)
    const doc = debuterPdf(res, `${devis.numero}.pdf`)
    await enTetePdf(doc, `DEVIS ${devis.numero}`, `Date : ${fmtDate(devis.date)}  •  Version ${devis.version}`)

    // Bloc client
    doc.font('Helvetica-Bold').fontSize(10).fill('#334155').text('CLIENT', 40, doc.y)
    doc.font('Helvetica').fontSize(10).fill('#0f172a')
    doc.text(devis.client?.nom ?? '—')
    if (devis.client?.adresse || devis.client?.ville) doc.text([devis.client?.adresse, devis.client?.ville].filter(Boolean).join(' — '))
    if (devis.client?.nif) doc.text(`NIF : ${devis.client.nif}`)
    if (devis.objet) {
      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').text(`Objet : `, { continued: true }).font('Helvetica').text(devis.objet)
    }
    doc.moveDown(1)

    tableauPdf(
      doc,
      [
        { titre: 'N°', largeur: 30 },
        { titre: "Désignation de l'ouvrage", largeur: 235 },
        { titre: 'Unité', largeur: 50, align: 'center' },
        { titre: 'Quantité', largeur: 60, align: 'right' },
        { titre: 'P.U. (FCFA)', largeur: 70, align: 'right' },
        { titre: 'Total (FCFA)', largeur: 70, align: 'right' },
      ],
      devis.lignes.map((l, i) => [
        String(i + 1),
        l.designation,
        l.unite,
        String(l.quantite),
        fmtF(l.prixUnitaire).replace(' F', ''),
        fmtF(l.quantite * l.prixUnitaire).replace(' F', ''),
      ])
    )

    // Totaux
    const xTot = doc.page.width - 40 - 220
    let y = doc.y + 5
    const ligneTotal = (label: string, valeur: string, gras = false, fond?: string) => {
      if (fond) doc.rect(xTot, y - 3, 220, 18).fill(fond)
      doc
        .font(gras ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9.5)
        .fill(fond ? '#ffffff' : '#0f172a')
      doc.text(label, xTot + 6, y, { width: 120 })
      doc.text(valeur, xTot + 100, y, { width: 114, align: 'right' })
      y += 18
    }
    if (devis.remise > 0) ligneTotal('Montant brut', fmtF(totaux.totalBrut))
    if (devis.remise > 0) ligneTotal('Remise', `- ${fmtF(devis.remise)}`)
    ligneTotal('Total HT', fmtF(totaux.totalHT))
    if (devis.tvaTaux > 0) ligneTotal(`TVA ${devis.tvaTaux} %`, fmtF(totaux.tva))
    else ligneTotal('TVA', 'Exonéré')
    ligneTotal(devis.tvaTaux > 0 ? 'TOTAL TTC' : 'TOTAL NET', fmtF(totaux.totalTTC), true, '#2563eb')
    if (devis.tvaTaux === 0) {
      doc.y = y + 4
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fill('#475569')
        .text('Marché exonéré de TVA (marchés publics / financements exonérés).', xTot, doc.y, { width: 220 })
      y = doc.y + 6
    }

    doc.y = y + 15
    doc.x = 40
    if (devis.notes) {
      doc.font('Helvetica-Oblique').fontSize(8.5).fill('#475569').text(`Notes : ${devis.notes}`, 40, doc.y, { width: doc.page.width - 80 })
    }
    doc
      .font('Helvetica')
      .fontSize(8)
      .fill('#94a3b8')
      .text(
        `Devis valable 30 jours. Arrêté à la somme de ${fmtF(totaux.totalTTC)} toutes taxes comprises.`,
        40,
        doc.page.height - 60,
        { align: 'center', width: doc.page.width - 80 }
      )
    doc.end()
  })
)

// ────────────────────────────── Facture PDF ─────────────────────────────────

routerExports.get(
  '/exports/factures/:id/pdf',
  h(async (req, res) => {
    const f = await prisma.facture.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { client: true, projet: true, contrat: true, paiements: { where: { deletedAt: null } } },
    })
    if (!f) throw new ApiError(404, 'Facture introuvable.')
    const paye = f.paiements.filter((p) => p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
    const retenue = (f.montant * (f.retenueGarantie || 0)) / 100
    const typeLibelle = f.type === 'acompte' ? "FACTURE D'ACOMPTE" : f.type === 'solde' ? 'FACTURE DE SOLDE' : 'FACTURE DE SITUATION'

    const doc = debuterPdf(res, `${f.numero}.pdf`)
    await enTetePdf(doc, `${typeLibelle} ${f.numero}`, `Date : ${fmtDate(f.date)}  •  Échéance : ${fmtDate(f.echeance)}`)

    doc.font('Helvetica-Bold').fontSize(10).fill('#334155').text('CLIENT', 40, doc.y)
    doc.font('Helvetica').fontSize(10).fill('#0f172a')
    doc.text(f.client?.nom ?? '—')
    if (f.client?.adresse || f.client?.ville) doc.text([f.client?.adresse, f.client?.ville].filter(Boolean).join(' — '))
    if (f.client?.nif) doc.text(`NIF : ${f.client.nif}`)
    doc.moveDown(0.5)
    if (f.projet) doc.text(`Projet : ${f.projet.nom}`)
    if (f.contrat) doc.text(`Contrat : ${f.contrat.numero}`)
    if (f.avancementPct != null) doc.text(`Avancement facturé : ${f.avancementPct} %`)
    doc.moveDown(1)

    tableauPdf(
      doc,
      [
        { titre: 'Désignation', largeur: 335 },
        { titre: 'Montant (FCFA)', largeur: 180, align: 'right' },
      ],
      [
        [f.objet ?? `${typeLibelle} — ${f.numero}`, fmtF(f.montant).replace(' F', '')],
        ...(retenue > 0 ? [[`Retenue de garantie (${f.retenueGarantie} %)`, `- ${fmtF(retenue).replace(' F', '')}`]] : []),
      ]
    )

    const xTot = doc.page.width - 40 - 220
    let y = doc.y + 5
    const ligneTotal = (label: string, valeur: string, gras = false, fond?: string) => {
      if (fond) doc.rect(xTot, y - 3, 220, 18).fill(fond)
      doc
        .font(gras ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9.5)
        .fill(fond ? '#ffffff' : '#0f172a')
      doc.text(label, xTot + 6, y, { width: 120 })
      doc.text(valeur, xTot + 100, y, { width: 114, align: 'right' })
      y += 18
    }
    ligneTotal('Montant facturé', fmtF(f.montant))
    if (retenue > 0) ligneTotal('Retenue de garantie', `- ${fmtF(retenue)}`)
    if (paye > 0) ligneTotal('Déjà payé', `- ${fmtF(paye)}`)
    ligneTotal('NET À PAYER', fmtF(Math.max(0, f.montant - retenue - paye)), true, '#16a34a')

    doc.x = 40
    doc
      .font('Helvetica')
      .fontSize(8)
      .fill('#94a3b8')
      .text(
        `Statut : ${f.statut}. Règlement par espèces, virement, chèque ou mobile money.`,
        40,
        doc.page.height - 60,
        { align: 'center', width: doc.page.width - 80 }
      )
    doc.end()
  })
)

// ──────────────────── Rapport journalier de chantier PDF ────────────────────

routerExports.get(
  '/exports/rapports-journaliers/:id/pdf',
  h(async (req, res) => {
    const r = await prisma.rapportJournalier.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { chantier: { include: { chef: { select: { nom: true } }, projet: { select: { nom: true } } } } },
    })
    if (!r) throw new ApiError(404, 'Rapport introuvable.')
    const doc = debuterPdf(res, `rapport-${fmtDate(r.date).replace(/\//g, '-')}-${r.chantier.nom.replace(/[^a-z0-9]/gi, '-')}.pdf`)
    await enTetePdf(doc, 'RAPPORT JOURNALIER', `${r.chantier.nom}  •  ${fmtDate(r.date)}`)

    // Bloc synthèse
    const blocs: [string, string][] = [
      ['Chantier', `${r.chantier.nom}${r.chantier.ville ? ` — ${r.chantier.ville}` : ''}`],
      ['Projet', r.chantier.projet?.nom ?? '—'],
      ['Chef de chantier', r.chantier.chef?.nom ?? '—'],
      ['Rédigé par', r.redacteurNom ?? '—'],
      ['Météo', r.meteo ?? '—'],
      ['Effectif présent', `${r.effectif} personne(s)`],
    ]
    let y = doc.y
    blocs.forEach(([titre, valeur], i) => {
      const x = 40 + (i % 2) * 258
      if (i % 2 === 0 && i > 0) y += 34
      doc.roundedRect(x, y, 250, 30, 4).fill('#f1f5f9')
      doc.fill('#64748b').font('Helvetica').fontSize(7.5).text(titre.toUpperCase(), x + 8, y + 6)
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(9.5).text(valeur, x + 8, y + 16, { width: 236, lineBreak: false, ellipsis: true })
    })
    doc.y = y + 42

    const section = (titre: string, contenu: string | null | undefined, couleur = '#2563eb') => {
      if (!contenu) return
      doc.x = 40
      doc.rect(40, doc.y, 3, 12).fill(couleur)
      doc.fill('#334155').font('Helvetica-Bold').fontSize(10).text(titre.toUpperCase(), 50, doc.y)
      doc.moveDown(0.3)
      doc.fill('#0f172a').font('Helvetica').fontSize(9.5).text(contenu, 50, doc.y, { width: doc.page.width - 100 })
      doc.moveDown(0.8)
    }
    section('Travaux réalisés', r.travauxRealises)
    section('Incidents / observations', r.incidents, '#f59e0b')
    section('Besoins exprimés', r.besoins, '#16a34a')

    // Photos (jusqu'à 4, en grille 2×2)
    let photos: string[] = []
    try {
      photos = JSON.parse(r.photos || '[]')
    } catch { /* ignore */ }
    const fichiers = photos
      .map((p) => path.join(DOSSIER_UPLOADS, path.basename(p)))
      .filter((f) => fs.existsSync(f) && /\.(jpe?g|png)$/i.test(f))
      .slice(0, 4)
    if (fichiers.length) {
      doc.x = 40
      doc.rect(40, doc.y, 3, 12).fill('#7c3aed')
      doc.fill('#334155').font('Helvetica-Bold').fontSize(10).text(`PHOTOS (${fichiers.length})`, 50, doc.y)
      doc.moveDown(0.5)
      const largeurImg = (doc.page.width - 100) / 2
      const hauteurImg = 150
      let yImg = doc.y
      fichiers.forEach((f, i) => {
        if (yImg + hauteurImg > doc.page.height - 60) {
          doc.addPage()
          yImg = 50
        }
        const x = 40 + (i % 2) * (largeurImg + 20)
        try {
          doc.image(f, x, yImg, { fit: [largeurImg, hauteurImg], align: 'center' })
        } catch { /* image illisible */ }
        if (i % 2 === 1) yImg += hauteurImg + 12
      })
      doc.y = yImg + hauteurImg + 10
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fill('#94a3b8')
      .text(
        `Rapport établi le ${fmtDate(r.createdAt)} via SIM-BAT. Visa chef de chantier : ______________  Visa direction : ______________`,
        40,
        doc.page.height - 60,
        { align: 'center', width: doc.page.width - 80 }
      )
    doc.end()
  })
)

// ─────────────────────────── Planning PDF (Gantt) ───────────────────────────

routerExports.get(
  '/exports/chantiers/:id/planning-pdf',
  h(async (req, res) => {
    const chantier = await prisma.chantier.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!chantier) throw new ApiError(404, 'Chantier introuvable.')
    const lots = await prisma.lot.findMany({
      where: { chantierId: chantier.id, deletedAt: null },
      orderBy: { ordre: 'asc' },
      include: { taches: { where: { deletedAt: null }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] } },
    })
    const taches = lots.flatMap((l) => l.taches).filter((t) => t.dateDebut && t.dateFin)
    if (!taches.length) throw new ApiError(422, 'Aucun planning calculé pour ce chantier.')

    const minDate = new Date(Math.min(...taches.map((t) => t.dateDebut!.getTime())))
    const maxDate = new Date(Math.max(...taches.map((t) => t.dateFin!.getTime())))
    const doc = debuterPdf(res, `planning-${chantier.nom.replace(/[^a-z0-9]/gi, '-')}.pdf`, true)
    await enTetePdf(
      doc,
      `PLANNING — ${chantier.nom.toUpperCase()}`,
      `Du ${fmtDate(minDate)} au ${fmtDate(maxDate)}  •  Fin prévue : ${fmtDate(chantier.finPrevue)}`
    )

    const xGauche = 40
    const largeurNom = 190
    const xBarres = xGauche + largeurNom
    const largeurBarres = doc.page.width - xBarres - 45
    const totalMs = Math.max(1, maxDate.getTime() - minDate.getTime())
    const xPour = (d: Date) => xBarres + ((d.getTime() - minDate.getTime()) / totalMs) * largeurBarres

    let y = doc.y + 5
    const hLigne = 16

    // Graduations mensuelles
    doc.font('Helvetica').fontSize(7).fill('#64748b')
    const premier = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    for (let m = new Date(premier); m <= maxDate; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const x = Math.max(xBarres, xPour(m))
      doc.moveTo(x, y).lineTo(x, y + 8 + (taches.length + lots.length) * hLigne).stroke('#e2e8f0')
      doc.fill('#64748b').text(`${String(m.getMonth() + 1).padStart(2, '0')}/${m.getFullYear()}`, x + 2, y)
    }
    y += 12

    for (const lot of lots) {
      if (y > doc.page.height - 60) {
        doc.addPage()
        y = 50
      }
      doc.rect(xGauche, y, doc.page.width - 85, hLigne - 2).fill('#e2e8f0')
      doc.font('Helvetica-Bold').fontSize(8).fill('#1e2430').text(lot.nom.toUpperCase(), xGauche + 4, y + 3)
      y += hLigne
      for (const t of lot.taches) {
        if (y > doc.page.height - 60) {
          doc.addPage()
          y = 50
        }
        doc.font('Helvetica').fontSize(7.5).fill('#0f172a')
        doc.text(`${t.nom}${t.estJalon ? ' (jalon)' : ''}`, xGauche + 8, y + 3, { width: largeurNom - 14, lineBreak: false, ellipsis: true })
        if (t.dateDebut && t.dateFin) {
          const x1 = xPour(t.dateDebut)
          const x2 = Math.max(x1 + 2, xPour(t.dateFin))
          const couleur = t.avancement >= 100 ? '#16a34a' : t.estCritique ? '#dc2626' : '#2563eb'
          const couleurProgression = t.avancement >= 100 ? '#15803d' : t.estCritique ? '#991b1b' : '#1e40af'
          doc.roundedRect(x1, y + 2, x2 - x1, hLigne - 7, 2).fill(couleur)
          if (t.avancement > 0 && t.avancement < 100) {
            doc.roundedRect(x1, y + 2, ((x2 - x1) * t.avancement) / 100, hLigne - 7, 2).fill(couleurProgression)
          }
          // marge en pointillés
          if ((t.margeTotale ?? 0) > 0) {
            const xm = Math.min(doc.page.width - 45, x2 + ((t.margeTotale ?? 0) / ((totalMs / 86400000) || 1)) * largeurBarres)
            doc
              .moveTo(x2, y + (hLigne - 7) / 2 + 2)
              .lineTo(xm, y + (hLigne - 7) / 2 + 2)
              .dash(2, { space: 2 })
              .stroke('#94a3b8')
            doc.undash()
          }
        }
        y += hLigne
      }
    }

    // Aujourd'hui
    const auj = new Date()
    if (auj >= minDate && auj <= maxDate) {
      const x = xPour(auj)
      doc.moveTo(x, 130).lineTo(x, y).stroke('#dc2626')
    }

    // Légende
    y += 10
    doc.fontSize(7.5)
    const legende: [string, string][] = [
      ['#2563eb', 'Normal'],
      ['#dc2626', 'Critique'],
      ['#16a34a', 'Terminé'],
      ['#94a3b8', 'Marge (pointillés)'],
    ]
    let lx = xGauche
    for (const [couleur, label] of legende) {
      doc.rect(lx, y, 10, 8).fill(couleur)
      doc.fill('#334155').text(label, lx + 14, y + 1)
      lx += 90
    }
    doc.end()
  })
)

// ─────────────────────────── Planning Excel ─────────────────────────────────

function initExcel(res: Response, nomFichier: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIM-BAT'
  return wb
}

function styliserEntete(feuille: ExcelJS.Worksheet) {
  const entete = feuille.getRow(1)
  entete.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  entete.height = 20
}

routerExports.get(
  '/exports/chantiers/:id/planning-xlsx',
  h(async (req, res) => {
    const chantier = await prisma.chantier.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!chantier) throw new ApiError(404, 'Chantier introuvable.')
    const lots = await prisma.lot.findMany({
      where: { chantierId: chantier.id, deletedAt: null },
      orderBy: { ordre: 'asc' },
      include: { taches: { where: { deletedAt: null }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] } },
    })
    const wb = initExcel(res, `planning-${chantier.nom.replace(/[^a-z0-9]/gi, '-')}.xlsx`)
    const f = wb.addWorksheet('Planning')
    f.columns = [
      { header: 'Lot', key: 'lot', width: 22 },
      { header: 'Tâche', key: 'tache', width: 34 },
      { header: 'Durée (j)', key: 'duree', width: 10 },
      { header: 'Début', key: 'debut', width: 12 },
      { header: 'Fin', key: 'fin', width: 12 },
      { header: 'Avancement (%)', key: 'avancement', width: 14 },
      { header: 'Marge (j)', key: 'marge', width: 10 },
      { header: 'Critique', key: 'critique', width: 10 },
      { header: 'Jalon', key: 'jalon', width: 8 },
    ]
    styliserEntete(f)
    for (const lot of lots) {
      for (const t of lot.taches) {
        const ligne = f.addRow({
          lot: lot.nom,
          tache: t.nom,
          duree: t.dureeJours,
          debut: t.dateDebut ? fmtDate(t.dateDebut) : '—',
          fin: t.dateFin ? fmtDate(t.dateFin) : '—',
          avancement: t.avancement,
          marge: t.margeTotale ?? '—',
          critique: t.estCritique ? 'OUI' : '',
          jalon: t.estJalon ? '◆' : '',
        })
        if (t.estCritique) ligne.getCell('critique').font = { color: { argb: 'FFDC2626' }, bold: true }
      }
    }
    await wb.xlsx.write(res)
    res.end()
  })
)

// ─────────────────────────── États financiers Excel ─────────────────────────

routerExports.get(
  '/exports/finance-xlsx',
  h(async (_req, res) => {
    const [factures, paiements, depenses, devis] = await Promise.all([
      prisma.facture.findMany({ where: { deletedAt: null }, include: { client: true, paiements: { where: { deletedAt: null } } }, orderBy: { date: 'desc' } }),
      prisma.paiement.findMany({ where: { deletedAt: null }, include: { facture: true }, orderBy: { date: 'desc' } }),
      prisma.depense.findMany({ where: { deletedAt: null }, include: { chantier: true }, orderBy: { date: 'desc' } }),
      prisma.devis.findMany({ where: { deletedAt: null }, include: { client: true, lignes: true }, orderBy: { date: 'desc' } }),
    ])
    const wb = initExcel(res, `etats-financiers-${new Date().getFullYear()}.xlsx`)

    const fFactures = wb.addWorksheet('Factures')
    fFactures.columns = [
      { header: 'Numéro', key: 'numero', width: 15 },
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Type', key: 'type', width: 11 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Échéance', key: 'echeance', width: 12 },
      { header: 'Montant (FCFA)', key: 'montant', width: 16 },
      { header: 'Payé (FCFA)', key: 'paye', width: 16 },
      { header: 'Reste (FCFA)', key: 'reste', width: 16 },
      { header: 'Statut', key: 'statut', width: 18 },
    ]
    styliserEntete(fFactures)
    for (const fa of factures) {
      const paye = fa.paiements.filter((p) => p.sens === 'encaissement').reduce((s, p) => s + p.montant, 0)
      fFactures.addRow({
        numero: fa.numero,
        client: fa.client?.nom ?? '—',
        type: fa.type,
        date: fmtDate(fa.date),
        echeance: fmtDate(fa.echeance),
        montant: fa.montant,
        paye,
        reste: fa.montant - paye,
        statut: fa.statut,
      })
    }
    ;['montant', 'paye', 'reste'].forEach((c) => (fFactures.getColumn(c).numFmt = '# ##0'))

    const fPaiements = wb.addWorksheet('Paiements')
    fPaiements.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Sens', key: 'sens', width: 14 },
      { header: 'Mode', key: 'mode', width: 14 },
      { header: 'Tiers', key: 'tiers', width: 26 },
      { header: 'Facture', key: 'facture', width: 15 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Montant (FCFA)', key: 'montant', width: 16 },
    ]
    styliserEntete(fPaiements)
    for (const p of paiements) {
      fPaiements.addRow({
        date: fmtDate(p.date),
        sens: p.sens,
        mode: p.mode,
        tiers: p.tiers ?? '—',
        facture: p.facture?.numero ?? '—',
        reference: p.reference ?? '—',
        montant: p.montant,
      })
    }
    fPaiements.getColumn('montant').numFmt = '# ##0'

    const fDepenses = wb.addWorksheet('Dépenses')
    fDepenses.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Chantier', key: 'chantier', width: 28 },
      { header: 'Catégorie', key: 'categorie', width: 16 },
      { header: 'Fournisseur', key: 'fournisseur', width: 22 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Montant (FCFA)', key: 'montant', width: 16 },
    ]
    styliserEntete(fDepenses)
    for (const d of depenses) {
      fDepenses.addRow({
        date: fmtDate(d.date),
        chantier: d.chantier?.nom ?? '—',
        categorie: d.categorie,
        fournisseur: d.fournisseur ?? '—',
        description: d.description ?? '—',
        montant: d.montant,
      })
    }
    fDepenses.getColumn('montant').numFmt = '# ##0'

    const fDevis = wb.addWorksheet('Devis')
    fDevis.columns = [
      { header: 'Numéro', key: 'numero', width: 15 },
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Objet', key: 'objet', width: 34 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Total HT (FCFA)', key: 'ht', width: 16 },
      { header: 'Total TTC (FCFA)', key: 'ttc', width: 16 },
      { header: 'Statut', key: 'statut', width: 12 },
    ]
    styliserEntete(fDevis)
    for (const d of devis) {
      const t = totauxDevis(d)
      fDevis.addRow({
        numero: d.numero,
        client: d.client?.nom ?? '—',
        objet: d.objet ?? '—',
        date: fmtDate(d.date),
        ht: Math.round(t.totalHT),
        ttc: Math.round(t.totalTTC),
        statut: d.statut,
      })
    }
    ;['ht', 'ttc'].forEach((c) => (fDevis.getColumn(c).numFmt = '# ##0'))

    await wb.xlsx.write(res)
    res.end()
  })
)

// ────────────────────────────── Stock Excel ─────────────────────────────────

routerExports.get(
  '/exports/stock-xlsx',
  h(async (_req, res) => {
    const [materiaux, mouvements] = await Promise.all([
      prisma.materiau.findMany({ where: { deletedAt: null }, orderBy: { designation: 'asc' } }),
      prisma.stockMouvement.findMany({
        where: { deletedAt: null },
        include: { materiau: true, chantier: true },
        orderBy: { date: 'desc' },
      }),
    ])
    const etats = await etatStocks()
    const wb = initExcel(res, `stock-${new Date().toISOString().slice(0, 10)}.xlsx`)

    const fEtat = wb.addWorksheet('État du stock')
    fEtat.columns = [
      { header: 'Désignation', key: 'designation', width: 30 },
      { header: 'Unité', key: 'unite', width: 10 },
      { header: 'Stock total', key: 'stock', width: 12 },
      { header: "Seuil d'alerte", key: 'seuil', width: 12 },
      { header: 'En alerte', key: 'alerte', width: 10 },
      { header: 'P.U. moyen (FCFA)', key: 'pu', width: 16 },
      { header: 'Valorisation (FCFA)', key: 'valo', width: 18 },
    ]
    styliserEntete(fEtat)
    for (const m of materiaux) {
      const e = etats.get(m.id)
      const ligne = fEtat.addRow({
        designation: m.designation,
        unite: m.unite,
        stock: e?.stockTotal ?? 0,
        seuil: m.seuilAlerte,
        alerte: e?.enAlerte ? 'OUI' : '',
        pu: m.prixUnitaire,
        valo: Math.round(e?.valorisation ?? 0),
      })
      if (e?.enAlerte) ligne.getCell('alerte').font = { color: { argb: 'FFDC2626' }, bold: true }
    }
    ;['pu', 'valo'].forEach((c) => (fEtat.getColumn(c).numFmt = '# ##0'))

    const fMouv = wb.addWorksheet('Mouvements')
    fMouv.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Matériau', key: 'materiau', width: 28 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Quantité', key: 'quantite', width: 10 },
      { header: 'Dépôt / Chantier', key: 'depot', width: 26 },
      { header: 'Fournisseur', key: 'fournisseur', width: 20 },
      { header: 'Motif', key: 'motif', width: 24 },
    ]
    styliserEntete(fMouv)
    for (const mv of mouvements) {
      fMouv.addRow({
        date: fmtDate(mv.date),
        materiau: mv.materiau.designation,
        type: mv.type,
        quantite: mv.quantite,
        depot: mv.chantier?.nom ?? 'Dépôt central',
        fournisseur: mv.fournisseur ?? '—',
        motif: mv.motif ?? '—',
      })
    }
    await wb.xlsx.write(res)
    res.end()
  })
)
