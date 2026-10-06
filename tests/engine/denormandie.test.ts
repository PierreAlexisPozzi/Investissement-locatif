import { describe, expect, it } from 'vitest'
import {
  dureeEngagementDenormandie,
  eligibiliteDenormandie,
  imputerReductionDenormandie,
  reductionDenormandie,
  travauxDeductiblesDenormandie,
  type EntreeEligibiliteDenormandie,
  type EntreeReductionDenormandie,
} from '../../src/engine/denormandie'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'

const PRECISION = 6

/** Prix de revient de 240 000 € (cahier des charges §13). */
const base: EntreeReductionDenormandie = {
  prix_acquisition: 170000,
  frais_acquisition: 10000,
  travaux: 60000,
  surface_habitable: 50,
  engagement_initial: 'neuf_ans',
  prorogations: 0,
  annee_achevement_travaux: 2028,
}

describe('réduction Denormandie', () => {
  it('prix de revient 240 000 €, 50 m², 9 ans → 43 200 € au total, 4 800 €/an (§13)', () => {
    const r = reductionDenormandie(base, p)
    expect(r.base).toBe(240000)
    expect(r.total).toBeCloseTo(43200, PRECISION)
    expect(r.annees).toHaveLength(9)
    r.annees.forEach((a) => {
      expect(a.reduction).toBeCloseTo(4800, PRECISION)
    })
    expect(r.annees[0]?.annee).toBe(2028)
  })

  it('6 ans : 12 %, soit 2 %/an', () => {
    const r = reductionDenormandie({ ...base, engagement_initial: 'six_ans' }, p)
    expect(r.taux_total).toBeCloseTo(0.12, PRECISION)
    expect(r.annees).toHaveLength(6)
  })

  it('12 ans : 21 %, 2 %/an pendant 9 ans puis 1 %/an, quel que soit l’engagement initial', () => {
    const neufPlusTrois = reductionDenormandie({ ...base, prorogations: 1 }, p)
    const sixPlusSix = reductionDenormandie({ ...base, engagement_initial: 'six_ans', prorogations: 2 }, p)
    for (const r of [neufPlusTrois, sixPlusSix]) {
      expect(r.taux_total).toBeCloseTo(0.21, PRECISION)
      expect(r.duree_ans).toBe(12)
      expect(r.annees[8]?.reduction).toBeCloseTo(4800, PRECISION)
      expect(r.annees[9]?.reduction).toBeCloseTo(2400, PRECISION)
      expect(r.annees.at(-1)?.annee).toBe(2039)
    }
  })

  it('base plafonnée à 5 500 €/m² et à 300 000 € par an', () => {
    expect(reductionDenormandie({ ...base, surface_habitable: 30 }, p).base).toBe(165000)
    expect(reductionDenormandie({ ...base, prix_acquisition: 400000, surface_habitable: 80 }, p).base).toBe(300000)
    expect(reductionDenormandie({ ...base, base_deja_retenue_annee: 100000 }, p).base).toBe(200000)
  })

  it('refuse un nombre de prorogations impossible', () => {
    expect(() => reductionDenormandie({ ...base, prorogations: 2 }, p)).toThrow(RangeError)
    expect(() => reductionDenormandie({ ...base, engagement_initial: 'six_ans', prorogations: 3 }, p)).toThrow(RangeError)
    expect(() => reductionDenormandie({ ...base, prorogations: -1 }, p)).toThrow(RangeError)
  })

  it('durée d’engagement : 6, 9 ou 12 ans', () => {
    expect(dureeEngagementDenormandie('six_ans', 0, p)).toBe(6)
    expect(dureeEngagementDenormandie('six_ans', 1, p)).toBe(9)
    expect(dureeEngagementDenormandie('six_ans', 2, p)).toBe(12)
    expect(dureeEngagementDenormandie('neuf_ans', 1, p)).toBe(12)
  })
})

describe('imputation sur l’impôt du foyer', () => {
  const couple = { parts: 2, imposition_commune: true }

  it('couple, 90 000 € : 4 800 € imputés, impôt de 13 208 € ramené à 8 408 €', () => {
    const r = imputerReductionDenormandie(90000, couple, 4800, 0, p)
    expect(r.imputee).toBeCloseTo(4800, PRECISION)
    expect(r.impot_sans_reduction.impot_du).toBe(13208)
    expect(r.impot_avec_reduction.impot_du).toBe(8408)
    expect(r.perdue).toBe(0)
  })

  it('niches déjà utilisées à hauteur de 7 000 € : 3 000 € imputés, 1 800 € perdus', () => {
    const r = imputerReductionDenormandie(90000, couple, 4800, 7000, p)
    expect(r.imputee).toBeCloseTo(3000, PRECISION)
    expect(r.perdue).toBeCloseTo(1800, PRECISION)
  })

  it('impôt insuffisant : la réduction s’impute après décote, le reste est perdu', () => {
    const r = imputerReductionDenormandie(40000, couple, 4800, 0, p)
    expect(r.impot_sans_reduction.impot_apres_decote).toBeCloseTo(1201.22, PRECISION)
    expect(r.imputee).toBeCloseTo(1201.22, PRECISION)
    expect(r.perdue).toBeCloseTo(3598.78, PRECISION)
    expect(r.impot_avec_reduction.impot_du).toBe(0)
  })

  it('si la réduction sortait du plafonnement des niches, elle ne serait limitée que par l’impôt', () => {
    const horsPlafond: ParametresFiscaux = {
      ...p,
      denormandie: {
        ...p.denormandie,
        dans_plafonnement_niches: { ...p.denormandie.dans_plafonnement_niches, valeur: false },
      },
    }
    expect(imputerReductionDenormandie(90000, couple, 4800, 10000, horsPlafond).imputee).toBeCloseTo(4800, PRECISION)
  })

  it('les travaux retenus dans la base ne sont pas déductibles des revenus fonciers', () => {
    expect(travauxDeductiblesDenormandie(60000, true, p)).toBe(0)
    expect(travauxDeductiblesDenormandie(5000, false, p)).toBe(5000)
  })
})

describe('éligibilité', () => {
  const entree: EntreeEligibiliteDenormandie = {
    date_acquisition: '2026-05-10',
    etat: 'ancien',
    detention: 'nom_propre',
    commune_eligible: true,
    prix_acquisition: 150000,
    frais_acquisition: 12000,
    travaux: 60000,
    annee_achevement_travaux: 2028,
  }

  it('ancien avec 27 % de travaux, achevés dans les délais, en commune éligible : éligible', () => {
    expect(eligibiliteDenormandie(entree, p).eligible).toBe(true)
  })

  it.each([
    [{ travaux: 40000 }, 'travaux de'],
    [{ annee_achevement_travaux: 2029 }, '31/12/2028'],
    [{ date_acquisition: '2028-01-15' }, 'période'],
    [{ etat: 'vefa' as const }, 'ancien'],
    [{ commune_eligible: false }, 'commune hors périmètre'],
    [{ autres_logements_annee: 2 }, 'logements par an'],
    [{ option_jeanbrun: true }, 'Jeanbrun'],
    [{ detention: 'sci_is' as const }, 'impôt sur les sociétés'],
  ])('motif d’inéligibilité : %o', (modif, extrait) => {
    const r = eligibiliteDenormandie({ ...entree, ...modif }, p)
    expect(r.eligible).toBe(false)
    expect(r.motifs.join(' ')).toContain(extrait)
  })
})
