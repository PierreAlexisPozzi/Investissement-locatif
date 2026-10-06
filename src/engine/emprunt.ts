/**
 * Emprunt : tableau d'amortissement mensuel au centime, assurance sur capital
 * initial, différé, frais de dossier et de garantie, regroupement par année
 * civile, indemnités de remboursement anticipé et taux d'endettement
 * (§5.3, §8.6).
 *
 * Fonctions pures, sans effet de bord. Taux mensuel = taux annuel / 12 (taux
 * proportionnel, usage bancaire). Chaque échéance est arrondie au centime et
 * la dernière solde le capital restant.
 */
import type { ParametresFiscaux } from '../params'
import { arrondirCentimes } from './arrondis'
import { MOIS_PAR_AN } from './constantes-numeriques'

export interface Pret {
  readonly capital: number
  /** Taux nominal annuel (décimal). */
  readonly taux_annuel: number
  /** Durée d'amortissement en mois, différé exclu. */
  readonly duree_mois: number
  /** Taux annuel d'assurance emprunteur, appliqué au capital initial. */
  readonly taux_assurance_annuel?: number
  /** Différé partiel (VEFA) : intérêts et assurance seuls, sur tout le capital, avant l'amortissement. */
  readonly differe_mois?: number
  readonly frais_dossier?: number
  readonly frais_garantie?: number
}

export interface Echeance {
  /** Numéro de l'échéance à partir de 1, différé compris. */
  readonly numero: number
  readonly differe: boolean
  readonly interets: number
  readonly capital_rembourse: number
  readonly assurance: number
  /** Intérêts + capital, hors assurance. */
  readonly mensualite: number
  readonly capital_restant_du: number
}

/** Mensualité constante hors assurance : C × t / (1 − (1 + t)^−n), t étant le taux mensuel. */
export function mensualiteConstante(capital: number, tauxAnnuel: number, dureeMois: number): number {
  const t = tauxAnnuel / MOIS_PAR_AN
  if (t === 0) return capital / dureeMois
  return (capital * t) / (1 - (1 + t) ** -dureeMois)
}

function verifierPret(pret: Pret): void {
  if (!(pret.capital >= 0)) throw new RangeError('Le capital emprunté doit être positif ou nul')
  if (!(pret.taux_annuel >= 0)) throw new RangeError('Le taux nominal doit être positif ou nul')
  if (!Number.isInteger(pret.duree_mois) || pret.duree_mois <= 0) {
    throw new RangeError('La durée doit être un nombre entier de mois strictement positif')
  }
  const differe = pret.differe_mois ?? 0
  if (!Number.isInteger(differe) || differe < 0) throw new RangeError('Le différé doit être un nombre entier de mois')
}

export function tableauAmortissement(pret: Pret): Echeance[] {
  verifierPret(pret)
  if (pret.capital === 0) return []
  const t = pret.taux_annuel / MOIS_PAR_AN
  const assurance = arrondirCentimes((pret.capital * (pret.taux_assurance_annuel ?? 0)) / MOIS_PAR_AN)
  const echeances: Echeance[] = []
  let restant = pret.capital

  for (let mois = 1; mois <= (pret.differe_mois ?? 0); mois++) {
    const interets = arrondirCentimes(restant * t)
    echeances.push({
      numero: echeances.length + 1,
      differe: true,
      interets,
      capital_rembourse: 0,
      assurance,
      mensualite: interets,
      capital_restant_du: restant,
    })
  }

  const mensualite = arrondirCentimes(mensualiteConstante(pret.capital, pret.taux_annuel, pret.duree_mois))
  for (let mois = 1; mois <= pret.duree_mois; mois++) {
    const interets = arrondirCentimes(restant * t)
    const capitalRembourse = mois === pret.duree_mois ? restant : arrondirCentimes(mensualite - interets)
    restant = arrondirCentimes(restant - capitalRembourse)
    echeances.push({
      numero: echeances.length + 1,
      differe: false,
      interets,
      capital_rembourse: capitalRembourse,
      assurance,
      mensualite: arrondirCentimes(interets + capitalRembourse),
      capital_restant_du: restant,
    })
  }
  return echeances
}

export interface AnnuitePret {
  readonly annee: number
  readonly nombre_echeances: number
  readonly interets: number
  readonly assurance: number
  readonly capital_rembourse: number
  /** Intérêts + capital, hors assurance. */
  readonly mensualites: number
  readonly capital_restant_du_fin: number
}

/**
 * Regroupe les échéances par année civile ; la première tombe le mois
 * `moisPremiereEcheance` (1 à 12) de `anneePremiereEcheance`.
 */
export function annuitesParAnnee(
  echeances: readonly Echeance[],
  anneePremiereEcheance: number,
  moisPremiereEcheance: number,
): AnnuitePret[] {
  if (!Number.isInteger(moisPremiereEcheance) || moisPremiereEcheance < 1 || moisPremiereEcheance > MOIS_PAR_AN) {
    throw new RangeError('Le mois de la première échéance doit être compris entre 1 et 12')
  }
  const annuites = new Map<number, AnnuitePret>()
  for (const e of echeances) {
    const rangMois = moisPremiereEcheance - 1 + (e.numero - 1)
    const annee = anneePremiereEcheance + Math.floor(rangMois / MOIS_PAR_AN)
    const cumul = annuites.get(annee)
    annuites.set(annee, {
      annee,
      nombre_echeances: (cumul?.nombre_echeances ?? 0) + 1,
      interets: arrondirCentimes((cumul?.interets ?? 0) + e.interets),
      assurance: arrondirCentimes((cumul?.assurance ?? 0) + e.assurance),
      capital_rembourse: arrondirCentimes((cumul?.capital_rembourse ?? 0) + e.capital_rembourse),
      mensualites: arrondirCentimes((cumul?.mensualites ?? 0) + e.mensualite),
      capital_restant_du_fin: e.capital_restant_du,
    })
  }
  return [...annuites.values()]
}

/** Capital restant dû après le paiement de `nombreEcheancesPayees` échéances. */
export function capitalRestantDu(pret: Pret, echeances: readonly Echeance[], nombreEcheancesPayees: number): number {
  if (nombreEcheancesPayees <= 0) return pret.capital
  return echeances[Math.min(nombreEcheancesPayees, echeances.length) - 1]?.capital_restant_du ?? 0
}

export interface CoutCredit {
  readonly interets: number
  readonly assurance: number
  /** Frais de dossier et de garantie, payés à la mise en place. */
  readonly frais: number
  readonly total: number
}

export function coutCredit(pret: Pret, echeances: readonly Echeance[]): CoutCredit {
  const interets = arrondirCentimes(echeances.reduce((total, e) => total + e.interets, 0))
  const assurance = arrondirCentimes(echeances.reduce((total, e) => total + e.assurance, 0))
  const frais = (pret.frais_dossier ?? 0) + (pret.frais_garantie ?? 0)
  return { interets, assurance, frais, total: arrondirCentimes(interets + assurance + frais) }
}

/**
 * Indemnités de remboursement anticipé au plafond légal : le plus faible de
 * six mois d'intérêts au taux du prêt et de 3 % du capital restant dû.
 */
export function indemnitesRemboursementAnticipe(
  capitalRestant: number,
  tauxAnnuel: number,
  p: ParametresFiscaux,
): number {
  const { mois_interets, part_capital_restant_du } = p.financement.indemnites_remboursement_anticipe_plafond.valeur
  return arrondirCentimes(
    Math.min((capitalRestant * tauxAnnuel * mois_interets) / MOIS_PAR_AN, capitalRestant * part_capital_restant_du),
  )
}

/** Mensualités de crédits, assurance comprise, rapportées aux revenus mensuels. */
export function tauxEndettement(mensualitesCredits: number, revenusMensuels: number): number {
  if (!(revenusMensuels > 0)) throw new RangeError('Les revenus mensuels doivent être strictement positifs')
  return mensualitesCredits / revenusMensuels
}

export function endettementExcessif(taux: number, p: ParametresFiscaux): boolean {
  return taux > p.financement.taux_endettement_max.valeur
}
