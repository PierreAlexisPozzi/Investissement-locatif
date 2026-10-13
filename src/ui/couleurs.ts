/**
 * Couleurs des graphiques. Palette catégorielle à huit teintes, dans un ordre
 * vérifié pour les daltonismes (protanopie, deutéranopie) avec l'outil de
 * validation de la palette : chaque scénario garde sa couleur quel que soit le
 * nombre de scénarios éligibles. Les scénarios du neuf (Jeanbrun, LLI) et ceux
 * de l'ancien (Denormandie) ne sont jamais éligibles ensemble : ils partagent
 * des teintes, choisies pour que chaque ensemble affiché reste lisible.
 */
import type { IdScenario } from '../engine/scenario'

/** Huit teintes, dans l'ordre validé. */
const PALETTE = {
  bleu: '#2a78d6',
  orange: '#eb6834',
  turquoise: '#1baf7a',
  jaune: '#eda100',
  rose: '#e87ba4',
  vert: '#008300',
  violet: '#6250d6',
  rouge: '#e34948',
} as const

export const COULEURS_SCENARIOS: Readonly<Record<IdScenario, string>> = {
  S0: PALETTE.bleu,
  S1: PALETTE.orange,
  S1_social: PALETTE.violet,
  S1_tres_social: PALETTE.rouge,
  S2: PALETTE.turquoise,
  S3: PALETTE.jaune,
  S3_IS: PALETTE.rose,
  S4: PALETTE.vert,
  S5_6: PALETTE.rose,
  S5_9: PALETTE.violet,
  S5_12: PALETTE.orange,
}

/** Composantes de l'avantage fiscal (§11, écran 4) : trois gains empilés, les reprises en négatif. */
export const COULEURS_AVANTAGE = {
  impot_evite: PALETTE.bleu,
  tva_economisee: PALETTE.turquoise,
  taxe_fonciere_remboursee: PALETTE.violet,
  impot_plus_value_repris: PALETTE.rouge,
} as const

/** Habillage des graphiques : grille et axes discrets, gris de mise en retrait. */
export const HABILLAGE = {
  grille: '#e6e9ee',
  axe: '#c9ced6',
  texte_axe: '#5a6372',
  retrait: '#c4c9d1',
  reference: '#5a6372',
  /** Série principale d'un graphique à une seule série. */
  principale: PALETTE.bleu,
} as const
