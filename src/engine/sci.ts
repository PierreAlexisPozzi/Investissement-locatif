/**
 * SCI : frais propres, répartition entre associés ; variante indicative à
 * l'impôt sur les sociétés (§5.4, §8.3).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. À l'impôt sur le revenu, le résultat foncier de la SCI se calcule
 * avec `revenus-fonciers.ts` puis se répartit entre associés ; la limite
 * d'imputation du déficit s'apprécie par associé.
 *
 * La variante à l'IS (S3 bis) est simplifiée : amortissement linéaire du bâti
 * selon les hypothèses de modélisation du LMNP, déficits reportables sans
 * limite de durée, plus-value égale au prix net diminué de la valeur nette
 * comptable, bénéfices distribués au prélèvement forfaitaire unique.
 */
import type { ParametresFiscaux } from '../params'
import { repartir } from './commun'

export interface FraisSci {
  /**
   * Statuts, immatriculation, annonce légale : payés l'année 0, non déduits des
   * revenus fonciers. TODO(fiscal) : aucune source lue ne traite leur déduction.
   */
  readonly constitution: number
  readonly comptabilite_annuelle: number
  readonly frais_bancaires_annuels: number
}

export interface FraisAnnuelsSci {
  /** Comptabilité : charge déductible des revenus fonciers (§8.2). */
  readonly deductibles_revenus_fonciers: number
  /**
   * Frais bancaires : autres frais de gestion, couverts par le forfait par local
   * (BOI-RFPI-BASE-20-10, §240) et donc non déduits en plus (lecture de l'outil).
   */
  readonly non_deductibles_revenus_fonciers: number
  readonly total: number
}

/** Frais de fonctionnement de l'année de rang `rang` (1 = première année), revalorisés au taux annuel donné. */
export function fraisAnnuelsSci(f: FraisSci, rang: number, revalorisation: number): FraisAnnuelsSci {
  const coefficient = (1 + revalorisation) ** (rang - 1)
  const deductibles = f.comptabilite_annuelle * coefficient
  const nonDeductibles = f.frais_bancaires_annuels * coefficient
  return {
    deductibles_revenus_fonciers: deductibles,
    non_deductibles_revenus_fonciers: nonDeductibles,
    total: deductibles + nonDeductibles,
  }
}

/** Part de chaque associé dans un résultat, une créance ou un flux de la SCI. */
export function repartirEntreAssocies(montant: number, quotesParts: readonly number[]): number[] {
  return repartir(montant, quotesParts)
}

/** Impôt sur les sociétés : taux réduit jusqu'au plafond de bénéfice, taux normal au-delà. */
export function impotSocietes(benefice: number, p: ParametresFiscaux): number {
  if (benefice <= 0) return 0
  const { taux_reduit, plafond_benefice_taux_reduit, taux_normal } = p.societe_is.impot_societes.valeur
  const tranche = Math.min(benefice, plafond_benefice_taux_reduit)
  return tranche * taux_reduit + (benefice - tranche) * taux_normal
}

export interface PlanAmortissementSciIs {
  /** Part du terrain, non amortissable. */
  readonly terrain: number
  readonly bati: number
  readonly duree_bati_ans: number
  readonly dotation_annuelle: number
  /** Frais d'acquisition passés en charge la première année (option retenue pour le LMNP). */
  readonly frais_en_charge: number
}

/** Amortissement comptable du bâti, frais d'acquisition traités comme en LMNP (charge ou amortissement). */
export function planAmortissementSciIs(
  prixAcquisition: number,
  fraisAcquisition: number,
  p: ParametresFiscaux,
): PlanAmortissementSciIs {
  const m = p.lmnp.modelisation.valeur
  const fraisAmortis = m.frais_acquisition === 'amortis' ? fraisAcquisition : 0
  const cout = prixAcquisition + fraisAmortis
  const terrain = cout * m.part_terrain
  const bati = cout - terrain
  return {
    terrain,
    bati,
    duree_bati_ans: m.duree_bati_ans,
    dotation_annuelle: bati / m.duree_bati_ans,
    frais_en_charge: fraisAcquisition - fraisAmortis,
  }
}

export interface EntreeExerciceSciIs {
  readonly annee: number
  readonly loyers: number
  /** Charges de l'exercice : intérêts, assurance, taxe foncière, copropriété, gestion, comptabilité, frais bancaires… */
  readonly charges: number
  readonly amortissements: number
  /** Plus-value de cession de l'immeuble réalisée dans l'exercice (voir `plusValueCessionSciIs`). */
  readonly plus_value_cession?: number
  /** Déficits antérieurs reportables. */
  readonly deficits_anterieurs: number
}

export interface ExerciceSciIs {
  readonly annee: number
  readonly resultat_comptable: number
  readonly deficits_imputes: number
  readonly benefice_imposable: number
  readonly impot_societes: number
  /** Résultat après impôt, distribuable s'il est positif. */
  readonly resultat_net: number
  readonly deficits_reportables: number
}

export function exerciceSciIs(e: EntreeExerciceSciIs, p: ParametresFiscaux): ExerciceSciIs {
  const resultat = e.loyers - e.charges - e.amortissements + (e.plus_value_cession ?? 0)
  const imputes = Math.min(Math.max(0, resultat), e.deficits_anterieurs)
  const benefice = Math.max(0, resultat) - imputes
  const impot = impotSocietes(benefice, p)
  return {
    annee: e.annee,
    resultat_comptable: resultat,
    deficits_imputes: imputes,
    benefice_imposable: benefice,
    impot_societes: impot,
    resultat_net: resultat - impot,
    deficits_reportables: e.deficits_anterieurs - imputes + Math.max(0, -resultat),
  }
}

/** Plus-value professionnelle : prix de cession net de frais diminué de la valeur nette comptable. */
export function plusValueCessionSciIs(
  prixCession: number,
  fraisCession: number,
  coutAcquisitionInscrit: number,
  amortissementsCumules: number,
): number {
  return prixCession - fraisCession - (coutAcquisitionInscrit - amortissementsCumules)
}

export interface FiscaliteDistribution {
  readonly impot_revenu: number
  readonly prelevements_sociaux: number
  readonly net: number
}

/** Dividendes versés aux associés personnes physiques, au prélèvement forfaitaire unique (option du barème non modélisée). */
export function fiscaliteDistribution(dividendes: number, p: ParametresFiscaux): FiscaliteDistribution {
  const assiette = Math.max(0, dividendes)
  const impot = assiette * p.placement_reference.pfu_taux_ir.valeur
  const prelevements = assiette * p.prelevements_sociaux.placements.valeur.cas_general
  return { impot_revenu: impot, prelevements_sociaux: prelevements, net: assiette - impot - prelevements }
}
