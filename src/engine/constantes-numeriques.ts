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

/** Écart toléré quand on compare des sommes de fractions saisies (0,1 + 0,2 + 0,7 ≈ 1). */
export const TOLERANCE_COMPARAISON = 1e-9

/** Bornes de recherche du taux de rendement interne : de −99 % à +100 % par an. */
export const TRI_MINIMUM = -0.99
export const TRI_MAXIMUM = 1

/** Nombre maximal d'itérations des recherches dichotomiques (TRI, seuils de bascule). */
export const ITERATIONS_RECHERCHE = 200

/** Années de l'effort d'épargne initial (§9 : effort moyen des années 1 à 3). */
export const ANNEES_EFFORT_INITIAL = 3

/** Borne haute de la recherche du prix de revente d'équilibre, en multiple du prix central. */
export const FACTEUR_PRIX_REVENTE_MAXIMUM = 3
