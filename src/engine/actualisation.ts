/**
 * Flux datés, valeur actuelle nette et taux de rendement interne : outils
 * partagés par l'orchestration (choix du régime) et les indicateurs (§9).
 * Le temps est exprimé en années décimales depuis la signature.
 */
import { ITERATIONS_RECHERCHE, TOLERANCE_COMPARAISON, TRI_MAXIMUM, TRI_MINIMUM } from './constantes-numeriques'

export interface FluxDate {
  /** Années décimales depuis la signature. */
  readonly temps: number
  /** Encaissement positif, décaissement négatif. */
  readonly montant: number
}

export function valeurActuelleNette(flux: readonly FluxDate[], taux: number): number {
  return flux.reduce((total, f) => total + f.montant / (1 + taux) ** f.temps, 0)
}

/**
 * Taux de rendement interne par dichotomie : taux annulant la valeur actuelle
 * nette. Null si les flux ne changent pas de signe ou si aucun taux de
 * l'intervalle de recherche ne l'annule.
 */
export function tauxRendementInterne(flux: readonly FluxDate[]): number | null {
  const positifs = flux.some((f) => f.montant > 0)
  const negatifs = flux.some((f) => f.montant < 0)
  if (!positifs || !negatifs) return null
  let bas = TRI_MINIMUM
  let haut = TRI_MAXIMUM
  let vanBas = valeurActuelleNette(flux, bas)
  const vanHaut = valeurActuelleNette(flux, haut)
  if (Math.sign(vanBas) === Math.sign(vanHaut)) return null
  for (let i = 0; i < ITERATIONS_RECHERCHE && haut - bas > TOLERANCE_COMPARAISON; i++) {
    const milieu = (bas + haut) / 2
    const vanMilieu = valeurActuelleNette(flux, milieu)
    if (Math.sign(vanMilieu) === Math.sign(vanBas)) {
      bas = milieu
      vanBas = vanMilieu
    } else {
      haut = milieu
    }
  }
  return (bas + haut) / 2
}

/** Recherche dichotomique de la valeur de x, dans [bas ; haut], où une fonction croissante atteint la cible. */
export function rechercheDichotomique(
  fonction: (x: number) => number,
  cible: number,
  bas: number,
  haut: number,
): number | null {
  let b = bas
  let h = haut
  if (fonction(b) > cible || fonction(h) < cible) return null
  for (let i = 0; i < ITERATIONS_RECHERCHE && h - b > TOLERANCE_COMPARAISON * Math.max(1, Math.abs(h)); i++) {
    const milieu = (b + h) / 2
    if (fonction(milieu) < cible) b = milieu
    else h = milieu
  }
  return (b + h) / 2
}
