import brut from './hypotheses-defaut.json'
import type { Elargi } from './types'

/** Hypothèse de modélisation : pas une règle fiscale, donc pas de source officielle. */
export interface Hypothese<T> {
  readonly valeur: T
  readonly unite: string
  /** Référence du cahier des charges, ou « choix de l'outil » si la valeur n'y figure pas. */
  readonly origine: string
  readonly commentaire: string
}

export const ENVELOPPES_PLACEMENT = ['pea', 'assurance_vie', 'cto'] as const
export type EnveloppePlacement = (typeof ENVELOPPES_PLACEMENT)[number]

export const MODES_EVOLUTION = ['egale_inflation', 'nulle'] as const
export type ModeEvolution = (typeof MODES_EVOLUTION)[number]

export interface ScenarioPrix {
  readonly decote_neuf: number
  readonly revalorisation_annuelle: number
}

export interface HypothesesDefaut {
  readonly meta: { readonly date: string; readonly principe: string }
  readonly marche: {
    readonly revalorisation_loyers: Hypothese<number>
    readonly revalorisation_charges: Hypothese<number>
    readonly vacance_mois_par_an: Hypothese<number>
    readonly entretien_part_loyers: Hypothese<number>
    readonly frais_cession: Hypothese<number>
    readonly scenarios_prix: Hypothese<{
      readonly pessimiste: ScenarioPrix
      readonly central: ScenarioPrix
      readonly optimiste: ScenarioPrix
    }>
    readonly inflation: Hypothese<number>
    readonly indexation_bareme_ir: Hypothese<ModeEvolution>
    readonly evolution_revenus: Hypothese<ModeEvolution>
  }
  readonly placement_reference: {
    readonly rendement_net_frais: Hypothese<number>
    readonly enveloppe: Hypothese<EnveloppePlacement>
  }
  readonly bien: {
    readonly annees_exoneration_taxe_fonciere: Hypothese<number>
  }
  readonly financement: {
    readonly ira_appliquees: Hypothese<boolean>
  }
  readonly sensibilites: Hypothese<{
    readonly variation_prix_revente: number
    readonly variation_loyer: number
    readonly vacance_mois: { readonly basse: number; readonly haute: number }
    readonly variation_taux_emprunt: number
    readonly variation_revenus: number
    readonly grille_decote_neuf: readonly number[]
    readonly grille_revalorisation_prix: readonly number[]
  }>
  readonly horizons_ans: Hypothese<readonly number[]>
  readonly objectifs: {
    readonly ponderations: Hypothese<PonderationsObjectifs>
    readonly horizon_ans: Hypothese<number>
  }
  readonly recommandation: {
    /** Notes par identifiant de scénario ; leur exhaustivité est contrôlée par le moteur de recommandation. */
    readonly souplesse: Hypothese<Readonly<Record<string, number>>>
    readonly simplicite: Hypothese<Readonly<Record<string, number>>>
    readonly transmission: Hypothese<Readonly<Record<string, number>>>
    readonly alertes: Hypothese<{ readonly ecart_prix_neuf_ancien: number }>
  }
  readonly contre_expertise: {
    readonly tolerance_ecart: Hypothese<number>
  }
}

/** Curseurs de pondération des objectifs (§5.6), total 100. */
export interface PonderationsObjectifs {
  readonly economie_impot: number
  readonly effort_epargne: number
  readonly tri: number
  readonly souplesse: number
  readonly simplicite: number
  readonly transmission: number
}

function verifierHypotheses(d: Elargi<HypothesesDefaut>): HypothesesDefaut {
  const anomalies: string[] = []
  const verifier = (chemin: string, valeur: string, admises: readonly string[]): void => {
    if (!admises.includes(valeur)) anomalies.push(`${chemin} : « ${valeur} » n'est pas admis`)
  }
  verifier('marche.indexation_bareme_ir', d.marche.indexation_bareme_ir.valeur, MODES_EVOLUTION)
  verifier('marche.evolution_revenus', d.marche.evolution_revenus.valeur, MODES_EVOLUTION)
  verifier('placement_reference.enveloppe', d.placement_reference.enveloppe.valeur, ENVELOPPES_PLACEMENT)
  if (anomalies.length > 0) {
    throw new Error(`Hypothèses par défaut invalides :\n- ${anomalies.join('\n- ')}`)
  }
  return d as HypothesesDefaut
}

const donnees: Elargi<HypothesesDefaut> = brut

/** Hypothèses de marché et de modélisation par défaut (§5.5), validées au chargement. */
export const hypothesesDefaut: HypothesesDefaut = verifierHypotheses(donnees)
