import { describe, expect, it } from 'vitest'
import { comparerScenarios } from '../../src/engine/indicateurs'
import { SCENARIOS, type IdScenario } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p } from '../../src/params'
import { COULEURS_AVANTAGE, COULEURS_SCENARIOS } from '../../src/ui/couleurs'
import { dossierAncien, dossierType } from '../engine/fixtures/dossier-type'

const NEUF: readonly IdScenario[] = ['S0', 'S1', 'S1_social', 'S1_tres_social', 'S2', 'S3', 'S3_IS', 'S4']
const ANCIEN: readonly IdScenario[] = ['S0', 'S4', 'S5_6', 'S5_9', 'S5_12']

const distinctes = (ids: readonly IdScenario[]): boolean => new Set(ids.map((id) => COULEURS_SCENARIOS[id])).size === ids.length

describe('couleurs des scénarios', () => {
  it('chaque scénario a une couleur ; deux scénarios ne la partagent que s’ils relèvent l’un du neuf, l’autre de l’ancien', () => {
    expect(Object.keys(COULEURS_SCENARIOS).sort()).toEqual([...SCENARIOS].sort())
    expect(distinctes(NEUF)).toBe(true)
    expect(distinctes(ANCIEN)).toBe(true)
  })

  it('les scénarios éligibles d’un bien neuf, puis d’un bien ancien, ont des couleurs distinctes', () => {
    for (const [dossier, famille] of [
      [dossierType, NEUF],
      [dossierAncien, ANCIEN],
    ] as const) {
      const eligibles = comparerScenarios(dossier, 16, p).indicateurs.map((i) => i.id)
      expect(eligibles.length).toBeGreaterThan(1)
      expect(eligibles.every((id) => famille.includes(id)), eligibles.join(', ')).toBe(true)
      expect(distinctes(eligibles)).toBe(true)
    }
  })

  it('les composantes de l’avantage fiscal ont des couleurs distinctes', () => {
    const couleurs = Object.values(COULEURS_AVANTAGE)
    expect(new Set(couleurs).size).toBe(couleurs.length)
  })
})
