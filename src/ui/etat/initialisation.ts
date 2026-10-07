/**
 * État initial, lu dans le stockage du navigateur avant le premier rendu ; au
 * premier lancement (aucun dossier enregistré), le jeu d'essai fictif est
 * préchargé.
 */
import { dossierVierge } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import type { ParametresFiscaux } from '../../params'
import { jeuEssai } from '../../jeu-essai'
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

/** Jeu d'essai fictif enregistrable (cas type du §14), daté du moment où il est chargé. */
export function dossierEnregistreJeuEssai(maintenant: Date): DossierEnregistre {
  const { nom, dossier, simulation_vendeur } = jeuEssai()
  return { id: nouvelIdentifiant(), nom, dossier, simulation_vendeur, modifie_le: maintenant.toISOString() }
}

export function etatInitial(stockage: Stockage | null, maintenant: Date): EtatApplication {
  const horodatage = maintenant.toISOString()
  const dossiers = lireDossiers(stockage, horodatage)
  const existants = dossiers.valeur.dossiers
  const liste = existants.length > 0 ? existants : [dossierEnregistreJeuEssai(maintenant)]
  const courant = dossiers.valeur.courant ?? liste[0]?.id ?? ''
  return {
    dossiers: liste,
    courant,
    scenario: SCENARIO_PAR_DEFAUT,
    messages: dossiers.erreurs,
  }
}
