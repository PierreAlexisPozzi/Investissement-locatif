/**
 * Impôt sur le revenu : barème, quotient familial plafonné, décote, réductions
 * dans la limite du plafonnement global des niches, impôt différentiel avec et
 * sans l'opération (§6.1, §8.1 point 4).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. L'impôt n'est jamais approximé par « montant × TMI » : il est
 * recalculé intégralement avec et sans l'opération.
 */
import type { ParametresFiscaux, TrancheBareme } from '../params'
import { arrondirEuro } from './arrondis'
import { ajouterDeficit, imputerDeficits, type Millesime } from './deficits'

export interface Foyer {
  /** Nombre de parts de quotient familial (§5.1). */
  readonly parts: number
  /** Couple marié ou pacsé soumis à imposition commune : deux parts de base et décote « couple ». */
  readonly imposition_commune: boolean
}

/** Revenu imposé selon le système du quotient (CGI art. 163-0 A). */
export interface RevenuExceptionnel {
  readonly montant: number
  /** Le montant est divisé par ce coefficient, ajouté au revenu ordinaire, et l'impôt supplémentaire multiplié d'autant. */
  readonly coefficient: number
}

export interface OptionsImpot {
  /** Réductions d'impôt soumises au plafonnement global des niches (Denormandie). */
  readonly reductions_plafonnees?: number
  /** Avantages déjà retenus dans le plafonnement global (emploi à domicile, garde d'enfants…). */
  readonly avantages_niches_deja_utilises?: number
  /** Réductions d'impôt hors du plafonnement global, imputées après les réductions plafonnées. */
  readonly reductions_non_plafonnees?: number
  /** Revenu exceptionnel taxé au quotient : amortissements Jeanbrun réintégrés en cas de rupture d'engagement. */
  readonly revenu_exceptionnel?: RevenuExceptionnel
}

export interface DetailImpot {
  /** Revenu net imposable arrondi à l'euro. */
  readonly revenu_imposable: number
  readonly parts: number
  readonly parts_de_base: number
  /** Impôt du barème avec toutes les parts du foyer. */
  readonly impot_bareme: number
  /** Impôt du barème avec les seules parts de base (1 ou 2). */
  readonly impot_parts_de_base: number
  readonly avantage_quotient_familial: number
  readonly plafond_avantage_quotient_familial: number
  readonly quotient_familial_plafonne: boolean
  /** Impôt supplémentaire dû au revenu exceptionnel (système du quotient), compris dans l'impôt brut. */
  readonly supplement_quotient: number
  /** Impôt après plafonnement du quotient familial, supplément du quotient compris, avant décote. */
  readonly impot_brut: number
  readonly decote: number
  readonly impot_apres_decote: number
  readonly reductions_imputees: number
  /** Fraction des réductions perdue faute d'impôt ou au-delà du plafond des niches. */
  readonly reductions_perdues: number
  readonly impot_net_avant_arrondi: number
  /** Impôt net arrondi à l'euro le plus proche (règle `impot_revenu.arrondi`). */
  readonly impot_net: number
  readonly mis_en_recouvrement: boolean
  /** Impôt effectivement dû : nul sous le seuil de mise en recouvrement. */
  readonly impot_du: number
  /** Taux de la tranche où tombe le dernier euro imposé. */
  readonly tmi: number
}

/** Impôt du barème pour une part, tranche par tranche. */
export function impotParPart(quotient: number, bareme: readonly TrancheBareme[]): number {
  let impot = 0
  let borneBasse = 0
  for (const tranche of bareme) {
    const borneHaute = tranche.jusqua ?? Number.POSITIVE_INFINITY
    if (quotient > borneBasse) impot += (Math.min(quotient, borneHaute) - borneBasse) * tranche.taux
    borneBasse = borneHaute
  }
  return impot
}

/** Taux de la tranche contenant le quotient. */
export function tauxMarginal(quotient: number, bareme: readonly TrancheBareme[]): number {
  return bareme.find((tranche) => tranche.jusqua === null || quotient <= tranche.jusqua)?.taux ?? 0
}

export function partsDeBase(foyer: Foyer, p: ParametresFiscaux): number {
  const parts = p.impot_revenu.parts_quotient_familial.valeur
  return foyer.imposition_commune ? parts.couple_marie_pacse : parts.personne_seule
}

/**
 * Parts du foyer selon les enfants à charge (CGI art. 194) : une demi-part pour chacun des deux premiers enfants,
 * une part à partir du troisième. Les majorations particulières (parent isolé, invalidité, garde alternée) restent à saisir.
 */
export function partsAvecEnfants(impositionCommune: boolean, enfants: number, p: ParametresFiscaux): number {
  const parts = p.impot_revenu.parts_quotient_familial.valeur
  const n = Math.max(0, Math.floor(enfants))
  // Les deux premiers rangs sont ceux du paramètre « enfant_rang_1_et_2 ».
  const premiersRangs = Math.min(n, 2)
  return (
    partsDeBase({ parts: 0, imposition_commune: impositionCommune }, p) +
    premiersRangs * parts.enfant_rang_1_et_2 +
    (n - premiersRangs) * parts.enfant_rang_3_et_plus
  )
}

/** Décote = forfait − taux × impôt brut, si l'impôt brut est inférieur au seuil ; jamais supérieure à l'impôt. */
export function calculerDecote(impotBrut: number, impositionCommune: boolean, p: ParametresFiscaux): number {
  const { couple, personne_seule, taux } = p.impot_revenu.decote.valeur
  const { forfait, seuil_impot_brut } = impositionCommune ? couple : personne_seule
  if (impotBrut >= seuil_impot_brut) return 0
  return Math.min(impotBrut, Math.max(0, forfait - taux * impotBrut))
}

export function calculerImpot(
  revenuImposable: number,
  foyer: Foyer,
  p: ParametresFiscaux,
  options: OptionsImpot = {},
): DetailImpot {
  const ir = p.impot_revenu
  const bareme = ir.bareme.valeur
  const base = partsDeBase(foyer, p)
  if (!(foyer.parts >= base)) {
    throw new RangeError(`Le foyer doit compter au moins ${base} part(s) : ${foyer.parts} saisie(s)`)
  }

  // Plafonnement : l'avantage dû aux demi-parts au-delà des parts de base est limité.
  const demiPartsSupplementaires = (foyer.parts - base) * 2
  const plafondAvantage = demiPartsSupplementaires * ir.plafond_quotient_familial_demi_part.valeur
  const baremePlafonne = (revenuGlobal: number) => {
    const avecParts = impotParPart(revenuGlobal / foyer.parts, bareme) * foyer.parts
    const partsDeBaseSeules = impotParPart(revenuGlobal / base, bareme) * base
    const avantage = partsDeBaseSeules - avecParts
    const plafonne = avantage > plafondAvantage
    const impot = plafonne ? partsDeBaseSeules - plafondAvantage : avecParts
    return { avecParts, partsDeBaseSeules, avantage, plafonne, impot }
  }

  const revenu = Math.max(0, arrondirEuro(revenuImposable))
  const ordinaire = baremePlafonne(revenu)

  // Système du quotient : la décote s'applique ensuite à l'impôt total (brochure pratique IR 2026, p. 370).
  const exceptionnel = options.revenu_exceptionnel
  let supplement = 0
  if (exceptionnel !== undefined && exceptionnel.montant > 0) {
    if (!(exceptionnel.coefficient >= 1)) {
      throw new RangeError(`Le coefficient du quotient doit valoir au moins 1 : ${String(exceptionnel.coefficient)}`)
    }
    const quotient = arrondirEuro(exceptionnel.montant / exceptionnel.coefficient)
    supplement = exceptionnel.coefficient * (baremePlafonne(revenu + quotient).impot - ordinaire.impot)
  }
  const impotBrut = ordinaire.impot + supplement

  const decote = calculerDecote(impotBrut, foyer.imposition_commune, p)
  const impotApresDecote = impotBrut - decote

  const reductions = options.reductions_plafonnees ?? 0
  const plafondNichesDisponible = Math.max(
    0,
    ir.plafonnement_global_niches.valeur - (options.avantages_niches_deja_utilises ?? 0),
  )
  const plafonneesImputees = Math.min(reductions, plafondNichesDisponible, impotApresDecote)
  const nonPlafonnees = options.reductions_non_plafonnees ?? 0
  const nonPlafonneesImputees = Math.min(nonPlafonnees, impotApresDecote - plafonneesImputees)
  const reductionsImputees = plafonneesImputees + nonPlafonneesImputees
  const impotNetAvantArrondi = impotApresDecote - reductionsImputees
  const impotNet = arrondirEuro(impotNetAvantArrondi)
  // Comparaison avant arrondi : reproduit le seuil de la brochure IR 2026 (tableau 7, personne seule : 17 596 €).
  const misEnRecouvrement = impotNetAvantArrondi >= ir.seuil_mise_en_recouvrement.valeur

  return {
    revenu_imposable: revenu,
    parts: foyer.parts,
    parts_de_base: base,
    impot_bareme: ordinaire.avecParts,
    impot_parts_de_base: ordinaire.partsDeBaseSeules,
    avantage_quotient_familial: ordinaire.avantage,
    plafond_avantage_quotient_familial: plafondAvantage,
    quotient_familial_plafonne: ordinaire.plafonne,
    supplement_quotient: supplement,
    impot_brut: impotBrut,
    decote,
    impot_apres_decote: impotApresDecote,
    reductions_imputees: reductionsImputees,
    reductions_perdues: reductions + nonPlafonnees - reductionsImputees,
    impot_net_avant_arrondi: impotNetAvantArrondi,
    impot_net: impotNet,
    mis_en_recouvrement: misEnRecouvrement,
    impot_du: misEnRecouvrement ? impotNet : 0,
    tmi: tauxMarginal(revenu / (ordinaire.plafonne ? base : foyer.parts), bareme),
  }
}

export interface ImpotDifferentiel {
  readonly sans: DetailImpot
  readonly avec: DetailImpot
  /** Impôt dû avec l'opération − impôt dû sans : négatif quand l'opération fait économiser de l'impôt. */
  readonly ecart: number
}

/** Impôt différentiel (§8.1 point 4) : deux calculs complets, jamais une approximation par la TMI. */
export function impotDifferentiel(
  revenuSans: number,
  revenuAvec: number,
  foyer: Foyer,
  p: ParametresFiscaux,
  optionsSans: OptionsImpot = {},
  optionsAvec: OptionsImpot = {},
): ImpotDifferentiel {
  const sans = calculerImpot(revenuSans, foyer, p, optionsSans)
  const avec = calculerImpot(revenuAvec, foyer, p, optionsAvec)
  return { sans, avec, ecart: avec.impot_du - sans.impot_du }
}

/** Déduction forfaitaire de 10 % sur un salaire, bornée par le minimum et le maximum, jamais supérieure au salaire. */
export function deductionFraisProfessionnels(salaire: number, p: ParametresFiscaux): number {
  if (salaire <= 0) return 0
  const { taux, minimum, maximum } = p.impot_revenu.abattement_frais_professionnels.valeur
  return Math.min(salaire, Math.max(minimum, Math.min(maximum, taux * salaire)))
}

/** Salaires nets imposables du foyer : la déduction s'applique à chaque membre séparément. */
export function salairesNetsImposables(salaires: readonly number[], p: ParametresFiscaux): number {
  return salaires.reduce((total, salaire) => total + salaire - deductionFraisProfessionnels(salaire, p), 0)
}

export interface EntreeRevenuGlobal {
  readonly annee: number
  /** Revenus catégoriels nets positifs : salaires après déduction, revenus fonciers imposables… */
  readonly revenus_categoriels: number
  /** Déficit foncier de l'année imputable sur le revenu global (déjà limité au plafond annuel). */
  readonly deficit_foncier_imputable?: number
  /** Charges déductibles du revenu global (CSG déductible…) : sans excédent reportable. */
  readonly charges_deductibles?: number
  readonly deficits_globaux_anterieurs?: readonly Millesime[]
}

export interface DetailRevenuGlobal {
  /** Revenus catégoriels diminués du déficit foncier de l'année ; négatif s'il crée un déficit global. */
  readonly revenu_avant_deficits_anterieurs: number
  /** Déficit global né dans l'année, reportable sur les revenus globaux des années suivantes. */
  readonly deficit_global_ne: number
  readonly deficits_anterieurs_imputes: number
  readonly deficits_perimes: number
  readonly charges_deduites: number
  /** Revenu net imposable de l'année. */
  readonly revenu_global_net: number
  readonly deficits_globaux: readonly Millesime[]
}

/**
 * Revenu global (CGI art. 156) : le déficit foncier imputable de l'année
 * s'impute d'abord ; s'il excède les revenus, l'excédent devient un déficit
 * global reportable 6 ans. Sinon, les déficits globaux antérieurs s'imputent
 * du plus ancien au plus récent, puis les charges déductibles.
 */
export function calculerRevenuGlobal(e: EntreeRevenuGlobal, p: ParametresFiscaux): DetailRevenuGlobal {
  const dureeReport = p.deficit_foncier.report_revenu_global_ans.valeur
  const avant = e.revenus_categoriels - (e.deficit_foncier_imputable ?? 0)
  const deficitNe = Math.max(0, -avant)
  const imputation = imputerDeficits(e.deficits_globaux_anterieurs ?? [], Math.max(0, avant), e.annee, dureeReport)
  const apresDeficits = Math.max(0, avant) - imputation.impute
  const charges = Math.min(Math.max(0, e.charges_deductibles ?? 0), apresDeficits)
  return {
    revenu_avant_deficits_anterieurs: avant,
    deficit_global_ne: deficitNe,
    deficits_anterieurs_imputes: imputation.impute,
    deficits_perimes: imputation.perime,
    charges_deduites: charges,
    revenu_global_net: apresDeficits - charges,
    deficits_globaux: ajouterDeficit(imputation.stock, e.annee, deficitNe),
  }
}

/**
 * Paramètres de l'impôt indexés d'un coefficient (§6.1 : indexation future du
 * barème). Bornes du barème, plafond du quotient familial, décote et bornes de
 * la déduction de 10 % sont revalorisés et arrondis à l'euro ; les taux, le
 * seuil de recouvrement et le plafond des niches restent inchangés.
 */
export function indexerImpotRevenu(p: ParametresFiscaux, coefficient: number): ParametresFiscaux {
  const ir = p.impot_revenu
  const indexer = (montant: number): number => arrondirEuro(montant * coefficient)
  const decote = ir.decote.valeur
  const abattement = ir.abattement_frais_professionnels.valeur
  return {
    ...p,
    impot_revenu: {
      ...ir,
      bareme: {
        ...ir.bareme,
        valeur: ir.bareme.valeur.map((t) => ({ ...t, jusqua: t.jusqua === null ? null : indexer(t.jusqua) })),
      },
      plafond_quotient_familial_demi_part: {
        ...ir.plafond_quotient_familial_demi_part,
        valeur: indexer(ir.plafond_quotient_familial_demi_part.valeur),
      },
      decote: {
        ...ir.decote,
        valeur: {
          ...decote,
          personne_seule: {
            forfait: indexer(decote.personne_seule.forfait),
            seuil_impot_brut: indexer(decote.personne_seule.seuil_impot_brut),
          },
          couple: {
            forfait: indexer(decote.couple.forfait),
            seuil_impot_brut: indexer(decote.couple.seuil_impot_brut),
          },
        },
      },
      abattement_frais_professionnels: {
        ...ir.abattement_frais_professionnels,
        valeur: { ...abattement, minimum: indexer(abattement.minimum), maximum: indexer(abattement.maximum) },
      },
    },
  }
}
