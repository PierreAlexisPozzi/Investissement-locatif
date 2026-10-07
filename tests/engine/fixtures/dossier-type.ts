/**
 * Cas type des tests : le jeu d'essai fictif préchargé par l'application (cahier des charges §14, étape 7), lu dans
 * `src/jeu-essai/cas-type.json` : T2 de 45 m² en zone A, 250 000 € HT en VEFA, couple marié avec 90 000 € de revenu
 * imposable. Les tests de non-régression portent ainsi sur le dossier que l'utilisateur voit au premier lancement.
 */
import type { Dossier } from '../../../src/engine/dossier'
import { jeuEssai } from '../../../src/jeu-essai'

export const dossierType: Dossier = jeuEssai().dossier

/** Variante ancienne avec travaux, en commune éligible au Denormandie. */
export const dossierAncien: Dossier = {
  ...dossierType,
  bien: {
    ...dossierType.bien,
    etat: 'ancien',
    commune_denormandie: true,
    programme_lli: false,
    prix_ht: 150000,
    frais_notaire: 12000,
    travaux: 60000,
    date_acquisition: '2026-05-10',
    date_livraison: '2027-03-31',
    date_debut_location: '2027-05-01',
    loyer_marche_nu: 700,
    loyer_marche_meuble: 800,
  },
  financement: { ...dossierType.financement, emprunt: 200000, differe_mois: 0 },
}

/** Variante : couple de concubins, deux foyers à parts égales. */
export const dossierConcubins: Dossier = {
  ...dossierType,
  foyers: {
    ...dossierType.foyers,
    situation: 'concubins',
    foyers: [
      { libelle: 'Concubin 1', revenu_imposable: 45000, parts: 1, quote_part: 0.5 },
      { libelle: 'Concubin 2', revenu_imposable: 45000, parts: 1, quote_part: 0.5 },
    ],
  },
}

/**
 * Variante favorable à l'immobilier, pour tester la cohérence de la recommandation (§14) :
 * loyers plus élevés, revente sans décote du neuf et revalorisée de 2,5 %/an, capacité d'épargne de 1 500 €.
 */
export const dossierFavorable: Dossier = {
  ...dossierType,
  foyers: { ...dossierType.foyers, capacite_epargne_mensuelle: 1500 },
  bien: { ...dossierType.bien, loyer_marche_nu: 1000, loyer_marche_meuble: 1150 },
  hypotheses: { ...dossierType.hypotheses, prix: { decote_neuf: 0, revalorisation_annuelle: 0.025 } },
}
