/**
 * Moteur de recommandation (§10) : filtre d'éligibilité, filtre de faisabilité,
 * score pondéré par les objectifs du foyer (§5.6), classement, texte généré par
 * règles, seuils de bascule et alertes (§10.5). Aucun modèle de langage : chaque
 * phrase vient d'une règle et chaque chiffre du calcul.
 *
 * Fonctions pures ; les paramètres fiscaux sont reçus en argument, les barèmes
 * qualitatifs et les pondérations par défaut viennent des hypothèses par défaut.
 */
import type { ParametresFiscaux, PonderationsObjectifs } from '../params'
import { hypothesesDefaut } from '../params'
import { calendrierOperation } from './calendrier'
import {
  ARRONDI_SEUIL_REVENUS,
  FACTEUR_REVENUS_EXTREME,
  ITERATIONS_RECHERCHE,
  MOIS_PAR_AN,
  NOMBRE_RAISONS,
  PAS_BALAYAGE_REVENUS,
  PRECISION_SEUIL_REVENUS,
  TOLERANCE_COMPARAISON,
  TRI_MINIMUM,
} from './constantes-numeriques'
import { lireDate } from './dates'
import { objectifsParDefaut, type BaremesQualitatifs, type Dossier, type Objectifs } from './dossier'
import { formaterDate, formaterEuros, formaterTaux } from './format'
import { calculerImpot } from './impot-revenu'
import {
  avecRevenus,
  comparerScenarios,
  penaliteSortieAnticipee,
  prixReventeEquilibre,
  type Indicateurs,
  type PrixEquilibre,
} from './indicateurs'
import { plafondAnnuelJeanbrun, seuilPlafonnementJeanbrun } from './jeanbrun'
import { prixTtc } from './lli'
import { plafondLoyerIntermediaire } from './loyer-plafond'
import {
  ALERTE_JEANBRUN_PLAFONNE,
  caracteristiquesScenario,
  engagementsScenario,
  LIBELLES_SCENARIOS,
  SCENARIOS,
  type IdScenario,
  type ResultatSimulation,
} from './scenario'

export const CRITERES = ['economie_impot', 'effort_epargne', 'tri', 'souplesse', 'simplicite', 'transmission'] as const
export type Critere = (typeof CRITERES)[number]

export const LIBELLES_CRITERES: Readonly<Record<Critere, string>> = {
  economie_impot: 'Économie d’impôt',
  effort_epargne: 'Effort d’épargne',
  tri: 'TRI après impôt',
  souplesse: 'Souplesse',
  simplicite: 'Simplicité de gestion',
  transmission: 'Transmission',
}

/** Sens de chaque critère : une valeur plus élevée est-elle meilleure ? */
const PLUS_ELEVE_MEILLEUR: Readonly<Record<Critere, boolean>> = {
  economie_impot: true,
  effort_epargne: false,
  tri: true,
  souplesse: true,
  simplicite: true,
  transmission: true,
}

const NOTE_MAXIMALE = 100

/** Clé du barème de simplicité pour le LMNP au micro-BIC (le réel garde la note de S4). */
const CLE_LMNP_MICRO = 'S4_micro'

/** Placement de référence (S6), retenu quand aucun scénario immobilier tenable ne le bat. */
export type Choix = IdScenario | 'placement'

export interface NoteCritere {
  readonly critere: Critere
  /** Valeur brute : euros, taux, ou note du barème qualitatif. */
  readonly valeur: number
  /** Note de 0 à 100 sur l'ensemble des scénarios classés. */
  readonly note: number
  readonly poids: number
  /** Points apportés au score : poids × note / somme des poids. */
  readonly points: number
}

export interface EvaluationScenario {
  readonly id: IdScenario
  readonly libelle: string
  readonly eligible: boolean
  readonly motifs_ineligibilite: readonly string[]
  readonly tenable: boolean
  /** Raisons pour lesquelles un scénario éligible est « non tenable » (§10.2). */
  readonly motifs_non_tenable: readonly string[]
  readonly simulation: ResultatSimulation | null
  readonly indicateurs: Indicateurs | null
  readonly parametres_a_confirmer: readonly string[]
  /** Notes des critères, pour les seuls scénarios classés. */
  readonly notes: readonly NoteCritere[]
  readonly score: number | null
  readonly rang: number | null
  /** TRI après impôt supérieur à celui du placement de référence équivalent. */
  readonly bat_le_placement: boolean
}

export interface Classement {
  readonly horizon: number
  readonly ponderations: PonderationsObjectifs
  /** Scénarios classés par score, puis non tenables, puis inéligibles. */
  readonly evaluations: readonly EvaluationScenario[]
  /** Scénario classé premier ; null si aucun scénario n'est éligible et tenable. */
  readonly meilleur_immobilier: IdScenario | null
  /** Aucun scénario classé ne bat le placement de référence (§3, principe 6). */
  readonly placement_domine: boolean
  readonly choix: Choix
}

function verifierPonderations(ponderations: PonderationsObjectifs): void {
  const valeurs = CRITERES.map((c) => ponderations[c])
  if (valeurs.some((v) => !(v >= 0)) || !(valeurs.reduce((total, v) => total + v, 0) > 0)) {
    throw new RangeError('Les pondérations des objectifs doivent être positives ou nulles, de somme strictement positive')
  }
}

function baremesRetenus(o: Objectifs): BaremesQualitatifs {
  const r = hypothesesDefaut.recommandation
  return {
    souplesse: { ...r.souplesse.valeur, ...o.baremes?.souplesse },
    simplicite: { ...r.simplicite.valeur, ...o.baremes?.simplicite },
    transmission: { ...r.transmission.valeur, ...o.baremes?.transmission },
  }
}

function noteBareme(bareme: Readonly<Record<string, number>>, cle: string, critere: Critere): number {
  const note = bareme[cle]
  if (note === undefined) throw new Error(`Barème « ${LIBELLES_CRITERES[critere]} » : aucune note pour ${cle}`)
  return note
}

function valeurBrute(critere: Critere, i: Indicateurs, s: ResultatSimulation, b: BaremesQualitatifs): number {
  switch (critere) {
    case 'economie_impot':
      return i.economie_impot_cumulee
    case 'effort_epargne':
      return i.effort_mensuel_moyen
    case 'tri':
      return i.tri ?? TRI_MINIMUM
    case 'souplesse':
      return noteBareme(b.souplesse, i.id, critere)
    case 'simplicite':
      return noteBareme(b.simplicite, i.id === 'S4' && s.regime === 'micro' ? CLE_LMNP_MICRO : i.id, critere)
    case 'transmission':
      return noteBareme(b.transmission, i.id, critere)
  }
}

/** Filtre de faisabilité (§10.2) : effort, endettement, horizon plus court que les engagements. */
function motifsNonTenable(d: Dossier, i: Indicateurs, horizon: number, p: ParametresFiscaux): string[] {
  const motifs: string[] = []
  const capacite = d.foyers.capacite_epargne_mensuelle
  const effort = Math.max(i.effort_mensuel_premieres_annees, i.effort_mensuel_moyen)
  if (effort > capacite) {
    motifs.push(
      `Effort d’épargne de ${formaterEuros(effort)} par mois, au-delà de la capacité déclarée (${formaterEuros(capacite)} par mois)`,
    )
  }
  const endettementMax = p.financement.taux_endettement_max.valeur
  if (i.taux_endettement_apres > endettementMax) {
    motifs.push(
      `Taux d’endettement de ${formaterTaux(i.taux_endettement_apres)} après l’opération, au-delà de ${formaterTaux(endettementMax)}`,
    )
  }
  if (i.date_sortie_sans_penalite !== null && horizon < i.duree_blocage_ans) {
    motifs.push(
      `Revente après ${horizon} ans de location, avant la fin des engagements (${formaterDate(i.date_sortie_sans_penalite)}) : sortie anticipée pénalisée`,
    )
  }
  return motifs
}

/** Classement des scénarios pour un horizon et des objectifs (§10, points 1 à 3). */
export function classer(d: Dossier, objectifs: Objectifs, p: ParametresFiscaux): Classement {
  verifierPonderations(objectifs.ponderations)
  const horizon = objectifs.horizon
  const baremes = baremesRetenus(objectifs)
  const comparaison = comparerScenarios(d, horizon, p)

  const bruts = comparaison.scenarios.map((r) => {
    const indicateurs = comparaison.indicateurs.find((i) => i.id === r.id) ?? null
    const motifs = indicateurs === null ? [] : motifsNonTenable(d, indicateurs, horizon, p)
    return { r, indicateurs, motifs }
  })
  const classables = bruts.flatMap(({ r, indicateurs, motifs }) =>
    r.simulation !== null && indicateurs !== null && motifs.length === 0
      ? [{ id: r.id, simulation: r.simulation, indicateurs }]
      : [],
  )

  // Normalisation de chaque critère entre 0 et 100 sur les scénarios classés (§10.3).
  const valeurs = new Map(classables.map((c) => [c.id, CRITERES.map((k) => valeurBrute(k, c.indicateurs, c.simulation, baremes))]))
  const bornes = CRITERES.map((_, k) => {
    const v = classables.map((c) => valeurs.get(c.id)?.[k] ?? 0)
    return { min: Math.min(...v), max: Math.max(...v) }
  })
  const poidsTotal = CRITERES.reduce((total, c) => total + objectifs.ponderations[c], 0)
  const notesDe = (id: IdScenario): NoteCritere[] =>
    CRITERES.map((critere, k) => {
      const valeur = valeurs.get(id)?.[k] ?? 0
      const { min = 0, max = 0 } = bornes[k] ?? {}
      const ecart = max - min
      // Critère identique pour tous les scénarios classés : il ne départage pas, chacun reçoit la note maximale.
      const departage = ecart > TOLERANCE_COMPARAISON * Math.max(1, Math.abs(max))
      const part = departage ? (valeur - min) / ecart : 1
      const note = NOTE_MAXIMALE * (!departage || PLUS_ELEVE_MEILLEUR[critere] ? part : 1 - part)
      const poids = objectifs.ponderations[critere]
      return { critere, valeur, note, poids, points: (poids * note) / poidsTotal }
    })

  const scores = classables.map((c) => {
    const notes = notesDe(c.id)
    return { ...c, notes, score: notes.reduce((total, n) => total + n.points, 0) }
  })
  const ordre = (id: IdScenario): number => SCENARIOS.indexOf(id)
  scores.sort(
    (a, b) =>
      b.score - a.score || (b.indicateurs.tri ?? TRI_MINIMUM) - (a.indicateurs.tri ?? TRI_MINIMUM) || ordre(a.id) - ordre(b.id),
  )
  const rangs = new Map(scores.map((s, k) => [s.id, k + 1]))
  const batLePlacement = (i: Indicateurs | null): boolean => {
    const ecart = i?.ecart_tri_placement ?? null
    return ecart !== null && ecart > 0
  }

  const evaluation = ({ r, indicateurs, motifs }: (typeof bruts)[number]): EvaluationScenario => {
    const classe = scores.find((s) => s.id === r.id)
    return {
      id: r.id,
      libelle: r.libelle,
      eligible: r.eligibilite.eligible,
      motifs_ineligibilite: r.eligibilite.motifs,
      tenable: r.eligibilite.eligible && motifs.length === 0,
      motifs_non_tenable: motifs,
      simulation: r.simulation,
      indicateurs,
      parametres_a_confirmer: r.parametres_a_confirmer,
      notes: classe?.notes ?? [],
      score: classe?.score ?? null,
      rang: rangs.get(r.id) ?? null,
      bat_le_placement: batLePlacement(indicateurs),
    }
  }
  const groupe = (e: EvaluationScenario): number => (e.rang !== null ? 0 : e.eligible ? 1 : 2)
  const evaluations = bruts
    .map(evaluation)
    .sort((a, b) => groupe(a) - groupe(b) || (a.rang ?? 0) - (b.rang ?? 0) || ordre(a.id) - ordre(b.id))

  const meilleur = scores[0]?.id ?? null
  const placementDomine = !scores.some((s) => batLePlacement(s.indicateurs))
  return {
    horizon,
    ponderations: objectifs.ponderations,
    evaluations,
    meilleur_immobilier: meilleur,
    placement_domine: placementDomine,
    choix: placementDomine || meilleur === null ? 'placement' : meilleur,
  }
}

// ---------------------------------------------------------------------------
// Alertes toujours évaluées (§10.5)
// ---------------------------------------------------------------------------

export const CODES_ALERTE = [
  'plafond_superieur_marche',
  'prix_neuf_eleve',
  'tmi_faible',
  'tmi_en_baisse',
  'reduction_perdue',
  'jeanbrun_plafonne',
  'valeurs_a_confirmer',
  'apport_insuffisant',
  'effort_pire_annee',
  'endettement_actuel',
] as const
export type CodeAlerte = (typeof CODES_ALERTE)[number]

export interface Alerte {
  readonly code: CodeAlerte
  readonly message: string
  /** Scénarios concernés ; vide pour une alerte qui vaut pour tous. */
  readonly scenarios: readonly IdScenario[]
}

/** Taux marginal de chaque foyer sans l'opération, à un revenu donné. */
function tmiDesFoyers(d: Dossier, revenus: readonly number[], p: ParametresFiscaux): number[] {
  const communes = d.foyers.situation === 'marie_pacse'
  return d.foyers.foyers.map((f, k) => calculerImpot(revenus[k] ?? f.revenu_imposable, { parts: f.parts, imposition_commune: communes }, p).tmi)
}

function evaluerAlertes(d: Dossier, c: Classement, p: ParametresFiscaux): Alerte[] {
  const alertes: Alerte[] = []
  const b = d.bien
  const eligibles = c.evaluations.filter((e) => e.eligible && e.simulation !== null)
  const ids = (filtre: (e: EvaluationScenario) => boolean): IdScenario[] => eligibles.filter(filtre).map((e) => e.id)

  // Loyer plafond au-dessus du marché : le plafond ne contraint pas, un loyer annoncé au plafond serait surévalué.
  const intermediaires = ids((e) => caracteristiquesScenario(e.id).niveau_loyer === 'intermediaire')
  if (intermediaires.length > 0) {
    const plafond = plafondLoyerIntermediaire(b.zone, b.surface, p).loyer_plafond_mensuel
    if (plafond > b.loyer_marche_nu) {
      alertes.push({
        code: 'plafond_superieur_marche',
        message: `Loyer plafond de ${formaterEuros(plafond)} par mois supérieur au loyer de marché (${formaterEuros(b.loyer_marche_nu)}) : le plafond ne contraint pas, mais un loyer annoncé au plafond serait surévalué`,
        scenarios: intermediaires,
      })
    }
  }

  // Prix du neuf nettement au-dessus de l'ancien récent du quartier.
  if (b.etat !== 'ancien' && b.prix_m2_ancien_recent !== undefined && b.surface.habitable > 0) {
    const prixM2Neuf = prixTtc(b.prix_ht, p.lli.tva_taux_normal.valeur) / b.surface.habitable
    const ecart = prixM2Neuf / b.prix_m2_ancien_recent - 1
    if (ecart > hypothesesDefaut.recommandation.alertes.valeur.ecart_prix_neuf_ancien) {
      alertes.push({
        code: 'prix_neuf_eleve',
        message: `Prix du neuf de ${formaterEuros(prixM2Neuf)} par m², supérieur de ${formaterTaux(ecart)} à l’ancien récent du quartier (${formaterEuros(b.prix_m2_ancien_recent)} par m²) : décote probable à la revente`,
        scenarios: [],
      })
    }
  }

  // Tranche marginale faible : l'avantage Jeanbrun est faible.
  const tmis = tmiDesFoyers(d, d.foyers.foyers.map((f) => f.revenu_imposable), p)
  const premiereTrancheImposee = p.impot_revenu.bareme.valeur.find((t) => t.taux > 0)?.taux ?? 0
  const jeanbrun = ids((e) => engagementsScenario(e.id).jeanbrun !== null)
  if (jeanbrun.length > 0 && tmis.some((t) => t <= premiereTrancheImposee)) {
    alertes.push({
      code: 'tmi_faible',
      message: `Tranche marginale de ${tmis.map(formaterTaux).join(' et ')} : l’avantage fiscal du Jeanbrun est faible`,
      scenarios: jeanbrun,
    })
  }

  // Baisse de revenus prévue pendant l'engagement.
  d.foyers.foyers.forEach((f, k) => {
    const changement = f.changement_revenu
    if (changement === undefined) return
    const avant = tmis[k] ?? 0
    const apres = tmiDesFoyers(d, d.foyers.foyers.map((x, j) => (j === k ? changement.revenu_imposable : x.revenu_imposable)), p)[k] ?? 0
    if (!(apres < avant)) return
    const engages = ids((e) => {
      const fin = e.indicateurs?.date_sortie_sans_penalite ?? null
      return fin !== null && changement.annee < lireDate(fin).annee
    })
    if (engages.length > 0) {
      alertes.push({
        code: 'tmi_en_baisse',
        message: `${f.libelle} : baisse de revenus prévue en ${changement.annee}, la tranche marginale passerait de ${formaterTaux(avant)} à ${formaterTaux(apres)} pendant l’engagement`,
        scenarios: engages,
      })
    }
  })

  // Denormandie : réduction perdue faute d'impôt ou au-delà du plafond des niches.
  for (const e of eligibles) {
    const perdue = e.simulation?.annees.reduce((total, a) => total + a.reduction_impot_perdue, 0) ?? 0
    if (engagementsScenario(e.id).denormandie !== null && perdue > 0) {
      alertes.push({
        code: 'reduction_perdue',
        message: `${e.id} : ${formaterEuros(perdue)} de réduction Denormandie perdus (impôt insuffisant ou plafond des niches atteint)`,
        scenarios: [e.id],
      })
    }
  }

  // Jeanbrun : amortissement plafonné au-delà du seuil de prix.
  for (const e of eligibles) {
    const niveau = engagementsScenario(e.id).jeanbrun
    if (niveau === null || e.simulation === null) continue
    const seuil = seuilPlafonnementJeanbrun(niveau, p)
    if (e.simulation.prix_acquisition > seuil) {
      alertes.push({
        code: 'jeanbrun_plafonne',
        message: `${e.id} : prix de ${formaterEuros(e.simulation.prix_acquisition)} au-delà de ${formaterEuros(seuil)}, amortissement Jeanbrun plafonné à ${formaterEuros(plafondAnnuelJeanbrun(niveau, p))} par an`,
        scenarios: [e.id],
      })
    }
  }

  // Valeurs à confirmer utilisées par le scénario retenu.
  const retenu = c.evaluations.find((e) => e.id === (c.choix === 'placement' ? c.meilleur_immobilier : c.choix))
  if (retenu !== undefined && retenu.parametres_a_confirmer.length > 0) {
    alertes.push({
      code: 'valeurs_a_confirmer',
      message: `${retenu.id} utilise des valeurs à confirmer : ${retenu.parametres_a_confirmer.join(', ')}`,
      scenarios: [retenu.id],
    })
  }

  // Apport nécessaire au-delà de l'apport disponible.
  const apport = d.foyers.apport_disponible
  const manque = ids((e) => (e.simulation?.apport ?? 0) > apport)
  if (manque.length > 0) {
    alertes.push({
      code: 'apport_insuffisant',
      message: `Fonds propres nécessaires supérieurs à l’apport disponible (${formaterEuros(apport)}) : ${manque.map((id) => `${id} ${formaterEuros(eligibles.find((e) => e.id === id)?.simulation?.apport ?? 0)}`).join(', ')}`,
      scenarios: manque,
    })
  }

  // Pire année d'effort au-delà de la capacité déclarée.
  for (const e of c.evaluations.filter((x) => x.tenable)) {
    const i = e.indicateurs
    if (i !== null && i.effort_mensuel_pire > d.foyers.capacite_epargne_mensuelle) {
      alertes.push({
        code: 'effort_pire_annee',
        message: `${e.id} : effort de ${formaterEuros(i.effort_mensuel_pire)} par mois en ${i.pire_annee}, au-delà de la capacité déclarée`,
        scenarios: [e.id],
      })
    }
  }

  // Endettement actuel au-delà du seuil, avant toute opération.
  const revenusMensuels = d.foyers.foyers.reduce((total, f) => total + f.revenu_imposable, 0) / MOIS_PAR_AN
  const credits = d.foyers.foyers.reduce((total, f) => total + (f.mensualites_credits_en_cours ?? 0), 0)
  const endettementMax = p.financement.taux_endettement_max.valeur
  if (revenusMensuels > 0 && credits / revenusMensuels > endettementMax) {
    alertes.push({
      code: 'endettement_actuel',
      message: `Taux d’endettement actuel de ${formaterTaux(credits / revenusMensuels)}, déjà au-delà de ${formaterTaux(endettementMax)}`,
      scenarios: [],
    })
  }
  return alertes
}

// ---------------------------------------------------------------------------
// Seuils de bascule (§10.4) : ce qui ferait changer la recommandation
// ---------------------------------------------------------------------------

export interface BasculeRevenus {
  /** Facteur appliqué aux revenus imposables de chaque foyer. */
  readonly facteur: number
  readonly revenus: readonly number[]
  readonly tmi: readonly number[]
  readonly choix: Choix
  /** Pourquoi le choix initial cède sa place, s'il cesse d'être éligible ou tenable. */
  readonly motif: string | null
}

export interface BasculeHorizon {
  readonly horizon: number
  readonly annee_cession: number
  readonly choix: Choix
  readonly motif: string | null
}

export interface SeuilsDeBascule {
  /** Scénario des seuils de prix : le choix, ou le mieux classé si le placement l'emporte. */
  readonly scenario: IdScenario | null
  readonly prix_revente: PrixEquilibre | null
  readonly revenus_hausse: BasculeRevenus | null
  readonly revenus_baisse: BasculeRevenus | null
  readonly horizon_plus_court: BasculeHorizon | null
  readonly horizon_plus_long: BasculeHorizon | null
}

/** Premier motif pour lequel le choix initial n'est plus éligible ou tenable dans un autre classement. */
function motifDeBascule(c: Classement, initial: Choix): string | null {
  if (initial === 'placement') return null
  const e = c.evaluations.find((x) => x.id === initial)
  if (e === undefined || e.rang !== null) return null
  const motif = e.eligible ? e.motifs_non_tenable[0] : e.motifs_ineligibilite[0]
  return motif === undefined ? null : `${initial} ne serait plus ${e.eligible ? 'tenable' : 'éligible'} (${motif})`
}

/** Points de balayage des revenus, du plus proche au plus éloigné du revenu actuel. */
function pointsDeBalayage(sens: 'hausse' | 'baisse'): number[] {
  const pas = sens === 'hausse' ? PAS_BALAYAGE_REVENUS : 1 / PAS_BALAYAGE_REVENUS
  const extreme = sens === 'hausse' ? FACTEUR_REVENUS_EXTREME : 1 / FACTEUR_REVENUS_EXTREME
  const points: number[] = []
  for (let f = pas; sens === 'hausse' ? f < extreme : f > extreme; f *= pas) points.push(f)
  points.push(extreme)
  return points
}

/** Revenu le plus proche de l'actuel où le choix change : balayage, puis dichotomie dans le premier intervalle. */
function basculeRevenus(
  d: Dossier,
  objectifs: Objectifs,
  initial: Choix,
  sens: 'hausse' | 'baisse',
  p: ParametresFiscaux,
): BasculeRevenus | null {
  const classementA = (facteur: number): Classement => classer(avecRevenus(d, facteur), objectifs, p)
  let avant = 1
  for (const point of pointsDeBalayage(sens)) {
    const premier = classementA(point)
    if (premier.choix === initial) {
      avant = point
      continue
    }
    let apres = point
    let classementApres = premier
    for (let k = 0; k < ITERATIONS_RECHERCHE && Math.abs(apres - avant) > PRECISION_SEUIL_REVENUS * Math.min(avant, apres); k++) {
      const milieu = (avant + apres) / 2
      const c = classementA(milieu)
      if (c.choix === initial) avant = milieu
      else {
        apres = milieu
        classementApres = c
      }
    }
    const revenus = d.foyers.foyers.map((f) => f.revenu_imposable * apres)
    return {
      facteur: apres,
      revenus,
      tmi: tmiDesFoyers(d, revenus, p),
      choix: classementApres.choix,
      motif: motifDeBascule(classementApres, initial),
    }
  }
  return null
}

/** Horizon le plus proche de l'horizon envisagé où le choix change, dans la plage des horizons de calcul. */
function basculeHorizon(d: Dossier, objectifs: Objectifs, initial: Choix, pas: 1 | -1, p: ParametresFiscaux): BasculeHorizon | null {
  const maximum = Math.max(...hypothesesDefaut.horizons_ans.valeur)
  const b = d.bien
  for (let h = objectifs.horizon + pas; h >= 1 && h <= maximum; h += pas) {
    const c = classer(d, { ...objectifs, horizon: h }, p)
    if (c.choix !== initial) {
      const cal = calendrierOperation(b.date_acquisition, b.date_livraison, b.date_debut_location, h)
      return { horizon: h, annee_cession: lireDate(cal.date_cession).annee, choix: c.choix, motif: motifDeBascule(c, initial) }
    }
  }
  return null
}

function seuilsDeBascule(d: Dossier, objectifs: Objectifs, c: Classement, p: ParametresFiscaux): SeuilsDeBascule {
  const scenario = c.choix === 'placement' ? c.meilleur_immobilier : c.choix
  return {
    scenario,
    prix_revente: scenario === null ? null : prixReventeEquilibre(d, scenario, c.horizon, p),
    revenus_hausse: basculeRevenus(d, objectifs, c.choix, 'hausse', p),
    revenus_baisse: basculeRevenus(d, objectifs, c.choix, 'baisse', p),
    horizon_plus_court: basculeHorizon(d, objectifs, c.choix, -1, p),
    horizon_plus_long: basculeHorizon(d, objectifs, c.choix, 1, p),
  }
}

// ---------------------------------------------------------------------------
// Texte généré par règles (§10.4)
// ---------------------------------------------------------------------------

export interface TexteRecommandation {
  /** Recommandation en une phrase. */
  readonly phrase: string
  /** Trois raisons chiffrées. */
  readonly raisons: readonly string[]
  /** Points bloquants ou risques majeurs. */
  readonly risques: readonly string[]
  /** Ce qui ferait changer la recommandation. */
  readonly bascules: readonly string[]
}


function nomChoix(choix: Choix): string {
  return choix === 'placement' ? 'le placement de référence' : `${choix} (${LIBELLES_SCENARIOS[choix]})`
}

const devant = (choix: Choix): string => (choix === 'placement' ? 'le placement de référence' : choix)
const pourquoi = (motif: string | null): string => (motif === null ? '' : ` : ${motif}`)

/** Effet de l'opération sur l'impôt pendant la détention : économie, ou surcroît si négatif. */
function effetImpot(montant: number): string {
  if (Math.round(montant) === 0) return 'un impôt inchangé'
  return montant > 0 ? `une économie d’impôt de ${formaterEuros(montant)}` : `un surcroît d’impôt de ${formaterEuros(-montant)}`
}

function formaterTri(t: number | null | undefined): string {
  return t === null || t === undefined ? 'non calculable' : formaterTaux(t)
}

const tri = (i: Indicateurs | null): string => formaterTri(i?.tri)
const triPlacement = (i: Indicateurs | null): string => formaterTri(i?.tri_placement)

function rendreCritere(n: NoteCritere, second: EvaluationScenario | undefined): string {
  const autre = second?.notes.find((x) => x.critere === n.critere)?.valeur
  const contre = (texte: string): string => (second === undefined || autre === undefined ? '' : `, contre ${texte} pour ${second.id}`)
  switch (n.critere) {
    case 'tri':
      return `TRI après impôt de ${formaterTaux(n.valeur)}${contre(formaterTaux(autre ?? 0))}`
    case 'effort_epargne':
      return `Effort d’épargne moyen de ${formaterEuros(n.valeur)} par mois${contre(formaterEuros(autre ?? 0))}`
    case 'economie_impot':
      return `Pendant la détention, ${effetImpot(n.valeur)}${contre(effetImpot(autre ?? 0))}`
    case 'souplesse':
    case 'simplicite':
    case 'transmission':
      return `${LIBELLES_CRITERES[n.critere]} : ${String(n.valeur)}/${String(NOTE_MAXIMALE)}${contre(`${String(autre ?? 0)}/${String(NOTE_MAXIMALE)}`)}`
  }
}

function raisonsScenario(e: EvaluationScenario, second: EvaluationScenario | undefined, d: Dossier): string[] {
  const avantages = e.notes
    .map((n) => ({ n, ecart: n.points - (second?.notes.find((x) => x.critere === n.critere)?.points ?? 0) }))
    .filter((a) => a.n.poids > 0 && a.ecart > TOLERANCE_COMPARAISON)
    .sort((a, b) => b.ecart - a.ecart)
  const raisons = avantages.slice(0, NOMBRE_RAISONS).map((a) => rendreCritere(a.n, second))
  const i = e.indicateurs
  const complements = [
    `TRI après impôt de ${tri(i)}, contre ${triPlacement(i)} pour le placement de référence`,
    `Effort d’épargne de ${formaterEuros(i?.effort_mensuel_premieres_annees ?? 0)} par mois les premières années, pour une capacité déclarée de ${formaterEuros(d.foyers.capacite_epargne_mensuelle)}`,
    `Capital net de ${formaterEuros(i?.capital_net_sortie ?? 0)} à la revente, après remboursement du prêt et impôts`,
  ]
  for (const texte of complements) if (raisons.length < NOMBRE_RAISONS) raisons.push(texte)
  return raisons
}

function rediger(d: Dossier, c: Classement, seuils: SeuilsDeBascule, alertes: readonly Alerte[], p: ParametresFiscaux): TexteRecommandation {
  const classes = c.evaluations.filter((e) => e.rang !== null)
  const premier = classes[0]
  const h = d.hypotheses

  // Phrase et raisons.
  let phrase: string
  let raisons: string[]
  if (premier === undefined) {
    phrase = 'Ne pas investir dans ces conditions : aucun scénario n’est à la fois éligible et tenable.'
    const motifs = [...new Set(c.evaluations.flatMap((e) => (e.eligible ? e.motifs_non_tenable : [])))]
    const ineligibles = c.evaluations.filter((e) => !e.eligible).length
    raisons = [...motifs.slice(0, NOMBRE_RAISONS - 1), `${ineligibles} scénarios sur ${c.evaluations.length} inéligibles pour ce bien`]
  } else if (c.choix === 'placement') {
    const i = premier.indicateurs
    phrase = `Ne pas investir : aucun scénario immobilier ne bat le placement de référence. Le mieux classé, ${nomChoix(premier.id)}, rapporte ${tri(i)} par an après impôt, contre ${triPlacement(i)} pour le même effort placé.`
    const prix = seuils.prix_revente
    raisons = [
      `TRI après impôt de ${premier.id} : ${tri(i)}, contre ${triPlacement(i)} pour le placement de référence`,
      `Capital net après ${c.horizon} ans : ${formaterEuros(i?.capital_net_sortie ?? 0)} pour ${premier.id}, ${formaterEuros(i?.capital_net_placement ?? 0)} pour le placement`,
      prix?.prix === null || prix === null
        ? `Aucun prix de revente plausible ne permet à ${premier.id} d’égaler le placement`
        : `Il faudrait revendre au moins ${formaterEuros(prix.prix)}, contre ${formaterEuros(prix.prix_central)} attendus, pour égaler le placement`,
    ]
  } else {
    const i = premier.indicateurs
    const score = `score de ${String(Math.round(premier.score ?? 0))}/${String(NOTE_MAXIMALE)}`
    phrase = premier.bat_le_placement
      ? `Recommandation : ${nomChoix(premier.id)}, ${score}, TRI après impôt de ${tri(i)} contre ${triPlacement(i)} pour le placement de référence.`
      : `Recommandation : ${nomChoix(premier.id)}, ${score}, mais son TRI après impôt (${tri(i)}) reste inférieur à celui du placement de référence (${triPlacement(i)}).`
    raisons = raisonsScenario(premier, classes[1], d)
  }

  // Points bloquants et risques.
  const risques: string[] = []
  const retenu = premier?.id
  if (retenu !== undefined && premier !== undefined) {
    const penalite = penaliteSortieAnticipee(d, retenu, p)
    const fin = premier.indicateurs?.date_sortie_sans_penalite ?? null
    if (fin !== null) {
      risques.push(
        penalite === null
          ? `Engagement jusqu’au ${formaterDate(fin)}`
          : `Engagement jusqu’au ${formaterDate(fin)} : une revente après ${penalite.horizon} ans de location coûterait ${formaterEuros(penalite.montant)}`,
      )
    }
    if (c.choix !== 'placement' && !premier.bat_le_placement) {
      risques.push(`${retenu} ne bat pas le placement de référence : ${tri(premier.indicateurs)} contre ${triPlacement(premier.indicateurs)}`)
    }
  }
  for (const a of alertes) {
    if (a.scenarios.length === 0 || (retenu !== undefined && a.scenarios.includes(retenu))) risques.push(a.message)
  }
  // Alertes de la simulation, sauf celle que l'alerte chiffrée du plafonnement Jeanbrun remplace.
  const chiffrees = new Set(alertes.map((a) => a.code))
  for (const texte of premier?.simulation?.alertes ?? []) {
    if (!(texte === ALERTE_JEANBRUN_PLAFONNE && chiffrees.has('jeanbrun_plafonne'))) risques.push(texte)
  }
  if (c.choix === 'placement') {
    risques.push(
      `Le placement de référence suppose ${formaterTaux(h.rendement_placement)} par an net de frais, avant impôt : rendement non garanti`,
    )
  }

  // Ce qui ferait changer la recommandation.
  const bascules: string[] = []
  const prix = seuils.prix_revente
  if (seuils.scenario !== null && prix !== null && prix.prix !== null) {
    bascules.push(
      prix.prix < prix.prix_central
        ? `En dessous de ${formaterEuros(prix.prix)} de prix de revente (${formaterEuros(prix.prix_central)} attendus), le placement de référence fait mieux que ${seuils.scenario}.`
        : `À partir de ${formaterEuros(prix.prix)} de prix de revente (${formaterEuros(prix.prix_central)} attendus), ${seuils.scenario} égalerait le placement de référence.`,
    )
  }
  for (const bascule of [seuils.revenus_hausse, seuils.revenus_baisse]) {
    if (bascule === null) continue
    const total = bascule.revenus.reduce((s, r) => s + r, 0)
    const environ = Math.round(total / ARRONDI_SEUIL_REVENUS) * ARRONDI_SEUIL_REVENUS
    const variation = Math.round((bascule.facteur - 1) * NOTE_MAXIMALE) / NOTE_MAXIMALE
    bascules.push(
      `Avec environ ${formaterEuros(environ)} de revenu imposable (${variation > 0 ? '+' : ''}${formaterTaux(variation)}), soit une tranche marginale de ${bascule.tmi.map(formaterTaux).join(' et ')}, ${nomChoix(bascule.choix)} passerait devant ${devant(c.choix)}${pourquoi(bascule.motif)}.`,
    )
  }
  for (const bascule of [seuils.horizon_plus_court, seuils.horizon_plus_long]) {
    if (bascule === null) continue
    bascules.push(
      `En revendant après ${bascule.horizon} ans de location (en ${bascule.annee_cession}) plutôt qu’après ${c.horizon} ans, ${nomChoix(bascule.choix)} passerait devant ${devant(c.choix)}${pourquoi(bascule.motif)}.`,
    )
  }
  if (bascules.length === 0) {
    bascules.push('Aucune bascule dans les plages étudiées (revenus divisés ou multipliés par quatre, horizons des calculs).')
  }
  return { phrase, raisons, risques, bascules }
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export interface Recommandation extends Classement {
  readonly alertes: readonly Alerte[]
  readonly seuils: SeuilsDeBascule
  readonly texte: TexteRecommandation
}

/** Recommandation complète (§10) pour les objectifs du dossier, ou ceux fournis. */
export function recommander(d: Dossier, p: ParametresFiscaux, objectifs: Objectifs = d.objectifs ?? objectifsParDefaut()): Recommandation {
  const c = classer(d, objectifs, p)
  const alertes = evaluerAlertes(d, c, p)
  const seuils = seuilsDeBascule(d, objectifs, c, p)
  return { ...c, alertes, seuils, texte: rediger(d, c, seuils, alertes, p) }
}
