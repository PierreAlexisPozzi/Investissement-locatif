import type { Parametre } from './types'

export interface EntreeParametre {
  /** Chemin pointé depuis la racine, par exemple `jeanbrun.plafond_annuel`. */
  readonly chemin: string
  readonly parametre: Parametre<unknown>
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/** Un nœud est un paramètre dès qu'il porte une clé `valeur`. */
export function estParametre(noeud: unknown): noeud is Parametre<unknown> {
  return estObjet(noeud) && 'valeur' in noeud
}

/**
 * Liste tous les paramètres d'un arbre (la section `meta` est ignorée),
 * dans l'ordre du fichier.
 */
export function listerParametres(racine: unknown): EntreeParametre[] {
  const entrees: EntreeParametre[] = []
  const visiter = (noeud: unknown, chemin: string): void => {
    if (estParametre(noeud)) {
      entrees.push({ chemin, parametre: noeud })
      return
    }
    if (!estObjet(noeud)) return
    for (const [cle, enfant] of Object.entries(noeud)) {
      if (chemin === '' && cle === 'meta') continue
      visiter(enfant, chemin === '' ? cle : `${chemin}.${cle}`)
    }
  }
  visiter(racine, '')
  return entrees
}
