/**
 * Jeu d'essai fictif (cahier des charges §14, étape 7) : T2 de 45 m² en zone A,
 * 250 000 € HT en VEFA, couple marié avec 90 000 € de revenu imposable.
 * Aucune donnée personnelle : toutes les valeurs sont inventées.
 */
import { hypothesesParDefaut, type Dossier } from '../../../src/engine/dossier'

export const dossierType: Dossier = {
  foyers: {
    situation: 'marie_pacse',
    foyers: [{ libelle: 'Couple', revenu_imposable: 90000, parts: 2, quote_part: 1 }],
    capacite_epargne_mensuelle: 800,
    apport_disponible: 40000,
  },
  bien: {
    etat: 'vefa',
    type_logement: 'appartement_collectif',
    zone: 'A',
    commune_denormandie: false,
    programme_lli: true,
    surface: { habitable: 45 },
    prix_ht: 250000,
    frais_notaire: 7500,
    date_acquisition: '2026-11-15',
    date_livraison: '2028-06-30',
    date_debut_location: '2028-09-01',
    loyer_marche_nu: 800,
    loyer_marche_meuble: 900,
    taxe_fonciere: 900,
    teom: 150,
    charges_copropriete_non_recuperables: 600,
    prix_m2_ancien_recent: 5500,
  },
  financement: {
    emprunt: 250000,
    taux_annuel: 0.034,
    duree_mois: 300,
    differe_mois: 18,
    taux_assurance_annuel: 0.003,
    frais_dossier: 1000,
    frais_garantie: 2500,
  },
  exploitation: {
    frais_gestion_part_loyers: 0.07,
    assurance_loyers_impayes_part_loyers: 0.025,
    assurance_pno_annuelle: 150,
    lmnp: { mobilier: 5000, comptable_annuel: 500, cfe_annuelle: 300 },
    sci: { constitution: 1500, comptabilite_annuelle: 1200, frais_bancaires_annuels: 120 },
  },
  hypotheses: hypothesesParDefaut('central'),
}

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
