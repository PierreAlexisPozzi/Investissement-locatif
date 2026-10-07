/**
 * Appels au moteur depuis l'interface : résultats mis en cache par dossier et
 * par jeu de paramètres (les objets sont immuables, leur identité suffit), et
 * calculs longs différés pour ne pas bloquer la saisie. L'interface ne fait
 * aucun calcul fiscal : elle appelle le moteur et affiche ses résultats.
 */
import { useEffect, useState } from 'react'
import { contreExpertiser, type ContreExpertise, type SimulationVendeur } from '../../engine/contre-expertise'
import type { Dossier, Objectifs } from '../../engine/dossier'
import {
  comparerAuxHorizons,
  comparerScenarios,
  penaliteSortieAnticipee,
  prixReventeEquilibre,
  tableauCroise,
  tornado,
  type ComparaisonHorizon,
  type PrixEquilibre,
  type TableauCroise,
  type Tornado,
} from '../../engine/indicateurs'
import { classer, recommander, type Classement, type Recommandation } from '../../engine/recommandation'
import type { IdScenario } from '../../engine/scenario'
import type { ParametresFiscaux } from '../../params'

export type Resultat<T> = { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly message: string }

export function messageErreur(erreur: unknown): string {
  if (erreur instanceof RangeError) return erreur.message
  return `Erreur de calcul : ${erreur instanceof Error ? erreur.message : String(erreur)}`
}

/** Exécute un calcul du moteur ; une erreur devient un message affichable. */
export function essayer<T>(calcul: () => T): Resultat<T> {
  try {
    return { ok: true, valeur: calcul() }
  } catch (erreur) {
    return { ok: false, message: messageErreur(erreur) }
  }
}

/** Nombre de résultats gardés par dossier et paramètres (curseurs d'objectifs déplacés). */
const TAILLE_CACHE = 40
const cache = new WeakMap<object, WeakMap<object, Map<string, unknown>>>()

function memoiser<T>(d: Dossier, p: ParametresFiscaux, cle: string, calcul: () => T): T {
  let parParametres = cache.get(d)
  if (parParametres === undefined) {
    parParametres = new WeakMap()
    cache.set(d, parParametres)
  }
  let parCle = parParametres.get(p)
  if (parCle === undefined) {
    parCle = new Map()
    parParametres.set(p, parCle)
  }
  if (parCle.has(cle)) return parCle.get(cle) as T
  const resultat = calcul()
  parCle.set(cle, resultat)
  if (parCle.size > TAILLE_CACHE) {
    const plusAncienne = parCle.keys().next().value
    if (plusAncienne !== undefined) parCle.delete(plusAncienne)
  }
  return resultat
}

export interface Sensibilites {
  readonly tornado: Tornado | null
  readonly croise: TableauCroise | null
  readonly equilibre: PrixEquilibre | null
  readonly penalite: { readonly horizon: number; readonly montant: number } | null
}

/** Calculs du moteur mis en cache ; `d` est le dossier sans ses objectifs (voir `useDossierDeCalcul`). */
export const calculs = {
  comparaison: (d: Dossier, p: ParametresFiscaux, horizon: number): ComparaisonHorizon =>
    memoiser(d, p, `comparaison:${String(horizon)}`, () => comparerScenarios(d, horizon, p)),
  horizons: (d: Dossier, p: ParametresFiscaux): ComparaisonHorizon[] => memoiser(d, p, 'horizons', () => comparerAuxHorizons(d, p)),
  classement: (d: Dossier, p: ParametresFiscaux, o: Objectifs): Classement =>
    memoiser(d, p, `classement:${JSON.stringify(o)}`, () => classer(d, o, p, calculs.comparaison(d, p, o.horizon))),
  recommandation: (d: Dossier, p: ParametresFiscaux, o: Objectifs): Recommandation =>
    memoiser(d, p, `recommandation:${JSON.stringify(o)}`, () => recommander(d, p, o)),
  sensibilites: (d: Dossier, p: ParametresFiscaux, id: IdScenario, horizon: number): Sensibilites =>
    memoiser(d, p, `sensibilites:${id}:${String(horizon)}`, () => ({
      tornado: tornado(d, id, horizon, p),
      croise: tableauCroise(d, id, horizon, p),
      equilibre: prixReventeEquilibre(d, id, horizon, p),
      penalite: penaliteSortieAnticipee(d, id, p),
    })),
  penalite: (d: Dossier, p: ParametresFiscaux, id: IdScenario) => memoiser(d, p, `penalite:${id}`, () => penaliteSortieAnticipee(d, id, p)),
  contreExpertise: (d: Dossier, p: ParametresFiscaux, v: SimulationVendeur): ContreExpertise =>
    memoiser(d, p, `contre-expertise:${JSON.stringify(v)}`, () => contreExpertiser(d, v, p)),
}

export type EtatCalcul<T> =
  | { readonly statut: 'inactif' }
  | { readonly statut: 'en_cours'; readonly precedent: T | undefined }
  | { readonly statut: 'pret'; readonly valeur: T }
  | { readonly statut: 'erreur'; readonly message: string }

/**
 * Calcul long lancé après un délai sans nouvelle modification ; le résultat précédent reste affiché pendant le
 * calcul. `calcul` doit être stable tant que ses entrées ne changent pas (useCallback) ; null pour ne rien calculer.
 */
export function useCalculDiffere<T>(calcul: (() => T) | null, delai: number): EtatCalcul<T> {
  const [fait, setFait] = useState<{ readonly calcul: () => T; readonly resultat: Resultat<T> } | null>(null)
  useEffect(() => {
    if (calcul === null) return
    const minuteur = window.setTimeout(() => {
      setFait({ calcul, resultat: essayer(calcul) })
    }, delai)
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [calcul, delai])
  if (calcul === null) return { statut: 'inactif' }
  if (fait?.calcul === calcul) return fait.resultat.ok ? { statut: 'pret', valeur: fait.resultat.valeur } : { statut: 'erreur', message: fait.resultat.message }
  return { statut: 'en_cours', precedent: fait?.resultat.ok === true ? fait.resultat.valeur : undefined }
}
