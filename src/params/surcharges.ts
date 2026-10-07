/**
 * Modifications locales des paramètres fiscaux (§11, écran 8). L'utilisateur
 * corrige une valeur, son statut ou sa date de vérification sans toucher au
 * fichier versionné : les modifications vivent dans le navigateur et
 * s'appliquent sur une copie des paramètres. Chacune est contrôlée : valeur de
 * même forme que l'original, puis validation complète des paramètres.
 */
import { estParametre } from './parcours'
import { STATUTS_PARAMETRE, type Elargi, type ParametresFiscaux, type StatutParametre } from './types'
import { listerAnomalies } from './validation'

export interface SurchargeParametre {
  readonly valeur?: unknown
  readonly statut?: StatutParametre
  readonly date_verification?: string | null
}

/** Modifications par chemin de paramètre (`jeanbrun.plafond_annuel`). */
export type SurchargesParametres = Readonly<Record<string, SurchargeParametre>>

export interface ParametresEffectifs {
  readonly parametres: ParametresFiscaux
  /** Chemins des paramètres modifiés. */
  readonly modifies: readonly string[]
  /** Modifications refusées ; quand il y en a, aucune n'est appliquée. */
  readonly erreurs: readonly string[]
}

function estObjet(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * Même forme : mêmes types, mêmes clés pour un objet, éléments de la forme du premier élément pour une liste.
 * Un nombre et null s'échangent (borne ouverte d'une tranche de barème).
 */
export function memeForme(reference: unknown, valeur: unknown): boolean {
  if (reference === null || valeur === null) {
    const autre = reference ?? valeur
    return autre === null || (typeof autre === 'number' && Number.isFinite(autre))
  }
  if (Array.isArray(reference)) {
    if (!Array.isArray(valeur)) return false
    const modele: unknown = reference[0]
    return modele === undefined ? valeur.length === 0 : valeur.every((v) => memeForme(modele, v))
  }
  if (estObjet(reference)) {
    if (!estObjet(valeur)) return false
    const cles = Object.keys(reference).sort()
    const autres = Object.keys(valeur).sort()
    return cles.length === autres.length && cles.every((c, k) => c === autres[k] && memeForme(reference[c], valeur[c]))
  }
  if (typeof valeur === 'number') return typeof reference === 'number' && Number.isFinite(valeur)
  return typeof reference === typeof valeur
}

/** Nœud de paramètre à un chemin pointé ; undefined si le chemin ne désigne pas un paramètre. */
function parametreAuChemin(racine: unknown, chemin: string): Record<string, unknown> | undefined {
  let noeud: unknown = racine
  for (const segment of chemin.split('.')) {
    if (!estObjet(noeud) || !Object.hasOwn(noeud, segment)) return undefined
    noeud = noeud[segment]
  }
  return estParametre(noeud) ? (noeud as unknown as Record<string, unknown>) : undefined
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Applique les modifications sur une copie ; en cas d'erreur, les paramètres d'origine restent en vigueur. */
export function appliquerSurcharges(base: ParametresFiscaux, surcharges: SurchargesParametres): ParametresEffectifs {
  const chemins = Object.keys(surcharges)
  if (chemins.length === 0) return { parametres: base, modifies: [], erreurs: [] }
  const copie = structuredClone(base) as unknown
  const erreurs: string[] = []
  for (const chemin of chemins) {
    const s = surcharges[chemin]
    const noeud = parametreAuChemin(copie, chemin)
    if (s === undefined) continue
    if (noeud === undefined) {
      erreurs.push(`${chemin} : paramètre inconnu`)
      continue
    }
    if (s.valeur !== undefined) {
      if (memeForme(noeud.valeur, s.valeur)) noeud.valeur = structuredClone(s.valeur)
      else erreurs.push(`${chemin} : la valeur n’a pas la forme de l’original`)
    }
    if (s.statut !== undefined) {
      if ((STATUTS_PARAMETRE as readonly string[]).includes(s.statut)) noeud.statut = s.statut
      else erreurs.push(`${chemin} : statut inconnu`)
    }
    if (s.date_verification !== undefined) {
      if (s.date_verification === null || DATE_ISO.test(s.date_verification)) noeud.date_verification = s.date_verification
      else erreurs.push(`${chemin} : date de vérification AAAA-MM-JJ attendue`)
    }
  }
  // Une vérification postérieure à la date d'arrêt des paramètres la repousse d'autant.
  const elargi = copie as Elargi<ParametresFiscaux> & { meta: { date_arret: string } }
  for (const s of Object.values(surcharges)) {
    const date = s.date_verification
    if (typeof date === 'string' && DATE_ISO.test(date) && date > elargi.meta.date_arret) elargi.meta.date_arret = date
  }
  if (erreurs.length === 0) erreurs.push(...listerAnomalies(elargi))
  return erreurs.length > 0
    ? { parametres: base, modifies: [], erreurs }
    : { parametres: copie as ParametresFiscaux, modifies: chemins, erreurs: [] }
}
