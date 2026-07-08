import { describe, it, expect } from 'vitest'
import {
  calculerCpm,
  ajouterJoursOuvres,
  prochainJourOuvre,
  indexJourOuvre,
  avancementAttendu,
  CpmError,
  CALENDRIER_DEFAUT,
  type CalendrierOuvre,
  type TacheCpm,
  type DependanceCpm,
} from './engine'

// Lundi 6 juillet 2026 — jour ouvré de référence
const LUNDI = new Date(2026, 6, 6)

const cal6j: CalendrierOuvre = { joursOuvres: [1, 2, 3, 4, 5, 6], feries: [] }
const cal5j: CalendrierOuvre = { joursOuvres: [1, 2, 3, 4, 5], feries: [] }

function t(id: string, duree: number, extra: Partial<TacheCpm> = {}): TacheCpm {
  return { id, nom: id, duree, ...extra }
}
function fd(p: string, s: string, lag = 0): DependanceCpm {
  return { predecesseurId: p, successeurId: s, type: 'FD', lagJours: lag }
}

describe('Calendrier ouvré', () => {
  it('saute le dimanche (6 j/7)', () => {
    // Samedi 11/07/2026 + 1 jour ouvré = lundi 13/07/2026
    const samedi = new Date(2026, 6, 11)
    expect(ajouterJoursOuvres(samedi, 1, cal6j).getDate()).toBe(13)
  })

  it('roule un départ non ouvré au jour ouvré suivant', () => {
    const dimanche = new Date(2026, 6, 12)
    expect(prochainJourOuvre(dimanche, cal6j).getDate()).toBe(13)
  })

  it('saute les jours fériés', () => {
    const cal: CalendrierOuvre = { joursOuvres: [1, 2, 3, 4, 5, 6], feries: ['2026-07-07'] }
    // Lundi 06/07 + 1 jour ouvré : mardi 07/07 est férié → mercredi 08/07
    expect(ajouterJoursOuvres(LUNDI, 1, cal).getDate()).toBe(8)
  })

  it('calcule l’index en jours ouvrés entre deux dates', () => {
    // Du lundi 06/07 au lundi 13/07 en 6j/7 : 6 jours ouvrés d’écart
    expect(indexJourOuvre(LUNDI, new Date(2026, 6, 13), cal6j)).toBe(6)
    // En 5j/7 : 5 jours ouvrés
    expect(indexJourOuvre(LUNDI, new Date(2026, 6, 13), cal5j)).toBe(5)
  })
})

describe('Moteur CPM — passes avant/arrière', () => {
  it('enchaîne des tâches FD (fin→début)', () => {
    const res = calculerCpm([t('A', 3), t('B', 2)], [fd('A', 'B')], LUNDI, cal6j)
    const a = res.taches.find((x) => x.id === 'A')!
    const b = res.taches.find((x) => x.id === 'B')!
    expect(a.es).toBe(0)
    expect(a.ef).toBe(3)
    expect(b.es).toBe(3)
    expect(b.ef).toBe(5)
    expect(res.dureeProjetJours).toBe(5)
    // A : lun 06 → mer 08 ; B : jeu 09 → ven 10
    expect(a.dateDebut.getDate()).toBe(6)
    expect(a.dateFin.getDate()).toBe(8)
    expect(b.dateDebut.getDate()).toBe(9)
    expect(b.dateFin.getDate()).toBe(10)
  })

  it('calcule marges et chemin critique sur branches parallèles', () => {
    // A(2) → B(4) → D(2) et A(2) → C(1) → D(2) : B critique, C marge 3
    const res = calculerCpm(
      [t('A', 2), t('B', 4), t('C', 1), t('D', 2)],
      [fd('A', 'B'), fd('A', 'C'), fd('B', 'D'), fd('C', 'D')],
      LUNDI,
      cal6j
    )
    const parId = Object.fromEntries(res.taches.map((x) => [x.id, x]))
    expect(parId.A.estCritique).toBe(true)
    expect(parId.B.estCritique).toBe(true)
    expect(parId.D.estCritique).toBe(true)
    expect(parId.C.estCritique).toBe(false)
    expect(parId.C.margeTotale).toBe(3)
    expect(res.cheminCritique.sort()).toEqual(['A', 'B', 'D'])
    expect(res.dureeProjetJours).toBe(8)
  })

  it('gère les dépendances DD (début→début) avec décalage', () => {
    const res = calculerCpm(
      [t('A', 5), t('B', 3)],
      [{ predecesseurId: 'A', successeurId: 'B', type: 'DD', lagJours: 2 }],
      LUNDI,
      cal6j
    )
    const b = res.taches.find((x) => x.id === 'B')!
    expect(b.es).toBe(2)
    expect(b.ef).toBe(5)
    // B finit en même temps que A → les deux critiques
    expect(res.cheminCritique.sort()).toEqual(['A', 'B'])
  })

  it('gère les dépendances FF (fin→fin)', () => {
    const res = calculerCpm(
      [t('A', 6), t('B', 2)],
      [{ predecesseurId: 'A', successeurId: 'B', type: 'FF', lagJours: 0 }],
      LUNDI,
      cal6j
    )
    const b = res.taches.find((x) => x.id === 'B')!
    expect(b.ef).toBe(6)
    expect(b.es).toBe(4)
  })

  it('gère le lag FD positif', () => {
    const res = calculerCpm([t('A', 2), t('B', 2)], [fd('A', 'B', 3)], LUNDI, cal6j)
    const b = res.taches.find((x) => x.id === 'B')!
    expect(b.es).toBe(5)
    expect(b.margeTotale).toBe(0)
  })

  it('respecte la contrainte de début souhaité', () => {
    // B ne peut pas commencer avant le lundi 13/07 (index 6 en 6j/7)
    const res = calculerCpm(
      [t('A', 2), t('B', 2, { contrainteDebut: new Date(2026, 6, 13) })],
      [fd('A', 'B')],
      LUNDI,
      cal6j
    )
    const b = res.taches.find((x) => x.id === 'B')!
    expect(b.es).toBe(6)
    // A dispose alors de marge (peut glisser jusqu'à ES=4)
    const a = res.taches.find((x) => x.id === 'A')!
    expect(a.margeTotale).toBe(4)
  })

  it('traite les jalons (durée 0)', () => {
    const res = calculerCpm([t('A', 3), t('J', 0)], [fd('A', 'J')], LUNDI, cal6j)
    const j = res.taches.find((x) => x.id === 'J')!
    expect(j.es).toBe(3)
    expect(j.ef).toBe(3)
    expect(j.estCritique).toBe(true)
    expect(j.dateDebut.getTime()).toBe(j.dateFin.getTime())
  })

  it('détecte les cycles avec un message explicite', () => {
    expect(() =>
      calculerCpm([t('A', 1), t('B', 1), t('C', 1)], [fd('A', 'B'), fd('B', 'C'), fd('C', 'A')], LUNDI, cal6j)
    ).toThrow(CpmError)
    try {
      calculerCpm([t('A', 1), t('B', 1)], [fd('A', 'B'), fd('B', 'A')], LUNDI, cal6j)
    } catch (e: any) {
      expect(e.message).toContain('Cycle de dépendances détecté')
      expect(e.message).toContain('A')
    }
  })

  it('accepte un graphe sans dépendances', () => {
    const res = calculerCpm([t('A', 2), t('B', 5)], [], LUNDI, cal6j)
    expect(res.dureeProjetJours).toBe(5)
    const a = res.taches.find((x) => x.id === 'A')!
    expect(a.margeTotale).toBe(3)
  })

  it('ignore les dépendances vers des tâches inexistantes', () => {
    const res = calculerCpm([t('A', 2)], [fd('A', 'FANTOME')], LUNDI, cal6j)
    expect(res.taches).toHaveLength(1)
  })

  it('projette correctement sur un calendrier 5 j/7 avec férié', () => {
    const cal: CalendrierOuvre = { joursOuvres: [1, 2, 3, 4, 5], feries: ['2026-07-08'] }
    // A dure 4 j à partir du lundi 06/07 : 06, 07, (08 férié), 09, 10
    const res = calculerCpm([t('A', 4)], [], LUNDI, cal)
    const a = res.taches[0]
    expect(a.dateDebut.getDate()).toBe(6)
    expect(a.dateFin.getDate()).toBe(10)
  })
})

describe('Avancement attendu à date', () => {
  it('vaut 0 avant le début et 100 après la fin', () => {
    const d1 = new Date(2026, 6, 6)
    const d2 = new Date(2026, 6, 11)
    expect(avancementAttendu(d1, d2, new Date(2026, 6, 1), cal6j)).toBe(0)
    expect(avancementAttendu(d1, d2, new Date(2026, 6, 20), cal6j)).toBe(100)
  })

  it('est proportionnel aux jours ouvrés écoulés', () => {
    // Tâche du lun 06/07 au sam 11/07 (6 jours ouvrés), au mercredi 08/07 : 2/6 ≈ 33 %
    const pct = avancementAttendu(new Date(2026, 6, 6), new Date(2026, 6, 11), new Date(2026, 6, 8), cal6j)
    expect(pct).toBe(33)
  })
})
