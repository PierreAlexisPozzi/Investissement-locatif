import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { SimulationVendeur } from '../../engine/contre-expertise'
import { anomaliesDossier, champsAComplete, objectifsParDefaut, type Dossier, type Objectifs } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import { appliquerSurcharges, type ParametresFiscaux, type SurchargeParametre } from '../../params'
import { Contexte, type ActionsApplication, type ContexteApplication } from './application'
import { dossierCourant, reduire, type EtatApplication } from './etat'
import { dossierEnregistreVierge, nouvelIdentifiant } from './initialisation'
import { ecrireDossiers, ecrireSurcharges, type Stockage } from './stockage'

interface Proprietes {
  readonly etatInitial: EtatApplication
  readonly stockage: Stockage | null
  /** Paramètres du fichier versionné, avant modifications locales. */
  readonly parametresDeBase: ParametresFiscaux
  readonly children: ReactNode
}

const horodatage = (): string => new Date().toISOString()

export function FournisseurApplication({ etatInitial, stockage, parametresDeBase, children }: Proprietes) {
  const [etat, envoyer] = useReducer(reduire, etatInitial)

  // Enregistrement automatique dans le navigateur ; un échec est signalé sans bloquer la saisie.
  useEffect(() => {
    const erreur = ecrireDossiers(stockage, { dossiers: etat.dossiers, courant: etat.courant })
    if (erreur === null) return
    const minuteur = window.setTimeout(() => {
      envoyer({ type: 'signaler', message: erreur })
    })
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [stockage, etat.dossiers, etat.courant])

  useEffect(() => {
    const erreur = ecrireSurcharges(stockage, etat.surcharges)
    if (erreur === null) return
    const minuteur = window.setTimeout(() => {
      envoyer({ type: 'signaler', message: erreur })
    })
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [stockage, etat.surcharges])

  const parametres = useMemo(() => appliquerSurcharges(parametresDeBase, etat.surcharges), [parametresDeBase, etat.surcharges])
  const p = parametres.parametres

  const actions = useMemo<ActionsApplication>(
    () => ({
      modifierDossier: (modifier: (d: Dossier) => Dossier) => {
        envoyer({ type: 'modifier_dossier', modifier, horodatage: horodatage() })
      },
      modifierObjectifs: (modifier: (o: Objectifs) => Objectifs) => {
        envoyer({
          type: 'modifier_dossier',
          modifier: (d) => ({ ...d, objectifs: modifier(d.objectifs ?? objectifsParDefaut()) }),
          horodatage: horodatage(),
        })
      },
      modifierVendeur: (simulation: SimulationVendeur | undefined) => {
        envoyer({ type: 'modifier_vendeur', simulation, horodatage: horodatage() })
      },
      nouveauDossier: () => {
        envoyer({ type: 'ajouter', dossier: dossierEnregistreVierge(new Date(), p) })
      },
      dupliquerDossier: () => {
        const source = dossierCourant(etat)
        envoyer({ type: 'ajouter', dossier: { ...source, id: nouvelIdentifiant(), nom: `${source.nom} (copie)`, modifie_le: horodatage() } })
      },
      selectionnerDossier: (id: string) => {
        envoyer({ type: 'selectionner', id })
      },
      renommerDossier: (nom: string) => {
        envoyer({ type: 'renommer', nom, horodatage: horodatage() })
      },
      supprimerDossier: () => {
        envoyer({ type: 'supprimer', remplacant: dossierEnregistreVierge(new Date(), p) })
      },
      importerDossier: (nom: string, dossier: Dossier, simulation: SimulationVendeur | undefined) => {
        const base = { id: nouvelIdentifiant(), nom, dossier, modifie_le: horodatage() }
        envoyer({ type: 'ajouter', dossier: simulation === undefined ? base : { ...base, simulation_vendeur: simulation } })
      },
      surchargerParametre: (chemin: string, surcharge: SurchargeParametre | null) => {
        envoyer({ type: 'surcharger', chemin, surcharge })
      },
      reinitialiserParametres: () => {
        envoyer({ type: 'reinitialiser_surcharges' })
      },
      choisirScenario: (scenario: IdScenario) => {
        envoyer({ type: 'choisir_scenario', scenario })
      },
      signaler: (message: string) => {
        envoyer({ type: 'signaler', message })
      },
      effacerMessages: () => {
        envoyer({ type: 'effacer_messages' })
      },
    }),
    [etat, p],
  )

  const enregistre = dossierCourant(etat)
  const dossier = enregistre.dossier
  const { foyers, bien, financement, exploitation, hypotheses } = dossier
  const dossierCalcul = useMemo<Dossier>(
    () => ({ foyers, bien, financement, exploitation, hypotheses }),
    [foyers, bien, financement, exploitation, hypotheses],
  )
  const manquants = useMemo(() => champsAComplete(dossierCalcul), [dossierCalcul])
  const anomalies = useMemo(() => anomaliesDossier(dossierCalcul), [dossierCalcul])
  const objectifs = useMemo(() => dossier.objectifs ?? objectifsParDefaut(), [dossier.objectifs])

  const valeur: ContexteApplication = {
    etat,
    enregistre,
    dossier,
    dossierCalcul,
    objectifs,
    parametres,
    parametresDeBase,
    p,
    manquants,
    anomalies,
    complet: manquants.length === 0 && anomalies.length === 0,
    actions,
  }
  return <Contexte value={valeur}>{children}</Contexte>
}
