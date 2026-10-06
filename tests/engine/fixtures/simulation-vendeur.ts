/**
 * Simulations de vendeur fictives (§12), sur le bien du jeu d'essai : aucune
 * donnée réelle, aucune plaquette de tiers. La première cumule les hypothèses
 * optimistes que la contre-expertise doit relever ; la seconde est prudente.
 */
import type { SimulationVendeur } from '../../../src/engine/contre-expertise'

/** Jeanbrun sur 9 ans : vacance nulle, loyers et prix revalorisés de 2 %, entretien et plus-value oubliés. */
export const simulationOptimiste: SimulationVendeur = {
  scenario: 'S1',
  horizon: 9,
  prix: 300000,
  loyer_mensuel: 738,
  revalorisation_loyers: 0.02,
  revalorisation_prix: 0.02,
  vacance_mois_par_an: 0,
  charges_copropriete: 600,
  taxe_fonciere: 900,
  taux_emprunt: 0.034,
  economie_impot_annoncee: 30000,
  effort_epargne_annonce: 250,
  tmi_supposee: 0.3,
  tri_annonce: 0.05,
}

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
