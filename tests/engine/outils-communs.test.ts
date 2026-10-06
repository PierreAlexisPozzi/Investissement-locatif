import { describe, expect, it } from 'vitest'
import { cumulerEligibilites, eligibilite, repartir, verifierQuotesParts } from '../../src/engine/commun'
import { ajouterAnnees, anneesRevolues, comparerDates, lireDate, rangAnnee } from '../../src/engine/dates'
import { formaterDate, formaterEuros, formaterTaux, libelleZone } from '../../src/engine/format'

describe('dates ISO', () => {
  it('lit une date valide et refuse un format ou un jour invalide', () => {
    expect(lireDate('2028-02-29')).toEqual({ annee: 2028, mois: 2, jour: 29 })
    expect(() => lireDate('2027-02-29')).toThrow(RangeError)
    expect(() => lireDate('2027-04-31')).toThrow(RangeError)
    expect(() => lireDate('06/10/2026')).toThrow(RangeError)
  })

  it('compare deux dates', () => {
    expect(comparerDates('2026-10-06', '2026-10-07')).toBeLessThan(0)
    expect(comparerDates('2026-10-06', '2026-10-06')).toBe(0)
    expect(comparerDates('2027-01-01', '2026-12-31')).toBeGreaterThan(0)
  })

  it('ajoute des années ; un 29 février devient un 28 février', () => {
    expect(ajouterAnnees('2027-03-01', 9)).toBe('2036-03-01')
    expect(ajouterAnnees('2028-02-29', 1)).toBe('2029-02-28')
  })

  it('compte les années révolues et le rang de l’année en cours', () => {
    expect(anneesRevolues('2027-06-30', '2037-06-29')).toBe(9)
    expect(anneesRevolues('2027-06-30', '2037-06-30')).toBe(10)
    expect(rangAnnee('2027-06-30', '2027-12-31')).toBe(1)
  })
})

describe('éligibilité et quotes-parts', () => {
  it('une éligibilité sans motif est remplie ; le cumul réunit motifs et avertissements', () => {
    expect(eligibilite([]).eligible).toBe(true)
    const r = cumulerEligibilites(eligibilite(['a'], ['x']), eligibilite([], ['y']))
    expect(r).toEqual({ eligible: false, motifs: ['a'], avertissements: ['x', 'y'] })
  })

  it('quotes-parts positives et de somme 1', () => {
    expect(() => {
      verifierQuotesParts([0.3, 0.7])
    }).not.toThrow()
    expect(() => {
      verifierQuotesParts([])
    }).toThrow(RangeError)
    expect(() => {
      verifierQuotesParts([1.2, -0.2])
    }).toThrow(RangeError)
    expect(repartir(900, [1 / 3, 2 / 3])).toEqual([300, 600])
  })
})

describe('mise en forme française', () => {
  it('montants, taux, dates et zones', () => {
    expect(formaterEuros(10700).replace(/\s/g, ' ')).toBe('10 700 €')
    expect(formaterTaux(0.172).replace(/\s/g, ' ')).toBe('17,2 %')
    expect(formaterDate('2026-02-21')).toBe('21/02/2026')
    expect(libelleZone('A_bis')).toBe('A bis')
  })
})
