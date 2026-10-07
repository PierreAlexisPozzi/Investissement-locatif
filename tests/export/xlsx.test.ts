// @vitest-environment jsdom
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { classeurScenario, nomDeFichier, tableauIndicateurs } from '../../src/export/exports-scenario'
import type { Tableau } from '../../src/export/tableau'
import { lettreColonne, versXlsx } from '../../src/export/xlsx'
import { comparerScenarios } from '../../src/engine/indicateurs'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierType } from '../engine/fixtures/dossier-type'

const lire = (classeur: Uint8Array): Record<string, string> =>
  Object.fromEntries(Object.entries(unzipSync(classeur)).map(([chemin, contenu]) => [chemin, strFromU8(contenu)]))

const xml = (texte: string): Document => {
  const document = new DOMParser().parseFromString(texte, 'application/xml')
  expect(document.getElementsByTagName('parsererror')).toHaveLength(0)
  return document
}

const simple: Tableau = {
  titre: 'Essai',
  colonnes: [
    { libelle: 'Année', format: 'annee' },
    { libelle: 'Loyers', format: 'euros' },
    { libelle: 'Note', format: 'texte' },
  ],
  lignes: [
    [2028, 3200.5, 'Première année <partielle> & "vacance"'],
    [2029, null, 'contrôle\u0007 retiré'],
  ],
}

describe('classeur XLSX', () => {
  it('contient les parties obligatoires d’un classeur, en XML bien formé', () => {
    const fichiers = lire(versXlsx([simple]))
    expect(Object.keys(fichiers).sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].sort(),
    )
    for (const contenu of Object.values(fichiers)) xml(contenu)
  })

  it('écrit les nombres en valeur et les textes échappés, sans caractère de contrôle', () => {
    const feuille = xml(lire(versXlsx([simple]))['xl/worksheets/sheet1.xml'] ?? '')
    const cellules = [...feuille.getElementsByTagName('c')].map((c) => [c.getAttribute('r'), c.textContent])
    expect(cellules).toEqual([
      ['A1', 'Année'],
      ['B1', 'Loyers'],
      ['C1', 'Note'],
      ['A2', '2028'],
      ['B2', '3200.5'],
      ['C2', 'Première année <partielle> & "vacance"'],
      ['A3', '2029'],
      ['C3', 'contrôle retiré'],
    ])
  })

  it('une feuille par tableau, noms nettoyés et distincts', () => {
    const fichiers = lire(versXlsx([{ ...simple, titre: 'Tableau [annuel] : S1/S2' }, simple, simple]))
    const noms = [...xml(fichiers['xl/workbook.xml'] ?? '').getElementsByTagName('sheet')].map((s) => s.getAttribute('name'))
    expect(noms).toEqual(['Tableau  annuel    S1 S2', 'Essai', 'Essai (2)'])
    expect(Object.keys(fichiers).filter((f) => f.startsWith('xl/worksheets/'))).toHaveLength(3)
  })

  it('références de colonnes au-delà de Z', () => {
    expect([0, 25, 26, 51, 701, 702].map(lettreColonne)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA'])
  })

  it('refuse un classeur vide', () => {
    expect(() => versXlsx([])).toThrow(RangeError)
  })
})

describe('classeur d’un scénario et indicateurs', () => {
  const c = comparerScenarios(dossierType, 16, p)
  const s1 = c.scenarios.find((r) => r.id === 'S1')?.simulation
  if (s1 === null || s1 === undefined) throw new Error('S1 inéligible')

  it('tableau annuel, revente et formules du scénario', () => {
    const tableaux = classeurScenario(dossierType, 'S1', s1, p)
    expect(tableaux.map((t) => t.titre)).toEqual(['S1 tableau annuel', 'S1 revente', 'S1 formules'])
    const [annuel] = tableaux
    expect(annuel?.lignes).toHaveLength(s1.annees.length)
    expect(annuel?.lignes.every((l) => l.length === annuel.colonnes.length)).toBe(true)
    const fichiers = lire(versXlsx(tableaux))
    for (const contenu of Object.values(fichiers)) xml(contenu)
  })

  it('indicateurs : une colonne par scénario éligible, format propre à chaque ligne', () => {
    const t = tableauIndicateurs(c, dossierType, p)
    expect(t.colonnes).toHaveLength(c.indicateurs.length + 2)
    expect(t.formats_lignes).toHaveLength(t.lignes.length)
    const tri = t.lignes.findIndex((l) => l[0] === 'TRI après impôt')
    expect(t.formats_lignes?.[tri]).toBe('taux')
  })

  it('noms de fichiers sans accents ni caractères spéciaux', () => {
    expect(nomDeFichier('Dossier « été » n°1', 'S1', 'tableau annuel')).toBe('Dossier-ete-n-1-S1-tableau-annuel')
  })
})
