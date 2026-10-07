/**
 * Contexte React de l'application : état, dossier courant, paramètres
 * effectifs et actions. Le fournisseur est dans `FournisseurApplication.tsx`.
 */
import { createContext, useContext } from 'react'
import type { SimulationVendeur } from '../../engine/contre-expertise'
import type { Dossier, Objectifs } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import type { ParametresEffectifs, ParametresFiscaux, SurchargeParametre } from '../../params'
import type { EtatApplication } from './etat'
import type { DossierEnregistre } from './stockage'

export interface ActionsApplication {
  readonly modifierDossier: (modifier: (d: Dossier) => Dossier) => void
  readonly modifierObjectifs: (modifier: (o: Objectifs) => Objectifs) => void
  readonly modifierVendeur: (simulation: SimulationVendeur | undefined) => void
  readonly nouveauDossier: () => void
  readonly dupliquerDossier: () => void
  readonly selectionnerDossier: (id: string) => void
  readonly renommerDossier: (nom: string) => void
  readonly supprimerDossier: () => void
  readonly importerDossier: (nom: string, dossier: Dossier, simulation: SimulationVendeur | undefined) => void
  readonly surchargerParametre: (chemin: string, surcharge: SurchargeParametre | null) => void
  readonly reinitialiserParametres: () => void
  readonly choisirScenario: (id: IdScenario) => void
  readonly signaler: (message: string) => void
  readonly effacerMessages: () => void
}

export interface ContexteApplication {
  readonly etat: EtatApplication
  readonly enregistre: DossierEnregistre
  readonly dossier: Dossier
  /** Dossier sans ses objectifs : son identité ne change pas quand seuls les curseurs bougent (cache des calculs). */
  readonly dossierCalcul: Dossier
  readonly objectifs: Objectifs
  readonly parametres: ParametresEffectifs
  /** Paramètres du fichier versionné, avant modifications locales. */
  readonly parametresDeBase: ParametresFiscaux
  readonly p: ParametresFiscaux
  /** Saisies manquantes et incohérences : tant qu'il y en a, les écrans de résultats attendent. */
  readonly manquants: readonly string[]
  readonly anomalies: readonly string[]
  readonly complet: boolean
  readonly actions: ActionsApplication
}

export const Contexte = createContext<ContexteApplication | null>(null)

export function useApplication(): ContexteApplication {
  const contexte = useContext(Contexte)
  if (contexte === null) throw new Error('useApplication doit être appelé sous FournisseurApplication')
  return contexte
}
