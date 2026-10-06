/**
 * Dossier de simulation : les données saisies par l'utilisateur (§5), que
 * l'interface collecte et que l'export JSON conserve. Aucune règle fiscale ici :
 * les règles viennent des paramètres, les valeurs par défaut des hypothèses de
 * marché (`hypotheses-defaut.json`).
 *
 * Conventions de saisie :
 * - montants annuels en euros, loyers mensuels hors charges ;
 * - le prix saisi comprend le parking et les annexes acquis avec le logement ;
 * - les dates sont ramenées au premier jour de leur mois par le calendrier.
 */
import type { EnveloppePlacement, ModeEvolution, ScenarioPrix, Zone } from '../params'
import { hypothesesDefaut } from '../params'
import { verifierQuotesParts, type EtatBien, type TypeLogement } from './commun'
import { comparerDates, lireDate } from './dates'
import type { Millesime } from './deficits'
import type { PerimetreAssimileLli } from './lli'
import type { Surface } from './loyer-plafond'
import type { FraisSci } from './sci'

export type SituationFoyers = 'personne_seule' | 'marie_pacse' | 'concubins'

export interface RevenusFonciersExistants {
  /** Recettes brutes annuelles des autres biens loués nus. */
  readonly recettes: number
  /** Charges déductibles annuelles de ces biens, hors intérêts (retenues au régime réel). */
  readonly charges: number
  readonly regime: 'micro' | 'reel'
}

export interface FoyerFiscal {
  readonly libelle: string
  /** Revenu net imposable de l'année d'acquisition, hors revenus fonciers et hors opération. */
  readonly revenu_imposable: number
  readonly parts: number
  /** Quote-part du foyer dans le bien ou dans la SCI : 1 pour une personne seule ou un couple marié ou pacsé. */
  readonly quote_part: number
  readonly revenus_fonciers_existants?: RevenusFonciersExistants
  readonly deficits_fonciers_existants?: readonly Millesime[]
  /** Avantages déjà retenus dans le plafonnement global des niches (emploi à domicile, garde d'enfants…). */
  readonly avantages_niches_deja_utilises?: number
  /** Changement de revenu prévu (§5.1) : revenu de l'année indiquée, puis indexé. */
  readonly changement_revenu?: { readonly annee: number; readonly revenu_imposable: number }
  /** Mensualités des crédits en cours, assurance comprise. */
  readonly mensualites_credits_en_cours?: number
  /** Revenus d'activité du foyer, pour le statut de loueur en meublé ; à défaut, le revenu imposable. */
  readonly revenus_activite?: number
}

export interface Foyers {
  readonly situation: SituationFoyers
  readonly foyers: readonly FoyerFiscal[]
  readonly capacite_epargne_mensuelle: number
  readonly apport_disponible: number
}

export interface Bien {
  readonly etat: EtatBien
  readonly type_logement: TypeLogement
  readonly zone: Zone
  /** Commune à fort besoin de réhabilitation, Action Cœur de Ville ou sous convention ORT (Denormandie). */
  readonly commune_denormandie: boolean
  /** Périmètre assimilé du LLI hors zones tendues, déclaré par l'utilisateur. */
  readonly perimetre_lli?: PerimetreAssimileLli
  /** Programme proposé au taux réduit du LLI, mixité sociale comprise (déclaration du vendeur). */
  readonly programme_lli: boolean
  readonly surface: Surface
  /** Prix hors taxes pour un logement neuf, prix d'achat pour un logement ancien. */
  readonly prix_ht: number
  readonly frais_notaire: number
  /** Logement ancien : travaux facturés, achevés à la date de livraison. */
  readonly travaux?: number
  /** Travaux d'amélioration déductibles des revenus fonciers en location nue classique (S0). */
  readonly travaux_deductibles?: boolean
  /** Signature de l'acte (contrat de VEFA compris). */
  readonly date_acquisition: string
  /** Achèvement de l'immeuble (VEFA), ou des travaux pour un logement ancien. */
  readonly date_livraison: string
  readonly date_debut_location: string
  /** Loyers de marché constatés pour un bien comparable, par mois hors charges. */
  readonly loyer_marche_nu: number
  readonly loyer_marche_meuble: number
  /** Plafonds de loyer social et très social de la commune (Loc'Avantages), en €/m², pour les variantes Jeanbrun. */
  readonly plafonds_m2_loc_avantages?: { readonly social?: number; readonly tres_social?: number }
  /** Taxe foncière annuelle hors taxe d'enlèvement des ordures ménagères. */
  readonly taxe_fonciere: number
  readonly teom?: number
  readonly charges_copropriete_non_recuperables: number
  /** Prix de l'ancien récent du quartier, en €/m² (alerte, étape 5). */
  readonly prix_m2_ancien_recent?: number
}

export interface Financement {
  readonly emprunt: number
  readonly taux_annuel: number
  readonly duree_mois: number
  /** Différé partiel pendant la construction (VEFA). */
  readonly differe_mois?: number
  readonly taux_assurance_annuel: number
  readonly frais_dossier: number
  readonly frais_garantie: number
}

export interface Exploitation {
  readonly frais_gestion_part_loyers: number
  readonly assurance_loyers_impayes_part_loyers: number
  readonly assurance_pno_annuelle: number
  readonly lmnp: { readonly mobilier: number; readonly comptable_annuel: number; readonly cfe_annuelle: number }
  readonly sci: FraisSci
}

export interface HypothesesSimulation {
  readonly revalorisation_loyers: number
  readonly revalorisation_charges: number
  readonly vacance_mois_par_an: number
  readonly entretien_part_loyers: number
  readonly frais_cession: number
  readonly prix: ScenarioPrix
  readonly inflation: number
  readonly indexation_bareme: ModeEvolution
  readonly evolution_revenus: ModeEvolution
  readonly rendement_placement: number
  readonly enveloppe_placement: EnveloppePlacement
  readonly annees_exoneration_taxe_fonciere: number
  readonly ira_appliquees: boolean
  /** CSG déductible du revenu global de l'année suivante (option, désactivée par défaut). */
  readonly csg_deductible: boolean
}

export interface Dossier {
  readonly foyers: Foyers
  readonly bien: Bien
  readonly financement: Financement
  readonly exploitation: Exploitation
  readonly hypotheses: HypothesesSimulation
}

export type ScenarioMarche = 'pessimiste' | 'central' | 'optimiste'

/** Hypothèses par défaut (§5.5) pour un scénario de marché. */
export function hypothesesParDefaut(marche: ScenarioMarche = 'central'): HypothesesSimulation {
  const h = hypothesesDefaut
  return {
    revalorisation_loyers: h.marche.revalorisation_loyers.valeur,
    revalorisation_charges: h.marche.revalorisation_charges.valeur,
    vacance_mois_par_an: h.marche.vacance_mois_par_an.valeur,
    entretien_part_loyers: h.marche.entretien_part_loyers.valeur,
    frais_cession: h.marche.frais_cession.valeur,
    prix: h.marche.scenarios_prix.valeur[marche],
    inflation: h.marche.inflation.valeur,
    indexation_bareme: h.marche.indexation_bareme_ir.valeur,
    evolution_revenus: h.marche.evolution_revenus.valeur,
    rendement_placement: h.placement_reference.rendement_net_frais.valeur,
    enveloppe_placement: h.placement_reference.enveloppe.valeur,
    annees_exoneration_taxe_fonciere: h.bien.annees_exoneration_taxe_fonciere.valeur,
    ira_appliquees: h.financement.ira_appliquees.valeur,
    csg_deductible: false,
  }
}

/** Incohérences de saisie qui empêchent la simulation ; liste vide si le dossier est exploitable. */
export function anomaliesDossier(d: Dossier): string[] {
  const anomalies: string[] = []
  const { situation, foyers } = d.foyers
  const attendus = situation === 'concubins' ? 2 : 1
  if (foyers.length !== attendus) {
    anomalies.push(`Situation « ${situation} » : ${attendus} foyer(s) fiscal(aux) attendu(s), ${foyers.length} saisi(s)`)
  }
  try {
    verifierQuotesParts(foyers.map((f) => f.quote_part))
  } catch {
    anomalies.push('Les quotes-parts des foyers doivent être positives et de somme égale à 1')
  }
  const b = d.bien
  try {
    if (comparerDates(b.date_livraison, b.date_acquisition) < 0 && b.etat === 'vefa') {
      anomalies.push('VEFA : la livraison ne peut précéder la signature')
    }
    const debutAuPlusTot = comparerDates(b.date_livraison, b.date_acquisition) > 0 ? b.date_livraison : b.date_acquisition
    if (comparerDates(b.date_debut_location, debutAuPlusTot) < 0) {
      anomalies.push('La location ne peut commencer avant la signature et la livraison')
    }
    lireDate(b.date_debut_location)
  } catch (erreur) {
    anomalies.push(erreur instanceof Error ? erreur.message : 'Date invalide')
  }
  if (b.etat === 'ancien' && b.travaux === undefined) anomalies.push('Logement ancien : montant des travaux à saisir (0 si aucun)')
  if (!(d.financement.emprunt >= 0)) anomalies.push('Le montant emprunté doit être positif ou nul')
  return anomalies
}
