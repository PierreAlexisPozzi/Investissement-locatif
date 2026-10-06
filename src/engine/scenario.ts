/**
 * Orchestration année par année des scénarios S0 à S5 jusqu'à la revente
 * (§7, §8), et placement de référence équivalent (S6, §8.7).
 *
 * Chaque année civile : loyers encaissés, charges, emprunt, résultat fiscal
 * selon le régime, impôt sur le revenu recalculé en entier avec et sans
 * l'opération pour chaque foyer, prélèvements sociaux, créance de taxe
 * foncière, flux de trésorerie après impôt. À l'horizon : revente, plus-value,
 * complément de TVA, reprises en cas de sortie anticipée.
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Les simplifications sont listées dans HYPOTHESES.md (section 6).
 */
import type { NiveauLoyer, ParametresFiscaux } from '../params'
import { listerParametres } from '../params'
import { valeurActuelleNette, type FluxDate } from './actualisation'
import { calendrierOperation, type AnneeCalendrier, type Calendrier } from './calendrier'
import { cumulerEligibilites, eligibilite, type Eligibilite, type ModeDetention } from './commun'
import { MOIS_PAR_AN } from './constantes-numeriques'
import { anneesRevolues, comparerDates, ajouterAnnees, lireDate } from './dates'
import type { Millesime } from './deficits'
import {
  dureeEngagementDenormandie,
  eligibiliteDenormandie,
  reductionDenormandie,
  type EngagementInitialDenormandie,
} from './denormandie'
import { anomaliesDossier, type Dossier, type FoyerFiscal } from './dossier'
import { indemnitesRemboursementAnticipe, tableauAmortissement, type Echeance } from './emprunt'
import { calculerImpot, calculerRevenuGlobal, indexerImpotRevenu, type Foyer } from './impot-revenu'
import { eligibiliteJeanbrun, ruptureJeanbrun, tableauAmortissementJeanbrun, type TableauJeanbrun } from './jeanbrun'
import {
  complementTvaLli,
  creanceTaxeFonciere,
  eligibiliteCumulJeanbrunLli,
  eligibiliteLli,
  prixTtc,
  rangAnneeDepuisLivraison,
  taxeFonciereDeductibleLli,
} from './lli'
import {
  amortissementsReintegresLmnp,
  anneeBasculeVersMicro,
  dotationsLmnp,
  ETAT_INITIAL_LMNP,
  exerciceLmnpReel,
  microBic,
  planAmortissementLmnp,
  prelevementsSociauxLmnp,
  statutLoueurMeuble,
  type EtatLmnp,
  type ResultatLmnpReel,
  type ResultatMicroBic,
} from './lmnp'
import { plafondLoyer, plafondLoyerIntermediaire } from './loyer-plafond'
import { simulerPlacement, type ResultatPlacement } from './placement-reference'
import { calculerPlusValue, type Cedants, type DetailPlusValue } from './plus-value'
import {
  fraisGestionForfaitaires,
  imputationsRemisesEnCause,
  prelevementsSociauxFonciers,
  revenuFoncierMicro,
  revenuFoncierReel,
} from './revenus-fonciers'
import {
  exerciceSciIs,
  fiscaliteDistribution,
  fraisAnnuelsSci,
  fraisConstitutionDeductibles,
  planAmortissementSciIs,
  plusValueCessionSciIs,
} from './sci'

export const SCENARIOS = [
  'S0',
  'S1',
  'S1_social',
  'S1_tres_social',
  'S2',
  'S3',
  'S3_IS',
  'S4',
  'S5_6',
  'S5_9',
  'S5_12',
] as const
export type IdScenario = (typeof SCENARIOS)[number]

export const LIBELLES_SCENARIOS: Readonly<Record<IdScenario, string>> = {
  S0: 'Location nue classique',
  S1: 'Jeanbrun neuf, loyer intermédiaire',
  S1_social: 'Jeanbrun neuf, loyer social',
  S1_tres_social: 'Jeanbrun neuf, loyer très social',
  S2: 'Jeanbrun + LLI en SCI à l’IR',
  S3: 'LLI seul en SCI à l’IR',
  S3_IS: 'LLI en SCI à l’IS (indicatif)',
  S4: 'LMNP',
  S5_6: 'Denormandie, engagement de 6 ans',
  S5_9: 'Denormandie, engagement de 9 ans',
  S5_12: 'Denormandie, engagement de 12 ans',
}

type RegimeOperation = 'foncier' | 'lmnp' | 'is'
type Loyer = 'marche_nu' | 'marche_meuble' | NiveauLoyer

interface Configuration {
  readonly regime: RegimeOperation
  readonly detention: ModeDetention
  readonly tva_reduite: boolean
  readonly loyer: Loyer
  readonly jeanbrun: NiveauLoyer | null
  readonly lli: boolean
  readonly denormandie: { readonly engagement_initial: EngagementInitialDenormandie; readonly prorogations: number } | null
}

const base: Configuration = {
  regime: 'foncier',
  detention: 'nom_propre',
  tva_reduite: false,
  loyer: 'marche_nu',
  jeanbrun: null,
  lli: false,
  denormandie: null,
}

const CONFIGURATIONS: Readonly<Record<IdScenario, Configuration>> = {
  S0: base,
  S1: { ...base, loyer: 'intermediaire', jeanbrun: 'intermediaire' },
  S1_social: { ...base, loyer: 'social', jeanbrun: 'social' },
  S1_tres_social: { ...base, loyer: 'tres_social', jeanbrun: 'tres_social' },
  S2: { ...base, detention: 'sci_ir', tva_reduite: true, loyer: 'intermediaire', jeanbrun: 'intermediaire', lli: true },
  S3: { ...base, detention: 'sci_ir', tva_reduite: true, loyer: 'intermediaire', lli: true },
  S3_IS: { ...base, regime: 'is', detention: 'sci_is', tva_reduite: true, loyer: 'intermediaire', lli: true },
  S4: { ...base, regime: 'lmnp', loyer: 'marche_meuble' },
  S5_6: { ...base, loyer: 'intermediaire', denormandie: { engagement_initial: 'six_ans', prorogations: 0 } },
  S5_9: { ...base, loyer: 'intermediaire', denormandie: { engagement_initial: 'neuf_ans', prorogations: 0 } },
  S5_12: { ...base, loyer: 'intermediaire', denormandie: { engagement_initial: 'neuf_ans', prorogations: 1 } },
}

/** Régime d'imposition des loyers : réel, micro (S0, S4), ou réel puis micro à partir de l'année de bascule (S4). */
export type RegimeFiscal = 'reel' | 'micro' | 'reel_puis_micro'

export interface OptionsSimulation {
  /** Années de location avant la revente. */
  readonly horizon: number
  /** Régime imposé ; à défaut, le plus favorable en valeur actuelle nette (§8.4). */
  readonly regime?: RegimeFiscal
  /** Coefficient appliqué au prix de revente (prix d'équilibre, sensibilités). */
  readonly facteur_prix_revente?: number
}

export interface ChargesAnnee {
  readonly taxe_fonciere: number
  readonly copropriete: number
  readonly assurance_pno: number
  readonly gestion: number
  readonly assurance_loyers_impayes: number
  readonly entretien: number
  readonly frais_gestion_forfaitaires: number
  readonly frais_sci: number
  readonly comptable_et_cfe: number
}

export interface LigneAnnuelle {
  readonly annee: number
  readonly mois_detention: number
  readonly mois_location: number
  readonly loyer_mensuel_marche: number
  readonly loyer_mensuel_retenu: number
  readonly loyers_encaisses: number
  /** Manque à gagner du plafonnement par rapport au marché, sur les mois loués. */
  readonly decote_loyer: number
  readonly charges: ChargesAnnee
  readonly charges_total: number
  readonly interets: number
  readonly assurance_emprunteur: number
  readonly capital_rembourse: number
  readonly capital_restant_du: number
  /** Amortissement déduit : Jeanbrun, LMNP ou comptable (SCI à l'IS). */
  readonly amortissement_deduit: number
  /** Résultat fiscal de l'opération : revenu foncier, bénéfice de location meublée ou résultat de la SCI. */
  readonly resultat_fiscal: number
  readonly deficit_impute_revenu_global: number
  /** Déficits reportables en fin d'année : fonciers, de location meublée ou de la SCI. */
  readonly deficits_reportables: number
  readonly reduction_impot_imputee: number
  readonly reduction_impot_perdue: number
  /** Impôt sur le revenu avec l'opération moins impôt sans, tous foyers : négatif quand l'opération en fait économiser. */
  readonly impot_revenu_differentiel: number
  readonly prelevements_sociaux: number
  readonly impot_societes: number
  readonly creance_taxe_fonciere: number
  /** Flux de trésorerie après impôt de l'année, hors revente : négatif pour un effort d'épargne. */
  readonly flux_tresorerie: number
  readonly temps_moyen: number
}

export interface SortieScenario {
  readonly date_cession: string
  readonly annees_detention: number
  readonly prix_revente: number
  readonly frais_cession: number
  readonly capital_restant_du: number
  readonly indemnites_remboursement_anticipe: number
  readonly plus_value: DetailPlusValue | null
  readonly impot_plus_value: number
  /** Impôt de plus-value dû aux seuls amortissements réintégrés (§9). */
  readonly impot_plus_value_reintegration: number
  readonly complement_tva: number
  /** Impôt sur le revenu et prélèvements sociaux de la réintégration Jeanbrun (rupture), compris dans la dernière année. */
  readonly reprise_jeanbrun: number
  /** Réductions Denormandie reprises (sortie anticipée), comprises dans la dernière année. */
  readonly reprise_denormandie: number
  /** Prélèvement forfaitaire sur la distribution finale (SCI à l'IS). */
  readonly impot_distribution: number
  /** Produit net de la revente pour les investisseurs. */
  readonly produit_net: number
}

export interface ResultatSimulation {
  readonly regime: RegimeFiscal | 'is'
  readonly calendrier: Calendrier
  readonly prix_acquisition: number
  readonly cout_total: number
  readonly emprunt: number
  /** Fonds propres investis à la signature : coût total moins emprunt. */
  readonly apport: number
  readonly annees: readonly LigneAnnuelle[]
  readonly sortie: SortieScenario
  readonly flux: readonly FluxDate[]
  readonly placement: ResultatPlacement
  readonly alertes: readonly string[]
  /** Exercices de location meublée au réel : amortissements disponibles, déduits et différés (traçabilité). */
  readonly exercices_lmnp: readonly ResultatLmnpReel[]
}

export interface ResultatScenario {
  readonly id: IdScenario
  readonly libelle: string
  readonly eligibilite: Eligibilite
  /** Paramètres non vérifiés dont dépend le scénario (badge et alerte du §10). */
  readonly parametres_a_confirmer: readonly string[]
  /** Null pour un scénario inéligible, affiché grisé avec ses motifs. */
  readonly simulation: ResultatSimulation | null
}

const anneeDuRang = (rang: number): number => Math.floor(rang / MOIS_PAR_AN)

/** Éligibilité du scénario pour le bien et le foyer saisis (§10, filtre 1). */
export function eligibiliteScenario(d: Dossier, id: IdScenario, p: ParametresFiscaux): Eligibilite {
  const cfg = CONFIGURATIONS[id]
  const b = d.bien
  const dossier = eligibilite(anomaliesDossier(d).map((a) => `Dossier : ${a}`))
  const elements: Eligibilite[] = [dossier]
  const jeanbrun = (detention: ModeDetention): Eligibilite =>
    eligibiliteJeanbrun(
      { date_acquisition: b.date_acquisition, etat: b.etat, type_logement: b.type_logement, detention },
      p,
    )
  const lli = (detention: ModeDetention): Eligibilite => {
    const regles = eligibiliteLli(
      { etat: b.etat, detention, zone: b.zone, perimetre_assimile: b.perimetre_lli, mixite_sociale: true },
      p,
    )
    return b.programme_lli
      ? regles
      : cumulerEligibilites(regles, eligibilite(['LLI : programme non proposé au taux réduit de TVA par le vendeur']))
  }
  if (cfg.jeanbrun !== null && !cfg.lli) {
    elements.push(jeanbrun('nom_propre'))
    if (cfg.jeanbrun !== 'intermediaire' && b.plafonds_m2_loc_avantages?.[cfg.jeanbrun] === undefined) {
      const niveau = cfg.jeanbrun === 'social' ? 'social' : 'très social'
      elements.push(eligibilite([`Jeanbrun ${niveau} : plafond de loyer de la commune non saisi (Loc'Avantages)`]))
    }
  }
  if (cfg.jeanbrun !== null && cfg.lli) elements.push(eligibiliteCumulJeanbrunLli(jeanbrun('sci_ir'), lli('sci_ir'), p))
  if (cfg.jeanbrun === null && cfg.lli) elements.push(lli(cfg.detention))
  if (cfg.denormandie !== null) {
    elements.push(
      eligibiliteDenormandie(
        {
          date_acquisition: b.date_acquisition,
          etat: b.etat,
          detention: cfg.detention,
          commune_eligible: b.commune_denormandie,
          prix_acquisition: b.prix_ht,
          frais_acquisition: b.frais_notaire,
          travaux: b.travaux ?? 0,
          annee_achevement_travaux: lireDate(b.date_livraison).annee,
        },
        p,
      ),
    )
  }
  return cumulerEligibilites(...elements)
}

const PARAMETRES_SENSIBLES: Readonly<Record<IdScenario, readonly string[]>> = {
  S0: ['lli.tva_taux_normal'],
  S1: [
    'lli.tva_taux_normal',
    'jeanbrun.prorata_premiere_annee',
    'jeanbrun.plafond_proratise_premiere_annee',
    'jeanbrun.concubins_plafond_par_foyer',
    'plus_value_immobiliere.forfait_travaux_bien_neuf_amorti',
  ],
  S1_social: [],
  S1_tres_social: [],
  S2: [
    'lli.tva_taux_normal',
    'jeanbrun.prorata_premiere_annee',
    'jeanbrun.plafond_proratise_premiere_annee',
    'jeanbrun.concubins_plafond_par_foyer',
    'plus_value_immobiliere.forfait_travaux_bien_neuf_amorti',
    'cumul_jeanbrun_lli.statut_cumul',
    'lli.tf_deductible_si_creance',
    'sci_ir.frais_constitution_deductibles',
    'sci_ir.frais_bancaires_couverts_par_forfait',
  ],
  S3: [
    'lli.tva_taux_normal',
    'lli.tf_deductible_si_creance',
    'sci_ir.frais_constitution_deductibles',
    'sci_ir.frais_bancaires_couverts_par_forfait',
  ],
  S3_IS: ['lli.tva_taux_normal', 'lli.tf_deductible_si_creance', 'lmnp.modelisation'],
  S4: [
    'lli.tva_taux_normal',
    'lmnp.modelisation',
    'lmnp.perimetre_reintegration_pv',
    'plus_value_immobiliere.frais_acquisition_deduits_en_charge',
    'plus_value_immobiliere.forfait_travaux_bien_neuf_amorti',
  ],
  S5_6: [],
  S5_9: [],
  S5_12: [],
}

/** Paramètres non vérifiés utilisés par le scénario pour ce dossier. */
export function parametresAConfirmer(d: Dossier, id: IdScenario, p: ParametresFiscaux): string[] {
  const variantes: Partial<Record<IdScenario, IdScenario>> = { S1_social: 'S1', S1_tres_social: 'S1' }
  const chemins = PARAMETRES_SENSIBLES[variantes[id] ?? id].filter(
    (c) => c !== 'jeanbrun.concubins_plafond_par_foyer' || d.foyers.situation === 'concubins',
  )
  const neuf = d.bien.etat !== 'ancien'
  const statuts = new Map(listerParametres(p).map((e) => [e.chemin, e.parametre.statut]))
  return chemins.filter((c) => (neuf || c !== 'lli.tva_taux_normal') && statuts.get(c) !== 'verifie')
}

/** État fiscal d'un foyer reporté d'une année sur l'autre, avec et sans l'opération. */
interface EtatFoyer {
  readonly fonciers_avec: readonly Millesime[]
  readonly fonciers_sans: readonly Millesime[]
  readonly globaux_avec: readonly Millesime[]
  readonly globaux_sans: readonly Millesime[]
  readonly csg_avec: number
  readonly csg_sans: number
  readonly reductions_obtenues: number
}

interface Prix {
  readonly acquisition: number
  readonly travaux: number
  readonly cout_total: number
  readonly apport: number
}

function prixOperation(d: Dossier, cfg: Configuration, p: ParametresFiscaux): Prix {
  const b = d.bien
  const ancien = b.etat === 'ancien'
  const taux = cfg.tva_reduite ? p.lli.tva_taux_reduit.valeur : p.lli.tva_taux_normal.valeur
  const acquisition = ancien ? b.prix_ht : prixTtc(b.prix_ht, taux)
  const travaux = ancien ? (b.travaux ?? 0) : 0
  const mobilier = cfg.regime === 'lmnp' ? d.exploitation.lmnp.mobilier : 0
  const constitution = cfg.detention === 'nom_propre' ? 0 : d.exploitation.sci.constitution
  const fraisEmprunt = d.financement.frais_dossier + d.financement.frais_garantie
  const coutTotal = acquisition + b.frais_notaire + travaux + mobilier + constitution + fraisEmprunt
  return { acquisition, travaux, cout_total: coutTotal, apport: coutTotal - d.financement.emprunt }
}

function loyerMensuelDeBase(d: Dossier, cfg: Configuration, p: ParametresFiscaux): { marche: number; plafond: number | null } {
  const b = d.bien
  const marche = cfg.loyer === 'marche_meuble' ? b.loyer_marche_meuble : b.loyer_marche_nu
  if (cfg.loyer === 'marche_nu' || cfg.loyer === 'marche_meuble') return { marche, plafond: null }
  if (cfg.loyer === 'intermediaire') {
    return { marche, plafond: plafondLoyerIntermediaire(b.zone, b.surface, p).loyer_plafond_mensuel }
  }
  const plafondM2 = b.plafonds_m2_loc_avantages?.[cfg.loyer]
  return { marche, plafond: plafondM2 === undefined ? null : plafondLoyer(plafondM2, b.surface, p).loyer_plafond_mensuel }
}

function cedants(d: Dossier, cfg: Configuration): Cedants {
  const quotes = d.foyers.foyers.map((f) => f.quote_part)
  if (cfg.detention !== 'nom_propre') return { nature: 'sci_ir', quotes_parts: quotes }
  switch (d.foyers.situation) {
    case 'personne_seule':
      return { nature: 'personne_seule', quotes_parts: [1] }
    case 'marie_pacse':
      return { nature: 'epoux', quotes_parts: [1 / 2, 1 / 2] }
    case 'concubins':
      return { nature: 'concubins', quotes_parts: quotes }
  }
}

/** Revenu net imposable du foyer pour l'année, hors revenus fonciers et hors opération. */
function revenuDuFoyer(d: Dossier, f: FoyerFiscal, annee: number): number {
  const h = d.hypotheses
  const anneeAcquisition = lireDate(d.bien.date_acquisition).annee
  const indexe = (depuis: number): number => (h.evolution_revenus === 'egale_inflation' ? (1 + h.inflation) ** (annee - depuis) : 1)
  if (f.changement_revenu !== undefined && annee >= f.changement_revenu.annee) {
    return f.changement_revenu.revenu_imposable * indexe(f.changement_revenu.annee)
  }
  return f.revenu_imposable * indexe(anneeAcquisition)
}

function parametresDeLAnnee(d: Dossier, p: ParametresFiscaux): (annee: number) => ParametresFiscaux {
  const cache = new Map<number, ParametresFiscaux>()
  const h = d.hypotheses
  return (annee) => {
    if (h.indexation_bareme !== 'egale_inflation') return p
    const existant = cache.get(annee)
    if (existant !== undefined) return existant
    const indexes = indexerImpotRevenu(p, (1 + h.inflation) ** (annee - p.meta.annee_revenus))
    cache.set(annee, indexes)
    return indexes
  }
}

interface DonneesAnnee {
  readonly cal: AnneeCalendrier
  readonly loyer_marche: number
  readonly loyer_retenu: number
  readonly loyers: number
  readonly decote: number
  readonly charges: ChargesAnnee
  readonly charges_total: number
  readonly tf_deductible: number
  readonly creance: number
  readonly interets: number
  readonly assurance: number
  readonly capital_rembourse: number
  readonly capital_restant_du: number
  readonly frais_emprunt: number
  readonly frais_constitution_deductibles: number
  /** Frais de la SCI déductibles des revenus fonciers (comptabilité, frais bancaires selon le paramètre). */
  readonly sci_deductibles: number
}

/** Loyers, charges, emprunt et créance de chaque année, communs à tous les régimes. */
function donneesAnnuelles(
  d: Dossier,
  cfg: Configuration,
  cal: Calendrier,
  echeances: readonly Echeance[],
  p: ParametresFiscaux,
): DonneesAnnee[] {
  const b = d.bien
  const h = d.hypotheses
  const ex = d.exploitation
  const anneeAcquisition = anneeDuRang(cal.rang_acquisition)
  // Neuf : taxe foncière due à partir de l'année suivant l'achèvement réel ; ancien : chaque année détenue.
  const ancien = b.etat === 'ancien'
  const anneeAchevement = lireDate(b.date_livraison).annee
  const loyerBase = loyerMensuelDeBase(d, cfg, p)
  const capitalInitial = d.financement.emprunt
  let restant = capitalInitial

  return cal.annees.map((a) => {
    const ecart = a.annee - anneeAcquisition
    const coefLoyers = (1 + h.revalorisation_loyers) ** ecart
    const coefCharges = (1 + h.revalorisation_charges) ** ecart
    const marche = loyerBase.marche * coefLoyers
    const retenu = loyerBase.plafond === null ? marche : Math.min(marche, loyerBase.plafond * coefLoyers)
    const moisEncaisses = a.mois_location * (1 - h.vacance_mois_par_an / MOIS_PAR_AN)
    const loyers = retenu * moisEncaisses
    const decote = (marche - retenu) * moisEncaisses

    const rangTaxe = ancien ? a.annee - anneeAcquisition + 1 : a.annee - anneeAchevement
    const exoneree = !ancien && rangTaxe <= h.annees_exoneration_taxe_fonciere
    const prorataDetention = a.mois_detention / MOIS_PAR_AN
    const taxeAnnuelle = b.taxe_fonciere * coefCharges
    const taxeFonciere = rangTaxe >= 1 && !exoneree ? taxeAnnuelle * prorataDetention : 0
    const creance = cfg.lli
      ? creanceTaxeFonciere(
          {
            detention: cfg.detention,
            date_achevement: cal.date_livraison,
            taxe_fonciere: taxeAnnuelle + (b.teom ?? 0) * coefCharges,
            teom: (b.teom ?? 0) * coefCharges,
            rang_annee: rangTaxe,
            annees_exoneration_totale: h.annees_exoneration_taxe_fonciere,
          },
          p,
        ).montant * prorataDetention
      : 0
    // Copropriété et assurance : dès l'achat pour un logement ancien, à la livraison pour un logement neuf.
    const prorataLivre = (ancien ? a.mois_detention : a.mois_apres_livraison) / MOIS_PAR_AN
    const sci = cfg.detention === 'nom_propre' ? null : fraisAnnuelsSci(ex.sci, ecart + 1, h.revalorisation_charges, p)
    const loue = a.mois_location > 0
    const charges: ChargesAnnee = {
      taxe_fonciere: taxeFonciere,
      copropriete: b.charges_copropriete_non_recuperables * coefCharges * prorataLivre,
      assurance_pno: ex.assurance_pno_annuelle * coefCharges * prorataLivre,
      gestion: loyers * ex.frais_gestion_part_loyers,
      assurance_loyers_impayes: loyers * ex.assurance_loyers_impayes_part_loyers,
      entretien: loyers * h.entretien_part_loyers,
      frais_gestion_forfaitaires: cfg.regime === 'foncier' && loue ? fraisGestionForfaitaires(1, p) : 0,
      frais_sci: sci === null ? 0 : sci.total * prorataDetention,
      comptable_et_cfe:
        cfg.regime === 'lmnp' && loue ? (ex.lmnp.comptable_annuel + ex.lmnp.cfe_annuelle) * coefCharges : 0,
    }
    const chargesTotal =
      charges.taxe_fonciere +
      charges.copropriete +
      charges.assurance_pno +
      charges.gestion +
      charges.assurance_loyers_impayes +
      charges.entretien +
      charges.frais_gestion_forfaitaires +
      charges.frais_sci +
      charges.comptable_et_cfe

    const echeancesAnnee = echeances.filter((e) => {
      const rang = cal.rang_acquisition + e.numero
      return anneeDuRang(rang) === a.annee && rang < cal.rang_cession
    })
    const somme = (cle: 'interets' | 'assurance' | 'capital_rembourse'): number =>
      echeancesAnnee.reduce((total, e) => total + e[cle], 0)
    restant = echeancesAnnee.at(-1)?.capital_restant_du ?? restant
    const sciDeductibles = sci === null ? 0 : sci.deductibles_revenus_fonciers * prorataDetention
    const premiereAnnee = a.annee === anneeAcquisition

    return {
      cal: a,
      loyer_marche: marche,
      loyer_retenu: retenu,
      loyers,
      decote,
      charges,
      charges_total: chargesTotal,
      tf_deductible: cfg.lli ? taxeFonciereDeductibleLli(taxeFonciere, creance > 0, p) : taxeFonciere,
      creance,
      interets: somme('interets'),
      assurance: somme('assurance'),
      capital_rembourse: somme('capital_rembourse'),
      capital_restant_du: restant,
      frais_emprunt: premiereAnnee ? d.financement.frais_dossier + d.financement.frais_garantie : 0,
      frais_constitution_deductibles:
        premiereAnnee && cfg.detention !== 'nom_propre' ? fraisConstitutionDeductibles(ex.sci, p) : 0,
      sci_deductibles: sciDeductibles,
    }
  })
}

/** Charges déductibles autres que financières au régime réel des revenus fonciers. */
function autresChargesFoncieres(x: DonneesAnnee, travauxDeductibles: number): number {
  const c = x.charges
  return (
    x.tf_deductible +
    c.copropriete +
    c.assurance_pno +
    c.gestion +
    c.assurance_loyers_impayes +
    c.entretien +
    c.frais_gestion_forfaitaires +
    x.sci_deductibles +
    x.frais_constitution_deductibles +
    travauxDeductibles
  )
}

interface ResultatAnneeFoyers {
  readonly impot_revenu_differentiel: number
  readonly prelevements_sociaux: number
  readonly deficit_impute_revenu_global: number
  readonly deficits_reportables: number
  readonly reduction_imputee: number
  readonly reduction_perdue: number
  readonly reprise_jeanbrun: number
  readonly reprise_denormandie: number
  readonly etats: readonly EtatFoyer[]
}

interface RevenusOperationFoyer {
  /** Régime réel des revenus fonciers de l'opération, part du foyer. */
  readonly foncier?: {
    readonly recettes: number
    readonly interets: number
    readonly assurance: number
    readonly frais_emprunt: number
    readonly autres_charges: number
    readonly amortissement: number
    readonly micro: boolean
  }
  readonly bic: number
  readonly reduction: number
  readonly reintegration_jeanbrun: { readonly montant: number; readonly coefficient: number } | null
  readonly reprise_denormandie: number
}

/** Impôt différentiel de l'année : chaque foyer est imposé en entier avec et sans l'opération (§8.1, point 4). */
function imposerFoyers(
  d: Dossier,
  annee: number,
  revenusOperation: readonly RevenusOperationFoyer[],
  etats: readonly EtatFoyer[],
  pAnnee: ParametresFiscaux,
  p: ParametresFiscaux,
): ResultatAnneeFoyers {
  const tauxCsg = p.prelevements_sociaux.csg_deductible.valeur
  const csgActivee = d.hypotheses.csg_deductible
  let ir = 0
  let ps = 0
  let deficitImpute = 0
  let deficitsReportables = 0
  let reductionImputee = 0
  let reductionPerdue = 0
  let repriseJeanbrun = 0
  let repriseDenormandie = 0
  const nouveauxEtats: EtatFoyer[] = []

  d.foyers.foyers.forEach((f, i) => {
    const op = revenusOperation[i]
    const etat = etats[i]
    if (op === undefined || etat === undefined) return
    const foyer: Foyer = { parts: f.parts, imposition_commune: d.foyers.situation === 'marie_pacse' }
    const revenu = revenuDuFoyer(d, f, annee)
    const existants = f.revenus_fonciers_existants
    const recettesExistantes = existants?.recettes ?? 0
    const chargesExistantes = existants?.charges ?? 0

    // Sans l'opération : autres revenus fonciers dans leur régime actuel.
    const sans =
      existants?.regime === 'micro'
        ? revenuFoncierMicro(annee, recettesExistantes, p, { deficits_anterieurs: etat.fonciers_sans })
        : revenuFoncierReel(
            {
              annee,
              recettes: recettesExistantes,
              charges: { interets: 0, autres_charges: chargesExistantes },
              deficits_anterieurs: etat.fonciers_sans,
            },
            p,
          )
    const deficitSans = 'deficit_imputable_revenu_global' in sans ? sans.deficit_imputable_revenu_global : 0

    // Avec l'opération : revenus fonciers réunis (réel ou micro), ou inchangés à côté d'un bénéfice de location meublée.
    const foncierOp = op.foncier
    const avec =
      foncierOp === undefined
        ? sans
        : foncierOp.micro
          ? revenuFoncierMicro(annee, foncierOp.recettes + recettesExistantes, p, { deficits_anterieurs: etat.fonciers_avec })
          : revenuFoncierReel(
              {
                annee,
                recettes: foncierOp.recettes + recettesExistantes,
                charges: {
                  interets: foncierOp.interets,
                  assurance_emprunteur: foncierOp.assurance,
                  frais_emprunt: foncierOp.frais_emprunt,
                  autres_charges: foncierOp.autres_charges + chargesExistantes,
                  amortissement: foncierOp.amortissement,
                },
                deficits_anterieurs: etat.fonciers_avec,
              },
              p,
            )
    const deficitAvec = 'deficit_imputable_revenu_global' in avec ? avec.deficit_imputable_revenu_global : 0
    const rfSans = sans.revenu_foncier_imposable
    const rfAvec = avec.revenu_foncier_imposable

    const globalSans = calculerRevenuGlobal(
      {
        annee,
        revenus_categoriels: revenu + rfSans,
        deficit_foncier_imputable: deficitSans,
        charges_deductibles: etat.csg_sans,
        deficits_globaux_anterieurs: etat.globaux_sans,
      },
      p,
    )
    const globalAvec = calculerRevenuGlobal(
      {
        annee,
        revenus_categoriels: revenu + rfAvec + op.bic,
        deficit_foncier_imputable: deficitAvec,
        charges_deductibles: etat.csg_avec,
        deficits_globaux_anterieurs: etat.globaux_avec,
      },
      p,
    )
    const niches = f.avantages_niches_deja_utilises ?? 0
    const impotSans = calculerImpot(globalSans.revenu_global_net, foyer, pAnnee, { avantages_niches_deja_utilises: niches })
    const optionsAvec = {
      avantages_niches_deja_utilises: niches,
      ...(p.denormandie.dans_plafonnement_niches.valeur
        ? { reductions_plafonnees: op.reduction }
        : { reductions_non_plafonnees: op.reduction }),
    }
    const impotAvecSansReprise = calculerImpot(globalAvec.revenu_global_net, foyer, pAnnee, optionsAvec)
    const impotAvec =
      op.reintegration_jeanbrun === null
        ? impotAvecSansReprise
        : calculerImpot(globalAvec.revenu_global_net, foyer, pAnnee, {
            ...optionsAvec,
            revenu_exceptionnel: op.reintegration_jeanbrun,
          })
    const reintegre = op.reintegration_jeanbrun?.montant ?? 0
    const psJeanbrun = prelevementsSociauxFonciers(reintegre, p)

    ir += impotAvec.impot_du + op.reprise_denormandie - impotSans.impot_du
    ps +=
      prelevementsSociauxFonciers(rfAvec, p) -
      prelevementsSociauxFonciers(rfSans, p) +
      psJeanbrun +
      prelevementsSociauxLmnp(op.bic, p)
    deficitImpute += deficitAvec - deficitSans
    deficitsReportables += avec.deficits_reportables.reduce((total, m) => total + m.montant, 0)
    reductionImputee += impotAvec.reductions_imputees
    reductionPerdue += impotAvec.reductions_perdues
    repriseJeanbrun += impotAvec.impot_du - impotAvecSansReprise.impot_du + psJeanbrun
    repriseDenormandie += op.reprise_denormandie

    nouveauxEtats.push({
      fonciers_avec: avec.deficits_reportables,
      fonciers_sans: sans.deficits_reportables,
      globaux_avec: globalAvec.deficits_globaux,
      globaux_sans: globalSans.deficits_globaux,
      csg_avec: csgActivee ? tauxCsg * (Math.max(0, rfAvec) + reintegre + Math.max(0, op.bic)) : 0,
      csg_sans: csgActivee ? tauxCsg * Math.max(0, rfSans) : 0,
      reductions_obtenues: etat.reductions_obtenues + impotAvec.reductions_imputees,
    })
  })

  return {
    impot_revenu_differentiel: ir,
    prelevements_sociaux: ps,
    deficit_impute_revenu_global: deficitImpute,
    deficits_reportables: deficitsReportables,
    reduction_imputee: reductionImputee,
    reduction_perdue: reductionPerdue,
    reprise_jeanbrun: repriseJeanbrun,
    reprise_denormandie: repriseDenormandie,
    etats: nouveauxEtats,
  }
}

function etatsInitiaux(d: Dossier): EtatFoyer[] {
  return d.foyers.foyers.map((f) => ({
    fonciers_avec: f.deficits_fonciers_existants ?? [],
    fonciers_sans: f.deficits_fonciers_existants ?? [],
    globaux_avec: [],
    globaux_sans: [],
    csg_avec: 0,
    csg_sans: 0,
    reductions_obtenues: 0,
  }))
}

interface Revente {
  readonly prix: number
  readonly frais: number
  readonly capital_restant_du: number
  readonly indemnites: number
  readonly annees_detention: number
}

function revente(d: Dossier, cal: Calendrier, capitalRestant: number, options: OptionsSimulation, p: ParametresFiscaux): Revente {
  const b = d.bien
  const h = d.hypotheses
  // Neuf : prix TTC à 20 % diminué de la décote du neuf, quel que soit le taux de TVA payé (§5.5).
  const baseRevente =
    b.etat === 'ancien'
      ? b.prix_ht + (b.travaux ?? 0)
      : prixTtc(b.prix_ht, p.lli.tva_taux_normal.valeur) * (1 - h.prix.decote_neuf)
  const prix = baseRevente * (1 + h.prix.revalorisation_annuelle) ** cal.duree_detention_ans * (options.facteur_prix_revente ?? 1)
  const indemnites =
    h.ira_appliquees && capitalRestant > 0
      ? indemnitesRemboursementAnticipe(capitalRestant, d.financement.taux_annuel, p)
      : 0
  return {
    prix,
    frais: prix * h.frais_cession,
    capital_restant_du: capitalRestant,
    indemnites,
    // VEFA : la détention court de la conclusion du contrat (paramètre depart_detention_vefa).
    annees_detention: anneesRevolues(cal.date_acquisition, cal.date_cession),
  }
}

function complementTva(d: Dossier, cfg: Configuration, cal: Calendrier, p: ParametresFiscaux): number {
  if (!cfg.lli) return 0
  return complementTvaLli(
    {
      prix_ht: d.bien.prix_ht,
      rang_annee_sortie: rangAnneeDepuisLivraison(cal.date_livraison, cal.date_cession),
      motif: 'cession',
    },
    p,
  ).montant
}

function placementEquivalent(d: Dossier, apport: number, annees: readonly LigneAnnuelle[], p: ParametresFiscaux): ResultatPlacement {
  return simulerPlacement(
    {
      versement_initial: apport,
      versements_annuels: annees.map((a) => -a.flux_tresorerie),
      mois_par_annee: annees.map((a) => a.mois_detention),
      rendement_annuel: d.hypotheses.rendement_placement,
      enveloppe: d.hypotheses.enveloppe_placement,
      couple: d.foyers.situation !== 'personne_seule',
    },
    p,
  )
}

function fluxDates(apport: number, annees: readonly LigneAnnuelle[], cal: Calendrier, produitNet: number): FluxDate[] {
  return [
    { temps: 0, montant: -apport },
    ...annees.map((a) => ({ temps: a.temps_moyen, montant: a.flux_tresorerie })),
    { temps: cal.duree_detention_ans, montant: produitNet },
  ]
}

/** Scénarios imposés à l'impôt sur le revenu : revenus fonciers (S0, S1, S2, S3, S5) ou location meublée (S4). */
function simulerImpotRevenu(
  d: Dossier,
  cfg: Configuration,
  regime: RegimeFiscal,
  options: OptionsSimulation,
  p: ParametresFiscaux,
): ResultatSimulation {
  const b = d.bien
  const f = d.financement
  const cal = calendrierOperation(b.date_acquisition, b.date_livraison, b.date_debut_location, options.horizon)
  const prix = prixOperation(d, cfg, p)
  const echeances = tableauAmortissement({
    capital: f.emprunt,
    taux_annuel: f.taux_annuel,
    duree_mois: f.duree_mois,
    taux_assurance_annuel: f.taux_assurance_annuel,
    differe_mois: f.differe_mois ?? 0,
    frais_dossier: f.frais_dossier,
    frais_garantie: f.frais_garantie,
  })
  const donnees = donneesAnnuelles(d, cfg, cal, echeances, p)
  const parametresAnnee = parametresDeLAnnee(d, p)
  const foyers = d.foyers.foyers
  const derniere = cal.annees.at(-1)
  const anneeCession = derniere?.annee ?? anneeDuRang(cal.rang_cession)
  const anneeLivraison = anneeDuRang(cal.rang_livraison)
  const alertes: string[] = []

  // Jeanbrun : amortissement de la quote-part de chaque foyer, sous son propre plafond.
  const tableaux: (TableauJeanbrun | null)[] = foyers.map((foyer) =>
    cfg.jeanbrun === null
      ? null
      : tableauAmortissementJeanbrun(
          {
            prix_acquisition: prix.acquisition,
            niveau: cfg.jeanbrun,
            date_achevement: cal.date_livraison,
            date_acquisition: cal.date_acquisition,
            derniere_annee: anneeCession,
            fraction_derniere_annee: (derniere?.mois_detention ?? MOIS_PAR_AN) / MOIS_PAR_AN,
            quote_part: foyer.quote_part,
          },
          p,
        ),
  )
  const ruptures = tableaux.map((t) =>
    t === null ? null : ruptureJeanbrun(t, cal.date_debut_location, cal.date_cession, 'cession', p),
  )
  if (tableaux.some((t) => t?.annees.some((a) => a.plafonne) === true)) {
    alertes.push('Jeanbrun : l’annuité dépasse le plafond annuel du foyer, l’amortissement est plafonné')
  }

  // Denormandie : réduction de la quote-part de chaque foyer, reprise en cas de cession avant le terme de l'engagement.
  const denormandie = cfg.denormandie
  const reductions = foyers.map((foyer) =>
    denormandie === null
      ? null
      : reductionDenormandie(
          {
            prix_acquisition: b.prix_ht * foyer.quote_part,
            frais_acquisition: b.frais_notaire * foyer.quote_part,
            travaux: prix.travaux * foyer.quote_part,
            surface_habitable: b.surface.habitable * foyer.quote_part,
            engagement_initial: denormandie.engagement_initial,
            prorogations: denormandie.prorogations,
            annee_achevement_travaux: anneeLivraison,
          },
          p,
        ),
  )
  const finEngagementDenormandie =
    denormandie === null
      ? null
      : ajouterAnnees(
          cal.date_debut_location,
          dureeEngagementDenormandie(denormandie.engagement_initial, denormandie.prorogations, p),
        )
  const ruptureDenormandie =
    finEngagementDenormandie !== null &&
    comparerDates(cal.date_cession, finEngagementDenormandie) < 0 &&
    p.denormandie.reprise_cession_anticipee.valeur

  // Location meublée : plan d'amortissement, charges antérieures au début de l'activité reportées sur le premier exercice.
  const lmnp = cfg.regime === 'lmnp'
  const plan = lmnp
    ? planAmortissementLmnp(
        {
          prix_acquisition: prix.acquisition + prix.travaux,
          frais_acquisition: b.frais_notaire,
          mobilier: d.exploitation.lmnp.mobilier,
        },
        p,
      )
    : null
  const moisPremiereActivite = cal.annees.find((a) => a.rang_location === 1)?.mois_location ?? MOIS_PAR_AN
  let etatLmnp: EtatLmnp = ETAT_INITIAL_LMNP
  let chargesAnterieures = plan?.frais_en_charge ?? 0
  const anneeBascule = regime === 'reel_puis_micro' ? basculeLmnp(d, cfg, options, p) : null

  const travauxDeductiblesS0 =
    cfg.regime === 'foncier' &&
    b.etat === 'ancien' &&
    cfg.jeanbrun === null &&
    !cfg.lli &&
    denormandie === null &&
    b.travaux_deductibles !== false
      ? prix.travaux
      : 0

  let etats = etatsInitiaux(d)
  const imputations: number[] = []
  const exercicesLmnp: ResultatLmnpReel[] = []
  let repriseJeanbrun = 0
  let repriseDenormandie = 0
  const annees: LigneAnnuelle[] = donnees.map((x) => {
    const a = x.cal
    const annee = a.annee
    const venteCetteAnnee = annee === anneeCession
    let resultatFiscal: number
    let amortissementDeduit = 0
    let bic = 0
    let deficitsLmnp = 0
    const autres = autresChargesFoncieres(x, annee === anneeLivraison ? travauxDeductiblesS0 : 0)

    if (lmnp) {
      const chargesAnnee =
        x.interets +
        x.assurance +
        x.frais_emprunt +
        x.tf_deductible +
        x.charges.copropriete +
        x.charges.assurance_pno +
        x.charges.gestion +
        x.charges.assurance_loyers_impayes +
        x.charges.entretien +
        x.charges.comptable_et_cfe
      if (a.rang_location === 0) {
        chargesAnterieures += chargesAnnee
        resultatFiscal = 0
      } else {
        const charges = chargesAnnee + chargesAnterieures
        chargesAnterieures = 0
        const micro = regime === 'micro' || (anneeBascule !== null && annee >= anneeBascule)
        if (micro) {
          bic = microBic(annee, x.loyers, p).benefice_imposable
          resultatFiscal = bic
        } else {
          const dotations = plan === null ? { immeuble: 0, mobilier: 0 } : dotationsLmnp(plan, a.rang_location, moisPremiereActivite)
          const prorata = venteCetteAnnee ? a.mois_detention / MOIS_PAR_AN : 1
          const r = exerciceLmnpReel(
            {
              annee,
              recettes: x.loyers,
              charges,
              dotations: { immeuble: dotations.immeuble * prorata, mobilier: dotations.mobilier * prorata },
            },
            etatLmnp,
            p,
          )
          etatLmnp = r.etat
          exercicesLmnp.push(r)
          bic = r.benefice_imposable
          amortissementDeduit = r.amortissement_deduit
          resultatFiscal = r.resultat_avant_amortissement - r.amortissement_deduit
          deficitsLmnp = r.etat.deficits.reduce((total, m) => total + m.montant, 0)
        }
      }
    } else {
      amortissementDeduit = tableaux.reduce(
        (total, t) => total + (t?.annees.find((l) => l.annee === annee)?.amortissement ?? 0),
        0,
      )
      resultatFiscal = x.loyers - x.interets - x.assurance - x.frais_emprunt - autres - amortissementDeduit
    }

    const revenusOperation: RevenusOperationFoyer[] = foyers.map((foyer, i) => {
      const q = foyer.quote_part
      const rupture = ruptures[i]
      const reductionAnnee = reductions[i]?.annees.find((l) => l.annee === annee)?.reduction ?? 0
      return {
        foncier: lmnp
          ? undefined
          : {
              recettes: x.loyers * q,
              interets: x.interets * q,
              assurance: x.assurance * q,
              frais_emprunt: x.frais_emprunt * q,
              autres_charges: autres * q,
              amortissement: tableaux[i]?.annees.find((l) => l.annee === annee)?.amortissement ?? 0,
              micro: regime === 'micro',
            },
        bic: bic * q,
        reduction: venteCetteAnnee && ruptureDenormandie ? 0 : reductionAnnee,
        reintegration_jeanbrun:
          venteCetteAnnee && rupture !== null && rupture !== undefined && rupture.montant_reintegre > 0
            ? { montant: rupture.montant_reintegre, coefficient: rupture.coefficient_quotient }
            : null,
        reprise_denormandie: venteCetteAnnee && ruptureDenormandie ? (etats[i]?.reductions_obtenues ?? 0) : 0,
      }
    })

    const impots = imposerFoyers(d, annee, revenusOperation, etats, parametresAnnee(annee), p)
    etats = [...impots.etats]
    if (impots.deficit_impute_revenu_global > 0) imputations.push(annee)
    if (venteCetteAnnee) {
      repriseJeanbrun = impots.reprise_jeanbrun
      repriseDenormandie = impots.reprise_denormandie
    }
    const flux =
      x.loyers - x.charges_total - x.interets - x.capital_rembourse - x.assurance + x.creance -
      impots.impot_revenu_differentiel - impots.prelevements_sociaux

    return {
      annee,
      mois_detention: a.mois_detention,
      mois_location: a.mois_location,
      loyer_mensuel_marche: x.loyer_marche,
      loyer_mensuel_retenu: x.loyer_retenu,
      loyers_encaisses: x.loyers,
      decote_loyer: x.decote,
      charges: x.charges,
      charges_total: x.charges_total,
      interets: x.interets,
      assurance_emprunteur: x.assurance,
      capital_rembourse: x.capital_rembourse,
      capital_restant_du: x.capital_restant_du,
      amortissement_deduit: amortissementDeduit,
      resultat_fiscal: resultatFiscal,
      deficit_impute_revenu_global: impots.deficit_impute_revenu_global,
      deficits_reportables: lmnp ? deficitsLmnp : impots.deficits_reportables,
      reduction_impot_imputee: impots.reduction_imputee,
      reduction_impot_perdue: impots.reduction_perdue,
      impot_revenu_differentiel: impots.impot_revenu_differentiel,
      prelevements_sociaux: impots.prelevements_sociaux,
      impot_societes: 0,
      creance_taxe_fonciere: x.creance,
      flux_tresorerie: flux,
      temps_moyen: a.temps_moyen,
    }
  })

  // Revente.
  const capitalRestant = annees.at(-1)?.capital_restant_du ?? f.emprunt
  const v = revente(d, cal, capitalRestant, options, p)
  const rupturesJeanbrun = ruptures.some((r) => r !== null && r.montant_reintegre > 0)
  const amortissementsJeanbrun =
    cfg.jeanbrun !== null && p.jeanbrun.pv_minoration_prix_acquisition.valeur && !rupturesJeanbrun
      ? tableaux.reduce((total, t) => total + (t?.total ?? 0), 0)
      : 0
  const amortissementsLmnp = lmnp && regime !== 'micro' ? amortissementsReintegresLmnp(etatLmnp, cal.date_cession, p) : 0
  const amorti = amortissementsJeanbrun + amortissementsLmnp > 0 || (lmnp && regime !== 'micro')
  const fraisExclus =
    lmnp &&
    regime !== 'micro' &&
    (plan?.frais_en_charge ?? 0) > 0 &&
    p.plus_value_immobiliere.frais_acquisition_deduits_en_charge.valeur === 'exclus'
  const travauxPlusValue = b.etat === 'ancien' && denormandie === null && travauxDeductiblesS0 === 0 ? prix.travaux : 0
  const entreePlusValue = {
    prix_cession: v.prix,
    frais_cession: v.frais,
    prix_acquisition: b.etat === 'ancien' ? b.prix_ht : prix.acquisition,
    frais_acquisition_reels: b.frais_notaire,
    frais_acquisition_exclus: fraisExclus,
    travaux_reels: travauxPlusValue,
    forfait_travaux_autorise: amorti && b.etat !== 'ancien' ? p.plus_value_immobiliere.forfait_travaux_bien_neuf_amorti.valeur : true,
    amortissements_deduits: amortissementsJeanbrun + amortissementsLmnp,
    annees_detention: v.annees_detention,
    cedants: cedants(d, cfg),
  }
  const plusValue = calculerPlusValue(entreePlusValue, p)
  const sansReintegration = calculerPlusValue({ ...entreePlusValue, amortissements_deduits: 0 }, p)
  const complement = complementTva(d, cfg, cal, p)
  const produitNet = v.prix - v.frais - v.capital_restant_du - v.indemnites - plusValue.impot_total - complement

  const sortie: SortieScenario = {
    date_cession: cal.date_cession,
    annees_detention: v.annees_detention,
    prix_revente: v.prix,
    frais_cession: v.frais,
    capital_restant_du: v.capital_restant_du,
    indemnites_remboursement_anticipe: v.indemnites,
    plus_value: plusValue,
    impot_plus_value: plusValue.impot_total,
    impot_plus_value_reintegration: plusValue.impot_total - sansReintegration.impot_total,
    complement_tva: complement,
    reprise_jeanbrun: repriseJeanbrun,
    reprise_denormandie: repriseDenormandie,
    impot_distribution: 0,
    produit_net: produitNet,
  }

  const remises = imputationsRemisesEnCause(imputations, anneeCession, p)
  if (remises.length > 0) {
    alertes.push(
      `Revente avant le 31/12 de la 3e année suivant une imputation de déficit sur le revenu global : imputations de ${remises.join(', ')} remises en cause (non chiffré)`,
    )
  }
  if (lmnp) {
    const recettesMax = Math.max(0, ...annees.map((l) => l.loyers_encaisses))
    const autresRevenus = foyers.reduce((total, foyer) => total + (foyer.revenus_activite ?? foyer.revenu_imposable), 0)
    if (statutLoueurMeuble(recettesMax, autresRevenus, p) === 'professionnel') {
      alertes.push('Location meublée : recettes au-delà des seuils du statut non professionnel (LMP non modélisé)')
    }
  }

  const placement = placementEquivalent(d, prix.apport, annees, p)
  return {
    regime,
    calendrier: cal,
    prix_acquisition: prix.acquisition,
    cout_total: prix.cout_total,
    emprunt: f.emprunt,
    apport: prix.apport,
    annees,
    sortie,
    flux: fluxDates(prix.apport, annees, cal, produitNet),
    placement,
    alertes: [...alertes, ...placement.alertes],
    exercices_lmnp: exercicesLmnp,
  }
}

/** Première année où le micro-BIC deviendrait plus favorable que le réel, sur toute la détention. */
function basculeLmnp(d: Dossier, cfg: Configuration, options: OptionsSimulation, p: ParametresFiscaux): number | null {
  const exercices = simulerImpotRevenu(d, cfg, 'reel', options, p).exercices_lmnp
  const micro: ResultatMicroBic[] = exercices.map((r) => microBic(r.annee, r.recettes, p))
  return anneeBasculeVersMicro(exercices, micro)
}

/** Variante à l'IS (S3 bis) : résultat de la société, impôt sur les sociétés, distribution finale au PFU. */
function simulerSciIs(d: Dossier, cfg: Configuration, options: OptionsSimulation, p: ParametresFiscaux): ResultatSimulation {
  const b = d.bien
  const f = d.financement
  const cal = calendrierOperation(b.date_acquisition, b.date_livraison, b.date_debut_location, options.horizon)
  const prix = prixOperation(d, cfg, p)
  const echeances = tableauAmortissement({
    capital: f.emprunt,
    taux_annuel: f.taux_annuel,
    duree_mois: f.duree_mois,
    taux_assurance_annuel: f.taux_assurance_annuel,
    differe_mois: f.differe_mois ?? 0,
    frais_dossier: f.frais_dossier,
    frais_garantie: f.frais_garantie,
  })
  const donnees = donneesAnnuelles(d, cfg, cal, echeances, p)
  const plan = planAmortissementSciIs(prix.acquisition, b.frais_notaire, p)
  const anneeAcquisition = anneeDuRang(cal.rang_acquisition)
  const anneeCession = cal.annees.at(-1)?.annee ?? anneeAcquisition
  const capitalRestant = donnees.at(-1)?.capital_restant_du ?? f.emprunt
  const v = revente(d, cal, capitalRestant, options, p)
  const complement = complementTva(d, cfg, cal, p)

  let deficits = 0
  let amortissementsCumules = 0
  let resultatsNets = 0
  const annees: LigneAnnuelle[] = donnees.map((x) => {
    const a = x.cal
    const dotation = Math.min(
      (plan.dotation_annuelle * a.mois_location) / MOIS_PAR_AN,
      plan.bati - amortissementsCumules,
    )
    amortissementsCumules += dotation
    const premiere = a.annee === anneeAcquisition
    const charges =
      x.charges_total -
      x.charges.taxe_fonciere +
      x.tf_deductible +
      x.interets +
      x.assurance +
      x.frais_emprunt +
      (premiere ? d.exploitation.sci.constitution + plan.frais_en_charge : 0)
    const plusValue =
      a.annee === anneeCession
        ? plusValueCessionSciIs(v.prix, v.frais, plan.terrain + plan.bati, amortissementsCumules)
        : 0
    const exercice = exerciceSciIs(
      {
        annee: a.annee,
        loyers: x.loyers,
        charges,
        amortissements: dotation,
        plus_value_cession: plusValue,
        deficits_anterieurs: deficits,
      },
      p,
    )
    deficits = exercice.deficits_reportables
    resultatsNets += exercice.resultat_net
    const flux = x.loyers - x.charges_total - x.interets - x.capital_rembourse - x.assurance + x.creance - exercice.impot_societes
    return {
      annee: a.annee,
      mois_detention: a.mois_detention,
      mois_location: a.mois_location,
      loyer_mensuel_marche: x.loyer_marche,
      loyer_mensuel_retenu: x.loyer_retenu,
      loyers_encaisses: x.loyers,
      decote_loyer: x.decote,
      charges: x.charges,
      charges_total: x.charges_total,
      interets: x.interets,
      assurance_emprunteur: x.assurance,
      capital_rembourse: x.capital_rembourse,
      capital_restant_du: x.capital_restant_du,
      amortissement_deduit: dotation,
      resultat_fiscal: exercice.resultat_comptable,
      deficit_impute_revenu_global: 0,
      deficits_reportables: deficits,
      reduction_impot_imputee: 0,
      reduction_impot_perdue: 0,
      impot_revenu_differentiel: 0,
      prelevements_sociaux: 0,
      impot_societes: exercice.impot_societes,
      creance_taxe_fonciere: x.creance,
      flux_tresorerie: flux,
      temps_moyen: a.temps_moyen,
    }
  })

  const distribution = fiscaliteDistribution(Math.max(0, resultatsNets), p)
  const impotDistribution = distribution.impot_revenu + distribution.prelevements_sociaux
  const produitNet = v.prix - v.frais - v.capital_restant_du - v.indemnites - complement - impotDistribution
  const placement = placementEquivalent(d, prix.apport, annees, p)
  return {
    regime: 'is',
    calendrier: cal,
    prix_acquisition: prix.acquisition,
    cout_total: prix.cout_total,
    emprunt: f.emprunt,
    apport: prix.apport,
    annees,
    sortie: {
      date_cession: cal.date_cession,
      annees_detention: v.annees_detention,
      prix_revente: v.prix,
      frais_cession: v.frais,
      capital_restant_du: v.capital_restant_du,
      indemnites_remboursement_anticipe: v.indemnites,
      plus_value: null,
      impot_plus_value: 0,
      impot_plus_value_reintegration: 0,
      complement_tva: complement,
      reprise_jeanbrun: 0,
      reprise_denormandie: 0,
      impot_distribution: impotDistribution,
      produit_net: produitNet,
    },
    flux: fluxDates(prix.apport, annees, cal, produitNet),
    placement,
    alertes: ['SCI à l’IS : variante indicative (plus-value professionnelle simplifiée, distribution au PFU)', ...placement.alertes],
    exercices_lmnp: [],
  }
}

/** Régimes à comparer pour un scénario : le plus favorable est retenu (§8.4). */
function regimesCandidats(d: Dossier, cfg: Configuration, options: OptionsSimulation, p: ParametresFiscaux): RegimeFiscal[] {
  if (cfg.regime === 'lmnp') {
    const candidats: RegimeFiscal[] = ['reel', 'micro']
    if (basculeLmnp(d, cfg, options, p) !== null) candidats.push('reel_puis_micro')
    return candidats
  }
  const sansAvantage = cfg.jeanbrun === null && !cfg.lli && cfg.denormandie === null
  const existantsAuReel = d.foyers.foyers.some((foyer) => foyer.revenus_fonciers_existants?.regime === 'reel')
  return sansAvantage && !existantsAuReel ? ['reel', 'micro'] : ['reel']
}

function regimeAdmissible(simulation: ResultatSimulation, cfg: Configuration, d: Dossier, p: ParametresFiscaux): boolean {
  if (simulation.regime !== 'micro') return true
  return simulation.annees.every((a) => {
    if (cfg.regime === 'lmnp') return microBic(a.annee, a.loyers_encaisses, p).eligible
    // Le seuil du micro-foncier s'apprécie foyer par foyer, sur l'ensemble de ses recettes foncières.
    return d.foyers.foyers.every(
      (foyer) =>
        revenuFoncierMicro(
          a.annee,
          a.loyers_encaisses * foyer.quote_part + (foyer.revenus_fonciers_existants?.recettes ?? 0),
          p,
        ).eligible,
    )
  })
}

/** Simule un scénario pour un horizon ; null pour un scénario inéligible (§7). */
export function simulerScenario(
  d: Dossier,
  id: IdScenario,
  options: OptionsSimulation,
  p: ParametresFiscaux,
): ResultatScenario {
  const cfg = CONFIGURATIONS[id]
  const elig = eligibiliteScenario(d, id, p)
  const commun = { id, libelle: LIBELLES_SCENARIOS[id], eligibilite: elig, parametres_a_confirmer: parametresAConfirmer(d, id, p) }
  if (!elig.eligible) return { ...commun, simulation: null }
  if (cfg.regime === 'is') return { ...commun, simulation: simulerSciIs(d, cfg, options, p) }

  const regimes = options.regime === undefined ? regimesCandidats(d, cfg, options, p) : [options.regime]
  const taux = d.hypotheses.rendement_placement
  const simulations = regimes
    .map((regime) => simulerImpotRevenu(d, cfg, regime, options, p))
    .filter((s) => options.regime !== undefined || regimeAdmissible(s, cfg, d, p))
  const meilleure = simulations.reduce<ResultatSimulation | null>(
    (choix, s) => (choix === null || valeurActuelleNette(s.flux, taux) > valeurActuelleNette(choix.flux, taux) ? s : choix),
    null,
  )
  return { ...commun, simulation: meilleure }
}

/** Tous les scénarios pour un horizon. */
export function simulerTousLesScenarios(d: Dossier, horizon: number, p: ParametresFiscaux): ResultatScenario[] {
  return SCENARIOS.map((id) => simulerScenario(d, id, { horizon }, p))
}
