import { describe, expect, it } from 'vitest'
import {
  simulerScenario,
  simulerTousLesScenarios,
  type IdScenario,
  type RegimeFiscal,
  type ResultatSimulation,
} from '../../src/engine/scenario'
import { valeurActuelleNette } from '../../src/engine/actualisation'
import type { Dossier } from '../../src/engine/dossier'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'
import { dossierAncien, dossierConcubins, dossierType } from './fixtures/dossier-type'

const PRECISION = 6
const CENTIMES = 2

function simuler(d: Dossier, id: IdScenario, horizon: number, regime?: RegimeFiscal): ResultatSimulation {
  const r = simulerScenario(d, id, regime === undefined ? { horizon } : { horizon, regime }, p)
  if (r.simulation === null) throw new Error(`${id} inéligible : ${r.eligibilite.motifs.join(' ; ')}`)
  return r.simulation
}

const somme = (valeurs: readonly number[]): number => valeurs.reduce((total, v) => total + v, 0)
const ligne = (s: ResultatSimulation, annee: number) => {
  const l = s.annees.find((a) => a.annee === annee)
  if (l === undefined) throw new Error(`Année ${String(annee)} absente`)
  return l
}

const ELIGIBLES: IdScenario[] = ['S0', 'S1', 'S2', 'S3', 'S3_IS', 'S4']

describe('éligibilité des scénarios du cas type (VEFA en zone A, programme LLI)', () => {
  const resultats = simulerTousLesScenarios(dossierType, 16, p)
  const eligibles = resultats.filter((r) => r.eligibilite.eligible).map((r) => r.id)

  it('S0 à S4 sont éligibles ; les variantes sans plafond saisi et le Denormandie ne le sont pas', () => {
    expect(eligibles).toEqual(ELIGIBLES)
    for (const r of resultats.filter((x) => !x.eligibilite.eligible)) {
      expect(r.simulation).toBeNull()
      expect(r.eligibilite.motifs.length).toBeGreaterThan(0)
    }
  })

  it('S2 porte l’avertissement du cumul Jeanbrun + LLI et ses paramètres à confirmer', () => {
    const s2 = resultats.find((r) => r.id === 'S2')
    expect(s2?.eligibilite.avertissements.join(' ')).toContain('Cumul Jeanbrun + LLI')
    expect(s2?.parametres_a_confirmer).toContain('cumul_jeanbrun_lli.statut_cumul')
  })
})

describe('cohérence des flux (§13 : la somme des flux égale la variation de trésorerie)', () => {
  it.each(ELIGIBLES)('%s : chaque flux annuel est la somme de ses postes', (id) => {
    const s = simuler(dossierType, id, 16)
    for (const a of s.annees) {
      const attendu =
        a.loyers_encaisses -
        a.charges_total -
        a.interets -
        a.capital_rembourse -
        a.assurance_emprunteur +
        a.creance_taxe_fonciere -
        a.impot_revenu_differentiel -
        a.prelevements_sociaux -
        a.impot_societes
      expect(a.flux_tresorerie).toBeCloseTo(attendu, PRECISION)
    }
  })

  it.each(ELIGIBLES)('%s : capital remboursé et capital restant dû à la revente égalent l’emprunt', (id) => {
    const s = simuler(dossierType, id, 16)
    expect(somme(s.annees.map((a) => a.capital_rembourse)) + s.sortie.capital_restant_du).toBeCloseTo(
      dossierType.financement.emprunt,
      CENTIMES,
    )
  })

  it.each(ELIGIBLES)('%s : l’enrichissement total se retrouve poste par poste', (id) => {
    const s = simuler(dossierType, id, 16)
    const enrichissement = somme(s.flux.map((f) => f.montant))
    const o = s.sortie
    const postes =
      -s.cout_total +
      somme(
        s.annees.map(
          (a) =>
            a.loyers_encaisses -
            a.charges_total -
            a.interets -
            a.assurance_emprunteur +
            a.creance_taxe_fonciere -
            a.impot_revenu_differentiel -
            a.prelevements_sociaux -
            a.impot_societes,
        ),
      ) +
      o.prix_revente -
      o.frais_cession -
      o.indemnites_remboursement_anticipe -
      o.impot_plus_value -
      o.complement_tva -
      o.impot_distribution
    expect(enrichissement).toBeCloseTo(postes, CENTIMES)
  })

  it('le calendrier compte les mois détenus, de la signature à la revente', () => {
    const s = simuler(dossierType, 'S0', 16)
    expect(s.calendrier.date_cession).toBe('2044-09-01')
    expect(somme(s.annees.map((a) => a.mois_detention))).toBe(s.calendrier.rang_cession - s.calendrier.rang_acquisition)
    expect(somme(s.annees.map((a) => a.mois_location))).toBe(16 * 12)
  })
})

describe('Jeanbrun (S1)', () => {
  it('première annuité proratisée sur 7 mois, puis 8 000 €/an plafonnés', () => {
    const s = simuler(dossierType, 'S1', 16)
    expect(ligne(s, 2028).amortissement_deduit).toBeCloseTo((8000 * 7) / 12, PRECISION)
    expect(ligne(s, 2030).amortissement_deduit).toBeCloseTo(8000, PRECISION)
    expect(s.alertes.join(' ')).toContain('plafonné')
  })

  it('le déficit hors intérêts s’impute sur le revenu global dans la limite de 10 700 €', () => {
    const s = simuler(dossierType, 'S1', 16)
    expect(ligne(s, 2029).deficit_impute_revenu_global).toBeCloseTo(10700, PRECISION)
    // Couple à 90 000 € : chaque euro imputé fait gagner 30 %.
    expect(ligne(s, 2029).impot_revenu_differentiel).toBeCloseTo(-3210, 0)
  })

  it('revente au terme de l’engagement (9 ans) : amortissements réintégrés dans la plus-value', () => {
    const s = simuler(dossierType, 'S1', 9)
    expect(s.sortie.reprise_jeanbrun).toBe(0)
    expect(s.sortie.plus_value?.amortissements_reintegres).toBeGreaterThan(0)
    expect(s.sortie.impot_plus_value_reintegration).toBeGreaterThan(0)
  })

  it('revente à 8 ans : rupture, amortissements réintégrés au revenu au quotient, pas dans la plus-value', () => {
    const s = simuler(dossierType, 'S1', 8)
    expect(s.sortie.reprise_jeanbrun).toBeGreaterThan(0)
    expect(s.sortie.plus_value?.amortissements_reintegres).toBe(0)
    const derniere = s.annees.at(-1)
    expect(derniere?.impot_revenu_differentiel).toBeGreaterThan(0)
  })

  it('concubins : chaque foyer amortit sa moitié sous son propre plafond (8 400 € au total)', () => {
    const s = simuler(dossierConcubins, 'S1', 16)
    expect(ligne(s, 2030).amortissement_deduit).toBeCloseTo(8400, PRECISION)
  })
})

describe('LLI (S2, S3)', () => {
  it('la créance de taxe foncière est encaissée et la taxe n’est pas déduite', () => {
    const s = simuler(dossierType, 'S3', 16)
    const l = ligne(s, 2030)
    expect(l.creance_taxe_fonciere).toBeCloseTo(900 * 1.02 ** 4, PRECISION)
    expect(l.charges.taxe_fonciere).toBeCloseTo(l.creance_taxe_fonciere, PRECISION)
    expect(ligne(s, 2028).creance_taxe_fonciere).toBe(0)
  })

  it('revente à 12 ans : complément de TVA de 25 000 € ; à 16 ans : aucun', () => {
    expect(simuler(dossierType, 'S2', 12).sortie.complement_tva).toBeCloseTo(25000, PRECISION)
    expect(simuler(dossierType, 'S2', 16).sortie.complement_tva).toBe(0)
  })

  it('S2 : prix TTC à 10 % et fonds propres réduits d’autant', () => {
    const s2 = simuler(dossierType, 'S2', 16)
    const s1 = simuler(dossierType, 'S1', 16)
    expect(s2.prix_acquisition).toBeCloseTo(275000, PRECISION)
    expect(s1.apport - s2.apport).toBeCloseTo(25000 - dossierType.exploitation.sci.constitution, PRECISION)
  })

  it('variante à l’IS : impôt sur les sociétés, pas d’impôt sur le revenu du foyer', () => {
    const s = simuler(dossierType, 'S3_IS', 16)
    expect(s.regime).toBe('is')
    expect(s.annees.every((a) => a.impot_revenu_differentiel === 0)).toBe(true)
  })
})

describe('LMNP (S4) et location nue (S0) : choix du régime', () => {
  it('le régime retenu est le plus favorable en valeur actuelle nette', () => {
    const taux = dossierType.hypotheses.rendement_placement
    for (const id of ['S0', 'S4'] as const) {
      const retenu = simuler(dossierType, id, 16)
      for (const regime of ['reel', 'micro'] as const) {
        const autre = simuler(dossierType, id, 16, regime)
        expect(valeurActuelleNette(retenu.flux, taux)).toBeGreaterThanOrEqual(valeurActuelleNette(autre.flux, taux) - 1e-6)
      }
    }
  })

  it('au réel, les exercices détaillent les amortissements disponibles, déduits et différés', () => {
    const s = simuler(dossierType, 'S4', 16, 'reel')
    expect(s.exercices_lmnp.length).toBeGreaterThan(0)
    const premier = s.exercices_lmnp[0]
    expect(premier?.amortissement_deduit).toBeLessThanOrEqual(premier?.amortissement_disponible ?? 0)
  })
})

describe('Denormandie (S5, logement ancien avec travaux)', () => {
  it('engagement de 9 ans : 18 % du prix de revient, 2 %/an à partir de l’achèvement des travaux', () => {
    const s = simuler(dossierAncien, 'S5_9', 9)
    // Prix de revient : 150 000 + 12 000 + 60 000 = 222 000 €, sous les plafonds.
    expect(ligne(s, 2027).reduction_impot_imputee).toBeCloseTo(222000 * 0.02, PRECISION)
    expect(s.sortie.reprise_denormandie).toBe(0)
  })

  it('revente à 5 ans : les réductions obtenues sont reprises l’année de la cession', () => {
    const s = simuler(dossierAncien, 'S5_9', 5)
    expect(s.sortie.reprise_denormandie).toBeCloseTo(5 * 222000 * 0.02, PRECISION)
  })

  it('les travaux retenus dans la réduction n’entrent pas dans la plus-value', () => {
    const s = simuler(dossierAncien, 'S5_9', 9)
    expect(s.sortie.plus_value?.travaux_forfaitaires).toBe(true)
  })
})

describe('micro-foncier entre concubins', () => {
  it('le seuil s’apprécie foyer par foyer : deux moitiés de loyer restent sous le seuil', () => {
    // Achat comptant et 18 000 € de loyers par an, soit 9 000 € par foyer : l'abattement de 30 %
    // dépasse les charges réelles, le micro-foncier est retenu pour chacun des deux foyers.
    const comptant: Dossier = {
      ...dossierConcubins,
      bien: { ...dossierConcubins.bien, loyer_marche_nu: 1500 },
      financement: { ...dossierConcubins.financement, emprunt: 0, frais_dossier: 0, frais_garantie: 0 },
    }
    expect(simulerScenario(comptant, 'S0', { horizon: 16 }, p).simulation?.regime).toBe('micro')
  })
})

describe('corrections de la revue de l’étape 4', () => {
  it('logement ancien au micro-foncier : les travaux non déduits entrent dans la plus-value', () => {
    const s = simuler(dossierAncien, 'S0', 9, 'micro')
    expect(s.sortie.plus_value?.travaux_retenus).toBe(60000)
    expect(s.annees.every((a) => a.resultat_fiscal > -60000)).toBe(true)
  })

  it('revente un 1er janvier : l’année de cession figure au calendrier, sans mois de détention', () => {
    const janvier: Dossier = {
      ...dossierType,
      bien: { ...dossierType.bien, date_livraison: '2028-11-30', date_debut_location: '2029-01-01' },
    }
    const s = simuler(janvier, 'S1', 9)
    expect(s.calendrier.date_cession).toBe('2038-01-01')
    expect(s.annees.at(-1)).toMatchObject({ annee: 2038, mois_detention: 0 })
    // La location a duré jusqu'au 31/12/2037 : seules les imputations de 2035 à 2037 sont remises en cause.
    const alerte = s.alertes.find((a) => a.includes('remises en cause')) ?? ''
    expect(alerte).toContain('2035, 2036, 2037')
    expect(alerte).not.toContain('2034')
  })

  it('logement ancien : taxe foncière, copropriété et assurance dès l’achat, pas à la fin des travaux', () => {
    const s = simuler(dossierAncien, 'S0', 9)
    const premiere = s.annees[0]
    // Achat en mai 2026 : 8 mois détenus la première année.
    expect(premiere?.charges.taxe_fonciere).toBeCloseTo((900 * 8) / 12, PRECISION)
    expect(premiere?.charges.copropriete).toBeCloseTo((600 * 8) / 12, PRECISION)
  })

  const sansExclusion: ParametresFiscaux = {
    ...p,
    lmnp: { ...p.lmnp, micro_bic_exclu_indivision: { ...p.lmnp.micro_bic_exclu_indivision, valeur: false } },
  }

  it('LMNP entre concubins : logement indivis entre deux foyers, micro-BIC exclu et régime réel retenu', () => {
    // Loyer élevé et achat comptant : sans l'exclusion, le passage au micro-BIC l'emporterait sur le réel.
    const favorableAuMicro = (d: Dossier): Dossier => ({
      ...d,
      bien: { ...d.bien, loyer_marche_meuble: 3000 },
      financement: { ...d.financement, emprunt: 0, frais_dossier: 0, frais_garantie: 0 },
    })
    const concubins = favorableAuMicro(dossierConcubins)
    expect(simulerScenario(concubins, 'S4', { horizon: 16 }, sansExclusion).simulation?.regime).toBe('reel_puis_micro')
    const s = simuler(concubins, 'S4', 16)
    expect(s.regime).toBe('reel')
    expect(s.alertes.some((a) => a.includes('micro-BIC exclu'))).toBe(true)
    // Un foyer unique (couple marié) garde le choix du régime, sans cette alerte.
    const marie = simuler(favorableAuMicro(dossierType), 'S4', 16)
    expect(marie.regime).toBe('reel_puis_micro')
    expect(marie.alertes.some((a) => a.includes('micro-BIC exclu'))).toBe(false)
  })

  it('micro-BIC sans l’exclusion de l’indivision : l’abattement minimum s’applique à la quote-part de chaque foyer', () => {
    const petitLoyer: Dossier = { ...dossierConcubins, bien: { ...dossierConcubins.bien, loyer_marche_meuble: 40 } }
    const s = simulerScenario(petitLoyer, 'S4', { horizon: 16, regime: 'micro' }, sansExclusion).simulation
    // 40 € par mois, soit moins de 305 € de recettes par foyer : bénéfice nul pour chacun.
    expect(s?.annees.filter((a) => a.mois_location === 12).every((a) => a.resultat_fiscal === 0)).toBe(true)
  })
})

describe('placement de référence équivalent (S6)', () => {
  it('reçoit l’apport puis les efforts d’épargne du scénario, sur la même durée', () => {
    const s = simuler(dossierType, 'S0', 16)
    expect(s.placement.versements_nets).toBeCloseTo(s.apport - somme(s.annees.map((a) => a.flux_tresorerie)), CENTIMES)
    expect(s.placement.capital_net).toBeGreaterThan(0)
  })
})
