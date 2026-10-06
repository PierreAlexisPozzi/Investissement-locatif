/**
 * LMNP (meublé non géré) : micro-BIC et régime réel, amortissements par
 * composants limités au résultat et différés, déficits sur 10 ans, statut non
 * professionnel, réintégration des amortissements à la revente (§6.7, §8.4).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Conventions de modélisation (à confirmer avec un expert-comptable) :
 * - un seul composant bâti, amorti sur la durée paramétrée, et le mobilier ;
 * - prorata mensuel la première année, le solde l'année suivant la dernière annuité pleine ;
 * - l'amortissement déductible de l'année se répartit entre composants au prorata
 *   des montants disponibles, ce qui permet de suivre la part réintégrée à la revente ;
 * - les déficits antérieurs s'imputent après l'amortissement de l'année (§8.4).
 *
 * Le choix du meilleur régime, qui dépend de l'impôt du foyer, est fait par
 * l'orchestration des scénarios (étape 4).
 */
import type { ParametresFiscaux } from '../params'
import { MOIS_PAR_AN } from './constantes-numeriques'
import { comparerDates } from './dates'
import { ajouterDeficit, imputerDeficits, type Millesime } from './deficits'
import { formaterEuros } from './format'

export interface ComposantsLmnp {
  /** Prix d'acquisition du logement, TTC, hors frais. */
  readonly prix_acquisition: number
  /** Frais d'acquisition : notaire, droits, commissions. */
  readonly frais_acquisition: number
  readonly mobilier: number
}

export interface PlanAmortissementLmnp {
  /** Terrain, non amortissable (part des frais incorporés comprise). */
  readonly terrain: number
  /** Bâti amortissable (part des frais incorporés comprise). */
  readonly bati: number
  readonly duree_bati_ans: number
  readonly mobilier: number
  readonly duree_mobilier_ans: number
  /** Frais d'acquisition passés en charge la première année (arbitrage du 06/10/2026). */
  readonly frais_en_charge: number
}

export function planAmortissementLmnp(c: ComposantsLmnp, p: ParametresFiscaux): PlanAmortissementLmnp {
  const m = p.lmnp.modelisation.valeur
  const fraisIncorpores = m.frais_acquisition === 'amortis' ? c.frais_acquisition : 0
  const immeuble = c.prix_acquisition + fraisIncorpores
  const terrain = immeuble * m.part_terrain
  return {
    terrain,
    bati: immeuble - terrain,
    duree_bati_ans: m.duree_bati_ans,
    mobilier: c.mobilier,
    duree_mobilier_ans: m.duree_mobilier_ans,
    frais_en_charge: c.frais_acquisition - fraisIncorpores,
  }
}

/**
 * Dotation linéaire de l'année de rang `rang` (1 = première année d'activité) :
 * prorata des mois d'activité la première année, solde l'année suivant la
 * dernière annuité pleine.
 */
export function dotationLineaire(base: number, dureeAns: number, rang: number, moisPremiereAnnee: number): number {
  if (base <= 0 || rang < 1 || rang > dureeAns + 1) return 0
  const annuite = base / dureeAns
  const fractionPremiere = moisPremiereAnnee / MOIS_PAR_AN
  if (rang === 1) return annuite * fractionPremiere
  if (rang <= dureeAns) return annuite
  return annuite * (1 - fractionPremiere)
}

export interface DotationsLmnp {
  readonly immeuble: number
  readonly mobilier: number
}

export function dotationsLmnp(plan: PlanAmortissementLmnp, rang: number, moisPremiereAnnee: number): DotationsLmnp {
  return {
    immeuble: dotationLineaire(plan.bati, plan.duree_bati_ans, rang, moisPremiereAnnee),
    mobilier: dotationLineaire(plan.mobilier, plan.duree_mobilier_ans, rang, moisPremiereAnnee),
  }
}

/** Situation reportée d'une année sur l'autre au régime réel. */
export interface EtatLmnp {
  /** Amortissements écartés par la limite (CGI art. 39 C, II), reportables sans limite de durée. */
  readonly amortissements_differes: DotationsLmnp
  /** Déficits reportables sur les revenus de location meublée non professionnelle (10 ans). */
  readonly deficits: readonly Millesime[]
  /** Amortissements effectivement déduits depuis l'origine. */
  readonly amortissements_deduits: DotationsLmnp
}

export const ETAT_INITIAL_LMNP: EtatLmnp = {
  amortissements_differes: { immeuble: 0, mobilier: 0 },
  deficits: [],
  amortissements_deduits: { immeuble: 0, mobilier: 0 },
}

export interface EntreeLmnpReel {
  readonly annee: number
  readonly recettes: number
  /**
   * Charges de l'année hors amortissements : intérêts, assurance, taxe foncière,
   * copropriété, gestion, comptabilité, CFE, frais d'acquisition passés en charge.
   */
  readonly charges: number
  readonly dotations: DotationsLmnp
}

export interface ResultatLmnpReel {
  readonly annee: number
  readonly recettes: number
  readonly charges: number
  readonly resultat_avant_amortissement: number
  /** Dotations de l'année et amortissements différés des années précédentes. */
  readonly amortissement_disponible: number
  readonly amortissement_deduit: number
  readonly amortissement_differe: number
  readonly deficit_ne: number
  readonly deficits_anterieurs_imputes: number
  readonly deficits_perimes: number
  /** Bénéfice imposable au barème et aux prélèvements sociaux. */
  readonly benefice_imposable: number
  readonly etat: EtatLmnp
}

/**
 * Exercice au régime réel (§8.4) : amortissement déductible =
 * min(dotations + amortissements différés ; résultat avant amortissement s'il
 * est positif, sinon 0). Un amortissement ne crée ni n'augmente de déficit.
 */
export function exerciceLmnpReel(e: EntreeLmnpReel, etat: EtatLmnp, p: ParametresFiscaux): ResultatLmnpReel {
  const resultatAvant = e.recettes - e.charges
  const disponibleImmeuble = e.dotations.immeuble + etat.amortissements_differes.immeuble
  const disponibleMobilier = e.dotations.mobilier + etat.amortissements_differes.mobilier
  const disponible = disponibleImmeuble + disponibleMobilier
  const limite = p.lmnp.amortissement_limite_au_resultat.valeur ? Math.max(0, resultatAvant) : disponible
  const deduit = Math.min(disponible, limite)
  const deduitImmeuble = disponible > 0 ? (deduit * disponibleImmeuble) / disponible : 0
  const deduitMobilier = deduit - deduitImmeuble

  const resultat = resultatAvant - deduit
  const deficitNe = Math.max(0, -resultat)
  const imputation = imputerDeficits(etat.deficits, Math.max(0, resultat), e.annee, p.lmnp.deficit_report_ans.valeur)
  const etatSuivant: EtatLmnp = {
    amortissements_differes: {
      immeuble: disponibleImmeuble - deduitImmeuble,
      mobilier: disponibleMobilier - deduitMobilier,
    },
    deficits: ajouterDeficit(imputation.stock, e.annee, deficitNe),
    amortissements_deduits: {
      immeuble: etat.amortissements_deduits.immeuble + deduitImmeuble,
      mobilier: etat.amortissements_deduits.mobilier + deduitMobilier,
    },
  }
  return {
    annee: e.annee,
    recettes: e.recettes,
    charges: e.charges,
    resultat_avant_amortissement: resultatAvant,
    amortissement_disponible: disponible,
    amortissement_deduit: deduit,
    amortissement_differe: disponible - deduit,
    deficit_ne: deficitNe,
    deficits_anterieurs_imputes: imputation.impute,
    deficits_perimes: imputation.perime,
    benefice_imposable: Math.max(0, resultat) - imputation.impute,
    etat: etatSuivant,
  }
}

/** Enchaîne les exercices au réel en reportant amortissements différés et déficits. */
export function simulerLmnpReel(
  exercices: readonly EntreeLmnpReel[],
  p: ParametresFiscaux,
  etatInitial: EtatLmnp = ETAT_INITIAL_LMNP,
): ResultatLmnpReel[] {
  const resultats: ResultatLmnpReel[] = []
  let etat = etatInitial
  for (const exercice of exercices) {
    const r = exerciceLmnpReel(exercice, etat, p)
    resultats.push(r)
    etat = r.etat
  }
  return resultats
}

export interface ResultatMicroBic {
  readonly annee: number
  readonly eligible: boolean
  readonly motifs_ineligibilite: readonly string[]
  readonly recettes: number
  readonly abattement: number
  readonly benefice_imposable: number
}

/** Seuil de recettes du micro-BIC : celui des revenus 2025 jusqu'à l'année de revenus des paramètres, puis celui de 2026. */
export function seuilMicroBic(annee: number, p: ParametresFiscaux): number {
  const m = p.lmnp.micro_bic.valeur
  return annee <= p.meta.annee_revenus ? m.seuil_recettes_revenus_2025 : m.seuil_recettes_revenus_2026
}

/** Micro-BIC : abattement forfaitaire, avec un minimum, sur les recettes. Calculé même hors des conditions, avec les motifs. */
export function microBic(annee: number, recettes: number, p: ParametresFiscaux): ResultatMicroBic {
  const m = p.lmnp.micro_bic.valeur
  const seuil = seuilMicroBic(annee, p)
  const motifs = recettes > seuil ? [`Recettes supérieures au seuil du micro-BIC (${formaterEuros(seuil)})`] : []
  const abattement = Math.min(recettes, Math.max(recettes * m.abattement, m.abattement_minimum))
  return {
    annee,
    eligible: motifs.length === 0,
    motifs_ineligibilite: motifs,
    recettes,
    abattement,
    benefice_imposable: Math.max(0, recettes - abattement),
  }
}

/** Loueur en meublé professionnel si les recettes dépassent le seuil et les autres revenus d'activité du foyer. */
export function statutLoueurMeuble(
  recettes: number,
  autresRevenusActivite: number,
  p: ParametresFiscaux,
): 'non_professionnel' | 'professionnel' {
  const professionnel = recettes > p.lmnp.seuil_non_professionnel_recettes.valeur && recettes > autresRevenusActivite
  return professionnel ? 'professionnel' : 'non_professionnel'
}

/** Prélèvements sociaux sur le bénéfice de location meublée non professionnelle. */
export function prelevementsSociauxLmnp(benefice: number, p: ParametresFiscaux): number {
  return Math.max(0, benefice) * p.prelevements_sociaux.location_meublee_non_professionnelle.valeur.total
}

/**
 * Amortissements réintégrés dans la plus-value (CGI art. 150 VB) : ceux
 * effectivement déduits, pour une cession à compter de la date d'entrée en
 * vigueur. Par arbitrage du 06/10/2026, ceux du mobilier, bien meuble hors du
 * champ de la plus-value immobilière, ne le sont pas ; les amortissements
 * différés, jamais déduits, ne le sont jamais.
 */
export function amortissementsReintegresLmnp(etat: EtatLmnp, dateCession: string, p: ParametresFiscaux): number {
  const debut = p.lmnp.reintegration_amortissements_pv.valeur.cessions_a_compter_du
  if (comparerDates(dateCession, debut) < 0) return 0
  const { immeuble, mobilier } = etat.amortissements_deduits
  return p.lmnp.perimetre_reintegration_pv.valeur === 'immeuble_et_mobilier' ? immeuble + mobilier : immeuble
}

/**
 * Première année où le bénéfice imposable au micro-BIC serait inférieur à celui
 * du réel : repère de bascule pour l'orchestration (§8.4) ; null si le réel
 * reste au moins aussi favorable sur toute la période.
 */
export function anneeBasculeVersMicro(
  reel: readonly ResultatLmnpReel[],
  micro: readonly ResultatMicroBic[],
): number | null {
  const bascule = reel.find((r) => {
    const m = micro.find((x) => x.annee === r.annee)
    return m !== undefined && m.eligible && m.benefice_imposable < r.benefice_imposable
  })
  return bascule?.annee ?? null
}
