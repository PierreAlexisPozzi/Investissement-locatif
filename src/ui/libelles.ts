/**
 * Libellés d'affichage des valeurs énumérées du dossier et des paramètres.
 */
import type { EtatBien, TypeLogement } from '../engine/commun'
import type { SituationFoyers } from '../engine/dossier'
import type { PerimetreAssimileLli } from '../engine/lli'
import type { EnveloppePlacement, ModeEvolution } from '../params'

export { LIBELLES_STATUTS } from '../engine/format'

export const LIBELLES_SITUATIONS: Readonly<Record<SituationFoyers, string>> = {
  personne_seule: 'Personne seule',
  marie_pacse: 'Marié ou pacsé (un foyer)',
  concubins: 'Concubins (deux foyers)',
}

export const LIBELLES_ETATS: Readonly<Record<EtatBien, string>> = {
  neuf: 'Neuf achevé',
  vefa: 'Neuf en VEFA (sur plan)',
  ancien: 'Ancien avec travaux',
}

export const LIBELLES_TYPES_LOGEMENT: Readonly<Record<TypeLogement, string>> = {
  appartement_collectif: 'Appartement en immeuble collectif',
  maison_individuelle: 'Maison individuelle',
}

export const LIBELLES_PERIMETRES_LLI: Readonly<Record<PerimetreAssimileLli, string>> = {
  convention_ort: 'Convention d’opération de revitalisation de territoire (ORT)',
  contrat_ppa: 'Contrat de projet partenarial d’aménagement (PPA)',
  grande_operation_urbanisme: 'Grande opération d’urbanisme',
  contrat_redynamisation_site_defense: 'Contrat de redynamisation de site de défense',
  commune_reindustrialisation_pinm: 'Commune de réindustrialisation (PINM)',
}

export const LIBELLES_MODES_EVOLUTION: Readonly<Record<ModeEvolution, string>> = {
  egale_inflation: 'Indexé sur l’inflation',
  nulle: 'Constant',
}

export const LIBELLES_ENVELOPPES: Readonly<Record<EnveloppePlacement, string>> = {
  pea: 'PEA',
  assurance_vie: 'Assurance-vie',
  cto: 'Compte-titres',
}

/** Options d'une liste déroulante à partir d'une table de libellés. */
export function options<T extends string>(libelles: Readonly<Record<T, string>>): { valeur: T; libelle: string }[] {
  return (Object.keys(libelles) as T[]).map((valeur) => ({ valeur, libelle: libelles[valeur] }))
}
