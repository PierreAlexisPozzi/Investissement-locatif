import { describe, expect, it } from 'vitest'
import { situationFiscale } from '../../src/engine/apercus'
import { contreExpertiser } from '../../src/engine/contre-expertise'
import { hypothesesParDefaut } from '../../src/engine/dossier'
import { comparerScenarios } from '../../src/engine/indicateurs'
import { jeuEssai } from '../../src/jeu-essai'
import { parametresFiscaux2026 as p } from '../../src/params'

describe('jeu d’essai préchargé (§14, étape 7)', () => {
  const { nom, dossier, simulation_vendeur } = jeuEssai()

  it('T2 de 45 m² en zone A, 250 000 € HT, couple marié avec 90 000 € de revenu imposable ; fictif', () => {
    expect(nom).toBe('Cas type (fictif)')
    expect(dossier.bien).toMatchObject({ nombre_pieces: 2, surface: { habitable: 45 }, zone: 'A', prix_ht: 250000 })
    expect(dossier.foyers.situation).toBe('marie_pacse')
    expect(dossier.foyers.foyers).toEqual([expect.objectContaining({ revenu_imposable: 90000, parts: 2, quote_part: 1 })])
  })

  it('hypothèses : les valeurs par défaut, scénario de prix central', () => {
    expect(dossier.hypotheses).toEqual(hypothesesParDefaut('central'))
  })

  it('impôt actuel du couple : 13 208 €, la valeur de référence du §13', () => {
    expect(situationFiscale(dossier, p).map((s) => s.impot)).toEqual([13208])
  })

  it('chaque scénario est simulé, ou écarté avec son motif', () => {
    const scenarios = comparerScenarios(dossier, 16, p).scenarios
    expect(scenarios.filter((r) => r.simulation !== null).length).toBeGreaterThan(0)
    for (const r of scenarios) if (r.simulation === null) expect(r.eligibilite.motifs.length, r.id).toBeGreaterThan(0)
  })

  it('la simulation du vendeur porte des hypothèses optimistes que la contre-expertise relève', () => {
    expect(contreExpertiser(dossier, simulation_vendeur, p).hypotheses_optimistes.length).toBeGreaterThan(0)
  })
})
