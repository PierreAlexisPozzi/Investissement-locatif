/**
 * Couleurs des scénarios dans les graphiques : une teinte par famille de
 * dispositifs, des nuances pour les variantes. Palette lisible en impression.
 */
import type { IdScenario } from '../engine/scenario'

export const COULEURS_SCENARIOS: Readonly<Record<IdScenario, string>> = {
  S0: '#4d4d4d',
  S1: '#1f4e79',
  S1_social: '#3c6fa3',
  S1_tres_social: '#6f97c4',
  S2: '#7b2d8e',
  S3: '#b0479b',
  S3_IS: '#d58bc4',
  S4: '#2e7d32',
  S5_6: '#b35c00',
  S5_9: '#d9822b',
  S5_12: '#e8b062',
}

/** Composantes de l'avantage fiscal (§11, écran 4). */
export const COULEURS_AVANTAGE = {
  impot_evite: '#1f4e79',
  tva_economisee: '#2e7d32',
  taxe_fonciere_remboursee: '#b0479b',
  impot_plus_value_repris: '#b3261e',
} as const
