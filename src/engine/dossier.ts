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
import type { EnveloppePlacement, ModeEvolution, ParametresFiscaux, PonderationsObjectifs, ScenarioPrix, Zone } from '../params'
import { hypothesesDefaut } from '../params'
import { verifierQuotesParts, type EtatBien, type TypeLogement } from './commun'
import { MOIS_PAR_AN } from './constantes-numeriques'
import { comparerDates, lireDate } from './dates'
import type { Millesime } from './deficits'
import type { PerimetreAssimileLli } from './lli'
import type { Surface } from './loyer-plafond'
import type { FraisSci } from './sci'

export const SITUATIONS_FOYERS = ['personne_seule', 'marie_pacse', 'concubins'] as const
export type SituationFoyers = (typeof SITUATIONS_FOYERS)[number]

export const REGIMES_REVENUS_FONCIERS = ['micro', 'reel'] as const

export interface RevenusFonciersExistants {
  /** Recettes brutes annuelles des autres biens loués nus. */
  readonly recettes: number
  /** Charges déductibles annuelles de ces biens, hors intérêts (retenues au régime réel). */
  readonly charges: number
  readonly regime: (typeof REGIMES_REVENUS_FONCIERS)[number]
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
  /** Commune, nombre de pièces, quartier prioritaire, travaux et étiquettes énergétiques : informations sans effet sur le calcul. */
  readonly commune?: string
  readonly nombre_pieces?: number
  readonly qpv?: boolean
  readonly nature_travaux?: string
  readonly dpe_avant?: string
  readonly dpe_apres?: string
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
  /**
   * Denormandie : travaux retenus dans la plus-value même sans reprise de la réduction (tolérance du BOFiP
   * non tranchée) ; à défaut, le paramètre `plus_value_immobiliere.travaux_denormandie_retenus`.
   */
  readonly travaux_denormandie_dans_plus_value?: boolean
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

/** Notes qualitatives par identifiant de scénario (§10.3), modifiables par l'utilisateur. */
export interface BaremesQualitatifs {
  readonly souplesse: Readonly<Record<string, number>>
  readonly simplicite: Readonly<Record<string, number>>
  readonly transmission: Readonly<Record<string, number>>
}

/** Objectifs du foyer (§5.6) : curseurs de pondération, horizon envisagé, barèmes qualitatifs modifiés. */
export interface Objectifs {
  readonly ponderations: PonderationsObjectifs
  /** Horizon de détention envisagé, en années de location avant la revente. */
  readonly horizon: number
  /** Notes modifiées ; les autres viennent des hypothèses par défaut. */
  readonly baremes?: Partial<BaremesQualitatifs>
}

export interface Dossier {
  readonly foyers: Foyers
  readonly bien: Bien
  readonly financement: Financement
  readonly exploitation: Exploitation
  readonly hypotheses: HypothesesSimulation
  /** À défaut, les objectifs par défaut (`objectifsParDefaut`). */
  readonly objectifs?: Objectifs
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

/**
 * Dossier vierge : montants à zéro, dates du jour, hypothèses par défaut. Couple marié ou pacsé,
 * comme l'utilisateur du cahier des charges (§2) ; prêt sur la durée maximale usuelle.
 */
export function dossierVierge(aujourdHui: string, p: ParametresFiscaux): Dossier {
  return {
    foyers: {
      situation: 'marie_pacse',
      foyers: foyersPourSituation([], 'marie_pacse', p),
      capacite_epargne_mensuelle: 0,
      apport_disponible: 0,
    },
    bien: {
      etat: 'vefa',
      type_logement: 'appartement_collectif',
      zone: 'A',
      commune_denormandie: false,
      programme_lli: false,
      surface: { habitable: 0 },
      prix_ht: 0,
      frais_notaire: 0,
      date_acquisition: aujourdHui,
      date_livraison: aujourdHui,
      date_debut_location: aujourdHui,
      loyer_marche_nu: 0,
      loyer_marche_meuble: 0,
      taxe_fonciere: 0,
      charges_copropriete_non_recuperables: 0,
    },
    financement: {
      emprunt: 0,
      taux_annuel: 0,
      duree_mois: p.financement.duree_max_pret_ans.valeur * MOIS_PAR_AN,
      differe_mois: 0,
      taux_assurance_annuel: 0,
      frais_dossier: 0,
      frais_garantie: 0,
    },
    exploitation: {
      frais_gestion_part_loyers: 0,
      assurance_loyers_impayes_part_loyers: 0,
      assurance_pno_annuelle: 0,
      lmnp: { mobilier: 0, comptable_annuel: 0, cfe_annuelle: 0 },
      sci: { constitution: 0, comptabilite_annuelle: 0, frais_bancaires_annuels: 0 },
    },
    hypotheses: hypothesesParDefaut('central'),
  }
}

const LIBELLES_PAR_DEFAUT = ['Foyer', 'Couple', 'Concubin 1', 'Concubin 2']

/**
 * Un foyer à partir de deux (concubins devenus mariés ou pacsés) : revenus, avantages déjà utilisés, crédits en
 * cours et revenus fonciers additionnés, déficits fonciers réunis ; un changement de revenu prévu, propre à une
 * personne, est à ressaisir pour le foyer. Les revenus fonciers passent au réel si l'un des deux y était, ou si
 * leurs recettes réunies dépassent le seuil du micro-foncier.
 */
function fusionnerFoyers(a: FoyerFiscal, b: FoyerFiscal, p: ParametresFiscaux): FoyerFiscal {
  const somme = (x: number | undefined, y: number | undefined): number | undefined => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0))
  const fa = a.revenus_fonciers_existants
  const fb = b.revenus_fonciers_existants
  const recettes = (fa?.recettes ?? 0) + (fb?.recettes ?? 0)
  const micro = fa?.regime !== 'reel' && fb?.regime !== 'reel' && recettes <= p.micro_foncier.seuil_recettes.valeur
  const fonciers =
    fa === undefined && fb === undefined
      ? undefined
      : { recettes, charges: (fa?.charges ?? 0) + (fb?.charges ?? 0), regime: micro ? ('micro' as const) : ('reel' as const) }
  const deficits = [...(a.deficits_fonciers_existants ?? []), ...(b.deficits_fonciers_existants ?? [])]
  const optionnels = {
    revenus_fonciers_existants: fonciers,
    deficits_fonciers_existants: deficits.length > 0 ? deficits : undefined,
    avantages_niches_deja_utilises: somme(a.avantages_niches_deja_utilises, b.avantages_niches_deja_utilises),
    mensualites_credits_en_cours: somme(a.mensualites_credits_en_cours, b.mensualites_credits_en_cours),
    revenus_activite: somme(a.revenus_activite, b.revenus_activite),
  }
  const definis = Object.fromEntries(Object.entries(optionnels).filter(([, v]) => v !== undefined)) as Partial<FoyerFiscal>
  return { libelle: a.libelle, revenu_imposable: a.revenu_imposable + b.revenu_imposable, parts: a.parts, quote_part: 1, ...definis }
}

/**
 * Foyers fiscaux d'une nouvelle situation du couple : un seul foyer de quote-part 1, ou deux concubins à parts
 * égales. Deux concubins qui se marient ou se pacsent forment un foyer qui additionne leurs revenus ; une personne
 * seule garde les saisies du premier foyer. Les parts reviennent aux parts de base de la situation (enfants à
 * ressaisir) et les libellés par défaut suivent la situation.
 */
export function foyersPourSituation(actuels: readonly FoyerFiscal[], situation: SituationFoyers, p: ParametresFiscaux): FoyerFiscal[] {
  const parts = p.impot_revenu.parts_quotient_familial.valeur
  const libelle = (f: FoyerFiscal | undefined, defaut: string): string =>
    f === undefined || LIBELLES_PAR_DEFAUT.includes(f.libelle) || f.libelle.trim() === '' ? defaut : f.libelle
  const [premier, second] = actuels
  const vide: FoyerFiscal = { libelle: '', revenu_imposable: 0, parts: parts.personne_seule, quote_part: 1 }
  if (situation === 'concubins') {
    const moitie = 1 / 2
    return [
      { ...(premier ?? vide), libelle: libelle(premier, 'Concubin 1'), parts: parts.personne_seule, quote_part: moitie },
      { ...(second ?? vide), libelle: libelle(second, 'Concubin 2'), parts: parts.personne_seule, quote_part: moitie },
    ]
  }
  const couple = situation === 'marie_pacse'
  const unique = couple && premier !== undefined && second !== undefined ? fusionnerFoyers(premier, second, p) : (premier ?? vide)
  return [
    {
      ...unique,
      libelle: libelle(premier, couple ? 'Couple' : 'Foyer'),
      parts: couple ? parts.couple_marie_pacse : parts.personne_seule,
      quote_part: 1,
    },
  ]
}

/** Saisies encore vides dont la simulation a besoin ; liste vide quand le dossier est complet. */
export function champsAComplete(d: Dossier): string[] {
  const manquants: string[] = []
  for (const f of d.foyers.foyers) {
    if (!(f.revenu_imposable > 0)) manquants.push(`Revenu imposable (${f.libelle})`)
    if (!(f.parts > 0)) manquants.push(`Nombre de parts (${f.libelle})`)
  }
  if (!(d.foyers.capacite_epargne_mensuelle > 0)) manquants.push('Capacité d’épargne mensuelle')
  const b = d.bien
  if (!(b.prix_ht > 0)) manquants.push(b.etat === 'ancien' ? 'Prix d’achat' : 'Prix hors taxes')
  if (!(b.frais_notaire > 0)) manquants.push('Frais de notaire')
  if (!(b.surface.habitable > 0)) manquants.push('Surface habitable')
  if (!(b.loyer_marche_nu > 0)) manquants.push('Loyer de marché nu')
  if (!(b.loyer_marche_meuble > 0)) manquants.push('Loyer de marché meublé')
  const f = d.financement
  if (f.emprunt > 0 && !(f.duree_mois > 0)) manquants.push('Durée du prêt')
  return manquants
}

/** Pondérations et horizon par défaut (§5.6), à ajuster dans l'écran Recommandation. */
export function objectifsParDefaut(): Objectifs {
  const o = hypothesesDefaut.objectifs
  return { ponderations: o.ponderations.valeur, horizon: o.horizon_ans.valeur }
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
