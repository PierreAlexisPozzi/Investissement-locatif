/**
 * Jeanbrun (statut du bailleur privé, logement neuf) : éligibilité, base
 * amortissable, annuité plafonnée par foyer, prorata de la première année,
 * limite cumulée, rupture de l'engagement de location (§6.4, §8.2).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. L'amortissement calculé ici s'ajoute aux charges du régime réel
 * (`revenus-fonciers.ts`, champ `amortissement`). Le moteur modélise un seul
 * logement Jeanbrun par foyer : le plafond annuel est donc celui de son niveau
 * de loyer.
 */
import type { EXCEPTIONS_RUPTURE_JEANBRUN, NiveauLoyer, ParametresFiscaux } from '../params'
import { eligibilite, type Eligibilite, type EtatBien, type ModeDetention, type TypeLogement } from './commun'
import { MOIS_PAR_AN } from './constantes-numeriques'
import { ajouterAnnees, comparerDates, lireDate, type DateCivile } from './dates'
import { formaterDate } from './format'

export interface EntreeEligibiliteJeanbrun {
  /** Date de signature de l'acte authentique, contrat de VEFA compris. */
  readonly date_acquisition: string
  readonly etat: EtatBien
  readonly type_logement: TypeLogement
  readonly detention: ModeDetention
  readonly droits_demembres?: boolean
  /** Réduction Denormandie demandée pour le même logement. */
  readonly reduction_denormandie?: boolean
}

export function eligibiliteJeanbrun(e: EntreeEligibiliteJeanbrun, p: ParametresFiscaux): Eligibilite {
  const jb = p.jeanbrun
  const motifs: string[] = []
  const avertissements: string[] = []
  const { debut, fin } = jb.periode_acquisition.valeur
  if (comparerDates(e.date_acquisition, debut) < 0 || comparerDates(e.date_acquisition, fin) > 0) {
    motifs.push(`Jeanbrun neuf : acquisition hors de la période ouverte du ${formaterDate(debut)} au ${formaterDate(fin)}`)
  }
  if (e.etat === 'ancien') {
    motifs.push('Jeanbrun neuf : logement ancien (le Jeanbrun dans l’ancien n’est pas modélisé)')
  }
  if (jb.immeuble_collectif_obligatoire.valeur && e.type_logement === 'maison_individuelle') {
    motifs.push('Jeanbrun neuf : maison individuelle exclue, immeuble collectif d’habitation obligatoire')
  }
  const beneficiaires = jb.beneficiaires.valeur
  if (e.detention === 'nom_propre' && !beneficiaires.personnes_physiques) {
    motifs.push('Jeanbrun : détention en nom propre exclue')
  }
  if (e.detention === 'sci_ir' && !beneficiaires.societes_non_soumises_is) {
    motifs.push('Jeanbrun : détention par une société exclue')
  }
  if (e.detention === 'sci_is') {
    motifs.push('Jeanbrun : société soumise à l’impôt sur les sociétés exclue (revenus fonciers seulement)')
  }
  if (e.droits_demembres === true && !beneficiaires.droits_demembres) {
    motifs.push('Jeanbrun : logement ou parts démembrés exclus')
  }
  if (e.reduction_denormandie === true && jb.non_cumul.valeur.denormandie) {
    motifs.push('Jeanbrun : non cumulable avec la réduction Denormandie sur le même logement')
  }
  if (e.detention === 'sci_ir' && jb.conservation_parts_societe.valeur) {
    avertissements.push('Jeanbrun en société : chaque associé doit conserver toutes ses parts jusqu’au terme de la location')
  }
  return eligibilite(motifs, avertissements)
}

/** Base amortissable : prix d'acquisition net de frais, diminué de la part forfaitaire du foncier. */
export function baseAmortissableJeanbrun(prixAcquisition: number, p: ParametresFiscaux): number {
  return prixAcquisition * (1 - p.jeanbrun.part_foncier_forfaitaire.valeur)
}

/** Annuité d'une année pleine, avant plafond. */
export function annuitePleineJeanbrun(prixAcquisition: number, niveau: NiveauLoyer, p: ParametresFiscaux): number {
  return baseAmortissableJeanbrun(prixAcquisition, p) * p.jeanbrun.taux_amortissement.valeur[niveau]
}

/** Plafond annuel du foyer pour un logement unique de ce niveau de loyer. */
export function plafondAnnuelJeanbrun(niveau: NiveauLoyer, p: ParametresFiscaux): number {
  return p.jeanbrun.plafond_annuel.valeur[niveau]
}

/** Prix au-delà duquel l'annuité pleine dépasse le plafond annuel (alerte du §10). */
export function seuilPlafonnementJeanbrun(niveau: NiveauLoyer, p: ParametresFiscaux): number {
  return plafondAnnuelJeanbrun(niveau, p) / annuitePleineJeanbrun(1, niveau, p)
}

/** Premier jour du mois d'achèvement de l'immeuble, ou de l'acquisition si elle est postérieure. */
export function pointDeDepartJeanbrun(dateAchevement: string, dateAcquisition: string): DateCivile {
  const posterieure = comparerDates(dateAcquisition, dateAchevement) > 0 ? dateAcquisition : dateAchevement
  const { annee, mois } = lireDate(posterieure)
  return { annee, mois, jour: 1 }
}

/** Mois amortis la première année : du mois de départ inclus à décembre (prorata mensuel), ou l'année entière. */
export function moisPremiereAnneeJeanbrun(depart: DateCivile, p: ParametresFiscaux): number {
  return p.jeanbrun.prorata_premiere_annee.valeur === 'mensuel' ? MOIS_PAR_AN - depart.mois + 1 : MOIS_PAR_AN
}

export interface EntreeAmortissementJeanbrun {
  /** Prix d'acquisition net de frais : TTC pour un logement neuf, au taux de TVA réellement payé. */
  readonly prix_acquisition: number
  readonly niveau: NiveauLoyer
  readonly date_achevement: string
  readonly date_acquisition: string
  /** Dernière année civile amortie : année de la cession ou de la fin des conditions, incluse. */
  readonly derniere_annee: number
  /**
   * Quote-part du foyer : 1 en nom propre ou pour un couple marié associé à
   * 100 % ; part de chacun pour des concubins (plafond par foyer, à confirmer).
   */
  readonly quote_part?: number
}

export interface AnnuiteJeanbrun {
  readonly annee: number
  /** Fraction d'année amortie : prorata de la première année, 1 ensuite. */
  readonly fraction_annee: number
  /** Annuité de la quote-part du foyer, avant plafond. */
  readonly annuite: number
  /** Plafond du foyer pour l'année, proratisé la première année (arbitrage du 06/10/2026). */
  readonly plafond: number
  /** Amortissement déductible de l'année. */
  readonly amortissement: number
  readonly plafonne: boolean
  /** Amortissements déduits depuis l'origine. */
  readonly cumul: number
}

export interface TableauJeanbrun {
  /** Base amortissable de la quote-part du foyer : limite du cumul des amortissements. */
  readonly base_amortissable: number
  readonly annuite_pleine: number
  readonly plafond_annuel: number
  readonly point_de_depart: DateCivile
  readonly annees: readonly AnnuiteJeanbrun[]
  readonly total: number
}

export function tableauAmortissementJeanbrun(e: EntreeAmortissementJeanbrun, p: ParametresFiscaux): TableauJeanbrun {
  const jb = p.jeanbrun
  const quotePart = e.quote_part ?? 1
  if (!(quotePart > 0 && quotePart <= 1)) {
    throw new RangeError(`La quote-part du foyer doit être comprise entre 0 exclu et 1 : ${String(quotePart)}`)
  }
  const base = baseAmortissableJeanbrun(e.prix_acquisition, p) * quotePart
  const annuitePleine = annuitePleineJeanbrun(e.prix_acquisition, e.niveau, p) * quotePart
  const plafondAnnuel = plafondAnnuelJeanbrun(e.niveau, p)
  const depart = pointDeDepartJeanbrun(e.date_achevement, e.date_acquisition)
  const fractionPremiereAnnee = moisPremiereAnneeJeanbrun(depart, p) / MOIS_PAR_AN

  const annees: AnnuiteJeanbrun[] = []
  let cumul = 0
  for (let annee = depart.annee; annee <= e.derniere_annee; annee++) {
    const premiere = annee === depart.annee
    const fraction = premiere ? fractionPremiereAnnee : 1
    const annuite = annuitePleine * fraction
    const plafond = premiere && jb.plafond_proratise_premiere_annee.valeur ? plafondAnnuel * fraction : plafondAnnuel
    const amortissement = Math.max(0, Math.min(annuite, plafond, base - cumul))
    cumul += amortissement
    annees.push({ annee, fraction_annee: fraction, annuite, plafond, amortissement, plafonne: annuite > plafond, cumul })
  }
  return {
    base_amortissable: base,
    annuite_pleine: annuitePleine,
    plafond_annuel: plafondAnnuel,
    point_de_depart: depart,
    annees,
    total: cumul,
  }
}

/** Terme de l'engagement : durée minimale de location comptée depuis le début de la location. */
export function finEngagementJeanbrun(dateDebutLocation: string, p: ParametresFiscaux): string {
  return ajouterAnnees(dateDebutLocation, p.jeanbrun.duree_engagement_ans.valeur)
}

/** Cause de la fin de la location : cession, manquement aux conditions, ou exception prévue par le texte. */
export type CauseFinLocation = 'cession' | 'manquement_conditions' | (typeof EXCEPTIONS_RUPTURE_JEANBRUN)[number]

export interface RuptureJeanbrun {
  /** La location prend fin avant le terme de l'engagement. */
  readonly rupture: boolean
  /** Rupture couverte par une exception (invalidité, licenciement, décès) : pas de réintégration. */
  readonly exoneree: boolean
  readonly fin_engagement: string
  readonly annee: number
  /** Amortissements déduits réintégrés dans le revenu foncier net de l'année de rupture. */
  readonly montant_reintegre: number
  /** Années civiles d'amortissement : coefficient du système du quotient (1 sans quotient). */
  readonly coefficient_quotient: number
}

/**
 * Conséquence d'une fin de location à la date `dateFin`. L'impôt dû sur la
 * réintégration se calcule avec `calculerImpot` (option `revenu_exceptionnel`).
 */
export function ruptureJeanbrun(
  tableau: TableauJeanbrun,
  dateDebutLocation: string,
  dateFin: string,
  cause: CauseFinLocation,
  p: ParametresFiscaux,
): RuptureJeanbrun {
  const regle = p.jeanbrun.rupture_engagement.valeur
  const finEngagement = finEngagementJeanbrun(dateDebutLocation, p)
  const annee = lireDate(dateFin).annee
  const rupture = comparerDates(dateFin, finEngagement) < 0
  const exoneree = rupture && regle.exceptions.some((exception) => exception === cause)
  const deduits = tableau.annees.filter((a) => a.annee <= annee && a.amortissement > 0)
  const reintegre = rupture && !exoneree && regle.reintegration_amortissements
  return {
    rupture,
    exoneree,
    fin_engagement: finEngagement,
    annee,
    montant_reintegre: reintegre ? deduits.reduce((total, a) => total + a.amortissement, 0) : 0,
    coefficient_quotient: reintegre && regle.systeme_du_quotient ? Math.max(1, deduits.length) : 1,
  }
}
