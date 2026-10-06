import { describe, expect, it } from 'vitest'
import { arrondirEuro } from '../../src/engine/arrondis'
import { calculerImpot } from '../../src/engine/impot-revenu'
import {
  annuitePleineJeanbrun,
  eligibiliteJeanbrun,
  finEngagementJeanbrun,
  moisPremiereAnneeJeanbrun,
  pointDeDepartJeanbrun,
  ruptureJeanbrun,
  seuilPlafonnementJeanbrun,
  tableauAmortissementJeanbrun,
  type EntreeAmortissementJeanbrun,
  type EntreeEligibiliteJeanbrun,
} from '../../src/engine/jeanbrun'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'

const PRECISION = 6

/** Achèvement en janvier : première année pleine. */
const entree = (prix: number, derniere = 2030): EntreeAmortissementJeanbrun => ({
  prix_acquisition: prix,
  niveau: 'intermediaire',
  date_achevement: '2027-01-20',
  date_acquisition: '2026-03-15',
  derniere_annee: derniere,
})

const avecJeanbrun = (modif: Partial<ParametresFiscaux['jeanbrun']>): ParametresFiscaux => ({
  ...p,
  jeanbrun: { ...p.jeanbrun, ...modif },
})

describe('amortissement Jeanbrun : valeurs du cahier des charges (§13)', () => {
  it('275 000 € en intermédiaire → 7 700 €/an', () => {
    expect(annuitePleineJeanbrun(275000, 'intermediaire', p)).toBeCloseTo(7700, PRECISION)
    const t = tableauAmortissementJeanbrun(entree(275000), p)
    expect(t.annees[0]?.amortissement).toBeCloseTo(7700, PRECISION)
    expect(t.annees[0]?.plafonne).toBe(false)
  })

  it('320 000 € en intermédiaire → 8 000 €/an (plafonné)', () => {
    const t = tableauAmortissementJeanbrun(entree(320000), p)
    expect(t.annuite_pleine).toBeCloseTo(8960, PRECISION)
    expect(t.annees.map((a) => a.amortissement)).toEqual([8000, 8000, 8000, 8000])
    expect(t.annees.every((a) => a.plafonne)).toBe(true)
  })

  it('seuil de plafonnement en intermédiaire : 285 714 €', () => {
    expect(arrondirEuro(seuilPlafonnementJeanbrun('intermediaire', p))).toBe(285714)
  })

  it('niveaux social et très social : taux et plafonds majorés', () => {
    expect(tableauAmortissementJeanbrun({ ...entree(275000), niveau: 'social' }, p).annees[0]?.amortissement).toBeCloseTo(
      9900,
      PRECISION,
    )
    expect(
      tableauAmortissementJeanbrun({ ...entree(275000), niveau: 'tres_social' }, p).annees[0]?.amortissement,
    ).toBeCloseTo(12000, PRECISION)
  })
})

describe('point de départ et première année', () => {
  it('part du premier jour du mois d’achèvement, ou de l’acquisition si elle est postérieure', () => {
    expect(pointDeDepartJeanbrun('2027-07-10', '2026-05-02')).toEqual({ annee: 2027, mois: 7, jour: 1 })
    expect(pointDeDepartJeanbrun('2026-11-05', '2027-03-20')).toEqual({ annee: 2027, mois: 3, jour: 1 })
  })

  it('prorata mensuel : de juillet à décembre, 6 mois', () => {
    expect(moisPremiereAnneeJeanbrun({ annee: 2027, mois: 7, jour: 1 }, p)).toBe(6)
    const t = tableauAmortissementJeanbrun({ ...entree(275000), date_achevement: '2027-07-10' }, p)
    const attendus = [3850, 7700, 7700, 7700]
    attendus.forEach((attendu, i) => {
      expect(t.annees[i]?.amortissement).toBeCloseTo(attendu, PRECISION)
    })
  })

  it('sans prorata, la première annuité est pleine', () => {
    const sansProrata = avecJeanbrun({
      prorata_premiere_annee: { ...p.jeanbrun.prorata_premiere_annee, valeur: 'aucun' },
    })
    const t = tableauAmortissementJeanbrun({ ...entree(275000), date_achevement: '2027-07-10' }, sansProrata)
    expect(t.annees[0]?.amortissement).toBeCloseTo(7700, PRECISION)
  })

  it('plafond proratisé la première année (arbitrage du 06/10/2026)', () => {
    const e = { ...entree(320000), date_achevement: '2027-07-10' }
    expect(tableauAmortissementJeanbrun(e, p).annees[0]?.amortissement).toBeCloseTo(4000, PRECISION)
    // Option écartée : plafond plein, l'annuité proratisée de 4 480 € passe entière.
    const plafondPlein = avecJeanbrun({
      plafond_proratise_premiere_annee: { ...p.jeanbrun.plafond_proratise_premiere_annee, valeur: false },
    })
    expect(tableauAmortissementJeanbrun(e, plafondPlein).annees[0]?.amortissement).toBeCloseTo(4480, PRECISION)
  })
})

describe('limites de l’amortissement', () => {
  it('le cumul s’arrête à la base amortissable (80 % du prix)', () => {
    const t = tableauAmortissementJeanbrun(entree(100000, 2060), p)
    expect(t.total).toBeCloseTo(80000, PRECISION)
    const derniere = t.annees.filter((a) => a.amortissement > 0).at(-1)
    expect(derniere?.annee).toBe(2055)
    expect(derniere?.amortissement).toBeCloseTo(1600, PRECISION)
  })

  it('concubins : chaque foyer amortit sa quote-part sous son propre plafond (à confirmer)', () => {
    const t = tableauAmortissementJeanbrun({ ...entree(320000), quote_part: 0.5 }, p)
    expect(t.annees[0]?.amortissement).toBeCloseTo(4480, PRECISION)
    expect(t.base_amortissable).toBeCloseTo(128000, PRECISION)
  })

  it('refuse une quote-part hors de ]0 ; 1]', () => {
    expect(() => tableauAmortissementJeanbrun({ ...entree(320000), quote_part: 0 }, p)).toThrow(RangeError)
    expect(() => tableauAmortissementJeanbrun({ ...entree(320000), quote_part: 1.2 }, p)).toThrow(RangeError)
  })
})

describe('éligibilité', () => {
  const base: EntreeEligibiliteJeanbrun = {
    date_acquisition: '2026-06-15',
    etat: 'vefa',
    type_logement: 'appartement_collectif',
    detention: 'nom_propre',
  }

  it('appartement neuf en nom propre acquis pendant la période : éligible', () => {
    expect(eligibiliteJeanbrun(base, p)).toEqual({ eligible: true, motifs: [], avertissements: [] })
  })

  it.each([
    [{ type_logement: 'maison_individuelle' as const }, 'maison individuelle'],
    [{ etat: 'ancien' as const }, 'ancien'],
    [{ detention: 'sci_is' as const }, 'impôt sur les sociétés'],
    [{ date_acquisition: '2026-02-20' }, 'période'],
    [{ date_acquisition: '2029-01-01' }, 'période'],
    [{ droits_demembres: true }, 'démembrés'],
    [{ reduction_denormandie: true }, 'Denormandie'],
  ])('motif d’inéligibilité : %o', (modif, extrait) => {
    const r = eligibiliteJeanbrun({ ...base, ...modif }, p)
    expect(r.eligible).toBe(false)
    expect(r.motifs.join(' ')).toContain(extrait)
  })

  it('en SCI à l’IR : éligible, avec l’obligation de conserver les parts', () => {
    const r = eligibiliteJeanbrun({ ...base, detention: 'sci_ir' }, p)
    expect(r.eligible).toBe(true)
    expect(r.avertissements).toHaveLength(1)
  })
})

describe('rupture de l’engagement de location', () => {
  const tableau = tableauAmortissementJeanbrun(entree(275000, 2031), p)

  it('l’engagement court 9 ans depuis le début de la location', () => {
    expect(finEngagementJeanbrun('2027-03-01', p)).toBe('2036-03-01')
  })

  it('cession avant le terme : les amortissements déduits sont réintégrés, au quotient sur 5 ans', () => {
    const r = ruptureJeanbrun(tableau, '2027-03-01', '2031-12-31', 'cession', p)
    expect(r.rupture).toBe(true)
    expect(r.montant_reintegre).toBeCloseTo(5 * 7700, PRECISION)
    expect(r.coefficient_quotient).toBe(5)
  })

  it('licenciement, invalidité ou décès : pas de réintégration', () => {
    const r = ruptureJeanbrun(tableau, '2027-03-01', '2031-12-31', 'licenciement', p)
    expect(r.exoneree).toBe(true)
    expect(r.montant_reintegre).toBe(0)
  })

  it('cession au terme de l’engagement : pas de rupture', () => {
    expect(ruptureJeanbrun(tableau, '2027-03-01', '2036-03-01', 'cession', p).rupture).toBe(false)
  })

  it('impôt de la réintégration : supplément calculé au quotient (couple, 90 000 €)', () => {
    const r = ruptureJeanbrun(tableau, '2027-03-01', '2031-12-31', 'cession', p)
    const foyer = { parts: 2, imposition_commune: true }
    const sans = calculerImpot(90000, foyer, p)
    const avec = calculerImpot(90000, foyer, p, {
      revenu_exceptionnel: { montant: r.montant_reintegre, coefficient: r.coefficient_quotient },
    })
    // Chaque cinquième (7 700 €) reste dans la tranche à 30 % : supplément = 38 500 × 30 %.
    expect(avec.supplement_quotient).toBeCloseTo(11550, PRECISION)
    expect(avec.impot_du - sans.impot_du).toBe(11550)
  })
})
