/**
 * Édition d'une valeur de paramètre (§11, écran 8) : nombre saisi à la
 * française, oui ou non, texte, ou JSON pour une valeur structurée (barème,
 * plafonds par zone). La forme et la validité sont ensuite contrôlées par
 * `appliquerSurcharges`.
 */
import { afficherSaisie, lireSaisie } from './saisie'

export type LectureEdition = { readonly ok: true; readonly valeur: unknown } | { readonly ok: false; readonly erreur: string }

const OUI = ['oui', 'true', 'vrai']
const NON = ['non', 'false', 'faux']
const LONGUEUR_APERCU = 90
const INDENTATION = 2

/** Texte proposé à l'édition. */
export function texteEdition(valeur: unknown): string {
  if (typeof valeur === 'number') return afficherSaisie(valeur)
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non'
  if (typeof valeur === 'string') return valeur
  return JSON.stringify(valeur, null, INDENTATION)
}

/** Relit le texte édité selon la nature de la valeur d'origine. */
export function lireEdition(texte: string, reference: unknown): LectureEdition {
  if (typeof reference === 'number') {
    const lu = lireSaisie(texte)
    return lu.ok ? { ok: true, valeur: lu.valeur } : { ok: false, erreur: lu.erreur }
  }
  if (typeof reference === 'boolean') {
    const t = texte.trim().toLowerCase()
    if (OUI.includes(t)) return { ok: true, valeur: true }
    if (NON.includes(t)) return { ok: true, valeur: false }
    return { ok: false, erreur: 'oui ou non attendu' }
  }
  if (typeof reference === 'string') {
    const t = texte.trim()
    return t === '' ? { ok: false, erreur: 'Valeur obligatoire' } : { ok: true, valeur: t }
  }
  try {
    return { ok: true, valeur: JSON.parse(texte) as unknown }
  } catch (erreur) {
    return { ok: false, erreur: `JSON invalide : ${erreur instanceof Error ? erreur.message : String(erreur)}` }
  }
}

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 })

/** Aperçu d'une valeur dans la liste des paramètres. */
export function apercuValeur(valeur: unknown): string {
  if (typeof valeur === 'number') return NOMBRE.format(valeur)
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non'
  if (typeof valeur === 'string') return valeur
  const json = JSON.stringify(valeur)
  return json.length > LONGUEUR_APERCU ? `${json.slice(0, LONGUEUR_APERCU)}…` : json
}
