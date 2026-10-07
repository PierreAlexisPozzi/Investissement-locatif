/**
 * Jeu d'essai préchargé (cahier des charges §14, étape 7) : T2 de 45 m² en zone A, 250 000 € HT en VEFA, couple
 * marié avec 90 000 € de revenu imposable, et une simulation de vendeur à contre-expertiser. Toutes les valeurs sont
 * fictives : aucune donnée personnelle. Le fichier a le format d'un export de dossier et il est relu avec les
 * contrôles d'un import ; c'est aussi le cas type des tests de non-régression.
 */
import type { SimulationVendeur } from '../engine/contre-expertise'
import type { Dossier } from '../engine/dossier'
import { lireFichierDossier } from '../engine/dossier-json'
import fichier from './cas-type.json'

export interface JeuEssai {
  readonly nom: string
  readonly dossier: Dossier
  readonly simulation_vendeur: SimulationVendeur
}

/** Jeu d'essai relu et contrôlé ; une erreur signale un fichier versionné abîmé (les tests le relisent). */
export function jeuEssai(): JeuEssai {
  const lu = lireFichierDossier(fichier)
  if (!lu.ok) throw new Error(`Jeu d’essai illisible : ${lu.erreurs.join(' ; ')}`)
  if (lu.simulation_vendeur === undefined) throw new Error('Jeu d’essai sans simulation de vendeur')
  return { nom: lu.nom, dossier: lu.dossier, simulation_vendeur: lu.simulation_vendeur }
}
