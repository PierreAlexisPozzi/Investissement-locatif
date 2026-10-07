/**
 * Simulations de vendeur fictives (§12), sur le bien du jeu d'essai : aucune
 * donnée réelle, aucune plaquette de tiers. La première, celle du jeu d'essai
 * préchargé, cumule les hypothèses optimistes que la contre-expertise doit
 * relever ; la seconde est prudente.
 */
import type { SimulationVendeur } from '../../../src/engine/contre-expertise'
import { jeuEssai } from '../../../src/jeu-essai'

/** Jeanbrun sur 9 ans : vacance nulle, loyers et prix revalorisés de 2 %, entretien et plus-value oubliés. */
export const simulationOptimiste: SimulationVendeur = jeuEssai().simulation_vendeur

/** Même opération présentée avec les hypothèses prudentes de l'outil. */
export const simulationPrudente: SimulationVendeur = {
  scenario: 'S1',
  horizon: 9,
  prix: 300000,
  loyer_mensuel: 738,
  revalorisation_loyers: 0.015,
  revalorisation_prix: 0.01,
  vacance_mois_par_an: 0.5,
  charges_copropriete: 600,
  entretien_part_loyers: 0.05,
  taxe_fonciere: 900,
  taux_emprunt: 0.034,
  prix_revente: 280000,
  impot_plus_value_annonce: 5000,
}
