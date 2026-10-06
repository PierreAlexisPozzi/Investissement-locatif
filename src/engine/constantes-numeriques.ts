/**
 * Constantes de calcul numérique du moteur. Elles ne sont pas fiscales : c'est
 * le seul fichier du moteur exempté de la liste blanche des nombres admis
 * (tests/garde-fous), mais il reste contrôlé contre les valeurs fiscales.
 * Toute règle fiscale reste dans src/params/.
 */

export const MOIS_PAR_AN = 12

/** Base de la numération décimale, pour arrondir à un nombre donné de décimales. */
export const BASE_DECIMALE = 10

/**
 * Écart ajouté avant un arrondi pour neutraliser les erreurs de représentation
 * binaire : 1,005 × 100 vaut 100,4999… en virgule flottante.
 */
export const TOLERANCE_ARRONDI = 1e-9
