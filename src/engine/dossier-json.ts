/**
 * Export et import d'un dossier de simulation en JSON (§4 : persistance par
 * fichiers locaux). Un fichier importé n'est pas fiable : chaque champ est relu
 * et typé, les champs inconnus sont ignorés, toute valeur invalide est
 * signalée avec son chemin.
 */
import {
  ENVELOPPES_PLACEMENT,
  MODES_EVOLUTION,
  PERIMETRES_ASSIMILES_LLI,
  STATUTS_PARAMETRE,
  ZONES,
  type PonderationsObjectifs,
  type SurchargeParametre,
  type SurchargesParametres,
} from '../params'
import { ETATS_BIEN, TYPES_LOGEMENT } from './commun'
import type { SimulationVendeur } from './contre-expertise'
import { lireDate } from './dates'
import type { Millesime } from './deficits'
import {
  anomaliesDossier,
  REGIMES_REVENUS_FONCIERS,
  SITUATIONS_FOYERS,
  type BaremesQualitatifs,
  type Bien,
  type Dossier,
  type Exploitation,
  type Financement,
  type FoyerFiscal,
  type Foyers,
  type HypothesesSimulation,
  type Objectifs,
  type RevenusFonciersExistants,
} from './dossier'
import { SCENARIOS } from './scenario'

export const FORMAT_FICHIER_DOSSIER = 'investissement-locatif/dossier'
export const VERSION_FICHIER_DOSSIER = 1

export interface FichierDossier {
  readonly format: typeof FORMAT_FICHIER_DOSSIER
  readonly version: number
  readonly nom: string
  /** Horodatage ISO de l'export. */
  readonly enregistre_le: string
  readonly dossier: Dossier
  /** Simulation remise par le vendeur, saisie pour la contre-expertise (§12). */
  readonly simulation_vendeur?: SimulationVendeur
  /** Paramètres fiscaux modifiés pour ce dossier (écran 8) ; absents, le dossier suit le fichier versionné. */
  readonly parametres_modifies?: SurchargesParametres
}

/** Contenu d'un fichier `*.dossier.json`. */
export function fichierDossier(
  nom: string,
  dossier: Dossier,
  enregistreLe: string,
  simulationVendeur?: SimulationVendeur,
  parametresModifies?: SurchargesParametres,
): FichierDossier {
  const fichier: FichierDossier = { format: FORMAT_FICHIER_DOSSIER, version: VERSION_FICHIER_DOSSIER, nom, enregistre_le: enregistreLe, dossier }
  return {
    ...fichier,
    ...(simulationVendeur === undefined ? {} : { simulation_vendeur: simulationVendeur }),
    ...(parametresModifies === undefined || Object.keys(parametresModifies).length === 0 ? {} : { parametres_modifies: parametresModifies }),
  }
}

export type LectureDossier =
  | {
      readonly ok: true
      readonly nom: string
      readonly dossier: Dossier
      readonly simulation_vendeur?: SimulationVendeur
      readonly parametres_modifies?: SurchargesParametres
      readonly anomalies: readonly string[]
    }
  | { readonly ok: false; readonly erreurs: readonly string[] }

// ---------------------------------------------------------------------------
// Lecteurs typés
// ---------------------------------------------------------------------------

type Lecteur<T> = (valeur: unknown, chemin: string, erreurs: string[]) => T | undefined

/** Un lecteur par champ ; l'optionnalité suit celle du type, ce que le compilateur vérifie. */
type Schema<T> = {
  readonly [K in keyof T]-?: readonly [Lecteur<Exclude<T[K], undefined>>, undefined extends T[K] ? 'optionnel' : 'requis']
}

function objet<T>(schema: Schema<T>): Lecteur<T> {
  return (valeur, chemin, erreurs) => {
    if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
      erreurs.push(`${chemin} : objet attendu`)
      return undefined
    }
    const source = valeur as Readonly<Record<string, unknown>>
    const lu: Record<string, unknown> = {}
    let valide = true
    for (const cle of Object.keys(schema) as (keyof T & string)[]) {
      const [lecteur, presence] = schema[cle]
      const brut = Object.hasOwn(source, cle) ? source[cle] : undefined
      if (brut === undefined) {
        if (presence === 'requis') {
          erreurs.push(`${chemin}.${cle} : champ manquant`)
          valide = false
        }
        continue
      }
      const champ = lecteur(brut, `${chemin}.${cle}`, erreurs)
      if (champ === undefined) valide = false
      else lu[cle] = champ
    }
    // Chaque champ du schéma a été relu avec son lecteur : la valeur construite est du type attendu.
    return valide ? (lu as T) : undefined
  }
}

const nombre =
  (minimum = Number.NEGATIVE_INFINITY): Lecteur<number> =>
  (valeur, chemin, erreurs) => {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
      erreurs.push(`${chemin} : nombre attendu`)
      return undefined
    }
    if (valeur < minimum) {
      erreurs.push(`${chemin} : valeur inférieure à ${String(minimum)}`)
      return undefined
    }
    return valeur
  }

const positif = nombre(0)

const texte: Lecteur<string> = (valeur, chemin, erreurs) => {
  if (typeof valeur !== 'string') {
    erreurs.push(`${chemin} : texte attendu`)
    return undefined
  }
  return valeur
}

const booleen: Lecteur<boolean> = (valeur, chemin, erreurs) => {
  if (typeof valeur !== 'boolean') {
    erreurs.push(`${chemin} : vrai ou faux attendu`)
    return undefined
  }
  return valeur
}

const date: Lecteur<string> = (valeur, chemin, erreurs) => {
  const t = texte(valeur, chemin, erreurs)
  if (t === undefined) return undefined
  try {
    lireDate(t)
    return t
  } catch {
    erreurs.push(`${chemin} : date AAAA-MM-JJ attendue`)
    return undefined
  }
}

function parmi<T extends string>(admises: readonly T[]): Lecteur<T> {
  return (valeur, chemin, erreurs) => {
    if (typeof valeur !== 'string' || !(admises as readonly string[]).includes(valeur)) {
      erreurs.push(`${chemin} : valeur admise parmi ${admises.join(', ')}`)
      return undefined
    }
    return valeur as T
  }
}

function liste<T>(lecteur: Lecteur<T>): Lecteur<readonly T[]> {
  return (valeur, chemin, erreurs) => {
    if (!Array.isArray(valeur)) {
      erreurs.push(`${chemin} : liste attendue`)
      return undefined
    }
    const lus = valeur.map((element, k) => lecteur(element, `${chemin}[${String(k)}]`, erreurs))
    return lus.every((x) => x !== undefined) ? lus : undefined
  }
}

const notes: Lecteur<Readonly<Record<string, number>>> = (valeur, chemin, erreurs) => {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    erreurs.push(`${chemin} : objet attendu`)
    return undefined
  }
  const lu: Record<string, number> = {}
  let valide = true
  for (const [cle, note] of Object.entries(valeur)) {
    const n = positif(note, `${chemin}.${cle}`, erreurs)
    if (n === undefined) valide = false
    else lu[cle] = n
  }
  return valide ? lu : undefined
}

// ---------------------------------------------------------------------------
// Schémas du dossier
// ---------------------------------------------------------------------------

const millesime = objet<Millesime>({ annee: [nombre(), 'requis'], montant: [positif, 'requis'] })

const revenusFonciersExistants = objet<RevenusFonciersExistants>({
  recettes: [positif, 'requis'],
  charges: [positif, 'requis'],
  regime: [parmi(REGIMES_REVENUS_FONCIERS), 'requis'],
})

const foyerFiscal = objet<FoyerFiscal>({
  libelle: [texte, 'requis'],
  revenu_imposable: [positif, 'requis'],
  parts: [positif, 'requis'],
  quote_part: [positif, 'requis'],
  revenus_fonciers_existants: [revenusFonciersExistants, 'optionnel'],
  deficits_fonciers_existants: [liste(millesime), 'optionnel'],
  avantages_niches_deja_utilises: [positif, 'optionnel'],
  changement_revenu: [objet<{ annee: number; revenu_imposable: number }>({ annee: [nombre(), 'requis'], revenu_imposable: [positif, 'requis'] }), 'optionnel'],
  mensualites_credits_en_cours: [positif, 'optionnel'],
  revenus_activite: [positif, 'optionnel'],
})

const foyers = objet<Foyers>({
  situation: [parmi(SITUATIONS_FOYERS), 'requis'],
  foyers: [liste(foyerFiscal), 'requis'],
  capacite_epargne_mensuelle: [positif, 'requis'],
  apport_disponible: [positif, 'requis'],
})

const bien = objet<Bien>({
  commune: [texte, 'optionnel'],
  nombre_pieces: [positif, 'optionnel'],
  qpv: [booleen, 'optionnel'],
  nature_travaux: [texte, 'optionnel'],
  dpe_avant: [texte, 'optionnel'],
  dpe_apres: [texte, 'optionnel'],
  etat: [parmi(ETATS_BIEN), 'requis'],
  type_logement: [parmi(TYPES_LOGEMENT), 'requis'],
  zone: [parmi(ZONES), 'requis'],
  commune_denormandie: [booleen, 'requis'],
  perimetre_lli: [parmi(PERIMETRES_ASSIMILES_LLI), 'optionnel'],
  programme_lli: [booleen, 'requis'],
  surface: [objet<Bien['surface']>({ habitable: [positif, 'requis'], annexes: [positif, 'optionnel'] }), 'requis'],
  prix_ht: [positif, 'requis'],
  frais_notaire: [positif, 'requis'],
  travaux: [positif, 'optionnel'],
  travaux_deductibles: [booleen, 'optionnel'],
  travaux_denormandie_dans_plus_value: [booleen, 'optionnel'],
  date_acquisition: [date, 'requis'],
  date_livraison: [date, 'requis'],
  date_debut_location: [date, 'requis'],
  loyer_marche_nu: [positif, 'requis'],
  loyer_marche_meuble: [positif, 'requis'],
  plafonds_m2_loc_avantages: [
    objet<NonNullable<Bien['plafonds_m2_loc_avantages']>>({ social: [positif, 'optionnel'], tres_social: [positif, 'optionnel'] }),
    'optionnel',
  ],
  taxe_fonciere: [positif, 'requis'],
  teom: [positif, 'optionnel'],
  charges_copropriete_non_recuperables: [positif, 'requis'],
  prix_m2_ancien_recent: [positif, 'optionnel'],
})

const financement = objet<Financement>({
  emprunt: [positif, 'requis'],
  taux_annuel: [positif, 'requis'],
  duree_mois: [positif, 'requis'],
  differe_mois: [positif, 'optionnel'],
  taux_assurance_annuel: [positif, 'requis'],
  frais_dossier: [positif, 'requis'],
  frais_garantie: [positif, 'requis'],
})

const exploitation = objet<Exploitation>({
  frais_gestion_part_loyers: [positif, 'requis'],
  assurance_loyers_impayes_part_loyers: [positif, 'requis'],
  assurance_pno_annuelle: [positif, 'requis'],
  lmnp: [
    objet<Exploitation['lmnp']>({ mobilier: [positif, 'requis'], comptable_annuel: [positif, 'requis'], cfe_annuelle: [positif, 'requis'] }),
    'requis',
  ],
  sci: [
    objet<Exploitation['sci']>({
      constitution: [positif, 'requis'],
      comptabilite_annuelle: [positif, 'requis'],
      frais_bancaires_annuels: [positif, 'requis'],
    }),
    'requis',
  ],
})

const hypotheses = objet<HypothesesSimulation>({
  revalorisation_loyers: [nombre(), 'requis'],
  revalorisation_charges: [nombre(), 'requis'],
  vacance_mois_par_an: [positif, 'requis'],
  entretien_part_loyers: [positif, 'requis'],
  frais_cession: [positif, 'requis'],
  prix: [objet<HypothesesSimulation['prix']>({ decote_neuf: [nombre(), 'requis'], revalorisation_annuelle: [nombre(), 'requis'] }), 'requis'],
  inflation: [nombre(), 'requis'],
  indexation_bareme: [parmi(MODES_EVOLUTION), 'requis'],
  evolution_revenus: [parmi(MODES_EVOLUTION), 'requis'],
  rendement_placement: [nombre(), 'requis'],
  enveloppe_placement: [parmi(ENVELOPPES_PLACEMENT), 'requis'],
  annees_exoneration_taxe_fonciere: [positif, 'requis'],
  ira_appliquees: [booleen, 'requis'],
  csg_deductible: [booleen, 'requis'],
})

const objectifs = objet<Objectifs>({
  ponderations: [
    objet<PonderationsObjectifs>({
      economie_impot: [positif, 'requis'],
      effort_epargne: [positif, 'requis'],
      tri: [positif, 'requis'],
      souplesse: [positif, 'requis'],
      simplicite: [positif, 'requis'],
      transmission: [positif, 'requis'],
    }),
    'requis',
  ],
  horizon: [nombre(1), 'requis'],
  baremes: [
    objet<Partial<BaremesQualitatifs>>({ souplesse: [notes, 'optionnel'], simplicite: [notes, 'optionnel'], transmission: [notes, 'optionnel'] }),
    'optionnel',
  ],
})

const dossier = objet<Dossier>({
  foyers: [foyers, 'requis'],
  bien: [bien, 'requis'],
  financement: [financement, 'requis'],
  exploitation: [exploitation, 'requis'],
  hypotheses: [hypotheses, 'requis'],
  objectifs: [objectifs, 'optionnel'],
})

const simulationVendeur = objet<SimulationVendeur>({
  scenario: [parmi(SCENARIOS), 'requis'],
  horizon: [nombre(1), 'requis'],
  prix: [positif, 'requis'],
  loyer_mensuel: [positif, 'requis'],
  revalorisation_loyers: [nombre(), 'requis'],
  revalorisation_prix: [nombre(), 'requis'],
  vacance_mois_par_an: [positif, 'requis'],
  charges_copropriete: [positif, 'optionnel'],
  entretien_part_loyers: [positif, 'optionnel'],
  taxe_fonciere: [positif, 'optionnel'],
  frais_sci_annuels: [positif, 'optionnel'],
  taux_emprunt: [positif, 'requis'],
  prix_revente: [positif, 'optionnel'],
  economie_impot_annoncee: [nombre(), 'optionnel'],
  effort_epargne_annonce: [nombre(), 'optionnel'],
  impot_plus_value_annonce: [positif, 'optionnel'],
  tmi_supposee: [positif, 'optionnel'],
  tri_annonce: [nombre(), 'optionnel'],
})

const dateOuNull: Lecteur<string | null> = (valeur, chemin, erreurs) => (valeur === null ? null : date(valeur, chemin, erreurs))

const surcharge = objet<SurchargeParametre>({
  valeur: [(valeur) => valeur, 'optionnel'],
  statut: [parmi(STATUTS_PARAMETRE), 'optionnel'],
  date_verification: [dateOuNull, 'optionnel'],
})

/** Chemin pointé d'un paramètre (`jeanbrun.plafond_annuel`) ; son existence est contrôlée à l'application. */
const CHEMIN_PARAMETRE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

/** Paramètres modifiés du dossier : structure relue ici, valeurs contrôlées quand elles sont appliquées aux paramètres. */
const parametresModifies: Lecteur<SurchargesParametres> = (valeur, chemin, erreurs) => {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    erreurs.push(`${chemin} : objet attendu`)
    return undefined
  }
  const lu: Record<string, SurchargeParametre> = {}
  let valide = true
  for (const [cle, brut] of Object.entries(valeur)) {
    if (!CHEMIN_PARAMETRE.test(cle)) {
      erreurs.push(`${chemin} : « ${cle} » n’est pas un chemin de paramètre`)
      valide = false
      continue
    }
    const s = surcharge(brut, `${chemin}.${cle}`, erreurs)
    if (s === undefined) valide = false
    else lu[cle] = s
  }
  return valide ? lu : undefined
}

/** Relit un fichier de dossier : format, version, puis chaque champ ; les incohérences restent signalées. */
export function lireFichierDossier(contenu: unknown): LectureDossier {
  const erreurs: string[] = []
  if (typeof contenu !== 'object' || contenu === null || Array.isArray(contenu)) {
    return { ok: false, erreurs: ['Le fichier ne contient pas un dossier'] }
  }
  const source = contenu as Readonly<Record<string, unknown>>
  if (source.format !== FORMAT_FICHIER_DOSSIER) return { ok: false, erreurs: ['Ce fichier n’est pas un dossier de cet outil'] }
  if (source.version !== VERSION_FICHIER_DOSSIER) {
    return { ok: false, erreurs: [`Version de dossier non prise en charge : ${String(source.version)}`] }
  }
  const nom = texte(source.nom, 'nom', erreurs)
  const lu = dossier(source.dossier, 'dossier', erreurs)
  const vendeur = source.simulation_vendeur === undefined ? undefined : simulationVendeur(source.simulation_vendeur, 'simulation_vendeur', erreurs)
  const modifies =
    source.parametres_modifies === undefined ? undefined : parametresModifies(source.parametres_modifies, 'parametres_modifies', erreurs)
  if (nom === undefined || lu === undefined || erreurs.length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    nom,
    dossier: lu,
    ...(vendeur === undefined ? {} : { simulation_vendeur: vendeur }),
    ...(modifies === undefined || Object.keys(modifies).length === 0 ? {} : { parametres_modifies: modifies }),
    anomalies: anomaliesDossier(lu),
  }
}
