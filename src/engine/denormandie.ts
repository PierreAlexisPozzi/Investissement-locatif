/**
 * Denormandie (logement ancien avec travaux) : éligibilité, base plafonnée,
 * réduction étalée sur l'engagement et ses prorogations, imputation sous le
 * plafonnement global des niches, part perdue (§6.8, §8.5).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Les revenus fonciers du logement relèvent par ailleurs du régime
 * réel (`revenus-fonciers.ts`), sans amortissement ni travaux inclus dans la
 * base de la réduction.
 */
import type { ParametresFiscaux } from '../params'
import { eligibilite, type Eligibilite, type EtatBien, type ModeDetention } from './commun'
import { comparerDates, lireDate } from './dates'
import { formaterDate, formaterTaux } from './format'
import { calculerImpot, type DetailImpot, type Foyer } from './impot-revenu'

export type EngagementInitialDenormandie = 'six_ans' | 'neuf_ans'

export interface EntreeEligibiliteDenormandie {
  readonly date_acquisition: string
  readonly etat: EtatBien
  readonly detention: ModeDetention
  /** Commune à fort besoin de réhabilitation, Action Cœur de Ville ou sous convention ORT, déclarée par l'utilisateur. */
  readonly commune_eligible: boolean
  readonly prix_acquisition: number
  readonly frais_acquisition: number
  readonly travaux: number
  readonly annee_achevement_travaux: number
  /** Logements Pinel ou Denormandie déjà acquis la même année par le contribuable. */
  readonly autres_logements_annee?: number
  /** Option pour l'amortissement Jeanbrun sur le même logement. */
  readonly option_jeanbrun?: boolean
}

/** Prix de revient : prix d'acquisition, frais afférents et travaux facturés. */
export function prixDeRevientDenormandie(prix: number, frais: number, travaux: number): number {
  return prix + frais + travaux
}

export function eligibiliteDenormandie(e: EntreeEligibiliteDenormandie, p: ParametresFiscaux): Eligibilite {
  const d = p.denormandie
  const motifs: string[] = []
  const { debut, fin } = d.periode.valeur
  if (comparerDates(e.date_acquisition, debut) < 0 || comparerDates(e.date_acquisition, fin) > 0) {
    motifs.push(`Denormandie : acquisition hors de la période ouverte du ${formaterDate(debut)} au ${formaterDate(fin)}`)
  }
  if (e.etat !== 'ancien') motifs.push('Denormandie : logement ancien avec travaux uniquement')
  if (e.detention === 'sci_is') motifs.push('Denormandie : société soumise à l’impôt sur les sociétés exclue')
  if (!e.commune_eligible) {
    motifs.push('Denormandie : commune hors périmètre (besoin de réhabilitation, Action Cœur de Ville ou convention ORT)')
  }
  const coutTotal = prixDeRevientDenormandie(e.prix_acquisition, e.frais_acquisition, e.travaux)
  const partTravaux = coutTotal > 0 ? e.travaux / coutTotal : 0
  if (partTravaux < d.part_travaux_min.valeur) {
    motifs.push(
      `Denormandie : travaux de ${formaterTaux(partTravaux)} du coût total, au lieu d’au moins ${formaterTaux(d.part_travaux_min.valeur)}`,
    )
  }
  const anneeLimite = lireDate(e.date_acquisition).annee + d.delai_achevement_travaux_annees.valeur
  if (e.annee_achevement_travaux > anneeLimite) {
    motifs.push(`Denormandie : travaux à achever au plus tard le 31/12/${anneeLimite}`)
  }
  if ((e.autres_logements_annee ?? 0) + 1 > d.logements_max_par_an.valeur) {
    motifs.push(`Denormandie : au plus ${d.logements_max_par_an.valeur} logements par an (Pinel compris)`)
  }
  if (e.option_jeanbrun === true && p.jeanbrun.non_cumul.valeur.denormandie) {
    motifs.push('Denormandie : non cumulable avec l’amortissement Jeanbrun sur le même logement')
  }
  return eligibilite(motifs)
}

/** Durée totale d'engagement : engagement initial et prorogations triennales. */
export function dureeEngagementDenormandie(
  engagement: EngagementInitialDenormandie,
  prorogations: number,
  p: ParametresFiscaux,
): number {
  const d = p.denormandie
  return d.duree_engagement_initial_ans.valeur[engagement] + prorogations * d.complement_prorogation.valeur.duree_periode_ans
}

export interface EntreeReductionDenormandie {
  readonly prix_acquisition: number
  readonly frais_acquisition: number
  readonly travaux: number
  readonly surface_habitable: number
  readonly engagement_initial: EngagementInitialDenormandie
  /** Prorogations triennales : jusqu'à deux après 6 ans, une après 9 ans (12 ans au total). */
  readonly prorogations: number
  /** Année d'achèvement des travaux : première année d'imputation. */
  readonly annee_achevement_travaux: number
  /** Base déjà retenue la même année pour un autre investissement Pinel ou Denormandie. */
  readonly base_deja_retenue_annee?: number
}

export interface AnnuiteDenormandie {
  readonly annee: number
  readonly taux: number
  readonly reduction: number
}

export interface ReductionDenormandie {
  readonly prix_de_revient: number
  /** Plafond par mètre carré de surface habitable. */
  readonly plafond_surface: number
  readonly plafond_annuel_disponible: number
  readonly base: number
  readonly duree_ans: number
  readonly taux_total: number
  readonly total: number
  readonly annees: readonly AnnuiteDenormandie[]
}

export function reductionDenormandie(e: EntreeReductionDenormandie, p: ParametresFiscaux): ReductionDenormandie {
  const d = p.denormandie
  const complements = d.complement_prorogation.valeur[e.engagement_initial === 'six_ans' ? 'initial_six_ans' : 'initial_neuf_ans']
  if (!Number.isInteger(e.prorogations) || e.prorogations < 0 || e.prorogations > complements.length) {
    throw new RangeError(
      `Prorogations possibles après un engagement initial « ${e.engagement_initial} » : de 0 à ${complements.length}`,
    )
  }
  const prixDeRevient = prixDeRevientDenormandie(e.prix_acquisition, e.frais_acquisition, e.travaux)
  const plafondSurface = d.plafond_m2.valeur * e.surface_habitable
  const plafondAnnuel = Math.max(0, d.plafond_base_annuel.valeur - (e.base_deja_retenue_annee ?? 0))
  const base = Math.min(prixDeRevient, plafondSurface, plafondAnnuel)

  // Chaque période se répartit par parts égales : par sixièmes ou neuvièmes, puis par tiers.
  const dureeInitiale = d.duree_engagement_initial_ans.valeur[e.engagement_initial]
  const periodes = [
    { taux: d.taux_engagement_initial.valeur[e.engagement_initial], duree: dureeInitiale },
    ...complements.slice(0, e.prorogations).map((taux) => ({ taux, duree: d.complement_prorogation.valeur.duree_periode_ans })),
  ]
  const annees: AnnuiteDenormandie[] = []
  let annee = e.annee_achevement_travaux
  for (const periode of periodes) {
    for (let i = 0; i < periode.duree; i++) {
      const taux = periode.taux / periode.duree
      annees.push({ annee, taux, reduction: base * taux })
      annee++
    }
  }
  const tauxTotal = periodes.reduce((total, periode) => total + periode.taux, 0)
  return {
    prix_de_revient: prixDeRevient,
    plafond_surface: plafondSurface,
    plafond_annuel_disponible: plafondAnnuel,
    base,
    duree_ans: annees.length,
    taux_total: tauxTotal,
    total: base * tauxTotal,
    annees,
  }
}

export interface ImputationDenormandie {
  readonly reduction: number
  readonly imputee: number
  /** Fraction non imputée faute d'impôt ou au-delà du plafond des niches. */
  readonly non_imputee: number
  /** Perdue : ni report, ni remboursement (règle `excedent_perdu`). */
  readonly perdue: number
  readonly impot_sans_reduction: DetailImpot
  readonly impot_avec_reduction: DetailImpot
}

/** Imputation de la réduction de l'année sur l'impôt progressif du foyer (après décote), dans la limite des niches. */
export function imputerReductionDenormandie(
  revenuImposable: number,
  foyer: Foyer,
  reduction: number,
  avantagesNichesDejaUtilises: number,
  p: ParametresFiscaux,
): ImputationDenormandie {
  const d = p.denormandie
  const sans = calculerImpot(revenuImposable, foyer, p, { avantages_niches_deja_utilises: avantagesNichesDejaUtilises })
  const avec = calculerImpot(revenuImposable, foyer, p, {
    avantages_niches_deja_utilises: avantagesNichesDejaUtilises,
    ...(d.dans_plafonnement_niches.valeur ? { reductions_plafonnees: reduction } : { reductions_non_plafonnees: reduction }),
  })
  const nonImputee = reduction - avec.reductions_imputees
  return {
    reduction,
    imputee: avec.reductions_imputees,
    non_imputee: nonImputee,
    perdue: d.excedent_perdu.valeur ? nonImputee : 0,
    impot_sans_reduction: sans,
    impot_avec_reduction: avec,
  }
}

/** Travaux déductibles des revenus fonciers : aucun pour ceux retenus dans la base de la réduction. */
export function travauxDeductiblesDenormandie(travaux: number, inclusDansLaBase: boolean, p: ParametresFiscaux): number {
  return inclusDansLaBase && p.denormandie.travaux_base_non_deductibles.valeur ? 0 : travaux
}
