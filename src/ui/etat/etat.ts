/**
 * État de l'application : dossiers enregistrés, dossier courant, paramètres
 * modifiés. Le réducteur est pur ; identifiants et horodatages sont fournis
 * par l'appelant.
 */
import type { SimulationVendeur } from '../../engine/contre-expertise'
import type { Dossier } from '../../engine/dossier'
import type { IdScenario } from '../../engine/scenario'
import type { SurchargeParametre, SurchargesParametres } from '../../params'
import type { DossierEnregistre } from './stockage'

export const ECRANS = [
  { id: 'foyer', titre: 'Mon foyer' },
  { id: 'bien', titre: 'Le bien et le financement' },
  { id: 'hypotheses', titre: 'Hypothèses' },
  { id: 'comparaison', titre: 'Comparaison' },
  { id: 'recommandation', titre: 'Recommandation' },
  { id: 'detail', titre: 'Détail d’un scénario' },
  { id: 'contre_expertise', titre: 'Contre-expertise du vendeur' },
  { id: 'parametres', titre: 'Paramètres fiscaux' },
  { id: 'questions', titre: 'Questions à poser' },
] as const

export type IdEcran = (typeof ECRANS)[number]['id']

export function estEcran(x: string): x is IdEcran {
  return ECRANS.some((e) => e.id === x)
}

export interface EtatApplication {
  readonly dossiers: readonly DossierEnregistre[]
  /** Identifiant du dossier courant : il en existe toujours un. */
  readonly courant: string
  readonly surcharges: SurchargesParametres
  /** Scénario affiché par les écrans Détail et Questions. */
  readonly scenario: IdScenario
  /** Messages à l'utilisateur : lecture du stockage, import. */
  readonly messages: readonly string[]
}

export type Action =
  | { readonly type: 'modifier_dossier'; readonly modifier: (d: Dossier) => Dossier; readonly horodatage: string }
  | { readonly type: 'modifier_vendeur'; readonly simulation: SimulationVendeur | undefined; readonly horodatage: string }
  | { readonly type: 'ajouter'; readonly dossier: DossierEnregistre }
  | { readonly type: 'selectionner'; readonly id: string }
  | { readonly type: 'renommer'; readonly nom: string; readonly horodatage: string }
  /** Supprime le dossier courant ; le remplaçant sert s'il n'en reste aucun. */
  | { readonly type: 'supprimer'; readonly remplacant: DossierEnregistre }
  | { readonly type: 'surcharger'; readonly chemin: string; readonly surcharge: SurchargeParametre | null }
  | { readonly type: 'reinitialiser_surcharges' }
  /** Contenu enregistré par un autre onglet : il remplace celui de cet onglet, qui garde son dossier ouvert. */
  | {
      readonly type: 'recharger'
      readonly dossiers: readonly DossierEnregistre[]
      readonly surcharges: SurchargesParametres
      readonly message: string
    }
  | { readonly type: 'choisir_scenario'; readonly scenario: IdScenario }
  | { readonly type: 'signaler'; readonly message: string }
  | { readonly type: 'effacer_messages' }

/** Dossier courant ; le premier à défaut (état toujours cohérent). */
export function dossierCourant(etat: EtatApplication): DossierEnregistre {
  const d = etat.dossiers.find((x) => x.id === etat.courant) ?? etat.dossiers[0]
  if (d === undefined) throw new Error('Aucun dossier dans l’état de l’application')
  return d
}

function remplacerCourant(etat: EtatApplication, modifier: (x: DossierEnregistre) => DossierEnregistre): EtatApplication {
  const courant = dossierCourant(etat)
  return { ...etat, dossiers: etat.dossiers.map((x) => (x.id === courant.id ? modifier(x) : x)) }
}

/** Nom libre parmi les dossiers : « Dossier 2 », ou le nom suivi d'un numéro. */
export function nomDisponible(dossiers: readonly DossierEnregistre[], souhaite: string): string {
  const pris = new Set(dossiers.map((x) => x.nom))
  if (!pris.has(souhaite)) return souhaite
  for (let k = 2; ; k++) {
    const nom = `${souhaite} (${String(k)})`
    if (!pris.has(nom)) return nom
  }
}

/** Copie d'un objet sans l'une de ses clés. */
function sans<T extends object, K extends keyof T>(objet: T, cle: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(objet).filter(([k]) => k !== cle)) as Omit<T, K>
}

export function reduire(etat: EtatApplication, action: Action): EtatApplication {
  switch (action.type) {
    case 'modifier_dossier':
      return remplacerCourant(etat, (x) => ({ ...x, dossier: action.modifier(x.dossier), modifie_le: action.horodatage }))
    case 'modifier_vendeur':
      return remplacerCourant(etat, (x) => {
        const reste = sans(x, 'simulation_vendeur')
        return action.simulation === undefined
          ? { ...reste, modifie_le: action.horodatage }
          : { ...reste, simulation_vendeur: action.simulation, modifie_le: action.horodatage }
      })
    case 'ajouter': {
      const dossier = { ...action.dossier, nom: nomDisponible(etat.dossiers, action.dossier.nom) }
      return { ...etat, dossiers: [...etat.dossiers, dossier], courant: dossier.id }
    }
    case 'selectionner':
      return etat.dossiers.some((x) => x.id === action.id) ? { ...etat, courant: action.id } : etat
    case 'renommer': {
      const nom = action.nom.trim()
      if (nom === '') return etat
      const autres = etat.dossiers.filter((x) => x.id !== etat.courant)
      return remplacerCourant(etat, (x) => ({ ...x, nom: nomDisponible(autres, nom), modifie_le: action.horodatage }))
    }
    case 'supprimer': {
      const restants = etat.dossiers.filter((x) => x.id !== etat.courant)
      const dossiers = restants.length > 0 ? restants : [action.remplacant]
      const [premier] = dossiers
      return premier === undefined ? etat : { ...etat, dossiers, courant: premier.id }
    }
    case 'surcharger': {
      const autres = Object.fromEntries(Object.entries(etat.surcharges).filter(([chemin]) => chemin !== action.chemin))
      return { ...etat, surcharges: action.surcharge === null ? autres : { ...autres, [action.chemin]: action.surcharge } }
    }
    case 'reinitialiser_surcharges':
      return { ...etat, surcharges: {} }
    case 'recharger': {
      if (action.dossiers.length === 0) return etat
      const courant = action.dossiers.some((x) => x.id === etat.courant) ? etat.courant : (action.dossiers[0]?.id ?? etat.courant)
      const messages = etat.messages.includes(action.message) ? etat.messages : [...etat.messages, action.message]
      return { ...etat, dossiers: action.dossiers, courant, surcharges: action.surcharges, messages }
    }
    case 'choisir_scenario':
      return { ...etat, scenario: action.scenario }
    case 'signaler':
      return etat.messages.includes(action.message) ? etat : { ...etat, messages: [...etat.messages, action.message] }
    case 'effacer_messages':
      return { ...etat, messages: [] }
  }
}
