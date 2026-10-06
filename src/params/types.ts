/**
 * Typage des paramètres sourcés (cahier des charges §3, principe 1).
 *
 * Chaque règle fiscale vit dans un `Parametre` : la valeur n'est jamais
 * séparée de sa source, de sa date de vérification et de son statut.
 */

export const STATUTS_PARAMETRE = ['verifie', 'texte_non_consulte', 'a_confirmer'] as const
export type StatutParametre = (typeof STATUTS_PARAMETRE)[number]

export interface Parametre<T> {
  readonly valeur: T
  readonly unite: string
  readonly source: string
  readonly url_officielle: string
  /** Date ISO (AAAA-MM-JJ) de la dernière lecture de la source ; null si jamais lue. */
  readonly date_verification: string | null
  readonly statut: StatutParametre
  readonly commentaire: string
}

/*
 * Valeurs énumérées : chaque liste sert à la fois au typage et à la
 * validation du JSON à l'exécution (voir validation.ts).
 */
export const ZONES = ['A_bis', 'A', 'B1', 'B2', 'C'] as const
export type Zone = (typeof ZONES)[number]
export type ParZone<T> = Readonly<Record<Zone, T>>

export const NIVEAUX_LOYER = ['intermediaire', 'social', 'tres_social'] as const
export type NiveauLoyer = (typeof NIVEAUX_LOYER)[number]
export type ParNiveauLoyer<T> = Readonly<Record<NiveauLoyer, T>>

export const MODES_ARRONDI_IMPOT = ['euro_le_plus_proche'] as const
export const POINTS_DE_DEPART_JEANBRUN = ['premier_jour_du_mois_achevement_ou_acquisition'] as const
export const MODES_PRORATA = ['mensuel', 'aucun'] as const
export const EXCEPTIONS_RUPTURE_JEANBRUN = ['invalidite_2e_ou_3e_categorie', 'licenciement', 'deces'] as const
export const REPARTITIONS_PLAFOND_CONCUBINS = ['quote_part_par_foyer'] as const
export const TRAITEMENTS_FRAIS_ACQUISITION_LMNP = ['charge_annee_1', 'amortis'] as const
export const PERIMETRES_ASSIMILES_LLI = [
  'convention_ort',
  'contrat_ppa',
  'grande_operation_urbanisme',
  'contrat_redynamisation_site_defense',
  'commune_reindustrialisation_pinm',
] as const
export const STATUTS_CUMUL_JEANBRUN_LLI = ['non_exclu_par_les_textes_lus', 'autorise', 'exclu'] as const
export const PREMIERES_ANNEES_DENORMANDIE = ['annee_achevement_travaux'] as const
export const MODES_APPRECIATION_SURTAXE = ['quote_part', 'societe'] as const

export interface TrancheBareme {
  /** Borne haute de la tranche par part, incluse ; null pour la dernière tranche. */
  readonly jusqua: number | null
  readonly taux: number
}

export interface TauxPrelevementsSociaux {
  readonly total: number
  readonly csg: number
  readonly crds: number
  readonly prelevement_solidarite: number
}

export interface Periode {
  readonly debut: string
  readonly fin: string
}

export interface TrancheSurtaxe {
  /** Borne basse exclue. */
  readonly de: number
  /** Borne haute incluse ; null pour la dernière tranche. */
  readonly a: number | null
  readonly taux: number
  /** Taxe = taux × PV − (lissage_borne − PV) × lissage_coefficient. */
  readonly lissage_borne: number | null
  readonly lissage_coefficient: number
}

export type ModeAppreciationSurtaxe = (typeof MODES_APPRECIATION_SURTAXE)[number]

/** Années de détention révolues de `de` à `a` (incluses), chacune abattue de `taux_annuel`. */
export interface TrancheAbattement {
  readonly de: number
  readonly a: number
  readonly taux_annuel: number
}

export interface MetaParametres {
  readonly version: string
  readonly date_arret: string
  readonly annee_revenus: number
  readonly annee_imposition: number
  readonly textes_pris_en_compte: string
  readonly textes_non_pris_en_compte: string
  readonly convention_taux: string
  readonly convention_statuts: string
}

export interface ParametresFiscaux {
  readonly meta: MetaParametres

  readonly impot_revenu: {
    readonly bareme: Parametre<readonly TrancheBareme[]>
    readonly plafond_quotient_familial_demi_part: Parametre<number>
    readonly parts_quotient_familial: Parametre<{
      readonly personne_seule: number
      readonly couple_marie_pacse: number
      readonly enfant_rang_1_et_2: number
      readonly enfant_rang_3_et_plus: number
    }>
    readonly decote: Parametre<{
      readonly personne_seule: { readonly forfait: number; readonly seuil_impot_brut: number }
      readonly couple: { readonly forfait: number; readonly seuil_impot_brut: number }
      readonly taux: number
    }>
    readonly abattement_frais_professionnels: Parametre<{
      readonly taux: number
      readonly minimum: number
      readonly maximum: number
    }>
    readonly seuil_mise_en_recouvrement: Parametre<number>
    readonly arrondi: Parametre<(typeof MODES_ARRONDI_IMPOT)[number]>
    readonly plafonnement_global_niches: Parametre<number>
  }

  readonly prelevements_sociaux: {
    readonly revenus_fonciers: Parametre<TauxPrelevementsSociaux>
    readonly location_meublee_non_professionnelle: Parametre<TauxPrelevementsSociaux>
    readonly plus_values_immobilieres: Parametre<TauxPrelevementsSociaux>
    readonly csg_deductible: Parametre<number>
    readonly placements: Parametre<{ readonly cas_general: number; readonly assurance_vie: number }>
  }

  readonly placement_reference: {
    readonly pfu_taux_ir: Parametre<number>
    readonly pea: Parametre<{ readonly duree_exoneration_ir_ans: number; readonly plafond_versements: number }>
    readonly assurance_vie: Parametre<{
      readonly duree_avantage_ans: number
      readonly abattement_personne_seule: number
      readonly abattement_couple: number
      readonly taux_ir_primes_jusqua_seuil: number
      readonly taux_ir_primes_au_dela: number
      readonly seuil_primes: number
      readonly taux_ir_avant_8_ans: number
    }>
  }

  readonly loyers_plafonds: {
    readonly intermediaire_m2: Parametre<ParZone<number>>
    readonly coefficient_surface: Parametre<{
      readonly constante: number
      readonly numerateur: number
      readonly maximum: number
      readonly decimales: number
    }>
    readonly arrondi_plafond_m2: Parametre<{ readonly decimales: number }>
    readonly surface_prise_en_compte: Parametre<{ readonly part_annexes: number; readonly plafond_annexes_m2: number }>
    readonly ressources_locataires_intermediaire: Parametre<{
      readonly personne_seule: ParZone<number>
      readonly couple: ParZone<number>
      readonly une_personne_a_charge: ParZone<number>
      readonly deux_personnes_a_charge: ParZone<number>
      readonly trois_personnes_a_charge: ParZone<number>
      readonly quatre_personnes_a_charge: ParZone<number>
      readonly majoration_par_personne_supplementaire: ParZone<number>
    }>
  }

  readonly jeanbrun: {
    readonly periode_acquisition: Parametre<Periode>
    readonly immeuble_collectif_obligatoire: Parametre<boolean>
    readonly beneficiaires: Parametre<{
      readonly personnes_physiques: boolean
      readonly societes_non_soumises_is: boolean
      readonly droits_demembres: boolean
    }>
    readonly conservation_parts_societe: Parametre<boolean>
    readonly duree_engagement_ans: Parametre<number>
    readonly delai_mise_en_location_mois: Parametre<number>
    readonly part_foncier_forfaitaire: Parametre<number>
    readonly taux_amortissement: Parametre<ParNiveauLoyer<number>>
    readonly plafond_annuel: Parametre<ParNiveauLoyer<number>>
    readonly seuil_majoration_plafond: Parametre<number>
    readonly point_de_depart: Parametre<(typeof POINTS_DE_DEPART_JEANBRUN)[number]>
    readonly prorata_premiere_annee: Parametre<(typeof MODES_PRORATA)[number]>
    readonly plafond_proratise_premiere_annee: Parametre<boolean>
    readonly amortissement_apres_engagement: Parametre<boolean>
    readonly option_irrevocable: Parametre<boolean>
    readonly micro_foncier_exclu: Parametre<boolean>
    readonly hors_plafonnement_niches: Parametre<boolean>
    readonly non_cumul: Parametre<{ readonly denormandie: boolean; readonly girardin_social_199_undecies_C: boolean }>
    readonly rupture_engagement: Parametre<{
      readonly reintegration_amortissements: boolean
      readonly systeme_du_quotient: boolean
      readonly exceptions: readonly (typeof EXCEPTIONS_RUPTURE_JEANBRUN)[number][]
    }>
    readonly pv_minoration_prix_acquisition: Parametre<boolean>
    readonly concubins_plafond_par_foyer: Parametre<(typeof REPARTITIONS_PLAFOND_CONCUBINS)[number]>
  }

  readonly deficit_foncier: {
    readonly plafond_imputation_revenu_global: Parametre<number>
    readonly report_revenu_global_ans: Parametre<number>
    readonly report_revenus_fonciers_ans: Parametre<number>
    readonly frais_emprunt_assimiles_interets: Parametre<boolean>
    readonly limite_sans_prorata_temporis: Parametre<boolean>
    readonly limite_appreciee_par_associe: Parametre<boolean>
    readonly maintien_location_annees: Parametre<number>
  }

  readonly micro_foncier: {
    readonly seuil_recettes: Parametre<number>
    readonly abattement: Parametre<number>
    readonly option_reel_irrevocable_ans: Parametre<number>
  }

  readonly lmnp: {
    readonly micro_bic: Parametre<{
      readonly seuil_recettes_revenus_2025: number
      readonly seuil_recettes_revenus_2026: number
      readonly abattement: number
      readonly abattement_minimum: number
    }>
    readonly seuil_non_professionnel_recettes: Parametre<number>
    readonly amortissement_limite_au_resultat: Parametre<boolean>
    readonly deficit_report_ans: Parametre<number>
    readonly reintegration_amortissements_pv: Parametre<{ readonly cessions_a_compter_du: string }>
    readonly immatriculation_delai_jours: Parametre<number>
    readonly modelisation: Parametre<{
      readonly part_terrain: number
      readonly duree_bati_ans: number
      readonly duree_mobilier_ans: number
      readonly frais_acquisition: (typeof TRAITEMENTS_FRAIS_ACQUISITION_LMNP)[number]
    }>
  }

  readonly lli: {
    readonly tva_taux_reduit: Parametre<number>
    readonly tva_taux_normal: Parametre<number>
    readonly acquereur_personne_morale: Parametre<boolean>
    readonly zones_eligibles: Parametre<readonly Zone[]>
    readonly perimetres_assimiles: Parametre<readonly (typeof PERIMETRES_ASSIMILES_LLI)[number][]>
    readonly mixite_sociale_seuil: Parametre<number>
    readonly duree_conditions_ans: Parametre<number>
    readonly complement_tva: Parametre<{
      readonly fin_periode_toujours_du: number
      readonly fin_periode_cession_partielle: number
      readonly part_max_logements_cedes: number
      readonly fin_periode_cession_libre: number
    }>
    readonly cession_parts_sans_complement: Parametre<boolean>
    readonly creance_taxe_fonciere: Parametre<{
      readonly duree_ans: number
      readonly achevement_a_compter_du: string
      readonly teom_exclue: boolean
      readonly taxes_additionnelles_incluses: boolean
      readonly reduite_des_annees_exoneration_totale: boolean
      readonly remboursement_immediat_societe_non_is: boolean
      readonly acquise_a_la_societe: boolean
    }>
    readonly tf_deductible_si_creance: Parametre<boolean>
  }

  readonly cumul_jeanbrun_lli: {
    readonly statut_cumul: Parametre<(typeof STATUTS_CUMUL_JEANBRUN_LLI)[number]>
  }

  readonly societe_is: {
    readonly impot_societes: Parametre<{
      readonly taux_reduit: number
      readonly plafond_benefice_taux_reduit: number
      readonly taux_normal: number
    }>
  }

  readonly denormandie: {
    readonly periode: Parametre<Periode>
    readonly taux_engagement_initial: Parametre<{ readonly six_ans: number; readonly neuf_ans: number }>
    readonly complement_prorogation: Parametre<{
      readonly initial_six_ans: readonly number[]
      readonly initial_neuf_ans: readonly number[]
      readonly duree_periode_ans: number
    }>
    readonly plafond_base_annuel: Parametre<number>
    readonly plafond_m2: Parametre<number>
    readonly logements_max_par_an: Parametre<number>
    readonly part_travaux_min: Parametre<number>
    readonly delai_achevement_travaux_annees: Parametre<number>
    readonly premiere_annee_imputation: Parametre<(typeof PREMIERES_ANNEES_DENORMANDIE)[number]>
    readonly excedent_perdu: Parametre<boolean>
    readonly imputation_sur_impot_progressif: Parametre<boolean>
    readonly dans_plafonnement_niches: Parametre<boolean>
    readonly travaux_base_non_deductibles: Parametre<boolean>
  }

  readonly plus_value_immobiliere: {
    readonly taux_ir: Parametre<number>
    readonly abattement_ir: Parametre<{ readonly tranches: readonly TrancheAbattement[] }>
    readonly abattement_ps: Parametre<{ readonly tranches: readonly TrancheAbattement[] }>
    readonly forfait_frais_acquisition: Parametre<number>
    readonly forfait_travaux: Parametre<{ readonly taux: number; readonly detention_superieure_a_ans: number }>
    readonly forfait_travaux_bien_neuf_amorti: Parametre<boolean>
    readonly surtaxe_plus_values_elevees: Parametre<{
      readonly seuil: number
      readonly tranches: readonly TrancheSurtaxe[]
    }>
    readonly surtaxe_appreciation_seuil: Parametre<{
      readonly epoux: ModeAppreciationSurtaxe
      readonly partenaires_pacs: ModeAppreciationSurtaxe
      readonly concubins: ModeAppreciationSurtaxe
      readonly sci_ir: ModeAppreciationSurtaxe
    }>
  }

  readonly financement: {
    readonly taux_endettement_max: Parametre<number>
    readonly duree_max_pret_ans: Parametre<number>
    readonly indemnites_remboursement_anticipe_plafond: Parametre<{
      readonly mois_interets: number
      readonly part_capital_restant_du: number
    }>
  }
}

/**
 * Forme brute du JSON telle que TypeScript l'infère : les chaînes ne sont pas
 * réduites à leurs valeurs littérales. Sert au contrôle de structure à la
 * compilation ; les valeurs énumérées sont vérifiées à l'exécution.
 */
export type Elargi<T> = T extends string
  ? string
  : T extends number | boolean | null
    ? T
    : T extends readonly (infer U)[]
      ? readonly Elargi<U>[]
      : { readonly [K in keyof T]: Elargi<T[K]> }
