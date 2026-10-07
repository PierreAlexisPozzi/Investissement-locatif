/**
 * État initial, lu dans le stockage du navigateur avant le premier rendu ; un
 * dossier vierge est créé s'il n'y en a aucun.
 */
import { dossierVierge } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import type { ParametresFiscaux } from '../../params'
import { dateDuJour } from '../format'
import type { EtatApplication } from './etat'
import { lireDossiers, type DossierEnregistre, type Stockage } from './stockage'

export const NOM_PAR_DEFAUT = 'Dossier'
const SCENARIO_PAR_DEFAUT: IdScenario = 'S0'

export function nouvelIdentifiant(): string {
  return crypto.randomUUID()
}

/** Dossier vierge enregistrable, daté du jour. */
export function dossierEnregistreVierge(maintenant: Date, p: ParametresFiscaux, nom = NOM_PAR_DEFAUT): DossierEnregistre {
  return { id: nouvelIdentifiant(), nom, dossier: dossierVierge(dateDuJour(maintenant), p), modifie_le: maintenant.toISOString() }
}

export function etatInitial(stockage: Stockage | null, maintenant: Date, p: ParametresFiscaux): EtatApplication {
  const horodatage = maintenant.toISOString()
  const dossiers = lireDossiers(stockage, horodatage)
  const existants = dossiers.valeur.dossiers
  const liste = existants.length > 0 ? existants : [dossierEnregistreVierge(maintenant, p)]
  const courant = dossiers.valeur.courant ?? liste[0]?.id ?? ''
  return {
    dossiers: liste,
    courant,
    scenario: SCENARIO_PAR_DEFAUT,
    messages: dossiers.erreurs,
  }
}
