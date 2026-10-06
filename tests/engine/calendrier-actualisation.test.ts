import { describe, expect, it } from 'vitest'
import {
  rechercheDichotomique,
  tauxRendementInterne,
  valeurActuelleNette,
} from '../../src/engine/actualisation'
import { calendrierOperation, dateDuRang, rangMois } from '../../src/engine/calendrier'

const PRECISION = 6

describe('calendrier d’une opération en VEFA', () => {
  const c = calendrierOperation('2026-11-15', '2028-06-30', '2028-09-01', 16)

  it('revente le jour anniversaire du début de la location, après 16 ans', () => {
    expect(c.date_cession).toBe('2044-09-01')
    expect(c.annees[0]?.annee).toBe(2026)
    expect(c.annees.at(-1)?.annee).toBe(2044)
    expect(c.duree_detention_ans).toBeCloseTo(214 / 12, PRECISION)
  })

  it('mois de détention, d’après livraison et de location de chaque année', () => {
    const an = (annee: number) => c.annees.find((a) => a.annee === annee)
    expect(an(2026)).toMatchObject({ mois_detention: 2, mois_apres_livraison: 0, mois_location: 0, rang_location: 0 })
    expect(an(2028)).toMatchObject({ mois_detention: 12, mois_apres_livraison: 7, mois_location: 4, rang_location: 1 })
    expect(an(2044)).toMatchObject({ mois_detention: 8, mois_location: 8, rang_location: 17 })
  })

  it('les dates sont ramenées au premier jour du mois', () => {
    expect(dateDuRang(rangMois('2026-11-15'))).toBe('2026-11-01')
    expect(c.date_livraison).toBe('2028-06-01')
  })

  it('refuse un horizon qui n’est pas un nombre entier d’années', () => {
    expect(() => calendrierOperation('2026-11-15', '2028-06-30', '2028-09-01', 0)).toThrow(RangeError)
    expect(() => calendrierOperation('2026-11-15', '2028-06-30', '2028-09-01', 1.5)).toThrow(RangeError)
  })
})

describe('actualisation', () => {
  const flux = [
    { temps: 0, montant: -100 },
    { temps: 1, montant: 110 },
  ]

  it('taux de rendement interne et valeur actuelle nette', () => {
    expect(tauxRendementInterne(flux)).toBeCloseTo(0.1, PRECISION)
    expect(valeurActuelleNette(flux, 0.1)).toBeCloseTo(0, PRECISION)
    expect(valeurActuelleNette(flux, 0)).toBeCloseTo(10, PRECISION)
  })

  it('pas de taux de rendement interne sans changement de signe', () => {
    expect(tauxRendementInterne([{ temps: 0, montant: -100 }])).toBeNull()
  })

  it('recherche dichotomique d’un seuil sur une fonction croissante', () => {
    expect(rechercheDichotomique((x) => x * x, 4, 0, 10)).toBeCloseTo(2, PRECISION)
    expect(rechercheDichotomique((x) => x, 20, 0, 10)).toBeNull()
  })
})
