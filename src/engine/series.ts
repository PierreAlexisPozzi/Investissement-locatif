/**
 * Données des graphiques des écrans Tableau de bord et Comparaison (§11,
 * écran 4) : flux de trésorerie cumulés après impôt, capital net à la sortie
 * par horizon et comparé au placement, effort d'épargne par année,
 * décomposition de l'avantage fiscal. Ce sont des regroupements des résultats
 * du moteur ; aucune règle fiscale ici.
 */
import { lireDate } from './dates'
import type { ComparaisonHorizon, Indicateurs } from './indicateurs'
import type { IdScenario, ResultatSimulation } from './scenario'

export interface PointSerie {
  readonly abscisse: number
  readonly valeurs: Readonly<Partial<Record<IdScenario, number>>>
}

/**
 * Trésorerie cumulée après impôt, année civile par année civile : fonds propres versés à la signature,
 * flux de chaque année, puis produit net de la revente l'année de la cession.
 */
export function fluxCumules(c: ComparaisonHorizon): PointSerie[] {
  const parAnnee = new Map<number, Partial<Record<IdScenario, number>>>()
  for (const r of c.scenarios) {
    const s = r.simulation
    if (s === null) continue
    let cumul = -s.apport
    const derniere = s.annees.at(-1)?.annee
    for (const a of s.annees) {
      cumul += a.flux_tresorerie + (a.annee === derniere ? s.sortie.produit_net : 0)
      const ligne = parAnnee.get(a.annee) ?? {}
      ligne[r.id] = cumul
      parAnnee.set(a.annee, ligne)
    }
  }
  return [...parAnnee.entries()].sort(([a], [b]) => a - b).map(([abscisse, valeurs]) => ({ abscisse, valeurs }))
}

/** Capital net à la sortie de chaque scénario éligible, pour chaque horizon de calcul. */
export function capitalNetParHorizon(comparaisons: readonly ComparaisonHorizon[]): PointSerie[] {
  return comparaisons.map((c) => ({
    abscisse: c.horizon,
    valeurs: Object.fromEntries(c.indicateurs.map((i) => [i.id, i.capital_net_sortie])),
  }))
}

export interface DecompositionAvantage {
  readonly id: IdScenario
  /** Impôt sur le revenu et prélèvements sociaux évités pendant la détention. */
  readonly impot_evite: number
  readonly tva_economisee: number
  /** Créance de taxe foncière du LLI. */
  readonly taxe_fonciere_remboursee: number
  /** Reprises à la revente (impôt de plus-value des amortissements, reprises Jeanbrun et Denormandie), en négatif. */
  readonly impot_plus_value_repris: number
  readonly total: number
}

/** Décomposition de l'avantage fiscal de chaque scénario éligible. */
export function decompositionAvantage(indicateurs: readonly Indicateurs[]): DecompositionAvantage[] {
  return indicateurs.map((i) => {
    const repris = -i.reprise_a_la_revente
    return {
      id: i.id,
      impot_evite: i.economie_impot_cumulee,
      tva_economisee: i.tva_economisee,
      taxe_fonciere_remboursee: i.creance_taxe_fonciere_cumulee,
      impot_plus_value_repris: repris,
      total: i.economie_impot_cumulee + i.tva_economisee + i.creance_taxe_fonciere_cumulee + repris,
    }
  })
}

/** Année civile de la revente à l'horizon de la comparaison, pour l'affichage. */
export function anneeDeCession(c: ComparaisonHorizon): number | null {
  const s = c.scenarios.find((r) => r.simulation !== null)?.simulation
  return s === undefined || s === null ? null : lireDate(s.calendrier.date_cession).annee
}

export interface EffortAnnuel {
  readonly annee: number
  /** Effort d'épargne mensuel moyen de l'année : négatif quand l'opération dégage de la trésorerie. */
  readonly mensuel: number
}

/** Effort d'épargne mensuel de chaque année de détention, flux de l'année réparti sur ses mois de détention (comme les indicateurs). */
export function effortParAnnee(s: ResultatSimulation): EffortAnnuel[] {
  return s.annees.filter((a) => a.mois_detention > 0).map((a) => ({ annee: a.annee, mensuel: -a.flux_tresorerie / a.mois_detention }))
}

export interface CapitalCompare {
  readonly id: IdScenario
  readonly capital: number
  /** Capital net des mêmes décaissements placés au rendement de référence. */
  readonly placement: number
  readonly ecart: number
}

/** Capital net à la sortie de chaque scénario éligible et de son placement équivalent, du plus élevé au plus faible. */
export function capitalCompareAuPlacement(indicateurs: readonly Indicateurs[]): CapitalCompare[] {
  return indicateurs
    .map((i) => ({ id: i.id, capital: i.capital_net_sortie, placement: i.capital_net_placement, ecart: i.ecart_capital_placement }))
    .sort((a, b) => b.capital - a.capital)
}
