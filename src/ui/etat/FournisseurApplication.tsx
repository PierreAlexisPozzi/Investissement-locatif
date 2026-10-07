import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { SimulationVendeur } from '../../engine/contre-expertise'
import { anomaliesDossier, champsAComplete, objectifsParDefaut, type Dossier, type Objectifs } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import { appliquerSurcharges, type ParametresFiscaux, type SurchargeParametre, type SurchargesParametres } from '../../params'
import { Contexte, type ActionsApplication, type ContexteApplication } from './application'
import { dossierCourant, reduire, type EtatApplication } from './etat'
import { dossierEnregistreVierge, nouvelIdentifiant } from './initialisation'
import { CLE_DOSSIERS, ecrireDossierCourant, ecrireDossiers, lireDossiers, type Stockage } from './stockage'

interface Proprietes {
  readonly etatInitial: EtatApplication
  readonly stockage: Stockage | null
  /** Paramètres du fichier versionné, avant modifications locales. */
  readonly parametresDeBase: ParametresFiscaux
  readonly children: ReactNode
}

const horodatage = (): string => new Date().toISOString()

/** Aucune modification : objet stable, pour que les paramètres d'un dossier non modifié restent ceux du fichier. */
const AUCUNE_MODIFICATION: SurchargesParametres = {}

export function FournisseurApplication({ etatInitial, stockage, parametresDeBase, children }: Proprietes) {
  const [etat, envoyer] = useReducer(reduire, etatInitial)

  // Enregistrement automatique dans le navigateur ; un échec est signalé sans bloquer la saisie.
  useEffect(() => {
    const erreur = ecrireDossiers(stockage, etat.dossiers)
    if (erreur === null) return
    const minuteur = window.setTimeout(() => {
      envoyer({ type: 'signaler', message: erreur })
    })
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [stockage, etat.dossiers])

  // Dossier ouvert : écrit seulement quand il change, pas quand un autre onglet fait recharger les dossiers.
  useEffect(() => {
    ecrireDossierCourant(stockage, etat.courant)
  }, [stockage, etat.courant])

  // Un autre onglet a enregistré : son contenu remplace celui-ci, pour qu'aucun des deux n'efface l'autre. Le dossier
  // ouvert, propre à chaque onglet, a sa propre clé, ignorée ici.
  useEffect(() => {
    if (stockage === null) return
    const ecouter = (e: StorageEvent): void => {
      if (e.key !== null && e.key !== CLE_DOSSIERS) return
      const dossiers = lireDossiers(stockage, new Date().toISOString())
      envoyer({ type: 'recharger', dossiers: dossiers.valeur.dossiers, message: 'Dossiers mis à jour depuis un autre onglet' })
      for (const message of dossiers.erreurs) envoyer({ type: 'signaler', message })
    }
    window.addEventListener('storage', ecouter)
    return () => {
      window.removeEventListener('storage', ecouter)
    }
  }, [stockage])

  // Chaque dossier a sa version des paramètres : le fichier versionné et ses propres modifications.
  const enregistre = dossierCourant(etat)
  const modifies = enregistre.parametres_modifies ?? AUCUNE_MODIFICATION
  const parametres = useMemo(() => appliquerSurcharges(parametresDeBase, modifies), [parametresDeBase, modifies])
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
        envoyer({ type: 'ajouter', dossier: dossierEnregistreVierge(new Date(), parametresDeBase) })
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
        envoyer({ type: 'supprimer', remplacant: dossierEnregistreVierge(new Date(), parametresDeBase) })
      },
      importerDossier: (
        nom: string,
        dossier: Dossier,
        simulation: SimulationVendeur | undefined,
        parametresModifies: SurchargesParametres | undefined,
      ) => {
        envoyer({
          type: 'ajouter',
          dossier: {
            id: nouvelIdentifiant(),
            nom,
            dossier,
            ...(simulation === undefined ? {} : { simulation_vendeur: simulation }),
            ...(parametresModifies === undefined ? {} : { parametres_modifies: parametresModifies }),
            modifie_le: horodatage(),
          },
        })
      },
      surchargerParametre: (chemin: string, surcharge: SurchargeParametre | null) => {
        envoyer({ type: 'surcharger', chemin, surcharge, horodatage: horodatage() })
      },
      reinitialiserParametres: () => {
        envoyer({ type: 'reinitialiser_surcharges', horodatage: horodatage() })
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
    [etat, parametresDeBase],
  )

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
