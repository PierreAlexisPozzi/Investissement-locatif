import { BASE_DECIMALE, TOLERANCE_ARRONDI } from './constantes-numeriques'

/**
 * Arrondi commercial au plus proche : une moitié est arrondie en s'éloignant
 * de zéro (1 597,50 € → 1 598 €), comme le prévoit le CGI pour l'impôt.
 */
export function arrondir(valeur: number, decimales: number): number {
  const facteur = BASE_DECIMALE ** decimales
  const resultat = (Math.sign(valeur) * Math.round(Math.abs(valeur) * facteur + TOLERANCE_ARRONDI)) / facteur
  // Évite de retourner −0.
  return resultat === 0 ? 0 : resultat
}

export function arrondirEuro(valeur: number): number {
  return arrondir(valeur, 0)
}

export function arrondirCentimes(valeur: number): number {
  return arrondir(valeur, 2)
}
