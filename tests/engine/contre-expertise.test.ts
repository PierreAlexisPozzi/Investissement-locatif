import { describe, expect, it } from 'vitest'
import { contreExpertiser, type CodeHypotheseOptimiste, type SimulationVendeur } from '../../src/engine/contre-expertise'
import type { Dossier } from '../../src/engine/dossier'
import { simulerScenario } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierType } from './fixtures/dossier-type'
import { simulationOptimiste, simulationPrudente } from './fixtures/simulation-vendeur'

const PRECISION = 6
const CENTIMES = 2

/** Marché constaté sous le plafond intermédiaire (738 € pour 45 m² en zone A). */
const marcheSousPlafond: Dossier = { ...dossierType, bien: { ...dossierType.bien, loyer_marche_nu: 700 } }
const codes = (d: Dossier, v: SimulationVendeur): CodeHypotheseOptimiste[] =>
  contreExpertiser(d, v, p).hypotheses_optimistes.map((h) => h.code)

describe('recalcul avec les hypothèses du vendeur (§12)', () => {
  it('le prix de revente annoncé est repris exactement', () => {
    const c = contreExpertiser(dossierType, { ...simulationOptimiste, prix_revente: 340000 }, p)
    expect(c.recalcul_vendeur?.sortie.prix_revente).toBeCloseTo(340000, CENTIMES)
  })

  it('sans prix de revente annoncé : prix d’achat revalorisé au taux du vendeur, sans décote du neuf', () => {
    const c = contreExpertiser(dossierType, simulationOptimiste, p)
    const s = simulerScenario(dossierType, 'S1', { horizon: 9 }, p).simulation
    const duree = s?.calendrier.duree_detention_ans ?? 0
    expect(c.recalcul_vendeur?.sortie.prix_revente).toBeCloseTo(300000 * 1.02 ** duree, CENTIMES)
  })

  it('prix TTC du LLI converti au taux réduit : même prix d’acquisition que celui annoncé', () => {
    const c = contreExpertiser(dossierType, { ...simulationOptimiste, scenario: 'S2', prix: 275000 }, p)
    expect(c.recalcul_vendeur?.indicateurs).not.toBeNull()
    const s = simulerScenario(dossierType, 'S2', { horizon: 9 }, p).simulation
    expect(s?.prix_acquisition).toBeCloseTo(275000, PRECISION)
  })

  it('un loyer au-delà du plafond est ramené au plafond dans le recalcul', () => {
    const c = contreExpertiser(dossierType, { ...simulationOptimiste, loyer_mensuel: 900 }, p)
    expect(codes(dossierType, { ...simulationOptimiste, loyer_mensuel: 900 })).toContain('loyer_au_dela_du_plafond')
    const prudent = contreExpertiser(dossierType, simulationOptimiste, p)
    // Au plafond dans les deux cas : même effort recalculé.
    expect(c.recalcul_vendeur?.indicateurs.effort_mensuel_moyen).toBeCloseTo(prudent.recalcul_vendeur?.indicateurs.effort_mensuel_moyen ?? 0, PRECISION)
  })

  it('scénario inéligible pour le bien : pas de recalcul, motif rappelé', () => {
    const zoneC: Dossier = { ...dossierType, bien: { ...dossierType.bien, zone: 'C' } }
    const c = contreExpertiser(zoneC, { ...simulationOptimiste, scenario: 'S3', prix: 275000 }, p)
    expect(c).toMatchObject({ eligible: false, recalcul_vendeur: null, rejeu_prudent: null, ecarts: [] })
    expect(c.motifs_ineligibilite.length).toBeGreaterThan(0)
    expect(c.synthese).toContain('n’est pas éligible')
  })
})

describe('écarts de plus de 5 % avec les résultats annoncés', () => {
  const c = contreExpertiser(dossierType, simulationOptimiste, p)
  const recalcul = c.recalcul_vendeur?.indicateurs
  if (recalcul === undefined) throw new Error('recalcul absent')

  it('l’économie d’impôt, l’effort et le TRI annoncés sont comparés au recalcul', () => {
    expect(c.ecarts.map((e) => e.indicateur)).toEqual(['economie_impot', 'effort_epargne', 'tri'])
    for (const e of c.ecarts) {
      expect(e.ecart).toBeCloseTo(e.annonce - e.recalcule, PRECISION)
      expect(e.ecart_relatif).toBeCloseTo((e.annonce - e.recalcule) / Math.abs(e.recalcule), PRECISION)
    }
    expect(c.ecarts.every((e) => e.significatif)).toBe(true)
  })

  it('un écart de 3 % n’est pas signalé, un écart de 10 % l’est', () => {
    const proche = contreExpertiser(dossierType, { ...simulationOptimiste, effort_epargne_annonce: recalcul.effort_mensuel_moyen * 1.03 }, p)
    expect(proche.ecarts.find((e) => e.indicateur === 'effort_epargne')?.significatif).toBe(false)
    const loin = contreExpertiser(dossierType, { ...simulationOptimiste, effort_epargne_annonce: recalcul.effort_mensuel_moyen * 1.1 }, p)
    expect(loin.ecarts.find((e) => e.indicateur === 'effort_epargne')?.significatif).toBe(true)
  })

  it('l’impôt de plus-value annoncé est comparé quand il est fourni', () => {
    const avecPv = contreExpertiser(dossierType, { ...simulationOptimiste, impot_plus_value_annonce: 1000 }, p)
    expect(avecPv.ecarts.map((e) => e.indicateur)).toContain('impot_plus_value')
  })
})

describe('hypothèses optimistes signalées', () => {
  it('la simulation optimiste cumule les hypothèses du §12', () => {
    expect(codes(marcheSousPlafond, simulationOptimiste)).toEqual([
      'vacance_nulle',
      'revalorisation_loyers',
      'revente_sans_decote',
      'charges_absentes',
      'plus_value_absente',
      'loyer_au_plafond',
      'tmi_constante',
    ])
  })

  it('la simulation prudente n’en déclenche aucune', () => {
    expect(codes(dossierType, simulationPrudente)).toEqual([])
  })

  it('taxe foncière, charges de copropriété et frais de SCI absents', () => {
    const sansCharges: SimulationVendeur = { ...simulationPrudente, scenario: 'S2', prix: 275000, charges_copropriete: undefined, taxe_fonciere: 0 }
    expect(codes(dossierType, sansCharges)).toEqual(expect.arrayContaining(['charges_absentes', 'taxe_fonciere_absente', 'frais_sci_absents']))
    expect(codes(dossierType, { ...sansCharges, frais_sci_annuels: 1320 })).not.toContain('frais_sci_absents')
  })

  it('loyer au plafond seulement si le marché est en dessous ; loyer au-delà du marché pour un loyer libre', () => {
    expect(codes(dossierType, simulationOptimiste)).not.toContain('loyer_au_plafond')
    const lmnp: SimulationVendeur = { ...simulationPrudente, scenario: 'S4', loyer_mensuel: 1100 }
    expect(codes(dossierType, lmnp)).toContain('loyer_au_dela_du_marche')
  })

  it('TMI supposée au-dessus de celle du foyer', () => {
    const c = contreExpertiser(dossierType, { ...simulationOptimiste, tmi_supposee: 0.41 }, p)
    expect(c.hypotheses_optimistes.find((h) => h.code === 'tmi_constante')?.message).toMatch(/au-dessus de la vôtre \(30\s%\)/)
  })
})

describe('rejeu avec les hypothèses prudentes', () => {
  const c = contreExpertiser(marcheSousPlafond, simulationOptimiste, p)

  it('effort plus élevé et TRI plus faible que le recalcul aux hypothèses du vendeur', () => {
    const vendeur = c.recalcul_vendeur?.indicateurs
    const prudent = c.rejeu_prudent?.indicateurs
    expect(prudent?.effort_mensuel_moyen ?? 0).toBeGreaterThan(vendeur?.effort_mensuel_moyen ?? 0)
    expect(prudent?.tri ?? 0).toBeLessThan(vendeur?.tri ?? 0)
    expect(c.ecart_effort_prudent).toBeCloseTo((prudent?.effort_mensuel_moyen ?? 0) - (vendeur?.effort_mensuel_moyen ?? 0), PRECISION)
    expect(c.ecart_tri_prudent).toBeCloseTo((prudent?.tri ?? 0) - (vendeur?.tri ?? 0), PRECISION)
  })

  it('le loyer annoncé est ramené au marché constaté, la revente subit la décote du neuf', () => {
    const prudent = c.rejeu_prudent
    expect(prudent?.sortie.prix_revente ?? 0).toBeLessThan(simulationOptimiste.prix)
    const s = simulerScenario(marcheSousPlafond, 'S1', { horizon: 9 }, p).simulation
    // Mêmes charges et même loyer que le dossier : le rejeu prudent retrouve la simulation du dossier.
    expect(prudent?.indicateurs.effort_mensuel_moyen).toBeCloseTo(
      (s?.annees.reduce((t, a) => t - a.flux_tresorerie, 0) ?? 0) / (s?.annees.reduce((t, a) => t + a.mois_detention, 0) ?? 1),
      PRECISION,
    )
  })

  it('synthèse chiffrée', () => {
    expect(c.synthese).toMatch(/^Avec des hypothèses prudentes, l’effort d’épargne passe de .* à .* par mois et le TRI après impôt de/)
    expect(c.synthese).toContain('hypothèse(s) optimiste(s)')
  })
})
