/**
 * Types et contrôles communs aux dispositifs : nature du bien, mode de
 * détention, éligibilité motivée, quotes-parts.
 */
import { TOLERANCE_COMPARAISON } from './constantes-numeriques'

/** Logement neuf achevé, vendu en l'état futur d'achèvement, ou ancien (avec ou sans travaux). */
export const ETATS_BIEN = ['neuf', 'vefa', 'ancien'] as const
export type EtatBien = (typeof ETATS_BIEN)[number]

/** Appartement dans un immeuble collectif d'habitation, ou maison individuelle. */
export const TYPES_LOGEMENT = ['appartement_collectif', 'maison_individuelle'] as const
export type TypeLogement = (typeof TYPES_LOGEMENT)[number]

/** Détention en nom propre (ou en indivision), par une SCI à l'impôt sur le revenu ou par une SCI à l'IS. */
export const MODES_DETENTION = ['nom_propre', 'sci_ir', 'sci_is'] as const
export type ModeDetention = (typeof MODES_DETENTION)[number]

export interface Eligibilite {
  readonly eligible: boolean
  /** Motifs d'inéligibilité, affichés sur le scénario grisé (§7). */
  readonly motifs: readonly string[]
  /** Points d'attention qui n'empêchent pas le calcul : conditions à tenir, règles à confirmer. */
  readonly avertissements: readonly string[]
}

export function eligibilite(motifs: readonly string[], avertissements: readonly string[] = []): Eligibilite {
  return { eligible: motifs.length === 0, motifs, avertissements }
}

/** Réunit plusieurs éligibilités : il faut les remplir toutes. */
export function cumulerEligibilites(...elements: readonly Eligibilite[]): Eligibilite {
  return eligibilite(
    elements.flatMap((e) => e.motifs),
    elements.flatMap((e) => e.avertissements),
  )
}

/** Quotes-parts (associés, cédants, foyers) : positives et de somme égale à 1. */
export function verifierQuotesParts(quotesParts: readonly number[]): void {
  const somme = quotesParts.reduce((total, q) => total + q, 0)
  if (quotesParts.length === 0 || quotesParts.some((q) => !(q > 0)) || Math.abs(somme - 1) > TOLERANCE_COMPARAISON) {
    throw new RangeError('Les quotes-parts doivent être positives et de somme égale à 1')
  }
}

/** Répartit un montant selon des quotes-parts. */
export function repartir(montant: number, quotesParts: readonly number[]): number[] {
  verifierQuotesParts(quotesParts)
  return quotesParts.map((q) => montant * q)
}
