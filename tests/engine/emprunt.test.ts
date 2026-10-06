import { describe, expect, it } from 'vitest'
import {
  annuitesParAnnee,
  capitalRestantDu,
  coutCredit,
  endettementExcessif,
  indemnitesRemboursementAnticipe,
  mensualiteConstante,
  tableauAmortissement,
  tauxEndettement,
  type Pret,
} from '../../src/engine/emprunt'
import { parametresFiscaux2026 as p } from '../../src/params'

const CENTIMES = 2
const pret: Pret = { capital: 250000, taux_annuel: 0.034, duree_mois: 300 }

describe('mensualité et tableau d’amortissement (cahier des charges §13)', () => {
  const tableau = tableauAmortissement(pret)

  it('250 000 € à 3,4 % sur 25 ans → 1 238,19 € par mois', () => {
    expect(mensualiteConstante(250000, 0.034, 300)).toBeCloseTo(1238.19, CENTIMES)
    expect(tableau[0]?.mensualite).toBe(1238.19)
  })

  it('intérêts de la première année ≈ 8 400 €', () => {
    const premiereAnnee = annuitesParAnnee(tableau, 2027, 1)[0]
    expect(premiereAnnee?.nombre_echeances).toBe(12)
    expect(premiereAnnee?.interets).toBe(8399.96)
  })

  it('rembourse exactement le capital et solde le prêt à la dernière échéance', () => {
    expect(tableau).toHaveLength(300)
    const capitalTotal = tableau.reduce((total, e) => total + e.capital_rembourse, 0)
    expect(capitalTotal).toBeCloseTo(250000, CENTIMES)
    expect(tableau.at(-1)?.capital_restant_du).toBe(0)
    expect(Math.abs((tableau.at(-1)?.mensualite ?? 0) - 1238.19)).toBeLessThan(1)
  })

  it('chaque échéance : intérêts = capital restant dû × taux mensuel, au centime', () => {
    expect(tableau[0]?.interets).toBe(708.33)
    expect(tableau[1]?.interets).toBeCloseTo(((tableau[0]?.capital_restant_du ?? 0) * 0.034) / 12, CENTIMES)
  })
})

describe('assurance, différé, frais', () => {
  it('assurance de 0,30 % du capital initial : 62,50 € par mois', () => {
    const tableau = tableauAmortissement({ ...pret, taux_assurance_annuel: 0.003 })
    expect(tableau.every((e) => e.assurance === 62.5)).toBe(true)
  })

  it('différé de 24 mois : intérêts seuls, puis amortissement sur la durée prévue', () => {
    const tableau = tableauAmortissement({ ...pret, differe_mois: 24 })
    expect(tableau).toHaveLength(324)
    expect(tableau[0]).toMatchObject({ differe: true, interets: 708.33, capital_rembourse: 0, capital_restant_du: 250000 })
    expect(tableau[24]).toMatchObject({ differe: false, mensualite: 1238.19 })
  })

  it('coût total : intérêts, assurance et frais', () => {
    const avecFrais: Pret = { ...pret, taux_assurance_annuel: 0.003, frais_dossier: 1000, frais_garantie: 2500 }
    const cout = coutCredit(avecFrais, tableauAmortissement(avecFrais))
    expect(cout.assurance).toBe(18750)
    expect(cout.frais).toBe(3500)
    expect(cout.interets).toBeGreaterThan(121000)
    expect(cout.interets).toBeLessThan(121600)
  })

  it('taux nul : capital / durée', () => {
    expect(mensualiteConstante(120000, 0, 240)).toBe(500)
  })

  it('sans emprunt, aucun tableau', () => {
    expect(tableauAmortissement({ ...pret, capital: 0 })).toEqual([])
  })

  it('refuse une durée non entière', () => {
    expect(() => tableauAmortissement({ ...pret, duree_mois: 12.5 })).toThrow(RangeError)
  })
})

describe('regroupement par année civile', () => {
  it('première échéance en juillet : 6 échéances la première année', () => {
    const annuites = annuitesParAnnee(tableauAmortissement(pret), 2027, 7)
    expect(annuites[0]).toMatchObject({ annee: 2027, nombre_echeances: 6 })
    expect(annuites[1]).toMatchObject({ annee: 2028, nombre_echeances: 12 })
    expect(annuites.at(-1)).toMatchObject({ annee: 2052, nombre_echeances: 6, capital_restant_du_fin: 0 })
  })

  it('capital restant dû après un nombre d’échéances', () => {
    const tableau = tableauAmortissement(pret)
    expect(capitalRestantDu(pret, tableau, 0)).toBe(250000)
    expect(capitalRestantDu(pret, tableau, 12)).toBe(tableau[11]?.capital_restant_du)
    expect(capitalRestantDu(pret, tableau, 400)).toBe(0)
  })
})

describe('indemnités de remboursement anticipé (service-public F1669)', () => {
  it.each([
    [0.034, 3400],
    [0.01, 1000],
    [0.08, 6000],
  ])('capital restant 200 000 €, taux %f → %i € (min de 6 mois d’intérêts et de 3 %)', (taux, attendu) => {
    expect(indemnitesRemboursementAnticipe(200000, taux, p)).toBe(attendu)
  })
})

describe('taux d’endettement (alerte au-delà de 35 %)', () => {
  it('signale un endettement excessif', () => {
    expect(endettementExcessif(tauxEndettement(1300, 6000), p)).toBe(false)
    expect(endettementExcessif(tauxEndettement(2500, 6000), p)).toBe(true)
  })

  it('refuse des revenus nuls', () => {
    expect(() => tauxEndettement(1000, 0)).toThrow(RangeError)
  })
})
