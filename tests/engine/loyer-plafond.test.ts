import { describe, expect, it } from 'vitest'
import {
  coefficientSurface,
  loyerRetenu,
  plafondLoyer,
  plafondLoyerIntermediaire,
  plafondRessourcesIntermediaire,
  surfacePriseEnCompte,
} from '../../src/engine/loyer-plafond'
import { parametresFiscaux2026 as p } from '../../src/params'

describe('coefficient de surface (cahier des charges §13)', () => {
  it.each([
    [45, 1.12],
    [30, 1.2],
    [65, 0.99],
  ])('%i m² → %f', (surface, attendu) => {
    expect(coefficientSurface(surface, p)).toBe(attendu)
  })
})

describe('loyer plafond intermédiaire', () => {
  it('zone A, 45 m² : 738,00 €/mois (arbitrage du 06/10/2026 : arrondi du BOFiP)', () => {
    const plafond = plafondLoyerIntermediaire('A', { habitable: 45 }, p)
    expect(plafond.coefficient).toBe(1.12)
    expect(plafond.plafond_m2_ajuste).toBe(16.4)
    expect(plafond.loyer_plafond_mensuel).toBe(738)
    // Option écartée : 737,86 € sans arrondi intermédiaire (cahier des charges §13).
    expect(14.64 * 1.12 * 45).toBeCloseTo(737.86, 2)
  })

  it.each([
    ['A bis', 80, 16.52, 0.94, 15.53, 1242.4],
    ['A bis', 40, 16.52, 1.18, 19.49, 779.6],
    ['A', 70, 12.27, 0.97, 11.9, 833],
    ['A', 35, 12.27, 1.2, 14.72, 515.2],
    ['B1', 50, 9.88, 1.08, 10.67, 533.5],
    ['B1', 25, 9.88, 1.2, 11.86, 296.5],
    ['B2', 40, 8.59, 1.18, 10.14, 405.6],
    ['B2', 20, 8.59, 1.2, 10.31, 206.2],
  ])(
    'exemple officiel (BOI-IR-RICI-360-20-30, §130, barème 2013) : zone %s, %i m²',
    (_, surface, bareme, coefficient, ajuste, loyer) => {
      const plafond = plafondLoyer(bareme, { habitable: surface }, p)
      expect(plafond.coefficient).toBe(coefficient)
      expect(plafond.plafond_m2_ajuste).toBe(ajuste)
      expect(plafond.loyer_plafond_mensuel).toBe(loyer)
    },
  )
})

describe('surface prise en compte (BOI-IR-RICI-230-20-20, §320 à 360)', () => {
  it('ajoute la moitié des annexes', () => {
    expect(surfacePriseEnCompte({ habitable: 40, annexes: 6 }, p)).toBe(43)
  })

  it('plafonne cette moitié à 8 m²', () => {
    expect(surfacePriseEnCompte({ habitable: 40, annexes: 20 }, p)).toBe(48)
  })

  it('refuse une surface habitable nulle', () => {
    expect(() => surfacePriseEnCompte({ habitable: 0 }, p)).toThrow(RangeError)
  })
})

describe('loyer retenu et manque à gagner (§8.1)', () => {
  it('le plafond s’impose quand il est inférieur au marché', () => {
    const retenu = loyerRetenu(800, 738)
    expect(retenu.loyer_mensuel).toBe(738)
    expect(retenu.plafond_contraignant).toBe(true)
    expect(retenu.decote_mensuelle).toBe(62)
    expect(retenu.decote_relative).toBeCloseTo(0.0775, 4)
  })

  it('le loyer de marché s’applique quand il est inférieur au plafond', () => {
    const retenu = loyerRetenu(700, 738)
    expect(retenu.loyer_mensuel).toBe(700)
    expect(retenu.plafond_contraignant).toBe(false)
    expect(retenu.decote_mensuelle).toBe(0)
  })
})

describe('plafonds de ressources du locataire (BOI-BAREME-000017, §270)', () => {
  it.each([
    [{ couple: false, personnes_a_charge: 0 }, 44344],
    [{ couple: true, personnes_a_charge: 0 }, 66276],
    [{ couple: true, personnes_a_charge: 2 }, 95427],
    [{ couple: false, personnes_a_charge: 4 }, 127122],
    [{ couple: true, personnes_a_charge: 6 }, 127122 + 2 * 14164],
  ])('zone A, %o → %i €', (composition, attendu) => {
    expect(plafondRessourcesIntermediaire('A', composition, p)).toBe(attendu)
  })
})
