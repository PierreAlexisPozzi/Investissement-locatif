/**
 * Calendrier d'une opération : années civiles de détention, mois de détention,
 * de location et d'après livraison pour chaque année, date de cession à
 * l'horizon. Les événements sont ramenés au premier jour de leur mois ; la
 * cession intervient le jour anniversaire du début de la location, après
 * `horizon` années de location.
 */
import { MOIS_PAR_AN } from './constantes-numeriques'
import { ajouterAnnees, ecrireDate, lireDate } from './dates'

/** Rang absolu du mois d'une date : année × 12 + mois − 1. */
export function rangMois(iso: string): number {
  const d = lireDate(iso)
  return d.annee * MOIS_PAR_AN + d.mois - 1
}

/** Premier jour du mois d'un rang absolu. */
export function dateDuRang(rang: number): string {
  return ecrireDate({ annee: Math.floor(rang / MOIS_PAR_AN), mois: (rang % MOIS_PAR_AN) + 1, jour: 1 })
}

export interface AnneeCalendrier {
  readonly annee: number
  /** Mois de l'année pendant lesquels le bien est détenu. */
  readonly mois_detention: number
  /** Mois détenus après la livraison : charges de copropriété, assurance. */
  readonly mois_apres_livraison: number
  readonly mois_location: number
  /** Rang de l'année depuis le début de la location : 1 la première année louée, 0 avant. */
  readonly rang_location: number
  /** Milieu de la période détenue dans l'année, en années depuis la signature (actualisation des flux). */
  readonly temps_moyen: number
}

export interface Calendrier {
  readonly date_acquisition: string
  readonly date_livraison: string
  readonly date_debut_location: string
  readonly date_cession: string
  readonly rang_acquisition: number
  readonly rang_livraison: number
  readonly rang_location: number
  readonly rang_cession: number
  readonly annees: readonly AnneeCalendrier[]
  /** Durée de détention en années décimales, de la signature à la cession. */
  readonly duree_detention_ans: number
}

function moisDansLAnnee(annee: number, debut: number, fin: number): number {
  const premier = Math.max(debut, annee * MOIS_PAR_AN)
  const dernier = Math.min(fin, (annee + 1) * MOIS_PAR_AN)
  return Math.max(0, dernier - premier)
}

export function calendrierOperation(
  dateAcquisition: string,
  dateLivraison: string,
  dateDebutLocation: string,
  horizonAns: number,
): Calendrier {
  if (!Number.isInteger(horizonAns) || horizonAns < 1) {
    throw new RangeError(`L'horizon doit être un nombre entier d'années, au moins 1 : ${String(horizonAns)}`)
  }
  const rangAcquisition = rangMois(dateAcquisition)
  const rangLivraison = Math.max(rangMois(dateLivraison), rangAcquisition)
  const rangLocation = Math.max(rangMois(dateDebutLocation), rangLivraison)
  const debutLocation = dateDuRang(rangLocation)
  const dateCession = ajouterAnnees(debutLocation, horizonAns)
  const rangCession = rangMois(dateCession)

  const annees: AnneeCalendrier[] = []
  const premiereAnnee = Math.floor(rangAcquisition / MOIS_PAR_AN)
  const derniereAnnee = Math.floor((rangCession - 1) / MOIS_PAR_AN)
  const anneeLocation = Math.floor(rangLocation / MOIS_PAR_AN)
  for (let annee = premiereAnnee; annee <= derniereAnnee; annee++) {
    const debut = Math.max(rangAcquisition, annee * MOIS_PAR_AN)
    const fin = Math.min(rangCession, (annee + 1) * MOIS_PAR_AN)
    annees.push({
      annee,
      mois_detention: moisDansLAnnee(annee, rangAcquisition, rangCession),
      mois_apres_livraison: moisDansLAnnee(annee, rangLivraison, rangCession),
      mois_location: moisDansLAnnee(annee, rangLocation, rangCession),
      rang_location: annee >= anneeLocation ? annee - anneeLocation + 1 : 0,
      temps_moyen: ((debut + fin) / 2 - rangAcquisition) / MOIS_PAR_AN,
    })
  }
  return {
    date_acquisition: dateDuRang(rangAcquisition),
    date_livraison: dateDuRang(rangLivraison),
    date_debut_location: debutLocation,
    date_cession: dateCession,
    rang_acquisition: rangAcquisition,
    rang_livraison: rangLivraison,
    rang_location: rangLocation,
    rang_cession: rangCession,
    annees,
    duree_detention_ans: (rangCession - rangAcquisition) / MOIS_PAR_AN,
  }
}
