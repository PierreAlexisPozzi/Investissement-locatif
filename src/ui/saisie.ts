/**
 * Lecture et affichage des nombres saisis à la française : espaces de
 * milliers, virgule décimale, pourcentages saisis en points (« 3,4 » pour
 * 3,4 %). Aucun calcul fiscal : simple conversion de texte.
 */

/** Espaces admis entre les milliers : espace, insécable, fine insécable. */
const ESPACES = /[\s\u00a0\u202f]/g
const FORMAT_NOMBRE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/

export type LectureSaisie = { readonly ok: true; readonly valeur: number | undefined } | { readonly ok: false; readonly erreur: string }

export interface ContraintesSaisie {
  readonly min?: number
  readonly max?: number
  /** Saisie vide admise : la valeur devient indéfinie. */
  readonly optionnel?: boolean
  readonly entier?: boolean
  /** Pourcentage : la saisie est divisée par 100. */
  readonly pourcentage?: boolean
}

const POURCENT = 100
/** Chiffres significatifs conservés pour neutraliser les erreurs de représentation (0,034 × 100). */
const CHIFFRES_SIGNIFICATIFS = 12

const nettoyer = (n: number): number => Number(n.toPrecision(CHIFFRES_SIGNIFICATIFS))

/** Nombre au format de saisie, sans séparateur de milliers ambigu. */
export function afficherSaisie(valeur: number | undefined, contraintes: ContraintesSaisie = {}): string {
  if (valeur === undefined || !Number.isFinite(valeur)) return ''
  const n = contraintes.pourcentage === true ? nettoyer(valeur * POURCENT) : nettoyer(valeur)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6, useGrouping: true }).format(n)
}

/** Lit une saisie ; une erreur explique pourquoi elle est refusée. */
export function lireSaisie(texte: string, contraintes: ContraintesSaisie = {}): LectureSaisie {
  const brut = texte.replace(ESPACES, '')
  if (brut === '') return contraintes.optionnel === true ? { ok: true, valeur: undefined } : { ok: false, erreur: 'Valeur obligatoire' }
  if (!FORMAT_NOMBRE.test(brut)) return { ok: false, erreur: 'Nombre attendu, par exemple 1 250,50' }
  const saisi = Number(brut.replace(',', '.'))
  const valeur = contraintes.pourcentage === true ? nettoyer(saisi / POURCENT) : saisi
  if (contraintes.entier === true && !Number.isInteger(saisi)) return { ok: false, erreur: 'Nombre entier attendu' }
  const unite = contraintes.pourcentage === true ? ' %' : ''
  const borne = (x: number): string => afficherSaisie(x, contraintes) + unite
  if (contraintes.min !== undefined && valeur < contraintes.min) return { ok: false, erreur: `Au moins ${borne(contraintes.min)}` }
  if (contraintes.max !== undefined && valeur > contraintes.max) return { ok: false, erreur: `Au plus ${borne(contraintes.max)}` }
  return { ok: true, valeur }
}
