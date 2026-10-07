/**
 * Point d'entrée des paramètres. Le moteur reçoit toujours les paramètres en
 * argument (fonctions pures) : l'interface peut ainsi lui passer une version
 * modifiée par l'utilisateur sans toucher à ce module.
 */
import brut from './fiscal-2026.json'
import type { Elargi, ParametresFiscaux } from './types'
import { verifierParametres } from './validation'

/** Contrôle à la compilation : le JSON doit fournir chaque paramètre typé. */
const donnees: Elargi<ParametresFiscaux> = brut

/** Paramètres fiscaux arrêtés au 06/10/2026, validés au chargement. */
export const parametresFiscaux2026: ParametresFiscaux = verifierParametres(donnees)

export * from './types'
export { listerParametres, estParametre, type EntreeParametre } from './parcours'
export { listerAnomalies, verifierParametres } from './validation'
export {
  appliquerSurcharges,
  memeForme,
  type ParametresEffectifs,
  type SurchargeParametre,
  type SurchargesParametres,
} from './surcharges'
export { DOMAINES_OFFICIELS, estUrlOfficielle } from './sources-officielles'
export {
  hypothesesDefaut,
  ENVELOPPES_PLACEMENT,
  MODES_EVOLUTION,
  type EnveloppePlacement,
  type Hypothese,
  type HypothesesDefaut,
  type ModeEvolution,
  type PonderationsObjectifs,
  type ScenarioPrix,
} from './hypotheses'
