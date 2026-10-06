import { describe, expect, it } from 'vitest'
import {
  calculerDecote,
  calculerImpot,
  calculerRevenuGlobal,
  deductionFraisProfessionnels,
  impotDifferentiel,
  indexerImpotRevenu,
  salairesNetsImposables,
  type Foyer,
} from '../../src/engine/impot-revenu'
import { parametresFiscaux2026 as p } from '../../src/params'

const CENTIMES = 2
const couple = (parts = 2): Foyer => ({ parts, imposition_commune: true })
const seul = (parts = 1): Foyer => ({ parts, imposition_commune: false })

describe('impôt sur le revenu : valeurs de référence du cahier des charges (§13)', () => {
  it('couple marié, 2 parts, 90 000 € → 13 208 €', () => {
    const impot = calculerImpot(90000, couple(), p)
    expect(impot.impot_brut).toBeCloseTo(13207.98, CENTIMES)
    expect(impot.decote).toBe(0)
    expect(impot.impot_net).toBe(13208)
    expect(impot.tmi).toBe(0.3)
  })

  it('même couple, 81 000 € → 10 508 € : 9 000 € de moins économisent 2 700 €, soit 30 %', () => {
    const { sans, avec, ecart } = impotDifferentiel(90000, 81000, couple(), p)
    expect(avec.impot_net).toBe(10508)
    expect(ecart).toBe(avec.impot_du - sans.impot_du)
    expect(ecart).toBe(-2700)
  })

  it('décote d’un couple dont l’impôt brut vaut 2 500 € : 351,75 €, impôt 2 148,25 € avant arrondi', () => {
    const decote = calculerDecote(2500, true, p)
    expect(decote).toBeCloseTo(351.75, CENTIMES)
    expect(2500 - decote).toBeCloseTo(2148.25, CENTIMES)
  })
})

describe('impôt sur le revenu : exemples officiels (service-public F1419, avant décote)', () => {
  it.each([
    ['célibataire, 1 part, 30 000 €', seul(), 30000, 2103.99, false],
    ['couple, 2 parts, 60 000 €', couple(), 60000, 4207.98, false],
    ['couple + 1 enfant, 2,5 parts, 60 000 €', couple(2.5), 60000, 3410, false],
    ['couple + 1 enfant, 2,5 parts, 90 000 € (quotient plafonné)', couple(2.5), 90000, 11400.98, true],
    ['couple + 2 enfants, 3 parts, 60 000 €', couple(3), 60000, 2772, false],
    ['couple + 2 enfants, 3 parts, 90 000 € (quotient plafonné)', couple(3), 90000, 9593.98, true],
  ])('%s → %f €', (_, foyer, revenu, attendu, plafonne) => {
    const impot = calculerImpot(revenu, foyer, p)
    expect(impot.impot_brut).toBeCloseTo(attendu, CENTIMES)
    expect(impot.quotient_familial_plafonne).toBe(plafonne)
  })

  it('l’avantage d’un enfant est plafonné à 1 807 € par demi-part', () => {
    const impot = calculerImpot(90000, couple(2.5), p)
    expect(impot.plafond_avantage_quotient_familial).toBe(1807)
    expect(impot.impot_brut).toBeCloseTo(impot.impot_parts_de_base - 1807, CENTIMES)
  })

  it('la décote s’applique ensuite : couple + 2 enfants, 60 000 €', () => {
    const impot = calculerImpot(60000, couple(3), p)
    expect(impot.decote).toBeCloseTo(1483 - 0.4525 * 2772, CENTIMES)
    expect(impot.impot_net).toBe(2543)
  })
})

describe('décote (brochure pratique IR 2026, p. 371)', () => {
  it('couple, impôt avant décote 2 140 € → décote de 515 € et impôt de 1 625 € (arrondis)', () => {
    const decote = calculerDecote(2140, true, p)
    expect(Math.round(decote)).toBe(515)
    expect(Math.round(2140 - decote)).toBe(1625)
  })

  it('aucune décote à partir du seuil, et jamais plus que l’impôt', () => {
    expect(calculerDecote(3277, true, p)).toBe(0)
    expect(calculerDecote(1982, false, p)).toBe(0)
    expect(calculerDecote(100, false, p)).toBe(100)
  })
})

describe('taux marginal, recouvrement, cas limites', () => {
  it('taux marginal de la tranche du dernier euro imposé', () => {
    expect(calculerImpot(0, seul(), p).tmi).toBe(0)
    expect(calculerImpot(20000, seul(), p).tmi).toBe(0.11)
    expect(calculerImpot(200000, seul(), p).tmi).toBe(0.45)
  })

  it('un impôt inférieur à 61 € n’est pas mis en recouvrement', () => {
    // 17 418 € : impôt brut 639,98 €, décote 607,41 €, impôt 32,57 €.
    const faible = calculerImpot(17418, seul(), p)
    expect(faible.impot_net).toBe(33)
    expect(faible.mis_en_recouvrement).toBe(false)
    expect(faible.impot_du).toBe(0)
    // Seuil de la brochure (tableau 7) pour une personne seule : 17 596 €.
    expect(calculerImpot(17596, seul(), p).impot_du).toBe(61)
    expect(calculerImpot(17595, seul(), p).impot_du).toBe(0)
  })

  it('un revenu négatif ou nul ne donne aucun impôt', () => {
    expect(calculerImpot(-5000, couple(), p).impot_du).toBe(0)
  })

  it('refuse un nombre de parts inférieur aux parts de base', () => {
    expect(() => calculerImpot(50000, couple(1.5), p)).toThrow(RangeError)
  })
})

describe('réductions d’impôt et plafonnement global des niches', () => {
  it('impute la réduction dans la limite de l’impôt ; l’excédent est perdu', () => {
    const impot = calculerImpot(30000, seul(), p, { reductions_plafonnees: 3000 })
    expect(impot.reductions_imputees).toBeCloseTo(2103.99, CENTIMES)
    expect(impot.reductions_perdues).toBeCloseTo(3000 - 2103.99, CENTIMES)
    expect(impot.impot_du).toBe(0)
  })

  it('limite la réduction au plafond restant après les autres niches', () => {
    const impot = calculerImpot(90000, couple(), p, { reductions_plafonnees: 4800, avantages_niches_deja_utilises: 8000 })
    expect(impot.reductions_imputees).toBe(2000)
    expect(impot.reductions_perdues).toBe(2800)
    expect(impot.impot_net).toBe(13208 - 2000)
  })

  it('impute les réductions hors plafond après les autres, dans la limite de l’impôt restant', () => {
    const impot = calculerImpot(90000, couple(), p, {
      reductions_plafonnees: 4800,
      avantages_niches_deja_utilises: 8000,
      reductions_non_plafonnees: 20000,
    })
    expect(impot.reductions_imputees).toBeCloseTo(13207.98, CENTIMES)
    expect(impot.reductions_perdues).toBeCloseTo(4800 + 20000 - 13207.98, CENTIMES)
    expect(impot.impot_du).toBe(0)
  })
})

describe('système du quotient (revenu exceptionnel, CGI art. 163-0 A)', () => {
  const PRECISION = 6
  const couple = { parts: 2, imposition_commune: true }

  it('la décote s’applique à l’impôt total, supplément du quotient compris (brochure IR 2026, p. 370)', () => {
    const d = calculerImpot(40000, couple, p, { revenu_exceptionnel: { montant: 4000, coefficient: 2 } })
    // Revenu ordinaire : 1 848 € ; avec la moitié du revenu exceptionnel : 2 068 € ; supplément 2 × 220 €.
    expect(d.supplement_quotient).toBeCloseTo(440, PRECISION)
    expect(d.impot_brut).toBeCloseTo(2288, PRECISION)
    expect(d.decote).toBeCloseTo(447.68, PRECISION)
    expect(d.impot_net).toBe(1840)
  })

  it('le quotient atténue la progressivité quand le revenu exceptionnel franchit une tranche', () => {
    const ordinaire = calculerImpot(160000, couple, p)
    const auQuotient = calculerImpot(160000, couple, p, { revenu_exceptionnel: { montant: 40000, coefficient: 4 } })
    const sansQuotient = calculerImpot(200000, couple, p)
    expect(auQuotient.supplement_quotient).toBeCloseTo(12372.24, PRECISION)
    expect(sansQuotient.impot_brut - ordinaire.impot_brut).toBeCloseTo(15393.06, PRECISION)
    expect(auQuotient.tmi).toBe(ordinaire.tmi)
  })

  it('sans revenu exceptionnel, aucun supplément', () => {
    expect(calculerImpot(90000, couple, p).supplement_quotient).toBe(0)
  })

  it('refuse un coefficient inférieur à 1', () => {
    expect(() => calculerImpot(90000, couple, p, { revenu_exceptionnel: { montant: 1000, coefficient: 0.5 } })).toThrow(
      RangeError,
    )
  })
})

describe('salaires : déduction forfaitaire de 10 %', () => {
  it.each([
    [40000, 4000],
    [3000, 509],
    [400, 400],
    [200000, 14555],
    [0, 0],
  ])('salaire de %i € → déduction de %i €', (salaire, deduction) => {
    expect(deductionFraisProfessionnels(salaire, p)).toBe(deduction)
  })

  it('la déduction s’applique à chaque membre du foyer', () => {
    expect(salairesNetsImposables([50000, 50000], p)).toBe(90000)
  })
})

describe('revenu global et déficits globaux (CGI art. 156)', () => {
  it('le déficit foncier imputable diminue le revenu global', () => {
    const r = calculerRevenuGlobal({ annee: 2027, revenus_categoriels: 50000, deficit_foncier_imputable: 10700 }, p)
    expect(r.revenu_global_net).toBe(39300)
    expect(r.deficit_global_ne).toBe(0)
  })

  it('un revenu insuffisant crée un déficit global, imputé l’année suivante', () => {
    const annee1 = calculerRevenuGlobal({ annee: 2027, revenus_categoriels: 5000, deficit_foncier_imputable: 10700 }, p)
    expect(annee1.revenu_global_net).toBe(0)
    expect(annee1.deficits_globaux).toEqual([{ annee: 2027, montant: 5700 }])
    const annee2 = calculerRevenuGlobal(
      { annee: 2028, revenus_categoriels: 30000, deficits_globaux_anterieurs: annee1.deficits_globaux },
      p,
    )
    expect(annee2.deficits_anterieurs_imputes).toBe(5700)
    expect(annee2.revenu_global_net).toBe(24300)
    expect(annee2.deficits_globaux).toEqual([])
  })

  it('un déficit global se périme après 6 ans', () => {
    const r = calculerRevenuGlobal(
      { annee: 2034, revenus_categoriels: 30000, deficits_globaux_anterieurs: [{ annee: 2027, montant: 5700 }] },
      p,
    )
    expect(r.deficits_perimes).toBe(5700)
    expect(r.revenu_global_net).toBe(30000)
  })

  it('les charges déductibles ne créent pas de déficit', () => {
    const r = calculerRevenuGlobal({ annee: 2027, revenus_categoriels: 1000, charges_deductibles: 1500 }, p)
    expect(r.charges_deduites).toBe(1000)
    expect(r.revenu_global_net).toBe(0)
  })
})

describe('indexation du barème (§6.1)', () => {
  it('un coefficient de 1 laisse les paramètres inchangés', () => {
    expect(indexerImpotRevenu(p, 1)).toEqual(p)
  })

  it('revalorise bornes, plafond du quotient, décote et déduction de 10 %, arrondis à l’euro', () => {
    const indexe = indexerImpotRevenu(p, 1.01).impot_revenu
    expect(indexe.bareme.valeur[0]?.jusqua).toBe(11716)
    expect(indexe.bareme.valeur.at(-1)?.jusqua).toBeNull()
    expect(indexe.plafond_quotient_familial_demi_part.valeur).toBe(1825)
    expect(indexe.decote.valeur.couple.forfait).toBe(1498)
    expect(indexe.abattement_frais_professionnels.valeur.maximum).toBe(14701)
    expect(indexe.bareme.valeur.map((t) => t.taux)).toEqual(p.impot_revenu.bareme.valeur.map((t) => t.taux))
    expect(indexe.plafonnement_global_niches.valeur).toBe(p.impot_revenu.plafonnement_global_niches.valeur)
  })
})
