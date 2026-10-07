/**
 * Écran affiché, porté par l'ancre de l'adresse (#/comparaison) : les boutons
 * Précédent et Suivant du navigateur et le rechargement de la page le
 * conservent.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { estEcran, type IdEcran } from './etat'

const ECRAN_PAR_DEFAUT: IdEcran = 'foyer'

function lireEcran(): IdEcran {
  const ancre = window.location.hash.replace(/^#\/?/, '')
  return estEcran(ancre) ? ancre : ECRAN_PAR_DEFAUT
}

function abonner(rappel: () => void): () => void {
  window.addEventListener('hashchange', rappel)
  return () => {
    window.removeEventListener('hashchange', rappel)
  }
}

export function useEcran(): readonly [IdEcran, (ecran: IdEcran) => void] {
  const ecran = useSyncExternalStore(abonner, lireEcran, () => ECRAN_PAR_DEFAUT)
  const allerA = useCallback((cible: IdEcran) => {
    window.location.hash = `/${cible}`
  }, [])
  return [ecran, allerA] as const
}
