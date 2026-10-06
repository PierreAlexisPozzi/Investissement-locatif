import { describe, expect, it } from 'vitest'
import {
  assiettesSurtaxe,
  calculerPlusValue,
  surcoutReintegration,
  surtaxePlusValueElevee,
  tauxAbattement,
  type EntreePlusValue,
} from '../../src/engine/plus-value'
import { parametresFiscaux2026 as p } from '../../src/params'

const PRECISION = 6
const ir = p.plus_value_immobiliere.abattement_ir.valeur.tranches
const ps = p.plus_value_immobiliere.abattement_ps.valeur.tranches

const base: EntreePlusValue = {
  prix_cession: 300000,
  frais_cession: 15000,
  prix_acquisition: 250000,
  forfait_travaux_autorise: false,
  amortissements_deduits: 0,
  annees_detention: 9,
  cedants: { nature: 'epoux', quotes_parts: [0.5, 0.5] },
}

describe('abattements pour durée de détention (cahier des charges §13, F10864)', () => {
  it.each([
    [5, 0, 0],
    [9, 0.24, 0.066],
    [10, 0.3, 0.0825],
    [16, 0.66, 0.1815],
    [22, 1, 0.28],
    [25, 1, 0.55],
    [30, 1, 1],
    [35, 1, 1],
  ])('%i ans de détention : IR %f, prélèvements sociaux %f', (annees, attenduIr, attenduPs) => {
    expect(tauxAbattement(annees, ir)).toBeCloseTo(attenduIr, PRECISION)
    expect(tauxAbattement(annees, ps)).toBeCloseTo(attenduPs, PRECISION)
  })

  it('compte les années révolues', () => {
    expect(tauxAbattement(9.9, ir)).toBeCloseTo(0.24, PRECISION)
  })
})

describe('surtaxe sur les plus-values élevées', () => {
  it.each([
    [50000, 0],
    [55000, 850],
    [80000, 1600],
    [105000, 2650],
    [103400, 2442],
  ])('plus-value imposable de %i € → %i €', (pv, attendu) => {
    expect(surtaxePlusValueElevee(pv, p)).toBeCloseTo(attendu, PRECISION)
  })

  it('époux : seuil apprécié sur la quote-part de chacun (BOI-RFPI-TPVIE-20, exemple 2)', () => {
    const assiettes = assiettesSurtaxe(122000, { nature: 'epoux', quotes_parts: [0.5, 0.5] }, p)
    expect(assiettes).toEqual([61000, 61000])
    expect(assiettes.reduce((t, a) => t + surtaxePlusValueElevee(a, p), 0)).toBeCloseTo(2440, PRECISION)
  })

  it('SCI à l’IR : seuil apprécié au niveau de la société (arbitrage du 06/10/2026)', () => {
    const assiettes = assiettesSurtaxe(90000, { nature: 'sci_ir', quotes_parts: [0.5, 0.5] }, p)
    expect(assiettes).toEqual([90000])
    expect(surtaxePlusValueElevee(90000, p)).toBeCloseTo(1800, PRECISION)
    // Option écartée : deux assiettes de 45 000 €, sous le seuil, donc aucune surtaxe.
  })

  it('exemple officiel 3 (SCI, 52 500 €) → 675 €', () => {
    const assiettes = assiettesSurtaxe(52500, { nature: 'sci_ir', quotes_parts: [1] }, p)
    expect(surtaxePlusValueElevee(assiettes[0] ?? 0, p)).toBeCloseTo(675, PRECISION)
  })

  it('refuse des quotes-parts dont la somme ne vaut pas 1', () => {
    expect(() => assiettesSurtaxe(90000, { nature: 'concubins', quotes_parts: [0.5, 0.4] }, p)).toThrow(RangeError)
    expect(assiettesSurtaxe(90000, { nature: 'concubins', quotes_parts: [0.1, 0.2, 0.7] }, p)).toHaveLength(3)
  })
})

describe('calcul complet de la plus-value', () => {
  it('exemple officiel (F10864) : plus-value imposable de 20 000 € → 3 800 € + 3 440 € = 7 240 €', () => {
    const pv = calculerPlusValue(
      {
        ...base,
        prix_cession: 127500,
        frais_cession: 0,
        prix_acquisition: 100000,
        annees_detention: 3,
        cedants: { nature: 'personne_seule', quotes_parts: [1] },
      },
      p,
    )
    expect(pv.frais_acquisition_retenus).toBe(7500)
    expect(pv.plus_value_brute).toBe(20000)
    expect(pv.impot_revenu).toBeCloseTo(3800, PRECISION)
    expect(pv.prelevements_sociaux).toBeCloseTo(3440, PRECISION)
    expect(pv.impot_total).toBeCloseTo(7240, PRECISION)
  })

  it('retient les frais réels quand ils dépassent le forfait de 7,5 %', () => {
    const pv = calculerPlusValue({ ...base, frais_acquisition_reels: 25000 }, p)
    expect(pv.frais_acquisition_retenus).toBe(25000)
    expect(pv.frais_acquisition_forfaitaires).toBe(false)
  })

  it('le forfait travaux de 15 % exige plus de 5 ans de détention et une autorisation', () => {
    expect(calculerPlusValue({ ...base, forfait_travaux_autorise: true, annees_detention: 6 }, p).travaux_retenus).toBe(
      37500,
    )
    expect(calculerPlusValue({ ...base, forfait_travaux_autorise: true, annees_detention: 5 }, p).travaux_retenus).toBe(0)
    expect(calculerPlusValue({ ...base, annees_detention: 6 }, p).travaux_retenus).toBe(0)
  })

  it('les amortissements déduits minorent le prix d’acquisition', () => {
    const pv = calculerPlusValue({ ...base, amortissements_deduits: 70000 }, p)
    expect(pv.prix_acquisition_corrige).toBe(250000 + 18750 - 70000)
    expect(pv.plus_value_brute).toBe(285000 - 198750)
  })

  it('le surcoût de la réintégration est l’impôt supplémentaire qu’elle provoque', () => {
    const avec = calculerPlusValue({ ...base, amortissements_deduits: 70000 }, p).impot_total
    const sans = calculerPlusValue(base, p).impot_total
    expect(surcoutReintegration({ ...base, amortissements_deduits: 70000 }, p)).toBeCloseTo(avec - sans, PRECISION)
    expect(avec).toBeGreaterThan(sans)
  })

  it('une moins-value ne donne aucun impôt', () => {
    const pv = calculerPlusValue({ ...base, prix_cession: 200000 }, p)
    expect(pv.plus_value_brute).toBeLessThan(0)
    expect(pv.impot_total).toBe(0)
  })

  it('exonération totale après 30 ans', () => {
    expect(calculerPlusValue({ ...base, annees_detention: 30 }, p).impot_total).toBe(0)
  })
})
