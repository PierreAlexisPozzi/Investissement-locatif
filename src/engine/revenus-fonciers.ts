/**
 * Revenus fonciers : régime réel et micro-foncier, ventilation du déficit
 * (charges financières imputées en priorité sur les recettes), stocks de
 * déficits par millésime, prélèvements sociaux et maintien de la location
 * (§8.2).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Pour une SCI à l'IR, la limite d'imputation s'apprécie par associé :
 * l'appelant passe la quote-part de chaque associé, cumulée avec ses autres
 * revenus fonciers.
 */
import type { ParametresFiscaux } from '../params'
import { ajouterDeficit, imputerDeficits, type Millesime } from './deficits'

export interface ChargesFoncieres {
  readonly interets: number
  readonly assurance_emprunteur?: number
  /** Frais de dossier et de garantie de l'emprunt, déduits l'année de leur paiement. */
  readonly frais_emprunt?: number
  /** Taxe foncière déductible, copropriété non récupérable, assurance PNO, gestion, loyers impayés, entretien, comptabilité de SCI… */
  readonly autres_charges: number
  /** Amortissement Jeanbrun déduit (étape 3). */
  readonly amortissement?: number
}

export interface EntreeFonciere {
  readonly annee: number
  /** Recettes brutes de l'année, autres revenus fonciers du foyer au réel compris. */
  readonly recettes: number
  readonly charges: ChargesFoncieres
  /** Déficits antérieurs reportables sur les revenus fonciers (10 ans). */
  readonly deficits_anterieurs?: readonly Millesime[]
}

export interface ResultatFoncierReel {
  readonly annee: number
  readonly recettes: number
  /** Intérêts et, par arbitrage du 06/10/2026, assurance et frais d'emprunt. */
  readonly charges_financieres: number
  /** Autres charges et amortissement. */
  readonly autres_deductions: number
  /** Recettes − toutes les déductions ; négatif en cas de déficit. */
  readonly resultat: number
  readonly deficits_anterieurs_imputes: number
  readonly deficits_perimes: number
  /** Revenu foncier net imposable au barème et aux prélèvements sociaux. */
  readonly revenu_foncier_imposable: number
  /** Déficit imputable sur le revenu global de l'année, dans la limite annuelle. */
  readonly deficit_imputable_revenu_global: number
  /** Charges financières non couvertes par les recettes : reportables sur les seuls revenus fonciers. */
  readonly interets_non_couverts: number
  /** Déficit hors charges financières au-delà de la limite annuelle : reportable sur les seuls revenus fonciers. */
  readonly excedent_au_dela_du_plafond: number
  readonly deficits_reportables: readonly Millesime[]
}

/** Répartit les charges entre charges financières (imputées en priorité) et autres déductions. */
export function ventilerCharges(
  c: ChargesFoncieres,
  p: ParametresFiscaux,
): { readonly financieres: number; readonly autres: number } {
  const fraisAccessoires = (c.assurance_emprunteur ?? 0) + (c.frais_emprunt ?? 0)
  const assimiles = p.deficit_foncier.frais_emprunt_assimiles_interets.valeur
  return {
    financieres: c.interets + (assimiles ? fraisAccessoires : 0),
    autres: c.autres_charges + (c.amortissement ?? 0) + (assimiles ? 0 : fraisAccessoires),
  }
}

/**
 * Régime réel. Les recettes compensent d'abord les charges financières
 * (BOI-RFPI-BASE-30-20, §110). Le déficit dû aux autres charges s'impute sur
 * le revenu global dans la limite annuelle ; le reste, comme les charges
 * financières non couvertes, se reporte sur les revenus fonciers.
 */
export function revenuFoncierReel(e: EntreeFonciere, p: ParametresFiscaux): ResultatFoncierReel {
  const df = p.deficit_foncier
  const dureeReport = df.report_revenus_fonciers_ans.valeur
  const { financieres, autres } = ventilerCharges(e.charges, p)
  const resultat = e.recettes - financieres - autres

  // Sans revenu positif, les déficits antérieurs ne s'imputent pas mais peuvent se périmer.
  const imputation = imputerDeficits(e.deficits_anterieurs ?? [], Math.max(0, resultat), e.annee, dureeReport)
  const commun = {
    annee: e.annee,
    recettes: e.recettes,
    charges_financieres: financieres,
    autres_deductions: autres,
    resultat,
    deficits_anterieurs_imputes: imputation.impute,
    deficits_perimes: imputation.perime,
  }

  if (resultat >= 0) {
    return {
      ...commun,
      revenu_foncier_imposable: resultat - imputation.impute,
      deficit_imputable_revenu_global: 0,
      interets_non_couverts: 0,
      excedent_au_dela_du_plafond: 0,
      deficits_reportables: imputation.stock,
    }
  }

  const interetsNonCouverts = Math.max(0, financieres - e.recettes)
  const deficitHorsInterets = autres - Math.max(0, e.recettes - financieres)
  const imputable = Math.min(deficitHorsInterets, df.plafond_imputation_revenu_global.valeur)
  const excedent = deficitHorsInterets - imputable
  return {
    ...commun,
    revenu_foncier_imposable: 0,
    deficit_imputable_revenu_global: imputable,
    interets_non_couverts: interetsNonCouverts,
    excedent_au_dela_du_plafond: excedent,
    deficits_reportables: ajouterDeficit(imputation.stock, e.annee, interetsNonCouverts + excedent),
  }
}

export interface ResultatMicroFoncier {
  readonly eligible: boolean
  readonly motifs_ineligibilite: readonly string[]
  readonly recettes: number
  readonly abattement: number
  readonly deficits_anterieurs_imputes: number
  readonly deficits_perimes: number
  readonly revenu_foncier_imposable: number
  readonly deficits_reportables: readonly Millesime[]
}

/**
 * Micro-foncier : abattement forfaitaire sur les recettes brutes, puis
 * imputation des déficits fonciers antérieurs. Calculé même hors des
 * conditions, avec les motifs d'inéligibilité.
 */
export function revenuFoncierMicro(
  annee: number,
  recettes: number,
  p: ParametresFiscaux,
  options: { readonly option_jeanbrun?: boolean; readonly deficits_anterieurs?: readonly Millesime[] } = {},
): ResultatMicroFoncier {
  const mf = p.micro_foncier
  const motifs: string[] = []
  if (recettes > mf.seuil_recettes.valeur) motifs.push('Recettes foncières supérieures au seuil du micro-foncier')
  if (options.option_jeanbrun === true && p.jeanbrun.micro_foncier_exclu.valeur) {
    motifs.push('L’option pour l’amortissement Jeanbrun exclut le micro-foncier')
  }
  const abattement = recettes * mf.abattement.valeur
  const imputation = imputerDeficits(
    options.deficits_anterieurs ?? [],
    recettes - abattement,
    annee,
    p.deficit_foncier.report_revenus_fonciers_ans.valeur,
  )
  return {
    eligible: motifs.length === 0,
    motifs_ineligibilite: motifs,
    recettes,
    abattement,
    deficits_anterieurs_imputes: imputation.impute,
    deficits_perimes: imputation.perime,
    revenu_foncier_imposable: recettes - abattement - imputation.impute,
    deficits_reportables: imputation.stock,
  }
}

/** Prélèvements sociaux sur le revenu foncier net imposable. */
export function prelevementsSociauxFonciers(revenuFoncierImposable: number, p: ParametresFiscaux): number {
  return Math.max(0, revenuFoncierImposable) * p.prelevements_sociaux.revenus_fonciers.valeur.total
}

/** CSG déductible du revenu global de l'année suivante (option du moteur). */
export function csgDeductibleFonciere(revenuFoncierImposable: number, p: ParametresFiscaux): number {
  return Math.max(0, revenuFoncierImposable) * p.prelevements_sociaux.csg_deductible.valeur
}

/**
 * Années dont l'imputation d'un déficit sur le revenu global serait remise en
 * cause par la fin de la location (cession) l'année `anneeFinLocation` : la
 * location doit durer jusqu'au 31/12 de la 3e année suivant l'imputation.
 */
export function imputationsRemisesEnCause(
  anneesImputation: readonly number[],
  anneeFinLocation: number,
  p: ParametresFiscaux,
): number[] {
  const delai = p.deficit_foncier.maintien_location_annees.valeur
  return anneesImputation.filter((annee) => anneeFinLocation <= annee + delai)
}
