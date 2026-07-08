import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { dateCourte, semaineIso, MOIS_FR } from '../lib/format'
import { cx } from '../ui'

export type EchelleGantt = 'jours' | 'semaines' | 'mois'

export interface TacheGantt {
  id: string
  nom: string
  debut: Date | null
  fin: Date | null
  duree: number
  avancement: number
  critique: boolean
  jalon: boolean
  marge: number | null
}

export interface GroupeGantt {
  id: string
  label: string
  taches: TacheGantt[]
}

const PX_PAR_JOUR: Record<EchelleGantt, number> = { jours: 36, semaines: 12, mois: 3.4 }
const H_GROUPE = 34
const H_TACHE = 46
const H_ENTETE = 46

const JOUR_MS = 86400000

function debutJour(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Statut visuel d'une tâche : terminé > critique > en retard > normal. */
export function statutVisuel(t: TacheGantt, aujourdHui: Date): 'termine' | 'critique' | 'retard' | 'normal' {
  if (t.avancement >= 100) return 'termine'
  const enRetard = estEnRetard(t, aujourdHui)
  if (t.critique) return 'critique'
  if (enRetard) return 'retard'
  return 'normal'
}

export function estEnRetard(t: TacheGantt, aujourdHui: Date): boolean {
  if (t.avancement >= 100 || !t.debut || !t.fin) return false
  const auj = debutJour(aujourdHui).getTime()
  const debut = debutJour(t.debut).getTime()
  const fin = debutJour(t.fin).getTime()
  if (auj > fin) return true
  if (auj <= debut) return false
  const attendu = ((auj - debut) / Math.max(JOUR_MS, fin - debut)) * 100
  return t.avancement < attendu - 5
}

const COULEURS = {
  normal: { barre: '#2563eb', progression: '#1e40af' },
  critique: { barre: '#dc2626', progression: '#991b1b' },
  retard: { barre: '#f59e0b', progression: '#b45309' },
  termine: { barre: '#16a34a', progression: '#15803d' },
}

interface Ligne {
  type: 'groupe' | 'tache'
  groupe: GroupeGantt
  tache?: TacheGantt
  y: number
  hauteur: number
}

export function Gantt({
  groupes,
  echelle,
  baseline,
  onEditer,
  refExport,
  onDeplacer,
  onRedimensionner,
}: {
  groupes: GroupeGantt[]
  echelle: EchelleGantt
  baseline?: Map<string, { debut: Date; fin: Date }>
  onEditer?: (tacheId: string) => void
  refExport?: React.MutableRefObject<(() => void) | null>
  /** Glisser une barre : décale le début souhaité de N jours (recalcul CPM ensuite) */
  onDeplacer?: (tacheId: string, deltaJours: number) => void
  /** Étirer le bord droit : change la durée de N jours */
  onRedimensionner?: (tacheId: string, deltaJours: number) => void
}) {
  const [replies, setReplies] = useState<Set<string>>(new Set())
  const refSvg = useRef<SVGSVGElement>(null)
  const aujourdHui = debutJour(new Date())
  const pxJour = PX_PAR_JOUR[echelle]

  // ── Glisser-déposer ────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<{ id: string; mode: 'deplacer' | 'redimensionner'; x0: number; delta: number } | null>(null)
  const interactif = !!(onDeplacer || onRedimensionner)

  useEffect(() => {
    if (!drag) return
    const bouger = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, delta: Math.round((e.clientX - d.x0) / pxJour) } : d))
    }
    const lacher = () => {
      setDrag((d) => {
        if (d && d.delta !== 0) {
          if (d.mode === 'deplacer') onDeplacer?.(d.id, d.delta)
          else onRedimensionner?.(d.id, d.delta)
        }
        return null
      })
    }
    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', lacher, { once: true })
    return () => {
      window.removeEventListener('pointermove', bouger)
      window.removeEventListener('pointerup', lacher)
    }
  }, [drag?.id, drag?.mode, pxJour, onDeplacer, onRedimensionner])

  const { lignes, minDate, totalJours, hauteurCorps } = useMemo(() => {
    const toutes = groupes.flatMap((g) => g.taches).filter((t) => t.debut && t.fin)
    let min = toutes.length ? Math.min(...toutes.map((t) => debutJour(t.debut!).getTime())) : aujourdHui.getTime() - 7 * JOUR_MS
    let max = toutes.length
      ? Math.max(...toutes.map((t) => debutJour(t.fin!).getTime() + Math.max(0, t.marge ?? 0) * JOUR_MS))
      : aujourdHui.getTime() + 21 * JOUR_MS
    min = Math.min(min, aujourdHui.getTime())
    max = Math.max(max, aujourdHui.getTime())
    // Caler sur le lundi précédent + marge de fin
    const dMin = new Date(min - 3 * JOUR_MS)
    const recul = (dMin.getDay() + 6) % 7
    const minDate = new Date(dMin.getTime() - recul * JOUR_MS)
    const maxDate = new Date(max + 6 * JOUR_MS)
    const totalJours = Math.ceil((maxDate.getTime() - minDate.getTime()) / JOUR_MS)

    const lignes: Ligne[] = []
    let y = 0
    for (const g of groupes) {
      lignes.push({ type: 'groupe', groupe: g, y, hauteur: H_GROUPE })
      y += H_GROUPE
      if (!replies.has(g.id)) {
        for (const t of g.taches) {
          lignes.push({ type: 'tache', groupe: g, tache: t, y, hauteur: H_TACHE })
          y += H_TACHE
        }
      }
    }
    return { lignes, minDate, totalJours, hauteurCorps: y }
  }, [groupes, replies, echelle])

  const largeur = totalJours * pxJour
  const X = (d: Date) => ((debutJour(d).getTime() - minDate.getTime()) / JOUR_MS) * pxJour

  const basculer = (id: string) =>
    setReplies((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // ── Graduations ────────────────────────────────────────────────────────────
  const graduations = useMemo(() => {
    const mois: { x: number; largeur: number; label: string }[] = []
    const semaines: { x: number; label: string }[] = []
    const jours: { x: number; label: string; dimanche: boolean }[] = []
    let d = new Date(minDate)
    // Mois
    let debutMois = new Date(d.getFullYear(), d.getMonth(), 1)
    while (debutMois.getTime() < minDate.getTime() + totalJours * JOUR_MS) {
      const finMois = new Date(debutMois.getFullYear(), debutMois.getMonth() + 1, 1)
      const x1 = Math.max(0, X(debutMois))
      const x2 = Math.min(largeur, X(finMois))
      if (x2 > x1 + 24) {
        mois.push({ x: x1, largeur: x2 - x1, label: `${MOIS_FR[debutMois.getMonth()]} ${debutMois.getFullYear()}` })
      }
      debutMois = finMois
    }
    // Semaines (lundis)
    d = new Date(minDate)
    while ((d.getDay() + 6) % 7 !== 0) d = new Date(d.getTime() + JOUR_MS)
    while (d.getTime() < minDate.getTime() + totalJours * JOUR_MS) {
      semaines.push({ x: X(d), label: `S${semaineIso(d)}` })
      d = new Date(d.getTime() + 7 * JOUR_MS)
    }
    // Jours
    if (echelle === 'jours') {
      for (let i = 0; i < totalJours; i++) {
        const jd = new Date(minDate.getTime() + i * JOUR_MS)
        jours.push({ x: i * pxJour, label: String(jd.getDate()), dimanche: jd.getDay() === 0 })
      }
    }
    return { mois, semaines, jours }
  }, [minDate, totalJours, pxJour, echelle])

  const xAujourdhui = X(aujourdHui) + pxJour / 2

  // ── Export PNG ─────────────────────────────────────────────────────────────
  const exporterPng = () => {
    const svg = refSvg.current
    if (!svg) return
    const largeurLabels = 300
    const serialise = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const blob = new Blob([serialise], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = largeurLabels + largeur
      canvas.height = H_ENTETE + hauteurCorps
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Colonne des libellés
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, largeurLabels, canvas.height)
      ctx.fillStyle = '#334155'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('Lot / Tâche', 12, 28)
      for (const l of lignes) {
        const y = H_ENTETE + l.y
        if (l.type === 'groupe') {
          ctx.fillStyle = '#1e2430'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText(l.groupe.label.toUpperCase(), 12, y + 22)
        } else if (l.tache) {
          ctx.fillStyle = '#0f172a'
          ctx.font = '12px sans-serif'
          ctx.fillText(l.tache.nom.slice(0, 38), 20, y + 20)
          ctx.fillStyle = '#64748b'
          ctx.font = '10px sans-serif'
          ctx.fillText(`${dateCourte(l.tache.debut)} – ${dateCourte(l.tache.fin)} · ${l.tache.duree} j · ${Math.round(l.tache.avancement)} %`, 20, y + 34)
        }
      }
      ctx.drawImage(img, largeurLabels, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((png) => {
        if (!png) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(png)
        a.download = 'chronogramme.png'
        a.click()
        URL.revokeObjectURL(a.href)
      })
    }
    img.src = url
  }
  if (refExport) refExport.current = exporterPng

  return (
    <div>
      <div className="carte overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ width: 300 + largeur, minWidth: '100%' }} className="flex">
            {/* Colonne gauche sticky */}
            <div className="sticky left-0 z-10 w-[300px] shrink-0 border-r border-slate-200 bg-white">
              <div className="flex h-[46px] items-center border-b border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lot / Tâche
              </div>
              {lignes.map((l) =>
                l.type === 'groupe' ? (
                  <button
                    key={`g-${l.groupe.id}`}
                    className="flex w-full items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-2.5 text-left"
                    style={{ height: l.hauteur }}
                    onClick={() => basculer(l.groupe.id)}
                  >
                    {replies.has(l.groupe.id) ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    <span className="truncate text-xs font-bold uppercase tracking-wide text-slate-700">{l.groupe.label}</span>
                    <span className="ml-auto rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {l.groupe.taches.length}
                    </span>
                  </button>
                ) : (
                  <div
                    key={`t-${l.tache!.id}`}
                    className="flex flex-col justify-center border-b border-slate-100 px-3 py-1"
                    style={{ height: l.hauteur }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cx('truncate text-[13px]', l.tache!.jalon ? 'font-semibold text-purple-700' : 'text-slate-800')}>
                        {l.tache!.jalon && '◆ '}
                        {l.tache!.nom}
                      </span>
                      {onEditer && (
                        <button
                          className="ml-auto shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-primaire"
                          onClick={() => onEditer(l.tache!.id)}
                          title="Modifier la tâche"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {dateCourte(l.tache!.debut)} – {dateCourte(l.tache!.fin)} · {l.tache!.duree} j
                      {(l.tache!.marge ?? 0) > 0 && <span className="text-slate-400"> (marge {l.tache!.marge} j)</span>}
                      <span className="font-medium text-slate-500"> · {Math.round(l.tache!.avancement)} %</span>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Timeline SVG */}
            <svg
              ref={refSvg}
              width={largeur}
              height={H_ENTETE + hauteurCorps}
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 bg-white"
            >
              {/* Dimanches */}
              {echelle !== 'mois' &&
                Array.from({ length: totalJours }, (_, i) => {
                  const jd = new Date(minDate.getTime() + i * JOUR_MS)
                  return jd.getDay() === 0 ? (
                    <rect key={i} x={i * pxJour} y={H_ENTETE} width={pxJour} height={hauteurCorps} fill="#f1f5f9" />
                  ) : null
                })}

              {/* En-tête : mois */}
              <rect x={0} y={0} width={largeur} height={H_ENTETE} fill="#f8fafc" />
              {graduations.mois.map((m, i) => (
                <g key={i}>
                  <line x1={m.x} y1={0} x2={m.x} y2={H_ENTETE + hauteurCorps} stroke="#e2e8f0" />
                  <text x={m.x + m.largeur / 2} y={16} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569">
                    {m.largeur > 60 ? m.label : m.label.slice(0, 4)}
                  </text>
                </g>
              ))}
              {/* En-tête : semaines */}
              {graduations.semaines.map((s, i) => (
                <g key={i}>
                  <line x1={s.x} y1={22} x2={s.x} y2={H_ENTETE + hauteurCorps} stroke="#eef2f7" />
                  {pxJour * 7 > 26 && (
                    <text x={s.x + (pxJour * 7) / 2} y={38} textAnchor="middle" fontSize={10} fill="#94a3b8">
                      {s.label}
                    </text>
                  )}
                </g>
              ))}
              {/* En-tête : jours */}
              {graduations.jours.map((j, i) => (
                <text key={i} x={j.x + pxJour / 2} y={38} textAnchor="middle" fontSize={9} fill={j.dimanche ? '#cbd5e1' : '#94a3b8'}>
                  {j.label}
                </text>
              ))}
              <line x1={0} y1={H_ENTETE} x2={largeur} y2={H_ENTETE} stroke="#e2e8f0" />

              {/* Lignes */}
              {lignes.map((l) => {
                const y = H_ENTETE + l.y
                if (l.type === 'groupe') {
                  const taches = l.groupe.taches.filter((t) => t.debut && t.fin)
                  if (!taches.length)
                    return <rect key={`g-${l.groupe.id}`} x={0} y={y} width={largeur} height={l.hauteur} fill="#f8fafc" opacity={0.6} />
                  const x1 = Math.min(...taches.map((t) => X(t.debut!)))
                  const x2 = Math.max(...taches.map((t) => X(t.fin!) + pxJour))
                  return (
                    <g key={`g-${l.groupe.id}`}>
                      <rect x={0} y={y} width={largeur} height={l.hauteur} fill="#f8fafc" opacity={0.6} />
                      <rect x={x1} y={y + l.hauteur / 2 - 3} width={x2 - x1} height={6} rx={2} fill="#334155" />
                      <line x1={0} y1={y + l.hauteur} x2={largeur} y2={y + l.hauteur} stroke="#f1f5f9" />
                    </g>
                  )
                }
                const t = l.tache!
                if (!t.debut || !t.fin) {
                  return <line key={t.id} x1={0} y1={y + l.hauteur} x2={largeur} y2={y + l.hauteur} stroke="#f8fafc" />
                }
                const sv = statutVisuel(t, aujourdHui)
                const coul = COULEURS[sv]
                const x1 = X(t.debut)
                const x2 = X(t.fin) + pxJour
                const largeurBarre = Math.max(pxJour * 0.5, x2 - x1)
                const hBarre = 16
                const yBarre = y + (l.hauteur - hBarre) / 2
                const base = baseline?.get(t.id)
                const libelleSv = { normal: 'Normal', critique: 'Critique', retard: 'En retard', termine: 'Terminé' }[sv]
                return (
                  <g key={t.id} className="cursor-pointer">
                    <title>
                      {`${t.nom}\n${dateCourte(t.debut)} → ${dateCourte(t.fin)} · ${t.duree} j\nAvancement : ${Math.round(t.avancement)} %  ·  ${libelleSv}${(t.marge ?? 0) > 0 ? `\nMarge totale : ${t.marge} j` : '\nSur le chemin critique'}`}
                    </title>
                    <line x1={0} y1={y + l.hauteur} x2={largeur} y2={y + l.hauteur} stroke="#f8fafc" />
                    {/* Baseline (prévu) */}
                    {base && (
                      <rect
                        x={X(base.debut)}
                        y={yBarre + hBarre + 2}
                        width={Math.max(4, X(base.fin) + pxJour - X(base.debut))}
                        height={5}
                        rx={2}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={1.4}
                      />
                    )}
                    {t.jalon ? (
                      <path
                        d={`M ${x1 + pxJour / 2 + (drag?.id === t.id ? drag.delta * pxJour : 0)} ${yBarre - 2} l 10 10 l -10 10 l -10 -10 z`}
                        fill={sv === 'termine' ? COULEURS.termine.barre : '#7c3aed'}
                        style={interactif ? { cursor: 'grab' } : undefined}
                        onPointerDown={
                          onDeplacer
                            ? (e) => {
                                e.preventDefault()
                                setDrag({ id: t.id, mode: 'deplacer', x0: e.clientX, delta: 0 })
                              }
                            : undefined
                        }
                      />
                    ) : (
                      (() => {
                        const enDrag = drag?.id === t.id
                        const dx = enDrag && drag!.mode === 'deplacer' ? drag!.delta * pxJour : 0
                        const dLargeur = enDrag && drag!.mode === 'redimensionner' ? drag!.delta * pxJour : 0
                        const largeurEff = Math.max(pxJour * 0.5, largeurBarre + dLargeur)
                        return (
                          <>
                            <rect
                              x={x1 + dx}
                              y={yBarre}
                              width={largeurEff}
                              height={hBarre}
                              rx={4}
                              fill={coul.barre}
                              opacity={enDrag ? 0.65 : 0.85}
                              style={onDeplacer ? { cursor: enDrag ? 'grabbing' : 'grab' } : undefined}
                              onPointerDown={
                                onDeplacer
                                  ? (e) => {
                                      e.preventDefault()
                                      setDrag({ id: t.id, mode: 'deplacer', x0: e.clientX, delta: 0 })
                                    }
                                  : undefined
                              }
                            />
                            {t.avancement > 0 && (
                              <rect
                                x={x1 + dx}
                                y={yBarre}
                                width={largeurEff * Math.min(1, t.avancement / 100)}
                                height={hBarre}
                                rx={4}
                                fill={coul.progression}
                                pointerEvents="none"
                              />
                            )}
                            {largeurEff > 46 && (
                              <text x={x1 + dx + 6} y={yBarre + 12} fontSize={9.5} fontWeight={600} fill="#ffffff" pointerEvents="none">
                                {enDrag && drag!.delta !== 0
                                  ? `${drag!.delta > 0 ? '+' : ''}${drag!.delta} j`
                                  : `${Math.round(t.avancement)} %`}
                              </text>
                            )}
                            {onRedimensionner && (
                              <rect
                                x={x1 + dx + largeurEff - 5}
                                y={yBarre}
                                width={8}
                                height={hBarre}
                                fill="transparent"
                                style={{ cursor: 'ew-resize' }}
                                onPointerDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDrag({ id: t.id, mode: 'redimensionner', x0: e.clientX, delta: 0 })
                                }}
                              />
                            )}
                            {/* Marge totale en pointillés */}
                            {(t.marge ?? 0) > 0 && (
                              <line
                                x1={x2}
                                y1={yBarre + hBarre / 2}
                                x2={x2 + (t.marge ?? 0) * pxJour}
                                y2={yBarre + hBarre / 2}
                                stroke="#94a3b8"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                              />
                            )}
                          </>
                        )
                      })()
                    )}
                  </g>
                )
              })}

              {/* Ligne aujourd'hui */}
              <line x1={xAujourdhui} y1={12} x2={xAujourdhui} y2={H_ENTETE + hauteurCorps} stroke="#dc2626" strokeWidth={1.6} />
              <rect x={xAujourdhui - 34} y={0} width={68} height={14} rx={7} fill="#dc2626" />
              <text x={xAujourdhui} y={10} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ffffff">
                AUJOURD'HUI
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-[#2563eb]" /> Normal</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-[#dc2626]" /> Critique</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-[#f59e0b]" /> En retard</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-[#16a34a]" /> Terminé</span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" /></svg>
          Marge
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="text-purple-700 font-bold">◆</span> Jalon</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-red-600" /> Aujourd'hui</span>
        {baseline && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="26" height="9"><rect x="1" y="1" width="24" height="6" rx="2" fill="none" stroke="#94a3b8" strokeWidth="1.4" /></svg>
            Baseline
          </span>
        )}
      </div>
    </div>
  )
}
