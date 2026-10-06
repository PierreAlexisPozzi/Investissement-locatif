import { describe, expect, it } from 'vitest'
import { arrondir, arrondirCentimes, arrondirEuro } from '../../src/engine/arrondis'
import { ajouterDeficit, imputerDeficits, totalStock } from '../../src/engine/deficits'

describe('stocks de déficits par millésime', () => {
  const stock = [
    { annee: 2026, montant: 1000 },
    { annee: 2027, montant: 2000 },
  ]

  it('impute du plus ancien au plus récent', () => {
    const r = imputerDeficits(stock, 1500, 2028, 10)
    expect(r.impute).toBe(1500)
    expect(r.detail).toEqual([
      { annee: 2026, montant: 1000 },
      { annee: 2027, montant: 500 },
    ])
    expect(r.stock).toEqual([{ annee: 2027, montant: 1500 }])
  })

  it('n’impute pas plus que le revenu et n’impute rien sur un revenu nul', () => {
    expect(imputerDeficits(stock, 0, 2028, 10).impute).toBe(0)
    expect(imputerDeficits(stock, 10000, 2028, 10).impute).toBe(3000)
  })

  it('n’impute pas un déficit sur le revenu de son année de naissance', () => {
    expect(imputerDeficits([{ annee: 2028, montant: 500 }], 1000, 2028, 10).impute).toBe(0)
  })

  it('un déficit né en A est imputable jusqu’en A + durée, puis périmé', () => {
    expect(imputerDeficits(stock, 5000, 2036, 10).impute).toBe(3000)
    const perime = imputerDeficits(stock, 5000, 2037, 10)
    expect(perime.perime).toBe(1000)
    expect(perime.impute).toBe(2000)
  })

  it('cumule les déficits d’une même année et ignore les montants nuls', () => {
    const cumule = ajouterDeficit(ajouterDeficit(stock, 2027, 500), 2028, 0)
    expect(cumule).toEqual([
      { annee: 2026, montant: 1000 },
      { annee: 2027, montant: 2500 },
    ])
    expect(totalStock(cumule)).toBe(3500)
  })
})

describe('arrondis commerciaux', () => {
  it.each([
    [1597.3, 1597],
    [1597.5, 1598],
    [1597.75, 1598],
    [-2.5, -3],
    [-0.2, 0],
  ])('%f € → %i € (brochure IR 2026, p. 371)', (valeur, attendu) => {
    expect(arrondirEuro(valeur)).toBe(attendu)
  })

  it('arrondit au centime sans erreur de représentation binaire', () => {
    expect(arrondirCentimes(1.005)).toBe(1.01)
    expect(arrondirCentimes(16.3968)).toBe(16.4)
    expect(arrondir(1.1222, 2)).toBe(1.12)
  })
})
