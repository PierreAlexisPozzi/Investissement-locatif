import { describe, expect, it } from 'vitest'
import {
  imputationsRemisesEnCause,
  prelevementsSociauxFonciers,
  revenuFoncierMicro,
  revenuFoncierReel,
  ventilerCharges,
} from '../../src/engine/revenus-fonciers'
import { parametresFiscaux2026 as p } from '../../src/params'

const reel = (recettes: number, interets: number, autres: number, amortissement = 0) =>
  revenuFoncierReel(
    { annee: 2027, recettes, charges: { interets, autres_charges: autres, amortissement } },
    p,
  )

describe('déficit foncier : valeurs de référence du cahier des charges (§13)', () => {
  it('loyers 8 500, intérêts 10 830, autres charges 2 245, amortissement 8 000', () => {
    const r = reel(8500, 10830, 2245, 8000)
    expect(r.deficit_imputable_revenu_global).toBe(10245)
    expect(r.interets_non_couverts).toBe(2330)
    expect(r.deficits_reportables).toEqual([{ annee: 2027, montant: 2330 }])
  })

  it('loyers 12 000, intérêts 5 000, autres charges 3 000, amortissement 8 000', () => {
    const r = reel(12000, 5000, 3000, 8000)
    expect(r.deficit_imputable_revenu_global).toBe(4000)
    expect(r.revenu_foncier_imposable).toBe(0)
    expect(r.deficits_reportables).toEqual([])
  })

  it('loyers 9 000, intérêts 4 000, autres charges 9 000, amortissement 8 000', () => {
    const r = reel(9000, 4000, 9000, 8000)
    expect(r.deficit_imputable_revenu_global).toBe(10700)
    expect(r.excedent_au_dela_du_plafond).toBe(1300)
    expect(r.deficits_reportables).toEqual([{ annee: 2027, montant: 1300 }])
  })

  it('exemple officiel (BOI-RFPI-BASE-30-20, §160) : loyers 15 000, intérêts 18 000, autres charges 20 000', () => {
    const r = reel(15000, 18000, 20000)
    expect(r.resultat).toBe(-23000)
    expect(r.interets_non_couverts).toBe(3000)
    expect(r.deficit_imputable_revenu_global).toBe(10700)
    expect(r.excedent_au_dela_du_plafond).toBe(9300)
  })

  it('exemple officiel (service-public F1991) : recettes 5 000, autres charges 12 000, intérêts 6 000', () => {
    const r = reel(5000, 6000, 12000)
    expect(r.deficit_imputable_revenu_global).toBe(10700)
    expect(r.deficits_reportables).toEqual([{ annee: 2027, montant: 2300 }])
  })
})

describe('frais d’emprunt traités comme des intérêts (arbitrage du 06/10/2026, BOFiP §110)', () => {
  const charges = { interets: 8000, assurance_emprunteur: 1000, frais_emprunt: 500, autres_charges: 5000 }

  it('l’assurance et les frais rejoignent les charges financières', () => {
    expect(ventilerCharges(charges, p)).toEqual({ financieres: 9500, autres: 5000 })
  })

  it('ils réduisent le déficit imputable sur le revenu global', () => {
    const r = revenuFoncierReel({ annee: 2027, recettes: 9000, charges }, p)
    expect(r.interets_non_couverts).toBe(500)
    expect(r.deficit_imputable_revenu_global).toBe(5000)
    // Option écartée (seuls les intérêts en priorité) : 5 000 + 1 500 − 1 000 = 5 500 € imputés.
  })
})

describe('revenu foncier positif et déficits antérieurs', () => {
  it('impute les déficits antérieurs sur le revenu foncier', () => {
    const r = revenuFoncierReel(
      {
        annee: 2028,
        recettes: 12000,
        charges: { interets: 2000, autres_charges: 3000 },
        deficits_anterieurs: [{ annee: 2027, montant: 5000 }],
      },
      p,
    )
    expect(r.revenu_foncier_imposable).toBe(2000)
    expect(r.deficits_anterieurs_imputes).toBe(5000)
    expect(r.deficits_reportables).toEqual([])
  })

  it('un nouveau déficit s’ajoute au stock ; les millésimes de plus de 10 ans se périment', () => {
    const r = revenuFoncierReel(
      {
        annee: 2038,
        recettes: 5000,
        charges: { interets: 6000, autres_charges: 0 },
        deficits_anterieurs: [
          { annee: 2027, montant: 700 },
          { annee: 2030, montant: 900 },
        ],
      },
      p,
    )
    expect(r.deficits_perimes).toBe(700)
    expect(r.deficits_reportables).toEqual([
      { annee: 2030, montant: 900 },
      { annee: 2038, montant: 1000 },
    ])
  })
})

describe('micro-foncier', () => {
  it('abattement de 30 % sous le seuil de 15 000 €', () => {
    const r = revenuFoncierMicro(2027, 10000, p)
    expect(r.eligible).toBe(true)
    expect(r.revenu_foncier_imposable).toBe(7000)
  })

  it('inéligible au-delà du seuil ou avec l’option Jeanbrun', () => {
    expect(revenuFoncierMicro(2027, 15001, p).eligible).toBe(false)
    const jeanbrun = revenuFoncierMicro(2027, 10000, p, { option_jeanbrun: true })
    expect(jeanbrun.eligible).toBe(false)
    expect(jeanbrun.motifs_ineligibilite).toHaveLength(1)
  })

  it('impute les déficits fonciers antérieurs après abattement', () => {
    const r = revenuFoncierMicro(2028, 10000, p, { deficits_anterieurs: [{ annee: 2027, montant: 2000 }] })
    expect(r.revenu_foncier_imposable).toBe(5000)
  })
})

describe('prélèvements sociaux et maintien de la location', () => {
  it('17,2 % sur le revenu foncier imposable, rien sur un déficit', () => {
    expect(prelevementsSociauxFonciers(7000, p)).toBeCloseTo(1204, 2)
    expect(prelevementsSociauxFonciers(-3000, p)).toBe(0)
  })

  it('une cession avant le 31/12 de la 3e année suivant l’imputation remet celle-ci en cause', () => {
    expect(imputationsRemisesEnCause([2027, 2028], 2030, p)).toEqual([2027, 2028])
    expect(imputationsRemisesEnCause([2027, 2028], 2031, p)).toEqual([2028])
    expect(imputationsRemisesEnCause([2027, 2028], 2032, p)).toEqual([])
  })
})
