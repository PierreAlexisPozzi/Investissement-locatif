/**
 * Logement locatif intermédiaire : éligibilité, TVA à taux réduit, complément
 * de TVA selon l'année de sortie, créance de taxe foncière, cumul avec le
 * Jeanbrun (§6.5, §6.6, §8.3).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Les délais courent depuis la livraison (l'achèvement en VEFA),
 * pas depuis la signature (BOI-TVA-IMM-30, §220).
 */
import type { PERIMETRES_ASSIMILES_LLI, ParametresFiscaux, Zone } from '../params'
import {
  cumulerEligibilites,
  eligibilite,
  type Eligibilite,
  type EtatBien,
  type ModeDetention,
} from './commun'
import { comparerDates, rangAnnee } from './dates'
import { formaterDate, formaterTaux, libelleZone } from './format'

export type PerimetreAssimileLli = (typeof PERIMETRES_ASSIMILES_LLI)[number]

export interface EntreeEligibiliteLli {
  readonly etat: EtatBien
  readonly detention: ModeDetention
  /** Zone appréciée à la date de la demande de permis de construire. */
  readonly zone: Zone
  /** Périmètre assimilé déclaré par l'utilisateur hors zones tendues (arbitrage du 06/10/2026). */
  readonly perimetre_assimile?: PerimetreAssimileLli
  /** Mixité sociale de la commune, du quartier ou de l'ensemble immobilier, déclarée par l'utilisateur. */
  readonly mixite_sociale: boolean
}

export function eligibiliteLli(e: EntreeEligibiliteLli, p: ParametresFiscaux): Eligibilite {
  const lli = p.lli
  const motifs: string[] = []
  if (e.etat === 'ancien') motifs.push('LLI : logement neuf uniquement')
  if (lli.acquereur_personne_morale.valeur && e.detention === 'nom_propre') {
    motifs.push('LLI : acquisition réservée aux personnes morales, SCI comprise ; pas d’achat en nom propre')
  }
  const zoneTendue = lli.zones_eligibles.valeur.includes(e.zone)
  const perimetre = e.perimetre_assimile !== undefined && lli.perimetres_assimiles.valeur.includes(e.perimetre_assimile)
  if (!zoneTendue && !perimetre) {
    motifs.push(`LLI : zone ${libelleZone(e.zone)} non éligible hors périmètre assimilé (convention ORT, contrat de PPA…)`)
  }
  if (!e.mixite_sociale) {
    motifs.push(
      `LLI : mixité sociale non remplie (plus de ${formaterTaux(lli.mixite_sociale_seuil.valeur)} de logements sociaux dans la commune, le quartier ou l’ensemble immobilier)`,
    )
  }
  const avertissements = [
    `LLI : loyers et ressources intermédiaires à respecter pendant ${lli.duree_conditions_ans.valeur} ans après la livraison, sous peine de complément de TVA`,
  ]
  return eligibilite(motifs, avertissements)
}

export function prixTtc(prixHt: number, tauxTva: number): number {
  return prixHt * (1 + tauxTva)
}

export interface EconomieTvaLli {
  readonly prix_ht: number
  readonly prix_ttc_taux_normal: number
  readonly prix_ttc_taux_reduit: number
  /** TVA économisée grâce au taux réduit. */
  readonly economie: number
}

export function economieTvaLli(prixHt: number, p: ParametresFiscaux): EconomieTvaLli {
  const normal = prixTtc(prixHt, p.lli.tva_taux_normal.valeur)
  const reduit = prixTtc(prixHt, p.lli.tva_taux_reduit.valeur)
  return { prix_ht: prixHt, prix_ttc_taux_normal: normal, prix_ttc_taux_reduit: reduit, economie: normal - reduit }
}

/** Rang de l'année de sortie, compté depuis la livraison : 1 pendant la première année. */
export function rangAnneeDepuisLivraison(dateLivraison: string, dateSortie: string): number {
  if (comparerDates(dateSortie, dateLivraison) < 0) {
    throw new RangeError(`Sortie le ${formaterDate(dateSortie)}, avant la livraison du ${formaterDate(dateLivraison)}`)
  }
  return rangAnnee(dateLivraison, dateSortie)
}

/** Cession du logement, ou fin du respect des conditions de location sans cession. */
export type MotifSortieLli = 'cession' | 'fin_des_conditions'

export interface EntreeComplementTva {
  readonly prix_ht: number
  /** Rang de l'année de sortie depuis la livraison (voir `rangAnneeDepuisLivraison`). */
  readonly rang_annee_sortie: number
  readonly motif: MotifSortieLli
  /** Logements LLI détenus par la société et logements cédés lors de la sortie : 1 et 1 pour un logement unique. */
  readonly logements_detenus?: number
  readonly logements_cedes?: number
}

export interface ComplementTva {
  readonly du: boolean
  readonly montant: number
  readonly explication: string
}

/**
 * Complément de TVA (CGI art. 284, II bis) : écart entre le taux normal et le
 * taux réduit, appliqué au prix hors taxes, sans dégressivité.
 */
export function complementTvaLli(e: EntreeComplementTva, p: ParametresFiscaux): ComplementTva {
  const c = p.lli.complement_tva.valeur
  const montant = e.prix_ht * (p.lli.tva_taux_normal.valeur - p.lli.tva_taux_reduit.valeur)
  const detenus = e.logements_detenus ?? 1
  const cedes = e.logements_cedes ?? detenus
  if (!(detenus >= 1 && cedes >= 1 && cedes <= detenus)) {
    throw new RangeError(`Logements cédés (${cedes}) et détenus (${detenus}) incohérents`)
  }
  const rang = e.rang_annee_sortie
  const du = (explication: string): ComplementTva => ({ du: true, montant, explication })
  const libre = (explication: string): ComplementTva => ({ du: false, montant: 0, explication })

  if (rang <= c.fin_periode_toujours_du) {
    return du(`Sortie pendant les ${c.fin_periode_toujours_du} premières années : complément dû, cession comprise`)
  }
  if (rang <= c.fin_periode_cession_partielle) {
    const partCedee = cedes / detenus
    if (e.motif === 'cession' && partCedee <= c.part_max_logements_cedes) {
      return libre(`Cession de ${formaterTaux(partCedee)} des logements, au plus ${formaterTaux(c.part_max_logements_cedes)} : pas de complément`)
    }
    return du(
      `Sortie avant la ${c.fin_periode_cession_partielle + 1}e année : complément dû, sauf cession de ${formaterTaux(c.part_max_logements_cedes)} des logements au plus (impossible avec un logement unique)`,
    )
  }
  if (rang <= c.fin_periode_cession_libre) {
    return e.motif === 'cession'
      ? libre(`Cession à partir de la ${c.fin_periode_cession_partielle + 1}e année : pas de complément`)
      : du(`Fin des conditions de location avant la ${c.fin_periode_cession_libre + 1}e année sans cession : complément dû`)
  }
  return libre(`Au-delà de ${c.fin_periode_cession_libre} ans : plus aucune condition`)
}

/** Premières années de sortie sans complément : cession de tous les logements, cession partielle (plusieurs logements). */
export function premieresAnneesSortieSansComplement(
  logementsDetenus: number,
  p: ParametresFiscaux,
): { readonly cession_totale: number; readonly cession_partielle: number | null } {
  const c = p.lli.complement_tva.valeur
  const partielle = Math.floor(logementsDetenus * c.part_max_logements_cedes) >= 1
  return {
    cession_totale: c.fin_periode_cession_partielle + 1,
    cession_partielle: partielle ? c.fin_periode_toujours_du + 1 : null,
  }
}

export interface EntreeCreanceTaxeFonciere {
  readonly detention: ModeDetention
  readonly date_achevement: string
  /** Taxe foncière mise en recouvrement, taxes additionnelles et frais de gestion compris. */
  readonly taxe_fonciere: number
  /** Taxe d'enlèvement des ordures ménagères figurant sur le même avis, exclue de la créance. */
  readonly teom: number
  /** Rang de l'année d'imposition : 1 pour la première année où la taxe serait due sans exonération. */
  readonly rang_annee: number
  /** Années d'exonération totale de taxe foncière des constructions neuves (délibération de la commune). */
  readonly annees_exoneration_totale: number
}

export interface CreanceTaxeFonciere {
  readonly eligible: boolean
  readonly motifs: readonly string[]
  /** Durée de la créance après déduction des années d'exonération. */
  readonly duree_ans: number
  /** Créance de l'année, encaissée par la société. */
  readonly montant: number
}

/** Créance de taxe foncière (CGI art. 220 Z septies), acquise à la société et non aux associés. */
export function creanceTaxeFonciere(e: EntreeCreanceTaxeFonciere, p: ParametresFiscaux): CreanceTaxeFonciere {
  const c = p.lli.creance_taxe_fonciere.valeur
  const motifs: string[] = []
  if (e.detention === 'nom_propre') motifs.push('Créance de taxe foncière réservée aux personnes morales')
  if (comparerDates(e.date_achevement, c.achevement_a_compter_du) < 0) {
    motifs.push(`Créance de taxe foncière : logement achevé avant le ${formaterDate(c.achevement_a_compter_du)}`)
  }
  const exoneration = Math.max(0, e.annees_exoneration_totale)
  const duree = Math.max(0, c.duree_ans - (c.reduite_des_annees_exoneration_totale ? exoneration : 0))
  const dansLaPeriode = e.rang_annee > exoneration && e.rang_annee <= exoneration + duree
  const assiette = Math.max(0, e.taxe_fonciere - (c.teom_exclue ? e.teom : 0))
  const eligible = motifs.length === 0
  return { eligible, motifs, duree_ans: duree, montant: eligible && dansLaPeriode ? assiette : 0 }
}

/** Taxe foncière déductible des revenus fonciers : nulle si elle ouvre droit à la créance et que le paramètre l'exclut (défaut prudent). */
export function taxeFonciereDeductibleLli(taxeFonciere: number, creanceDue: boolean, p: ParametresFiscaux): number {
  return creanceDue && !p.lli.tf_deductible_si_creance.valeur ? 0 : taxeFonciere
}

/**
 * Cumul Jeanbrun + LLI (S2) : chaque régime est vérifié séparément, puis le
 * statut du cumul lui-même, qu'aucune source officielle lue ne tranche.
 */
export function eligibiliteCumulJeanbrunLli(
  jeanbrun: Eligibilite,
  lli: Eligibilite,
  p: ParametresFiscaux,
): Eligibilite {
  const reunies = cumulerEligibilites(jeanbrun, lli)
  switch (p.cumul_jeanbrun_lli.statut_cumul.valeur) {
    case 'exclu':
      return eligibilite([...reunies.motifs, 'Cumul Jeanbrun + LLI exclu par les textes'], reunies.avertissements)
    case 'non_exclu_par_les_textes_lus':
      return eligibilite(reunies.motifs, [
        ...reunies.avertissements,
        'Cumul Jeanbrun + LLI : aucune source officielle lue ne l’autorise ni ne l’interdit ; demander une confirmation écrite (notaire ou rescrit)',
      ])
    case 'autorise':
      return reunies
  }
}
