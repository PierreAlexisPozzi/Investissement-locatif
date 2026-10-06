/**
 * Plus-value immobilière des particuliers : prix d'acquisition corrigé
 * (forfaits, amortissements réintégrés), abattements pour durée de détention,
 * impôt sur le revenu, prélèvements sociaux et surtaxe sur les plus-values
 * élevées, appréciée par cédant (§6.9, §8.6).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument.
 */
import type { ModeAppreciationSurtaxe, ParametresFiscaux, TrancheAbattement } from '../params'
import { TOLERANCE_COMPARAISON } from './constantes-numeriques'

/** Qui cède : la nature des cédants commande l'appréciation du seuil de la surtaxe. */
export type NatureCedants = 'personne_seule' | 'epoux' | 'partenaires_pacs' | 'concubins' | 'sci_ir'

export interface Cedants {
  readonly nature: NatureCedants
  /** Quote-part de chaque cédant ou associé ; leur somme vaut 1. */
  readonly quotes_parts: readonly number[]
}

export interface EntreePlusValue {
  readonly prix_cession: number
  /** Frais de cession justifiés, à la charge du vendeur (diagnostics, mainlevée, agence…). */
  readonly frais_cession: number
  /** Prix stipulé dans l'acte d'acquisition (TTC pour un logement neuf). */
  readonly prix_acquisition: number
  /** Frais d'acquisition réels ; le forfait est retenu s'il est plus favorable. */
  readonly frais_acquisition_reels?: number
  /** Travaux réels non déduits par ailleurs ; le forfait est retenu s'il est autorisé et plus favorable. */
  readonly travaux_reels?: number
  /** Forfait travaux admis : désactivé par défaut pour un bien neuf amorti (paramètre à confirmer). */
  readonly forfait_travaux_autorise: boolean
  /** Amortissements déduits (Jeanbrun, LMNP), qui minorent le prix d'acquisition. */
  readonly amortissements_deduits: number
  /** Années de détention révolues. */
  readonly annees_detention: number
  readonly cedants: Cedants
}

export interface DetailPlusValue {
  readonly prix_cession_net: number
  readonly frais_acquisition_retenus: number
  readonly frais_acquisition_forfaitaires: boolean
  readonly travaux_retenus: number
  readonly travaux_forfaitaires: boolean
  readonly amortissements_reintegres: number
  readonly prix_acquisition_corrige: number
  /** Négative en cas de moins-value, qui n'est pas imputable. */
  readonly plus_value_brute: number
  readonly taux_abattement_ir: number
  readonly taux_abattement_ps: number
  readonly plus_value_imposable_ir: number
  readonly plus_value_imposable_ps: number
  readonly impot_revenu: number
  readonly prelevements_sociaux: number
  /** Assiettes sur lesquelles le seuil de la surtaxe est apprécié. */
  readonly assiettes_surtaxe: readonly number[]
  readonly surtaxe: number
  readonly impot_total: number
}

/** Somme des taux des années de détention révolues couvertes par les tranches, plafonnée à 100 %. */
export function tauxAbattement(anneesDetention: number, tranches: readonly TrancheAbattement[]): number {
  const annees = Math.floor(anneesDetention)
  const total = tranches.reduce(
    (somme, t) => somme + Math.max(0, Math.min(annees, t.a) - t.de + 1) * t.taux_annuel,
    0,
  )
  return Math.min(1, total)
}

/** Surtaxe sur une assiette, avec le lissage des tranches basses (CGI art. 1609 nonies G). */
export function surtaxePlusValueElevee(plusValueImposable: number, p: ParametresFiscaux): number {
  const { seuil, tranches } = p.plus_value_immobiliere.surtaxe_plus_values_elevees.valeur
  if (plusValueImposable <= seuil) return 0
  const tranche = tranches.find((t) => plusValueImposable > t.de && (t.a === null || plusValueImposable <= t.a))
  if (tranche === undefined) return 0
  const lissage =
    tranche.lissage_borne === null ? 0 : (tranche.lissage_borne - plusValueImposable) * tranche.lissage_coefficient
  return tranche.taux * plusValueImposable - lissage
}

function modeAppreciation(nature: NatureCedants, p: ParametresFiscaux): ModeAppreciationSurtaxe {
  if (nature === 'personne_seule') return 'quote_part'
  return p.plus_value_immobiliere.surtaxe_appreciation_seuil.valeur[nature]
}

/**
 * Assiettes de la surtaxe : une par cédant lorsque le seuil s'apprécie par
 * quote-part, une seule pour la société (SCI à l'IR, arbitrage du 06/10/2026).
 */
export function assiettesSurtaxe(plusValueImposable: number, cedants: Cedants, p: ParametresFiscaux): number[] {
  const somme = cedants.quotes_parts.reduce((total, q) => total + q, 0)
  if (cedants.quotes_parts.some((q) => !(q > 0)) || Math.abs(somme - 1) > TOLERANCE_COMPARAISON) {
    throw new RangeError('Les quotes-parts des cédants doivent être positives et de somme égale à 1')
  }
  return modeAppreciation(cedants.nature, p) === 'societe'
    ? [plusValueImposable]
    : cedants.quotes_parts.map((q) => plusValueImposable * q)
}

export function calculerPlusValue(e: EntreePlusValue, p: ParametresFiscaux): DetailPlusValue {
  const pvi = p.plus_value_immobiliere
  const fraisForfait = e.prix_acquisition * pvi.forfait_frais_acquisition.valeur
  const fraisReels = e.frais_acquisition_reels ?? 0
  const fraisForfaitaires = fraisForfait >= fraisReels
  const forfaitTravaux = pvi.forfait_travaux.valeur
  const travauxForfait =
    e.forfait_travaux_autorise && e.annees_detention > forfaitTravaux.detention_superieure_a_ans
      ? e.prix_acquisition * forfaitTravaux.taux
      : 0
  const travauxReels = e.travaux_reels ?? 0
  const travauxForfaitaires = travauxForfait > travauxReels
  const fraisRetenus = Math.max(fraisForfait, fraisReels)
  const travauxRetenus = Math.max(travauxForfait, travauxReels)

  const prixCessionNet = e.prix_cession - e.frais_cession
  const prixAcquisitionCorrige = e.prix_acquisition + fraisRetenus + travauxRetenus - e.amortissements_deduits
  const plusValueBrute = prixCessionNet - prixAcquisitionCorrige
  const assiette = Math.max(0, plusValueBrute)

  const tauxIr = tauxAbattement(e.annees_detention, pvi.abattement_ir.valeur.tranches)
  const tauxPs = tauxAbattement(e.annees_detention, pvi.abattement_ps.valeur.tranches)
  const imposableIr = assiette * (1 - tauxIr)
  const imposablePs = assiette * (1 - tauxPs)
  const impotRevenu = imposableIr * pvi.taux_ir.valeur
  const prelevements = imposablePs * p.prelevements_sociaux.plus_values_immobilieres.valeur.total
  const assiettes = assiettesSurtaxe(imposableIr, e.cedants, p)
  const surtaxe = assiettes.reduce((total, a) => total + surtaxePlusValueElevee(a, p), 0)

  return {
    prix_cession_net: prixCessionNet,
    frais_acquisition_retenus: fraisRetenus,
    frais_acquisition_forfaitaires: fraisForfaitaires,
    travaux_retenus: travauxRetenus,
    travaux_forfaitaires: travauxForfaitaires,
    amortissements_reintegres: e.amortissements_deduits,
    prix_acquisition_corrige: prixAcquisitionCorrige,
    plus_value_brute: plusValueBrute,
    taux_abattement_ir: tauxIr,
    taux_abattement_ps: tauxPs,
    plus_value_imposable_ir: imposableIr,
    plus_value_imposable_ps: imposablePs,
    impot_revenu: impotRevenu,
    prelevements_sociaux: prelevements,
    assiettes_surtaxe: assiettes,
    surtaxe,
    impot_total: impotRevenu + prelevements + surtaxe,
  }
}

/**
 * Impôt de plus-value dû à la seule réintégration des amortissements : la
 * « reprise » à la revente de l'avantage fiscal obtenu pendant la détention (§9).
 */
export function surcoutReintegration(e: EntreePlusValue, p: ParametresFiscaux): number {
  return calculerPlusValue(e, p).impot_total - calculerPlusValue({ ...e, amortissements_deduits: 0 }, p).impot_total
}
