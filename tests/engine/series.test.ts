import { describe, expect, it } from 'vitest'
import { lireDate } from '../../src/engine/dates'
import { comparerAuxHorizons, comparerScenarios } from '../../src/engine/indicateurs'
import { anneeDeCession, capitalNetParHorizon, decompositionAvantage, fluxCumules } from '../../src/engine/series'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierType } from './fixtures/dossier-type'

const PRECISION = 6
const comparaison = comparerScenarios(dossierType, 16, p)

describe('flux de trésorerie cumulés après impôt', () => {
  const points = fluxCumules(comparaison)

  it('une abscisse par année civile, dans l’ordre', () => {
    const annees = points.map((x) => x.abscisse)
    expect(annees).toEqual([...annees].sort((a, b) => a - b))
    expect(new Set(annees).size).toBe(annees.length)
  })

  it('part des fonds propres versés et finit sur l’enrichissement net du scénario', () => {
    for (const i of comparaison.indicateurs) {
      const s = comparaison.scenarios.find((r) => r.id === i.id)?.simulation
      if (s === null || s === undefined) throw new Error(i.id)
      const serie = points.filter((x) => x.valeurs[i.id] !== undefined).map((x) => x.valeurs[i.id] ?? 0)
      expect(serie, i.id).toHaveLength(s.annees.length)
      expect(serie[0], i.id).toBeCloseTo(-s.apport + (s.annees[0]?.flux_tresorerie ?? 0), PRECISION)
      expect(serie.at(-1), i.id).toBeCloseTo(i.enrichissement_net, PRECISION)
    }
  })

  it('n’affiche pas les scénarios inéligibles', () => {
    const ineligibles = comparaison.scenarios.filter((r) => r.simulation === null).map((r) => r.id)
    expect(ineligibles.length).toBeGreaterThan(0)
    for (const id of ineligibles) expect(points.every((x) => x.valeurs[id] === undefined), id).toBe(true)
  })
})

describe('capital net par horizon et décomposition de l’avantage fiscal', () => {
  it('reprend le capital net à la sortie de chaque horizon de calcul', () => {
    const comparaisons = comparerAuxHorizons(dossierType, p)
    const points = capitalNetParHorizon(comparaisons)
    expect(points.map((x) => x.abscisse)).toEqual(comparaisons.map((c) => c.horizon))
    for (const [k, c] of comparaisons.entries()) {
      for (const i of c.indicateurs) expect(points[k]?.valeurs[i.id], `${i.id} ${String(c.horizon)}`).toBe(i.capital_net_sortie)
    }
  })

  it('les composantes s’additionnent : économie nette d’impôt, TVA, créance de taxe foncière', () => {
    const decomposition = decompositionAvantage(comparaison.indicateurs)
    expect(decomposition.map((x) => x.id)).toEqual(comparaison.indicateurs.map((i) => i.id))
    for (const [k, x] of decomposition.entries()) {
      const i = comparaison.indicateurs[k]
      if (i === undefined) throw new Error(x.id)
      expect(x.impot_plus_value_repris, x.id).toBeLessThanOrEqual(0)
      expect(x.total, x.id).toBeCloseTo(i.economie_impot_nette + i.tva_economisee + i.creance_taxe_fonciere_cumulee, PRECISION)
    }
    const lli = decomposition.find((x) => x.id === 'S3')
    expect(lli?.tva_economisee).toBeGreaterThan(0)
    expect(decomposition.find((x) => x.id === 'S0')?.tva_economisee).toBe(0)
  })

  it('année de la revente à l’horizon', () => {
    const s = comparaison.scenarios.find((r) => r.id === 'S0')?.simulation
    expect(anneeDeCession(comparaison)).toBe(lireDate(s?.calendrier.date_cession ?? '').annee)
  })
})
