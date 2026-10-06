import { describe, expect, it } from 'vitest'
import {
  exerciceSciIs,
  fiscaliteDistribution,
  fraisAnnuelsSci,
  impotSocietes,
  planAmortissementSciIs,
  plusValueCessionSciIs,
  repartirEntreAssocies,
} from '../../src/engine/sci'
import { parametresFiscaux2026 as p } from '../../src/params'

const PRECISION = 6

describe('SCI à l’impôt sur le revenu', () => {
  it('frais annuels revalorisés ; seule la comptabilité est déduite des revenus fonciers', () => {
    const f = fraisAnnuelsSci({ constitution: 1500, comptabilite_annuelle: 1200, frais_bancaires_annuels: 120 }, 3, 0.02)
    expect(f.deductibles_revenus_fonciers).toBeCloseTo(1200 * 1.0404, PRECISION)
    expect(f.non_deductibles_revenus_fonciers).toBeCloseTo(120 * 1.0404, PRECISION)
    expect(f.total).toBeCloseTo(1320 * 1.0404, PRECISION)
  })

  it('répartit un montant entre associés selon leurs quotes-parts', () => {
    expect(repartirEntreAssocies(1000, [0.5, 0.5])).toEqual([500, 500])
    expect(() => repartirEntreAssocies(1000, [0.6, 0.5])).toThrow(RangeError)
  })
})

describe('variante indicative à l’impôt sur les sociétés (S3 bis)', () => {
  it('taux réduit jusqu’à 42 500 € de bénéfice, taux normal au-delà', () => {
    expect(impotSocietes(30000, p)).toBeCloseTo(4500, PRECISION)
    expect(impotSocietes(100000, p)).toBeCloseTo(6375 + 14375, PRECISION)
    expect(impotSocietes(-5000, p)).toBe(0)
  })

  it('amortit le bâti hors terrain ; les frais d’acquisition suivent l’option retenue (charge l’année 1)', () => {
    const plan = planAmortissementSciIs(275000, 6000, p)
    expect(plan.terrain).toBeCloseTo(275000 * 0.15, PRECISION)
    expect(plan.dotation_annuelle).toBeCloseTo((275000 * 0.85) / 30, PRECISION)
    expect(plan.frais_en_charge).toBe(6000)
  })

  it('un déficit se reporte et s’impute sur les bénéfices suivants', () => {
    const an1 = exerciceSciIs(
      { annee: 2028, loyers: 12000, charges: 9000, amortissements: 6000, deficits_anterieurs: 0 },
      p,
    )
    expect(an1.resultat_comptable).toBe(-3000)
    expect(an1.impot_societes).toBe(0)
    expect(an1.deficits_reportables).toBe(3000)
    const an2 = exerciceSciIs(
      { annee: 2029, loyers: 25000, charges: 9000, amortissements: 6000, deficits_anterieurs: an1.deficits_reportables },
      p,
    )
    expect(an2.benefice_imposable).toBe(7000)
    expect(an2.impot_societes).toBeCloseTo(1050, PRECISION)
    expect(an2.deficits_reportables).toBe(0)
  })

  it('plus-value de cession : prix net diminué de la valeur nette comptable', () => {
    expect(plusValueCessionSciIs(300000, 15000, 280000, 60000)).toBe(65000)
  })

  it('distribution au prélèvement forfaitaire unique : 12,8 % + 18,6 %', () => {
    const d = fiscaliteDistribution(10000, p)
    expect(d.impot_revenu).toBeCloseTo(1280, PRECISION)
    expect(d.prelevements_sociaux).toBeCloseTo(1860, PRECISION)
    expect(d.net).toBeCloseTo(6860, PRECISION)
  })
})
