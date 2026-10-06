import { describe, expect, it } from 'vitest'
import { simulerPlacement, type EntreePlacement } from '../../src/engine/placement-reference'
import { parametresFiscaux2026 as p } from '../../src/params'

const PRECISION = 2

/** 10 000 € placés à 4 %/an pendant 10 ans, sans autre versement. */
const capitalUnique = (enveloppe: EntreePlacement['enveloppe'], annees = 10, couple = false): EntreePlacement => ({
  versement_initial: 10000,
  versements_annuels: Array.from({ length: annees }, () => 0),
  rendement_annuel: 0.04,
  enveloppe,
  couple,
})

const capital10ans = 10000 * 1.04 ** 10
const gain10ans = capital10ans - 10000

describe('capitalisation', () => {
  it('capitalisation mensuelle au taux équivalent : 10 000 € à 4 % pendant 10 ans', () => {
    const r = simulerPlacement(capitalUnique('cto'), p)
    expect(r.capital_brut).toBeCloseTo(capital10ans, PRECISION)
    expect(r.gain).toBeCloseTo(gain10ans, PRECISION)
    expect(r.annees).toHaveLength(10)
  })

  it('versements mensuels en fin de mois : valeur acquise d’une suite de 12 versements', () => {
    const tauxMensuel = 1.04 ** (1 / 12) - 1
    const r = simulerPlacement({ ...capitalUnique('cto', 1), versement_initial: 0, versements_annuels: [1200] }, p)
    expect(r.capital_brut).toBeCloseTo((100 * 0.04) / tauxMensuel, PRECISION)
  })

  it('années civiles partielles : la capitalisation suit les mois de placement', () => {
    const r = simulerPlacement({ ...capitalUnique('pea', 2), mois_par_annee: [6, 12] }, p)
    expect(r.capital_brut).toBeCloseTo(10000 * 1.04 ** 1.5, PRECISION)
    // 18 mois de détention : PEA de moins de 5 ans, imposé comme un compte-titres.
    expect(r.impot_revenu).toBeCloseTo((10000 * 1.04 ** 1.5 - 10000) * 0.128, PRECISION)
  })

  it('un flux négatif est un retrait ; signalé si le capital devient négatif', () => {
    const r = simulerPlacement({ ...capitalUnique('cto', 1), versements_annuels: [-12000] }, p)
    expect(r.versements_nets).toBeCloseTo(-2000, PRECISION)
    expect(r.alertes.join(' ')).toContain('négatif')
  })
})

describe('fiscalité de sortie', () => {
  it('compte-titres : prélèvement forfaitaire de 12,8 % et prélèvements sociaux de 18,6 %', () => {
    const r = simulerPlacement(capitalUnique('cto'), p)
    expect(r.impot_revenu).toBeCloseTo(gain10ans * 0.128, PRECISION)
    expect(r.prelevements_sociaux).toBeCloseTo(gain10ans * 0.186, PRECISION)
    expect(r.capital_net).toBeCloseTo(capital10ans - gain10ans * 0.314, PRECISION)
  })

  it('PEA de plus de 5 ans : prélèvements sociaux seulement', () => {
    const r = simulerPlacement(capitalUnique('pea'), p)
    expect(r.impot_revenu).toBe(0)
    expect(r.prelevements_sociaux).toBeCloseTo(gain10ans * 0.186, PRECISION)
  })

  it('PEA de moins de 5 ans : imposé comme un compte-titres', () => {
    const r = simulerPlacement(capitalUnique('pea', 3), p)
    const gain = 10000 * 1.04 ** 3 - 10000
    expect(r.impot_revenu).toBeCloseTo(gain * 0.128, PRECISION)
  })

  it('assurance-vie de plus de 8 ans : abattement de 4 600 € (9 200 € pour un couple), puis 7,5 %', () => {
    const seul = simulerPlacement(capitalUnique('assurance_vie'), p)
    expect(seul.impot_revenu).toBeCloseTo((gain10ans - 4600) * 0.075, PRECISION)
    expect(seul.prelevements_sociaux).toBeCloseTo(gain10ans * 0.172, PRECISION)
    expect(simulerPlacement(capitalUnique('assurance_vie', 10, true), p).impot_revenu).toBe(0)
  })

  it('assurance-vie : 12,8 % sur la part des gains liée aux primes au-delà de 150 000 €', () => {
    const r = simulerPlacement({ ...capitalUnique('assurance_vie'), primes_assurance_vie_existantes: 145000 }, p)
    // 5 000 € de seuil restant pour 10 000 € de primes : moitié à 7,5 %, moitié à 12,8 %.
    expect(r.impot_revenu).toBeCloseTo((gain10ans - 4600) * (0.5 * 0.075 + 0.5 * 0.128), PRECISION)
  })

  it('assurance-vie de moins de 8 ans : 12,8 % et 17,2 %', () => {
    const r = simulerPlacement(capitalUnique('assurance_vie', 5), p)
    const gain = 10000 * 1.04 ** 5 - 10000
    expect(r.impot_revenu).toBeCloseTo(gain * 0.128, PRECISION)
    expect(r.prelevements_sociaux).toBeCloseTo(gain * 0.172, PRECISION)
  })
})

describe('plafond de versement du PEA', () => {
  it('au-delà de 150 000 € par titulaire, l’excédent va sur un compte-titres', () => {
    const r = simulerPlacement({ ...capitalUnique('pea'), versement_initial: 200000 }, p)
    expect(r.annees.at(-1)?.dont_compte_titres).toBeCloseTo(50000 * 1.04 ** 10, PRECISION)
    const gainExcedent = 50000 * (1.04 ** 10 - 1)
    expect(r.impot_revenu).toBeCloseTo(gainExcedent * 0.128, PRECISION)
    expect(r.alertes).toHaveLength(1)
  })

  it('un couple dispose de deux plafonds', () => {
    const r = simulerPlacement({ ...capitalUnique('pea', 10, true), versement_initial: 200000 }, p)
    expect(r.annees.at(-1)?.dont_compte_titres).toBe(0)
    expect(r.alertes).toHaveLength(0)
  })
})
