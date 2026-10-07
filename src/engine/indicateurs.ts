/**
 * Indicateurs de sortie par scénario et par horizon (§9) : effort d'épargne,
 * économie d'impôt et reprise à la revente, rendements, TRI, VAN, capital net,
 * écarts au S0 et au placement de référence, blocage et pénalité de sortie
 * anticipée, endettement ; prix de revente d'équilibre (§8.6) ; sensibilités
 * (tornado et tableau croisé).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Les amplitudes des sensibilités viennent des hypothèses par défaut.
 */
import type { ParametresFiscaux } from '../params'
import { hypothesesDefaut } from '../params'
import { rechercheDichotomique, tauxRendementInterne, valeurActuelleNette, type FluxDate } from './actualisation'
import { calendrierOperation, rangMois, type Calendrier } from './calendrier'
import {
  ANNEES_EFFORT_INITIAL,
  FACTEUR_PRIX_REVENTE_MAXIMUM,
  MOIS_PAR_AN,
  TRI_MAXIMUM,
  TRI_MINIMUM,
} from './constantes-numeriques'
import { ajouterAnnees, comparerDates } from './dates'
import { dureeEngagementDenormandie } from './denormandie'
import type { Dossier } from './dossier'
import { tableauAmortissement, tauxEndettement } from './emprunt'
import { calculerImpot } from './impot-revenu'
import { finEngagementJeanbrun } from './jeanbrun'
import { prixTtc } from './lli'
import {
  engagementsScenario,
  simulerScenario,
  SCENARIOS,
  type IdScenario,
  type LigneAnnuelle,
  type OptionsSimulation,
  type ResultatScenario,
  type ResultatSimulation,
} from './scenario'

const MOIS_PREMIERES_ANNEES = ANNEES_EFFORT_INITIAL * MOIS_PAR_AN

export interface Indicateurs {
  readonly id: IdScenario
  readonly horizon: number
  /** Effort d'épargne mensuel moyen après impôt sur les 36 premiers mois de détention. */
  readonly effort_mensuel_premieres_annees: number
  readonly effort_mensuel_moyen: number
  readonly effort_mensuel_pire: number
  readonly pire_annee: number
  /** Impôt sur le revenu et prélèvements sociaux évités pendant la détention, hors reprises à la revente. */
  readonly economie_impot_cumulee: number
  /** Impôt de plus-value dû aux amortissements réintégrés et reprises Jeanbrun ou Denormandie. */
  readonly reprise_a_la_revente: number
  readonly economie_impot_nette: number
  readonly tva_economisee: number
  readonly creance_taxe_fonciere_cumulee: number
  /** Manque à gagner du plafonnement du loyer sur la détention. */
  readonly decote_loyer_cumulee: number
  readonly rendement_brut: number
  readonly rendement_net_de_charges: number
  readonly rendement_net_net: number
  readonly tri: number | null
  readonly van: number
  readonly capital_net_sortie: number
  /** Somme des flux non actualisés : apport, flux annuels et produit net de la revente. */
  readonly enrichissement_net: number
  readonly tri_placement: number | null
  readonly capital_net_placement: number
  readonly ecart_tri_placement: number | null
  /** Capital net de la revente moins capital net du placement équivalent. */
  readonly ecart_capital_placement: number
  /** Date à partir de laquelle la revente n'entraîne plus de reprise ni de complément ; null sans engagement. */
  readonly date_sortie_sans_penalite: string | null
  /** Durée minimale de blocage depuis le début de la location, en années. */
  readonly duree_blocage_ans: number
  readonly taux_endettement_apres: number
}

function moisDeDetention(s: ResultatSimulation): number {
  return s.annees.reduce((total, a) => total + a.mois_detention, 0)
}

/** Effort mensuel moyen sur les premiers mois de détention, chaque flux annuel étant réparti sur ses mois. */
function effortPremiersMois(s: ResultatSimulation, mois: number): number {
  let restant = mois
  let effort = 0
  for (const a of s.annees) {
    if (restant <= 0 || a.mois_detention === 0) continue
    const retenus = Math.min(restant, a.mois_detention)
    effort += (-a.flux_tresorerie * retenus) / a.mois_detention
    restant -= retenus
  }
  const comptes = mois - Math.max(0, restant)
  return comptes > 0 ? effort / comptes : 0
}

/** Première année de location complète (rendements) ; à défaut, l'année la plus louée. */
function anneeDeReference(s: ResultatSimulation) {
  const complete = s.annees.find((a) => a.mois_location === MOIS_PAR_AN)
  if (complete !== undefined) return complete
  return s.annees.reduce((meilleure, a) => (a.mois_location > meilleure.mois_location ? a : meilleure))
}

/** Date de fin des engagements du scénario : Jeanbrun, LLI ou Denormandie. */
export function dateSortieSansPenalite(id: IdScenario, cal: Calendrier, p: ParametresFiscaux): string | null {
  const engagements = engagementsScenario(id)
  const dates: string[] = []
  if (engagements.jeanbrun !== null) dates.push(finEngagementJeanbrun(cal.date_debut_location, p))
  if (engagements.lli) {
    // Sortie libre à partir de la 16e année suivant la livraison (logement unique).
    dates.push(ajouterAnnees(cal.date_livraison, p.lli.complement_tva.valeur.fin_periode_cession_partielle))
  }
  const denormandie = engagements.denormandie
  if (denormandie !== null) {
    dates.push(
      ajouterAnnees(
        cal.date_debut_location,
        dureeEngagementDenormandie(denormandie.engagement_initial, denormandie.prorogations, p),
      ),
    )
  }
  return dates.reduce<string | null>((plusTardive, date) => (plusTardive === null || comparerDates(date, plusTardive) > 0 ? date : plusTardive), null)
}

function tauxEndettementApres(d: Dossier): number {
  const f = d.financement
  const premiere = tableauAmortissement({
    capital: f.emprunt,
    taux_annuel: f.taux_annuel,
    duree_mois: f.duree_mois,
    taux_assurance_annuel: f.taux_assurance_annuel,
  })[0]
  const mensualite = premiere === undefined ? 0 : premiere.mensualite + premiere.assurance
  const existants = d.foyers.foyers.reduce((total, foyer) => total + (foyer.mensualites_credits_en_cours ?? 0), 0)
  const revenusMensuels = d.foyers.foyers.reduce((total, foyer) => total + foyer.revenu_imposable, 0) / MOIS_PAR_AN
  return revenusMensuels > 0 ? tauxEndettement(existants + mensualite, revenusMensuels) : Number.POSITIVE_INFINITY
}

/** Taux d'endettement actuel, avant l'opération (§5.1) ; null sans revenus. */
export function tauxEndettementActuel(d: Dossier): number | null {
  const credits = d.foyers.foyers.reduce((total, foyer) => total + (foyer.mensualites_credits_en_cours ?? 0), 0)
  const revenusMensuels = d.foyers.foyers.reduce((total, foyer) => total + foyer.revenu_imposable, 0) / MOIS_PAR_AN
  return revenusMensuels > 0 ? tauxEndettement(credits, revenusMensuels) : null
}

/** Taux marginal de chaque foyer sans l'opération, à ses revenus actuels ou aux revenus fournis. */
export function tmiDesFoyers(d: Dossier, p: ParametresFiscaux, revenus?: readonly number[]): number[] {
  const communes = d.foyers.situation === 'marie_pacse'
  return d.foyers.foyers.map(
    (f, k) => calculerImpot(revenus?.[k] ?? f.revenu_imposable, { parts: f.parts, imposition_commune: communes }, p).tmi,
  )
}

/** TRI retenu pour comparer et classer : borné quand il n'existe pas (flux tous positifs ou tous négatifs). */
export function triComparable(s: ResultatSimulation): number {
  const tri = tauxRendementInterne(s.flux)
  if (tri !== null) return tri
  return s.flux.every((f) => f.montant >= 0) ? TRI_MAXIMUM : TRI_MINIMUM
}

function fluxPlacement(s: ResultatSimulation): FluxDate[] {
  return [...s.flux.slice(0, -1), { temps: s.calendrier.duree_detention_ans, montant: s.placement.capital_net }]
}

/** Indicateurs d'un scénario simulé ; null pour un scénario inéligible. */
export function indicateursScenario(d: Dossier, r: ResultatScenario, horizon: number, p: ParametresFiscaux): Indicateurs | null {
  const s = r.simulation
  if (s === null) return null
  const somme = (valeur: (a: LigneAnnuelle) => number): number =>
    s.annees.reduce((total, a) => total + valeur(a), 0)
  const efforts = s.annees.filter((a) => a.mois_detention > 0).map((a) => ({ annee: a.annee, mensuel: -a.flux_tresorerie / a.mois_detention }))
  const pire = efforts.reduce((max, e) => (e.mensuel > max.mensuel ? e : max), { annee: 0, mensuel: Number.NEGATIVE_INFINITY })
  const o = s.sortie
  const reprises = o.reprise_jeanbrun + o.reprise_denormandie
  const economie = -somme((a) => a.impot_revenu_differentiel + a.prelevements_sociaux) + reprises
  const repriseRevente = o.impot_plus_value_reintegration + reprises
  const reference = anneeDeReference(s)
  const annualisation = reference.mois_location > 0 ? MOIS_PAR_AN / reference.mois_location : 0
  const netDeCharges = (reference.loyers_encaisses - reference.charges_total) * annualisation
  const impotsReference =
    reference.impot_revenu_differentiel + reference.prelevements_sociaux + reference.impot_societes - reference.creance_taxe_fonciere
  const tri = tauxRendementInterne(s.flux)
  const triPlacement = tauxRendementInterne(fluxPlacement(s))
  const sansPenalite = dateSortieSansPenalite(r.id, s.calendrier, p)
  const ttcNormal = prixTtc(d.bien.prix_ht, p.lli.tva_taux_normal.valeur)
  return {
    id: r.id,
    horizon,
    effort_mensuel_premieres_annees: effortPremiersMois(s, MOIS_PREMIERES_ANNEES),
    effort_mensuel_moyen: -somme((a) => a.flux_tresorerie) / moisDeDetention(s),
    effort_mensuel_pire: pire.mensuel,
    pire_annee: pire.annee,
    economie_impot_cumulee: economie,
    reprise_a_la_revente: repriseRevente,
    economie_impot_nette: economie - repriseRevente,
    tva_economisee: d.bien.etat === 'ancien' ? 0 : ttcNormal - s.prix_acquisition,
    creance_taxe_fonciere_cumulee: somme((a) => a.creance_taxe_fonciere),
    decote_loyer_cumulee: somme((a) => a.decote_loyer),
    rendement_brut: (reference.loyer_mensuel_retenu * MOIS_PAR_AN) / s.prix_acquisition,
    rendement_net_de_charges: netDeCharges / s.cout_total,
    rendement_net_net: (netDeCharges - impotsReference * annualisation) / s.cout_total,
    tri,
    van: valeurActuelleNette(s.flux, d.hypotheses.rendement_placement),
    capital_net_sortie: o.produit_net,
    enrichissement_net: s.flux.reduce((total, f) => total + f.montant, 0),
    tri_placement: triPlacement,
    capital_net_placement: s.placement.capital_net,
    ecart_tri_placement: tri === null || triPlacement === null ? null : tri - triPlacement,
    ecart_capital_placement: o.produit_net - s.placement.capital_net,
    date_sortie_sans_penalite: sansPenalite,
    duree_blocage_ans:
      sansPenalite === null
        ? 0
        : Math.max(0, (rangMois(sansPenalite) - rangMois(s.calendrier.date_debut_location)) / MOIS_PAR_AN),
    taux_endettement_apres: tauxEndettementApres(d),
  }
}

export interface ComparaisonHorizon {
  readonly horizon: number
  readonly scenarios: readonly ResultatScenario[]
  readonly indicateurs: readonly Indicateurs[]
  /** Écarts de TRI et de capital net au scénario S0 (location nue classique), s'il est éligible. */
  readonly ecarts_s0: Readonly<Partial<Record<IdScenario, { readonly tri: number | null; readonly capital_net: number }>>>
}

/** Tous les scénarios et leurs indicateurs pour un horizon (§9). */
export function comparerScenarios(d: Dossier, horizon: number, p: ParametresFiscaux): ComparaisonHorizon {
  const scenarios = SCENARIOS.map((id) => simulerScenario(d, id, { horizon }, p))
  const indicateurs = scenarios
    .map((r) => indicateursScenario(d, r, horizon, p))
    .filter((i): i is Indicateurs => i !== null)
  const s0 = indicateurs.find((i) => i.id === 'S0')
  const ecarts: Partial<Record<IdScenario, { tri: number | null; capital_net: number }>> = {}
  if (s0 !== undefined) {
    for (const i of indicateurs) {
      ecarts[i.id] = {
        tri: i.tri === null || s0.tri === null ? null : i.tri - s0.tri,
        capital_net: i.capital_net_sortie - s0.capital_net_sortie,
      }
    }
  }
  return { horizon, scenarios, indicateurs, ecarts_s0: ecarts }
}

/** Comparaison aux horizons de calcul par défaut (9, 12, 16, 20 et 25 ans). */
export function comparerAuxHorizons(d: Dossier, p: ParametresFiscaux): ComparaisonHorizon[] {
  return hypothesesDefaut.horizons_ans.valeur.map((horizon) => comparerScenarios(d, horizon, p))
}

/** TRI du scénario, borné : maximal si tous les flux sont positifs, minimal s'ils sont tous négatifs (recherche monotone). */
function triBorne(d: Dossier, id: IdScenario, options: OptionsSimulation, p: ParametresFiscaux): number {
  const s = simulerScenario(d, id, options, p).simulation
  return s === null ? TRI_MINIMUM : triComparable(s)
}

/** Options qui conservent le régime retenu dans le cas central : seule la variable étudiée change. */
function optionsAuRegimeCentral(s: ResultatSimulation, horizon: number, autres: Partial<OptionsSimulation> = {}): OptionsSimulation {
  return s.regime === 'is' ? { horizon, ...autres } : { horizon, regime: s.regime, ...autres }
}

export interface PrixEquilibre {
  /** Prix de revente pour lequel le TRI égale celui du placement équivalent ; null hors de l'intervalle étudié. */
  readonly prix: number | null
  readonly prix_central: number
  readonly tri_placement: number | null
}

/** Prix de revente d'équilibre (§8.6), par recherche dichotomique sur le prix de revente. */
export function prixReventeEquilibre(d: Dossier, id: IdScenario, horizon: number, p: ParametresFiscaux): PrixEquilibre | null {
  const s = simulerScenario(d, id, { horizon }, p).simulation
  if (s === null) return null
  const triPlacement = tauxRendementInterne(fluxPlacement(s))
  const prixCentral = s.sortie.prix_revente
  if (triPlacement === null) return { prix: null, prix_central: prixCentral, tri_placement: null }
  // Le régime retenu au prix central est conservé pour que seule la revente varie.
  const facteur = rechercheDichotomique(
    (x) => triBorne(d, id, optionsAuRegimeCentral(s, horizon, { facteur_prix_revente: x }), p),
    triPlacement,
    0,
    FACTEUR_PRIX_REVENTE_MAXIMUM,
  )
  return { prix: facteur === null ? null : facteur * prixCentral, prix_central: prixCentral, tri_placement: triPlacement }
}

export interface BrancheTornado {
  readonly variable: 'prix_revente' | 'loyer' | 'vacance' | 'taux_emprunt' | 'revenus'
  readonly libelle: string
  /** TRI avec la variable déplacée vers le bas (prix, loyer, vacance, taux ou revenus plus faibles). */
  readonly tri_bas: number | null
  /** TRI avec la variable déplacée vers le haut. */
  readonly tri_haut: number | null
  /** Écart entre les deux TRI, pour classer les branches. */
  readonly amplitude: number
}

export interface Tornado {
  readonly tri_central: number | null
  readonly branches: readonly BrancheTornado[]
}

function avecLoyers(d: Dossier, facteur: number): Dossier {
  return {
    ...d,
    bien: { ...d.bien, loyer_marche_nu: d.bien.loyer_marche_nu * facteur, loyer_marche_meuble: d.bien.loyer_marche_meuble * facteur },
  }
}

/** Dossier dont les revenus imposables des foyers, changements prévus compris, sont multipliés par un facteur. */
export function avecRevenus(d: Dossier, facteur: number): Dossier {
  return {
    ...d,
    foyers: {
      ...d.foyers,
      foyers: d.foyers.foyers.map((f) => ({
        ...f,
        revenu_imposable: f.revenu_imposable * facteur,
        ...(f.changement_revenu === undefined
          ? {}
          : { changement_revenu: { ...f.changement_revenu, revenu_imposable: f.changement_revenu.revenu_imposable * facteur } }),
      })),
    },
  }
}

/** Tornado (§9) : chaque variable déplacée vers le bas puis vers le haut, toutes choses égales par ailleurs. */
export function tornado(d: Dossier, id: IdScenario, horizon: number, p: ParametresFiscaux): Tornado | null {
  const centrale = simulerScenario(d, id, { horizon }, p).simulation
  if (centrale === null) return null
  const sens = hypothesesDefaut.sensibilites.valeur
  const tri = (dossier: Dossier, options: Partial<OptionsSimulation> = {}): number | null => {
    const s = simulerScenario(dossier, id, optionsAuRegimeCentral(centrale, horizon, options), p).simulation
    return s === null ? null : tauxRendementInterne(s.flux)
  }
  const branche = (
    variable: BrancheTornado['variable'],
    libelle: string,
    bas: number | null,
    haut: number | null,
  ): BrancheTornado => ({
    variable,
    libelle,
    tri_bas: bas,
    tri_haut: haut,
    amplitude: bas === null || haut === null ? 0 : Math.abs(haut - bas),
  })
  const h = d.hypotheses
  const f = d.financement
  const branches = [
    branche(
      'prix_revente',
      'Prix de revente',
      tri(d, { facteur_prix_revente: 1 - sens.variation_prix_revente }),
      tri(d, { facteur_prix_revente: 1 + sens.variation_prix_revente }),
    ),
    branche('loyer', 'Loyer', tri(avecLoyers(d, 1 - sens.variation_loyer)), tri(avecLoyers(d, 1 + sens.variation_loyer))),
    branche(
      'vacance',
      'Vacance locative',
      tri({ ...d, hypotheses: { ...h, vacance_mois_par_an: sens.vacance_mois.basse } }),
      tri({ ...d, hypotheses: { ...h, vacance_mois_par_an: sens.vacance_mois.haute } }),
    ),
    branche(
      'taux_emprunt',
      'Taux d’emprunt',
      tri({ ...d, financement: { ...f, taux_annuel: Math.max(0, f.taux_annuel - sens.variation_taux_emprunt) } }),
      tri({ ...d, financement: { ...f, taux_annuel: f.taux_annuel + sens.variation_taux_emprunt } }),
    ),
    branche(
      'revenus',
      'Revenus du foyer (tranche marginale)',
      tri(avecRevenus(d, 1 - sens.variation_revenus)),
      tri(avecRevenus(d, 1 + sens.variation_revenus)),
    ),
  ]
  return { tri_central: tauxRendementInterne(centrale.flux), branches: [...branches].sort((a, b) => b.amplitude - a.amplitude) }
}

export interface TableauCroise {
  readonly decotes: readonly number[]
  readonly revalorisations: readonly number[]
  /** TRI[i][j] pour la décote i et la revalorisation j. */
  readonly tri: readonly (readonly (number | null)[])[]
}

/** Tableau croisé (§9) : TRI selon la décote du neuf et la revalorisation annuelle du prix. */
export function tableauCroise(d: Dossier, id: IdScenario, horizon: number, p: ParametresFiscaux): TableauCroise | null {
  const centrale = simulerScenario(d, id, { horizon }, p).simulation
  if (centrale === null) return null
  const sens = hypothesesDefaut.sensibilites.valeur
  const decotes = sens.grille_decote_neuf
  const revalorisations = sens.grille_revalorisation_prix
  const tri = decotes.map((decote) =>
    revalorisations.map((revalorisation) => {
      const dossier: Dossier = {
        ...d,
        hypotheses: { ...d.hypotheses, prix: { decote_neuf: decote, revalorisation_annuelle: revalorisation } },
      }
      const s = simulerScenario(dossier, id, optionsAuRegimeCentral(centrale, horizon), p).simulation
      return s === null ? null : tauxRendementInterne(s.flux)
    }),
  )
  return { decotes, revalorisations, tri }
}

/** Pénalité d'une sortie un an avant la fin des engagements : complément de TVA et reprises fiscales. */
export function penaliteSortieAnticipee(
  d: Dossier,
  id: IdScenario,
  p: ParametresFiscaux,
): { readonly horizon: number; readonly montant: number } | null {
  const b = d.bien
  const cal = calendrierOperation(b.date_acquisition, b.date_livraison, b.date_debut_location, 1)
  const fin = dateSortieSansPenalite(id, cal, p)
  if (fin === null) return null
  let horizon = 0
  while (comparerDates(ajouterAnnees(cal.date_debut_location, horizon + 1), fin) < 0) horizon++
  if (horizon < 1) return null
  const s = simulerScenario(d, id, { horizon }, p).simulation
  if (s === null) return null
  const o = s.sortie
  return { horizon, montant: o.complement_tva + o.reprise_jeanbrun + o.reprise_denormandie }
}
