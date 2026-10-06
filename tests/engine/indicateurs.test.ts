import { describe, expect, it } from 'vitest'
import { valeurActuelleNette } from '../../src/engine/actualisation'
import {
  comparerAuxHorizons,
  comparerScenarios,
  indicateursScenario,
  penaliteSortieAnticipee,
  prixReventeEquilibre,
  tableauCroise,
  tornado,
  type Indicateurs,
} from '../../src/engine/indicateurs'
import { simulerScenario, type IdScenario } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierType } from './fixtures/dossier-type'

const PRECISION = 6

function indicateurs(id: IdScenario, horizon = 16): Indicateurs {
  const r = simulerScenario(dossierType, id, { horizon }, p)
  const i = indicateursScenario(dossierType, r, horizon, p)
  if (i === null) throw new Error(`${id} inéligible`)
  return i
}

describe('indicateurs d’un scénario (§9)', () => {
  it('effort d’épargne moyen : flux cumulés rapportés aux mois de détention', () => {
    const r = simulerScenario(dossierType, 'S0', { horizon: 16 }, p)
    const s = r.simulation
    if (s === null) throw new Error('S0 inéligible')
    const mois = s.annees.reduce((t, a) => t + a.mois_detention, 0)
    const flux = s.annees.reduce((t, a) => t + a.flux_tresorerie, 0)
    expect(indicateurs('S0').effort_mensuel_moyen).toBeCloseTo(-flux / mois, PRECISION)
  })

  it('économie d’impôt : impôts évités pendant la détention ; la reprise à la revente est isolée', () => {
    const i = indicateurs('S1')
    expect(i.economie_impot_cumulee).toBeGreaterThan(0)
    expect(i.reprise_a_la_revente).toBeGreaterThan(0)
    expect(i.economie_impot_nette).toBeCloseTo(i.economie_impot_cumulee - i.reprise_a_la_revente, PRECISION)
  })

  it('rendement brut de la première année pleine : loyer revalorisé rapporté au prix', () => {
    expect(indicateurs('S0').rendement_brut).toBeCloseTo((800 * 1.015 ** 3 * 12) / 300000, PRECISION)
  })

  it('TRI et VAN : la VAN au TRI est nulle, la VAN est calculée au rendement du placement', () => {
    const r = simulerScenario(dossierType, 'S2', { horizon: 16 }, p)
    const i = indicateurs('S2')
    expect(i.tri).not.toBeNull()
    expect(valeurActuelleNette(r.simulation?.flux ?? [], i.tri ?? 0)).toBeCloseTo(0, 2)
    expect(i.van).toBeCloseTo(valeurActuelleNette(r.simulation?.flux ?? [], 0.04), PRECISION)
  })

  it('TVA économisée et créance cumulée pour le LLI', () => {
    const i = indicateurs('S3')
    expect(i.tva_economisee).toBeCloseTo(25000, PRECISION)
    expect(i.creance_taxe_fonciere_cumulee).toBeGreaterThan(0)
  })

  it('taux d’endettement après l’opération : mensualité et assurance rapportées aux revenus', () => {
    expect(indicateurs('S0').taux_endettement_apres).toBeCloseTo((1238.19 + 62.5) / 7500, PRECISION)
  })

  it('durée de blocage : 9 ans pour le Jeanbrun, jusqu’à la 16e année après la livraison pour le LLI', () => {
    expect(indicateurs('S0').date_sortie_sans_penalite).toBeNull()
    expect(indicateurs('S1')).toMatchObject({ date_sortie_sans_penalite: '2037-09-01', duree_blocage_ans: 9 })
    expect(indicateurs('S2').date_sortie_sans_penalite).toBe('2043-06-01')
    expect(indicateurs('S2').duree_blocage_ans).toBeCloseTo(14.75, PRECISION)
  })
})

describe('pénalité de sortie anticipée', () => {
  it('LLI : sortie à 14 ans, complément de TVA de 25 000 €', () => {
    expect(penaliteSortieAnticipee(dossierType, 'S2', p)).toEqual({ horizon: 14, montant: 25000 })
  })

  it('Jeanbrun : sortie à 8 ans, reprise des amortissements au quotient et prélèvements sociaux', () => {
    const penalite = penaliteSortieAnticipee(dossierType, 'S1', p)
    expect(penalite?.horizon).toBe(8)
    // 66 000 € d'amortissements réintégrés, imposés à 30 % au quotient, plus 17,2 % de prélèvements sociaux.
    expect(penalite?.montant).toBeCloseTo(66000 * (0.3 + 0.172), -2)
  })

  it('aucune pénalité sans engagement', () => {
    expect(penaliteSortieAnticipee(dossierType, 'S0', p)).toBeNull()
    expect(penaliteSortieAnticipee(dossierType, 'S4', p)).toBeNull()
  })
})

describe('prix de revente d’équilibre (§8.6)', () => {
  it('au prix d’équilibre, le TRI égale celui du placement équivalent', () => {
    const e = prixReventeEquilibre(dossierType, 'S1', 16, p)
    if (e?.prix === null || e === null) throw new Error('prix d’équilibre introuvable')
    const facteur = e.prix / e.prix_central
    const r = simulerScenario(dossierType, 'S1', { horizon: 16, regime: 'reel', facteur_prix_revente: facteur }, p)
    const i = indicateursScenario(dossierType, r, 16, p)
    expect(i?.tri).toBeCloseTo(e.tri_placement ?? 0, 4)
    expect(e.prix).toBeGreaterThan(e.prix_central)
  })
})

describe('sensibilités (§9)', () => {
  it('tornado : branches classées par amplitude ; le loyer de marché à la hausse ne change rien sous plafond', () => {
    const t = tornado(dossierType, 'S1', 16, p)
    const amplitudes = t?.branches.map((b) => b.amplitude) ?? []
    expect([...amplitudes].sort((a, b) => b - a)).toEqual(amplitudes)
    const loyer = t?.branches.find((b) => b.variable === 'loyer')
    expect(loyer?.tri_haut).toBeCloseTo(t?.tri_central ?? 0, PRECISION)
    expect(loyer?.tri_bas ?? 0).toBeLessThan(t?.tri_central ?? 0)
  })

  it('tableau croisé : le TRI baisse avec la décote du neuf et monte avec la revalorisation', () => {
    const g = tableauCroise(dossierType, 'S1', 16, p)
    expect(g.tri).toHaveLength(g.decotes.length)
    for (let i = 0; i < g.decotes.length; i++) {
      const ligne = g.tri[i] ?? []
      for (let j = 1; j < ligne.length; j++) expect(ligne[j] ?? 0).toBeGreaterThan(ligne[j - 1] ?? 0)
      if (i > 0) expect(ligne[0] ?? 0).toBeLessThan(g.tri[i - 1]?.[0] ?? 0)
    }
  })
})

describe('comparaison des scénarios', () => {
  it('indicateurs des seuls scénarios éligibles, écarts à la location nue classique', () => {
    const c = comparerScenarios(dossierType, 16, p)
    expect(c.indicateurs.map((i) => i.id)).toEqual(['S0', 'S1', 'S2', 'S3', 'S3_IS', 'S4'])
    expect(c.ecarts_s0.S0?.tri).toBe(0)
    expect(c.ecarts_s0.S1?.capital_net).toBeCloseTo(indicateurs('S1').capital_net_sortie - indicateurs('S0').capital_net_sortie, PRECISION)
  })

  it('aux cinq horizons de calcul par défaut', () => {
    expect(comparerAuxHorizons(dossierType, p).map((c) => c.horizon)).toEqual([9, 12, 16, 20, 25])
  })
})

describe('non-régression du cas type (T2 de 45 m² en zone A, couple à 90 000 €, 16 ans)', () => {
  const c = comparerScenarios(dossierType, 16, p)
  const tri = (id: IdScenario) => c.indicateurs.find((i) => i.id === id)?.tri ?? null

  it('classement des TRI : Jeanbrun + LLI, puis Jeanbrun, puis LLI, LMNP, SCI à l’IS et location nue', () => {
    const classement = [...c.indicateurs].sort((a, b) => (b.tri ?? -1) - (a.tri ?? -1)).map((i) => i.id)
    expect(classement).toEqual(['S2', 'S1', 'S3', 'S4', 'S3_IS', 'S0'])
  })

  it('aucun scénario ne bat le placement de référence dans ce cas central', () => {
    expect(c.indicateurs.every((i) => (i.ecart_tri_placement ?? -1) < 0)).toBe(true)
  })

  it.each([
    ['S0', -0.0189],
    ['S1', -0.0135],
    ['S2', -0.0101],
    ['S4', -0.0186],
  ] as const)('%s : TRI après impôt de %f', (id, attendu) => {
    expect(tri(id)).toBeCloseTo(attendu, 4)
  })
})
