/**
 * Contre-expertise de la simulation remise par le vendeur (§12) : recalcul avec
 * ses hypothèses et écarts aux résultats annoncés, hypothèses optimistes
 * signalées, rejeu avec les hypothèses prudentes.
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument, les hypothèses prudentes et la tolérance des écarts viennent des
 * hypothèses par défaut.
 */
import type { NiveauLoyer, ParametresFiscaux } from '../params'
import { hypothesesDefaut } from '../params'
import { hypothesesParDefaut, type Dossier } from './dossier'
import { formaterEuros, formaterNombre, formaterTaux } from './format'
import { calculerImpot } from './impot-revenu'
import { indicateursScenario, type Indicateurs } from './indicateurs'
import { plafondLoyer, plafondLoyerIntermediaire } from './loyer-plafond'
import {
  caracteristiquesScenario,
  engagementsScenario,
  LIBELLES_SCENARIOS,
  simulerScenario,
  type IdScenario,
  type OptionsSimulation,
  type ResultatScenario,
  type SortieScenario,
} from './scenario'

/** Hypothèses et résultats de la simulation remise par le vendeur (§12). */
export interface SimulationVendeur {
  readonly scenario: IdScenario
  /** Années de location avant la revente. */
  readonly horizon: number
  /** Prix d'acquisition annoncé : TTC au taux de TVA du dispositif, ou prix d'achat d'un logement ancien. */
  readonly prix: number
  /** Loyer mensuel hors charges. */
  readonly loyer_mensuel: number
  readonly revalorisation_loyers: number
  /** Revalorisation annuelle du prix du bien. */
  readonly revalorisation_prix: number
  readonly vacance_mois_par_an: number
  /** Charges retenues par le vendeur ; absentes ou nulles si sa simulation les ignore. */
  readonly charges_copropriete?: number
  readonly entretien_part_loyers?: number
  readonly taxe_fonciere?: number
  /** Frais annuels de la SCI (comptabilité, banque) ; s'ils sont retenus, les frais de constitution du dossier aussi. */
  readonly frais_sci_annuels?: number
  readonly taux_emprunt: number
  /** Prix de revente annoncé à l'horizon ; à défaut, prix revalorisé sans décote du neuf. */
  readonly prix_revente?: number
  /** Économie d'impôt cumulée annoncée sur l'horizon. */
  readonly economie_impot_annoncee?: number
  /** Effort d'épargne mensuel moyen annoncé. */
  readonly effort_epargne_annonce?: number
  /** Impôt de plus-value annoncé à la revente. */
  readonly impot_plus_value_annonce?: number
  /** Tranche marginale supposée constante par le vendeur. */
  readonly tmi_supposee?: number
  readonly tri_annonce?: number
}

export const CODES_HYPOTHESE_OPTIMISTE = [
  'vacance_nulle',
  'revalorisation_loyers',
  'revente_sans_decote',
  'charges_absentes',
  'taxe_fonciere_absente',
  'frais_sci_absents',
  'plus_value_absente',
  'loyer_au_plafond',
  'loyer_au_dela_du_plafond',
  'loyer_au_dela_du_marche',
  'tmi_constante',
] as const
export type CodeHypotheseOptimiste = (typeof CODES_HYPOTHESE_OPTIMISTE)[number]

export interface HypotheseOptimiste {
  readonly code: CodeHypotheseOptimiste
  readonly message: string
}

export const INDICATEURS_ANNONCES = ['economie_impot', 'effort_epargne', 'tri', 'impot_plus_value'] as const
export type IndicateurAnnonce = (typeof INDICATEURS_ANNONCES)[number]

const LIBELLES_INDICATEURS: Readonly<Record<IndicateurAnnonce, string>> = {
  economie_impot: 'Économie d’impôt cumulée',
  effort_epargne: 'Effort d’épargne mensuel moyen',
  tri: 'TRI après impôt',
  impot_plus_value: 'Impôt de plus-value',
}

/** Écart entre un résultat annoncé par le vendeur et le recalcul de l'outil avec ses hypothèses. */
export interface EcartAnnonce {
  readonly indicateur: IndicateurAnnonce
  readonly libelle: string
  readonly annonce: number
  readonly recalcule: number
  /** Annoncé − recalculé (en points pour le TRI). */
  readonly ecart: number
  /** (annoncé − recalculé) / |recalculé| ; infini si le recalcul est nul et l'annonce non. */
  readonly ecart_relatif: number
  /** Écart supérieur à la tolérance (5 % par défaut). */
  readonly significatif: boolean
}

export interface ResultatContreExpertise {
  readonly indicateurs: Indicateurs
  readonly sortie: SortieScenario
}

export interface ContreExpertise {
  readonly scenario: IdScenario
  readonly horizon: number
  readonly eligible: boolean
  readonly motifs_ineligibilite: readonly string[]
  readonly hypotheses_optimistes: readonly HypotheseOptimiste[]
  readonly ecarts: readonly EcartAnnonce[]
  /** Recalcul de l'outil avec les hypothèses du vendeur. */
  readonly recalcul_vendeur: ResultatContreExpertise | null
  /** Même opération rejouée avec les hypothèses prudentes et les données du dossier. */
  readonly rejeu_prudent: ResultatContreExpertise | null
  /** Effort prudent moins effort du recalcul aux hypothèses du vendeur, par mois. */
  readonly ecart_effort_prudent: number | null
  /** TRI prudent moins TRI du recalcul aux hypothèses du vendeur. */
  readonly ecart_tri_prudent: number | null
  readonly synthese: string
}

function prixHorsTaxe(d: Dossier, v: SimulationVendeur, p: ParametresFiscaux): number {
  if (d.bien.etat === 'ancien') return v.prix
  const taux = caracteristiquesScenario(v.scenario).tva_reduite ? p.lli.tva_taux_reduit.valeur : p.lli.tva_taux_normal.valeur
  return v.prix / (1 + taux)
}

/** Dossier aux hypothèses du vendeur : prix, loyer, charges, taux et marché qu'il retient. */
function dossierVendeur(d: Dossier, v: SimulationVendeur, p: ParametresFiscaux): Dossier {
  const meuble = caracteristiquesScenario(v.scenario).meuble
  const sci = d.exploitation.sci
  const fraisSci = v.frais_sci_annuels ?? 0
  return {
    ...d,
    bien: {
      ...d.bien,
      prix_ht: prixHorsTaxe(d, v, p),
      loyer_marche_nu: meuble ? d.bien.loyer_marche_nu : v.loyer_mensuel,
      loyer_marche_meuble: meuble ? v.loyer_mensuel : d.bien.loyer_marche_meuble,
      charges_copropriete_non_recuperables: v.charges_copropriete ?? 0,
      taxe_fonciere: v.taxe_fonciere ?? 0,
    },
    financement: { ...d.financement, taux_annuel: v.taux_emprunt },
    exploitation: {
      ...d.exploitation,
      sci: {
        constitution: fraisSci > 0 ? sci.constitution : 0,
        comptabilite_annuelle: fraisSci,
        frais_bancaires_annuels: 0,
      },
    },
    hypotheses: {
      ...d.hypotheses,
      revalorisation_loyers: v.revalorisation_loyers,
      vacance_mois_par_an: v.vacance_mois_par_an,
      entretien_part_loyers: v.entretien_part_loyers ?? 0,
      prix: { decote_neuf: 0, revalorisation_annuelle: v.revalorisation_prix },
    },
  }
}

/**
 * Même opération (prix, financement, loyer annoncé s'il ne dépasse pas le marché) avec les hypothèses
 * prudentes (§5.5) et les charges du dossier.
 */
function dossierPrudent(d: Dossier, vendeur: Dossier, v: SimulationVendeur): Dossier {
  const prudentes = hypothesesParDefaut('central')
  const meuble = caracteristiquesScenario(v.scenario).meuble
  return {
    ...vendeur,
    bien: {
      ...vendeur.bien,
      loyer_marche_nu: meuble ? d.bien.loyer_marche_nu : Math.min(v.loyer_mensuel, d.bien.loyer_marche_nu),
      loyer_marche_meuble: meuble ? Math.min(v.loyer_mensuel, d.bien.loyer_marche_meuble) : d.bien.loyer_marche_meuble,
      charges_copropriete_non_recuperables: d.bien.charges_copropriete_non_recuperables,
      taxe_fonciere: d.bien.taxe_fonciere,
    },
    exploitation: d.exploitation,
    hypotheses: {
      ...d.hypotheses,
      revalorisation_loyers: prudentes.revalorisation_loyers,
      revalorisation_charges: prudentes.revalorisation_charges,
      vacance_mois_par_an: prudentes.vacance_mois_par_an,
      entretien_part_loyers: prudentes.entretien_part_loyers,
      frais_cession: prudentes.frais_cession,
      prix: prudentes.prix,
    },
  }
}

function resultat(d: Dossier, r: ResultatScenario, horizon: number, p: ParametresFiscaux): ResultatContreExpertise | null {
  const indicateurs = indicateursScenario(d, r, horizon, p)
  return r.simulation === null || indicateurs === null ? null : { indicateurs, sortie: r.simulation.sortie }
}

/** Recalcul aux hypothèses du vendeur ; le prix de revente annoncé est repris exactement. */
function recalculVendeur(dv: Dossier, v: SimulationVendeur, p: ParametresFiscaux): ResultatScenario {
  const options: OptionsSimulation = { horizon: v.horizon }
  const libre = simulerScenario(dv, v.scenario, options, p)
  const prixCalcule = libre.simulation?.sortie.prix_revente ?? 0
  if (v.prix_revente === undefined || !(prixCalcule > 0)) return libre
  return simulerScenario(dv, v.scenario, { ...options, facteur_prix_revente: v.prix_revente / prixCalcule }, p)
}

function plafondDuScenario(d: Dossier, niveau: NiveauLoyer, p: ParametresFiscaux): number | null {
  if (niveau === 'intermediaire') return plafondLoyerIntermediaire(d.bien.zone, d.bien.surface, p).loyer_plafond_mensuel
  const m2 = d.bien.plafonds_m2_loc_avantages?.[niveau]
  return m2 === undefined ? null : plafondLoyer(m2, d.bien.surface, p).loyer_plafond_mensuel
}

function hypothesesOptimistes(
  d: Dossier,
  v: SimulationVendeur,
  vendeur: ResultatContreExpertise | null,
  p: ParametresFiscaux,
): HypotheseOptimiste[] {
  const tolerance = hypothesesDefaut.contre_expertise.tolerance_ecart.valeur
  const prudentes = hypothesesParDefaut('central')
  const caracteristiques = caracteristiquesScenario(v.scenario)
  const liste: HypotheseOptimiste[] = []
  const ajouter = (code: CodeHypotheseOptimiste, message: string): void => {
    liste.push({ code, message })
  }

  if (!(v.vacance_mois_par_an > 0)) {
    ajouter('vacance_nulle', `Vacance locative nulle ; hypothèse prudente : ${formaterNombre(prudentes.vacance_mois_par_an)} mois par an`)
  }
  if (v.revalorisation_loyers > prudentes.revalorisation_loyers) {
    ajouter(
      'revalorisation_loyers',
      `Loyers revalorisés de ${formaterTaux(v.revalorisation_loyers)} par an, au-delà de ${formaterTaux(prudentes.revalorisation_loyers)}`,
    )
  }
  const prixRevente = v.prix_revente ?? vendeur?.sortie.prix_revente
  if (d.bien.etat !== 'ancien' && prixRevente !== undefined && prixRevente >= v.prix) {
    ajouter(
      'revente_sans_decote',
      `Revente à ${formaterEuros(prixRevente)}, au prix d’achat (${formaterEuros(v.prix)}) ou au-dessus, sans décote du neuf ; hypothèse prudente : décote de ${formaterTaux(prudentes.prix.decote_neuf)} du prix TTC à taux normal`,
    )
  }
  const absentes = [
    ...((v.charges_copropriete ?? 0) > 0 ? [] : ['charges de copropriété']),
    ...((v.entretien_part_loyers ?? 0) > 0 ? [] : ['entretien']),
  ]
  if (absentes.length > 0) ajouter('charges_absentes', `Absents de la simulation : ${absentes.join(' et ')}`)
  if (!((v.taxe_fonciere ?? 0) > 0)) {
    ajouter('taxe_fonciere_absente', `Taxe foncière absente ; le dossier l’estime à ${formaterEuros(d.bien.taxe_fonciere)} par an`)
  }
  if (caracteristiques.detention !== 'nom_propre' && !((v.frais_sci_annuels ?? 0) > 0)) {
    const sci = d.exploitation.sci
    ajouter(
      'frais_sci_absents',
      `Frais de SCI absents ; le dossier retient ${formaterEuros(sci.comptabilite_annuelle + sci.frais_bancaires_annuels)} par an et ${formaterEuros(sci.constitution)} de constitution`,
    )
  }
  const amortissement = engagementsScenario(v.scenario).jeanbrun !== null || caracteristiques.meuble
  const reintegration = vendeur?.sortie.impot_plus_value_reintegration ?? 0
  if (amortissement && !((v.impot_plus_value_annonce ?? 0) > 0) && reintegration > 0) {
    ajouter(
      'plus_value_absente',
      `Impôt de plus-value sur les amortissements réintégrés absent : ${formaterEuros(reintegration)} dans le recalcul`,
    )
  }
  const niveau = caracteristiques.niveau_loyer
  const plafond = niveau === null ? null : plafondDuScenario(d, niveau, p)
  if (plafond !== null && v.loyer_mensuel > plafond * (1 + tolerance)) {
    ajouter(
      'loyer_au_dela_du_plafond',
      `Loyer de ${formaterEuros(v.loyer_mensuel)} au-delà du plafond du dispositif (${formaterEuros(plafond)}) : le recalcul l’applique`,
    )
  } else if (plafond !== null && v.loyer_mensuel >= plafond * (1 - tolerance) && d.bien.loyer_marche_nu < plafond) {
    ajouter(
      'loyer_au_plafond',
      `Loyer au plafond (${formaterEuros(plafond)}) alors que le marché constaté est à ${formaterEuros(d.bien.loyer_marche_nu)}`,
    )
  }
  // Un loyer au plafond au-dessus du marché est déjà signalé ci-dessus.
  const marche = caracteristiques.meuble ? d.bien.loyer_marche_meuble : d.bien.loyer_marche_nu
  if (!liste.some((h) => h.code === 'loyer_au_plafond') && v.loyer_mensuel > marche * (1 + tolerance)) {
    ajouter(
      'loyer_au_dela_du_marche',
      `Loyer de ${formaterEuros(v.loyer_mensuel)} au-delà du loyer de marché constaté (${formaterEuros(marche)})`,
    )
  }
  if (v.tmi_supposee !== undefined) {
    const communes = d.foyers.situation === 'marie_pacse'
    const actuelles = d.foyers.foyers.map((f) => calculerImpot(f.revenu_imposable, { parts: f.parts, imposition_commune: communes }, p).tmi)
    const superieure = actuelles.every((t) => v.tmi_supposee !== undefined && v.tmi_supposee > t)
    ajouter(
      'tmi_constante',
      `Tranche marginale supposée constante à ${formaterTaux(v.tmi_supposee)}${superieure ? `, au-dessus de la vôtre (${actuelles.map(formaterTaux).join(' et ')})` : ''} ; l’outil recalcule l’impôt complet chaque année`,
    )
  }
  return liste
}

function ecarts(v: SimulationVendeur, vendeur: ResultatContreExpertise | null): EcartAnnonce[] {
  if (vendeur === null) return []
  const tolerance = hypothesesDefaut.contre_expertise.tolerance_ecart.valeur
  const i = vendeur.indicateurs
  const paires: readonly [IndicateurAnnonce, number | undefined, number | null][] = [
    ['economie_impot', v.economie_impot_annoncee, i.economie_impot_cumulee],
    ['effort_epargne', v.effort_epargne_annonce, i.effort_mensuel_moyen],
    ['tri', v.tri_annonce, i.tri],
    ['impot_plus_value', v.impot_plus_value_annonce, vendeur.sortie.impot_plus_value],
  ]
  return paires.flatMap(([indicateur, annonce, recalcule]) => {
    if (annonce === undefined || recalcule === null) return []
    const ecart =
      recalcule !== 0 ? (annonce - recalcule) / Math.abs(recalcule) : annonce === 0 ? 0 : Math.sign(annonce) * Number.POSITIVE_INFINITY
    return [
      {
        indicateur,
        libelle: LIBELLES_INDICATEURS[indicateur],
        annonce,
        recalcule,
        ecart: annonce - recalcule,
        ecart_relatif: ecart,
        significatif: Math.abs(ecart) > tolerance,
      },
    ]
  })
}

function formaterTri(t: number | null): string {
  return t === null ? 'non calculable' : formaterTaux(t)
}

/** Contre-expertise complète (§12) de la simulation d'un vendeur pour le bien du dossier. */
export function contreExpertiser(d: Dossier, v: SimulationVendeur, p: ParametresFiscaux): ContreExpertise {
  const dv = dossierVendeur(d, v, p)
  const r = recalculVendeur(dv, v, p)
  const vendeur = resultat(dv, r, v.horizon, p)
  const dp = dossierPrudent(d, dv, v)
  const prudent = resultat(dp, simulerScenario(dp, v.scenario, { horizon: v.horizon }, p), v.horizon, p)
  const optimistes = hypothesesOptimistes(d, v, vendeur, p)
  const liste = ecarts(v, vendeur)

  const effortVendeur = vendeur?.indicateurs.effort_mensuel_moyen ?? null
  const effortPrudent = prudent?.indicateurs.effort_mensuel_moyen ?? null
  const triVendeur = vendeur?.indicateurs.tri ?? null
  const triPrudent = prudent?.indicateurs.tri ?? null
  const significatifs = liste.filter((e) => e.significatif).length

  const synthese =
    vendeur === null || prudent === null || effortVendeur === null || effortPrudent === null
      ? `${v.scenario} (${LIBELLES_SCENARIOS[v.scenario]}) n’est pas éligible pour ce bien : ${r.eligibilite.motifs.join(' ; ')}`
      : `Avec des hypothèses prudentes, l’effort d’épargne passe de ${formaterEuros(effortVendeur)} à ${formaterEuros(effortPrudent)} par mois et le TRI après impôt de ${formaterTri(triVendeur)} à ${formaterTri(triPrudent)} ; ${optimistes.length} hypothèse(s) optimiste(s) relevée(s), ${significatifs} écart(s) de plus de ${formaterTaux(hypothesesDefaut.contre_expertise.tolerance_ecart.valeur)} avec les résultats annoncés.`

  return {
    scenario: v.scenario,
    horizon: v.horizon,
    eligible: r.eligibilite.eligible,
    motifs_ineligibilite: r.eligibilite.motifs,
    hypotheses_optimistes: optimistes,
    ecarts: liste,
    recalcul_vendeur: vendeur,
    rejeu_prudent: prudent,
    ecart_effort_prudent: effortVendeur === null || effortPrudent === null ? null : effortPrudent - effortVendeur,
    ecart_tri_prudent: triVendeur === null || triPrudent === null ? null : triPrudent - triVendeur,
    synthese,
  }
}
