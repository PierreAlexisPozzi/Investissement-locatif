import { describe, expect, it } from 'vitest'
import { versCsv } from '../../src/export/csv'
import type { Tableau } from '../../src/export/tableau'

const tableau = (lignes: Tableau['lignes'], formats_lignes?: Tableau['formats_lignes']): Tableau => ({
  titre: 'Essai',
  colonnes: [
    { libelle: 'Libellé', format: 'texte' },
    { libelle: 'Montant', format: 'euros' },
    { libelle: 'Taux', format: 'taux' },
  ],
  lignes,
  ...(formats_lignes === undefined ? {} : { formats_lignes }),
})

describe('export CSV', () => {
  it('UTF-8 avec BOM, point-virgule, virgule décimale, fins de ligne CRLF', () => {
    const csv = versCsv(tableau([['Loyers', 9600.456, 0.0345678912]]))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toBe('\uFEFFLibellé;Montant;Taux\r\nLoyers;9600,46;0,034568\r\n')
  })

  it('cellules vides, zéro négatif, valeurs non finies', () => {
    expect(versCsv(tableau([[null, -0.001, Number.NaN]]))).toBe('\uFEFFLibellé;Montant;Taux\r\n;0;\r\n')
  })

  it('protège les séparateurs, guillemets et sauts de ligne', () => {
    const csv = versCsv(tableau([['a;b', 1, 0], ['dit "oui"', 2, 0], ['ligne\nsuivante', 3, 0], [' espace', 4, 0]]))
    expect(csv.split('\r\n').slice(1, 5)).toEqual(['"a;b";1;0', '"dit ""oui""";2;0', '"ligne\nsuivante";3;0', '" espace";4;0'])
  })

  it('neutralise un texte qui serait lu comme une formule par le tableur', () => {
    const csv = versCsv(tableau([['=1+1', 0, 0], ['+33 6', 0, 0], ['-x', 0, 0], ['@somme', 0, 0]]))
    expect(csv.split('\r\n').slice(1, 5).map((l) => l.split(';')[0])).toEqual(["'=1+1", "'+33 6", "'-x", "'@somme"])
  })

  it('le format d’une ligne l’emporte sur celui de la colonne', () => {
    const csv = versCsv(tableau([['TRI', 0.0512345678, 0]], ['taux']))
    expect(csv.split('\r\n')[1]).toBe('TRI;0,051235;0')
  })
})
