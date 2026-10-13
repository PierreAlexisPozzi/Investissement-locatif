import { describe, expect, it } from 'vitest'
import { lireDate } from '../../src/engine/dates'
import { comparerAuxHorizons, comparerScenarios } from '../../src/engine/indicateurs'
import { anneeDeCession, capitalCompareAuPlacement, capitalNetParHorizon, decompositionAvantage, effortParAnnee, fluxCumules } from '../../src/engine/series'
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

describe('effort d’épargne par année', () => {
  it('une valeur par année de détention ; la plus forte et la moyenne pondérée retrouvent les indicateurs', () => {
    for (const i of comparaison.indicateurs) {
      const s = comparaison.scenarios.find((r) => r.id === i.id)?.simulation
      if (s === null || s === undefined) throw new Error(i.id)
      const efforts = effortParAnnee(s)
      expect(efforts.map((e) => e.annee), i.id).toEqual(s.annees.filter((a) => a.mois_detention > 0).map((a) => a.annee))
      const pire = efforts.reduce((max, e) => (e.mensuel > max.mensuel ? e : max))
      expect(pire.mensuel, i.id).toBeCloseTo(i.effort_mensuel_pire, PRECISION)
      expect(pire.annee, i.id).toBe(i.pire_annee)
      const mois = s.annees.map((a) => a.mois_detention)
      const pondere = efforts.reduce((total, e, k) => total + e.mensuel * (mois.filter((m) => m > 0)[k] ?? 0), 0) / mois.reduce((x, y) => x + y, 0)
      expect(pondere, i.id).toBeCloseTo(i.effort_mensuel_moyen, PRECISION)
    }
  })
})

describe('capital net à la sortie comparé au placement', () => {
  const lignes = capitalCompareAuPlacement(comparaison.indicateurs)

  it('un scénario éligible par ligne, du capital le plus élevé au plus faible', () => {
    expect(lignes.map((l) => l.id).sort()).toEqual(comparaison.indicateurs.map((i) => i.id).sort())
    expect(lignes.map((l) => l.capital)).toEqual([...lignes.map((l) => l.capital)].sort((a, b) => b - a))
  })

  it('reprend le capital, celui du placement équivalent et leur écart', () => {
    for (const l of lignes) {
      const i = comparaison.indicateurs.find((x) => x.id === l.id)
      expect(l).toEqual({ id: i?.id, capital: i?.capital_net_sortie, placement: i?.capital_net_placement, ecart: i?.ecart_capital_placement })
      expect(l.ecart).toBeCloseTo(l.capital - l.placement, PRECISION)
    }
  })
})

