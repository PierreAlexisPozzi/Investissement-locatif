/**
 * Présentation des résultats (§11, écrans 4 et 6) : libellé, format et formule
 * de chaque colonne du tableau annuel, de chaque poste de la revente et de
 * chaque indicateur. Les formules décrivent le calcul du moteur avec les
 * valeurs des paramètres et du dossier : un indicateur se retrouve ainsi dans
 * le tableau annuel et dans sa formule (§3).
 *
 * Aucun calcul fiscal ici : les valeurs sont lues dans les résultats du moteur.
 */
import type { ParametresFiscaux } from '../params'
import { ANNEES_EFFORT_INITIAL, MOIS_PAR_AN } from './constantes-numeriques'
import type { Dossier } from './dossier'
import { formaterEuros, formaterNombre, formaterTaux } from './format'
import type { Indicateurs } from './indicateurs'
import {
  caracteristiquesScenario,
  engagementsScenario,
  type ChargesAnnee,
  type IdScenario,
  type LigneAnnuelle,
  type ResultatSimulation,
  type SortieScenario,
} from './scenario'

export type FormatValeur = 'annee' | 'nombre' | 'euros' | 'taux' | 'annees' | 'date'

export interface Colonne<T> {
  readonly cle: string
  readonly libelle: string
  /** Calcul du moteur, en clair, avec les valeurs retenues. */
  readonly formule: string
  readonly format: FormatValeur
  readonly valeur: (ligne: T) => number | string | null
}

const taux = formaterTaux
const euros = formaterEuros

const LIBELLES_NIVEAUX = { intermediaire: 'intermédiaire', social: 'social', tres_social: 'très social' } as const

/** Régime fiscal des loyers de la simulation, en clair. */
function regimeLoyers(s: ResultatSimulation): string {
  switch (s.regime) {
    case 'micro':
      return 'micro'
    case 'reel':
      return 'réel'
    case 'reel_puis_micro':
      return 'réel, puis micro à partir de l’année de bascule'
    case 'is':
      return 'impôt sur les sociétés'
  }
}

/** Taxe foncière déduite : sans celle des années couvertes par la créance du LLI, si le paramètre l'exclut. */
function taxeFonciereDeduite(id: IdScenario, p: ParametresFiscaux): string {
  return engagementsScenario(id).lli && !p.lli.tf_deductible_si_creance.valeur ? 'taxe foncière hors années de créance du LLI' : 'taxe foncière'
}

/** Calcul du résultat fiscal de l'opération, tel que la colonne l'affiche, selon le régime retenu par la simulation. */
function formuleResultat(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): string {
  const c = caracteristiquesScenario(id)
  const e = engagementsScenario(id)
  const tf = taxeFonciereDeduite(id, p)
  const fraisEnCharge = p.lmnp.modelisation.valeur.frais_acquisition === 'charge_annee_1'
  if (s.regime === 'is') {
    return (
      `Résultat comptable de la SCI : loyers − charges (${tf}, copropriété, assurance PNO, gestion, loyers impayés, entretien, frais de la SCI) − intérêts − assurance emprunteur − amortissement ; ` +
      `l’année de la signature, aussi les frais d’emprunt, de constitution${fraisEnCharge ? ' et d’acquisition (passés en charge, paramètre lmnp.modelisation)' : ''} ; ` +
      'l’année de la revente, plus-value de cession comprise. La créance de taxe foncière n’est pas imposée.'
    )
  }
  if (c.meuble) {
    const mb = p.lmnp.micro_bic.valeur
    const micro = `au micro-BIC : loyers de la quote-part de chaque foyer × (1 − ${taux(mb.abattement)}), abattement d’au moins ${euros(mb.abattement_minimum)} par foyer`
    const reel =
      `au réel : loyers − charges (intérêts, assurance emprunteur, frais d’emprunt, ${tf}, copropriété, assurance PNO, gestion, loyers impayés, entretien, comptable et CFE) − amortissements déduits. ` +
      `Nul avant le début de la location : les charges de ces années${fraisEnCharge ? ' et les frais d’acquisition (passés en charge, paramètre lmnp.modelisation)' : ''} s’ajoutent à celles de la première année louée`
    if (s.regime === 'micro') return `Bénéfice de location meublée ${micro} ; nul avant le début de la location.`
    if (s.regime === 'reel') return `Bénéfice de location meublée ${reel}.`
    return `Bénéfice de location meublée ${reel} ; à partir de l’année de bascule, ${micro}.`
  }
  const deductibles = [tf, 'copropriété', 'assurance PNO', 'gestion', 'loyers impayés', 'entretien', `frais forfaitaires de ${euros(p.revenus_fonciers_reel.frais_gestion_forfaitaires_par_local.valeur)}`]
  if (c.detention === 'sci_ir') {
    deductibles.push(p.sci_ir.frais_bancaires_couverts_par_forfait.valeur ? 'comptabilité de la SCI (frais bancaires couverts par le forfait)' : 'frais de la SCI')
    if (p.sci_ir.frais_constitution_deductibles.valeur) deductibles.push('frais de constitution l’année de la signature')
  }
  const travauxDeductibles = id === 'S0' && d.bien.etat === 'ancien' && d.bien.travaux_deductibles !== false && s.regime !== 'micro'
  if (travauxDeductibles) deductibles.push('travaux, l’année de leur achèvement')
  const jeanbrun = e.jeanbrun === null ? '' : ' − amortissement Jeanbrun'
  const sci = c.detention === 'sci_ir' ? ', pour toute la SCI, avant répartition entre les associés' : ''
  const reel = `Revenu foncier de l’opération au réel : loyers − intérêts − assurance emprunteur − frais d’emprunt (année de la signature) − charges déductibles (${deductibles.join(', ')})${jeanbrun}${sci}.`
  if (s.regime !== 'micro') return reel
  return `${reel} Le micro-foncier étant retenu, l’impôt est calculé sur les loyers × (1 − ${taux(p.micro_foncier.abattement.valeur)}), sans déduire ces charges : la colonne sert de comparaison.`
}

/** Calcul de l'amortissement déduit, s'il y en a un dans le scénario. */
function formuleAmortissement(id: IdScenario, p: ParametresFiscaux): string | null {
  const niveau = engagementsScenario(id).jeanbrun
  const m = p.lmnp.modelisation.valeur
  if (niveau !== null) {
    const jb = p.jeanbrun
    const prorata = jb.prorata_premiere_annee.valeur === 'mensuel' ? ', au prorata des mois la première année' : ''
    return (
      `Amortissement Jeanbrun : prix d’acquisition diminué de ${taux(jb.part_foncier_forfaitaire.valeur)} de foncier, × ${taux(jb.taux_amortissement.valeur[niveau])} par an` +
      `${prorata}, plafonné à ${euros(jb.plafond_annuel.valeur[niveau])} par an et par foyer (loyer ${LIBELLES_NIVEAUX[niveau]}).`
    )
  }
  if (caracteristiquesScenario(id).meuble) {
    return (
      `Amortissements du bâti (prix hors terrain de ${taux(m.part_terrain)}, sur ${formaterNombre(m.duree_bati_ans)} ans) et du mobilier (sur ${formaterNombre(m.duree_mobilier_ans)} ans), ` +
      'déduits dans la limite du résultat avant amortissement ; l’excédent est reporté sans limite de durée.'
    )
  }
  if (caracteristiquesScenario(id).detention === 'sci_is') {
    return `Amortissement comptable du bâti : prix hors terrain de ${taux(m.part_terrain)}, sur ${formaterNombre(m.duree_bati_ans)} ans, au prorata des mois loués.`
  }
  return null
}

/** Détail des charges de l'exploitation, toutes revalorisées comme les charges du dossier. */
function formuleCharges(d: Dossier, id: IdScenario, p: ParametresFiscaux): string {
  const c = caracteristiquesScenario(id)
  const ex = d.exploitation
  const h = d.hypotheses
  const ancien = d.bien.etat === 'ancien'
  const exoneration = h.annees_exoneration_taxe_fonciere
  const postes = [
    ancien
      ? 'taxe foncière hors TEOM dès l’achat'
      : `taxe foncière hors TEOM à partir de l’année suivant l’achèvement${exoneration > 0 ? `, après ${formaterNombre(exoneration)} année(s) d’exonération` : ''}`,
    `copropriété non récupérable et assurance PNO ${ancien ? 'dès l’achat' : 'dès la livraison'}`,
    `gestion (${taux(ex.frais_gestion_part_loyers)} des loyers encaissés)`,
    `assurance loyers impayés (${taux(ex.assurance_loyers_impayes_part_loyers)})`,
    `entretien (${taux(h.entretien_part_loyers)})`,
  ]
  if (!c.meuble && c.detention !== 'sci_is') {
    postes.push(`frais de gestion forfaitaires de ${euros(p.revenus_fonciers_reel.frais_gestion_forfaitaires_par_local.valeur)} par année louée`)
  }
  if (c.detention !== 'nom_propre') postes.push('frais annuels de la SCI (comptabilité, banque)')
  if (c.meuble) postes.push('comptable et CFE les années louées')
  return `Somme, au prorata des mois détenus : ${postes.join(', ')} ; montants revalorisés de ${taux(h.revalorisation_charges)} par an.`
}

/** Colonnes du tableau annuel d'un scénario simulé (§11, écran 6), dans l'ordre d'affichage. */
export function colonnesTableauAnnuel(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Colonne<LigneAnnuelle>[] {
  const c = caracteristiquesScenario(id)
  const e = engagementsScenario(id)
  const h = d.hypotheses
  const f = d.financement
  const is = s.regime === 'is'
  const plafonne = c.niveau_loyer !== null
  const marche = c.meuble ? 'meublé' : 'nu'
  const amortissement = formuleAmortissement(id, p)
  const ps = c.meuble ? p.prelevements_sociaux.location_meublee_non_professionnelle.valeur.total : p.prelevements_sociaux.revenus_fonciers.valeur.total
  const colonnes: (Colonne<LigneAnnuelle> | null)[] = [
    { cle: 'annee', libelle: 'Année', formule: 'Année civile, de la signature à la revente ; la première et la dernière peuvent être incomplètes.', format: 'annee', valeur: (a) => a.annee },
    { cle: 'mois_location', libelle: 'Mois loués', formule: 'Mois de location de l’année, du début de la location à la revente.', format: 'nombre', valeur: (a) => a.mois_location },
    {
      cle: 'loyer_mensuel_retenu',
      libelle: 'Loyer mensuel',
      formule: plafonne
        ? `Loyer de marché ${marche} revalorisé de ${taux(h.revalorisation_loyers)} par an, limité au loyer plafond ${LIBELLES_NIVEAUX[c.niveau_loyer]} revalorisé au même rythme.`
        : `Loyer de marché ${marche} revalorisé de ${taux(h.revalorisation_loyers)} par an.`,
      format: 'euros',
      valeur: (a) => a.loyer_mensuel_retenu,
    },
    {
      cle: 'loyers_encaisses',
      libelle: 'Loyers encaissés',
      formule: `Loyer mensuel × mois loués × (1 − vacance de ${formaterNombre(h.vacance_mois_par_an)} mois par an ÷ ${String(MOIS_PAR_AN)}).`,
      format: 'euros',
      valeur: (a) => a.loyers_encaisses,
    },
    plafonne
      ? {
          cle: 'decote_loyer',
          libelle: 'Manque à gagner du plafond',
          formule: '(Loyer de marché − loyer retenu) × mois loués encaissés.',
          format: 'euros',
          valeur: (a) => a.decote_loyer,
        }
      : null,
    { cle: 'charges_total', libelle: 'Charges', formule: formuleCharges(d, id, p), format: 'euros', valeur: (a) => a.charges_total },
    {
      cle: 'interets',
      libelle: 'Intérêts',
      formule: `Intérêts des mensualités de l’année : capital restant dû × ${taux(f.taux_annuel)} ÷ ${String(MOIS_PAR_AN)}${(f.differe_mois ?? 0) > 0 ? `, différé de ${formaterNombre(f.differe_mois ?? 0)} mois compris` : ''}.`,
      format: 'euros',
      valeur: (a) => a.interets,
    },
    {
      cle: 'assurance_emprunteur',
      libelle: 'Assurance emprunteur',
      formule: `Capital emprunté × ${taux(f.taux_assurance_annuel)} ÷ ${String(MOIS_PAR_AN)}, chaque mois.`,
      format: 'euros',
      valeur: (a) => a.assurance_emprunteur,
    },
    { cle: 'capital_rembourse', libelle: 'Capital remboursé', formule: 'Part de capital des mensualités de l’année.', format: 'euros', valeur: (a) => a.capital_rembourse },
    {
      cle: 'capital_restant_du',
      libelle: 'Capital restant dû',
      formule: 'Capital restant dû après la dernière mensualité de l’année.',
      format: 'euros',
      valeur: (a) => a.capital_restant_du,
    },
    amortissement === null
      ? null
      : { cle: 'amortissement_deduit', libelle: 'Amortissement déduit', formule: amortissement, format: 'euros', valeur: (a) => a.amortissement_deduit },
    { cle: 'resultat_fiscal', libelle: 'Résultat fiscal', formule: formuleResultat(d, id, s, p), format: 'euros', valeur: (a) => a.resultat_fiscal },
    is || c.meuble
      ? null
      : {
          cle: 'deficit_impute_revenu_global',
          libelle: 'Déficit imputé sur le revenu global',
          formule: `Déficit foncier hors intérêts imputé sur le revenu global, au plus ${euros(p.deficit_foncier.plafond_imputation_revenu_global.valeur)} par an et par foyer (écart avec la situation sans l’opération).`,
          format: 'euros',
          valeur: (a) => a.deficit_impute_revenu_global,
        },
    {
      cle: 'deficits_reportables',
      libelle: 'Déficits reportables',
      formule: is
        ? 'Déficits de la SCI reportables sur ses bénéfices suivants.'
        : c.meuble
          ? `Déficits de location meublée en fin d’année, reportables ${formaterNombre(p.lmnp.deficit_report_ans.valeur)} ans sur les bénéfices de même nature ; les amortissements différés, reportables sans limite, n’y figurent pas.`
          : `Déficits fonciers des foyers en fin d’année, avec l’opération et déficits antérieurs compris, reportables ${formaterNombre(p.deficit_foncier.report_revenus_fonciers_ans.valeur)} ans sur les revenus fonciers.`,
      format: 'euros',
      valeur: (a) => a.deficits_reportables,
    },
    e.denormandie === null
      ? null
      : {
          cle: 'reduction_impot_imputee',
          libelle: 'Réduction d’impôt imputée',
          formule: `Réduction Denormandie de l’année, imputée dans la limite de l’impôt et du plafonnement global des niches (${euros(p.impot_revenu.plafonnement_global_niches.valeur)}) ; l’excédent est perdu.`,
          format: 'euros',
          valeur: (a) => a.reduction_impot_imputee,
        },
    e.denormandie === null
      ? null
      : {
          cle: 'reduction_impot_perdue',
          libelle: 'Réduction d’impôt perdue',
          formule: 'Part de la réduction de l’année non imputée, faute d’impôt suffisant ou de plafond des niches disponible.',
          format: 'euros',
          valeur: (a) => a.reduction_impot_perdue,
        },
    is
      ? null
      : {
          cle: 'impot_revenu_differentiel',
          libelle: 'Impôt sur le revenu (écart)',
          formule: `Impôt de chaque foyer avec l’opération − impôt sans l’opération, chaque foyer étant imposé en entier (barème, quotient familial, décote, réductions) ; négatif quand l’opération fait économiser de l’impôt${e.jeanbrun !== null || e.denormandie !== null ? '. L’année de la revente, reprise des avantages comprise en cas de sortie anticipée' : ''}.`,
          format: 'euros',
          valeur: (a) => a.impot_revenu_differentiel,
        },
    is
      ? null
      : {
          cle: 'prelevements_sociaux',
          libelle: 'Prélèvements sociaux (écart)',
          formule: `${taux(ps)} × écart de ${c.meuble ? 'bénéfice de location meublée' : 'revenu foncier'} imposable avec et sans l’opération${e.jeanbrun === null ? '' : ', et sur les amortissements Jeanbrun réintégrés en cas de sortie anticipée'}.`,
          format: 'euros',
          valeur: (a) => a.prelevements_sociaux,
        },
    is
      ? {
          cle: 'impot_societes',
          libelle: 'Impôt sur les sociétés',
          formule: `${taux(p.societe_is.impot_societes.valeur.taux_reduit)} jusqu’à ${euros(p.societe_is.impot_societes.valeur.plafond_benefice_taux_reduit)} de bénéfice, ${taux(p.societe_is.impot_societes.valeur.taux_normal)} au-delà, après imputation des déficits ; l’impôt dû sur la plus-value de cession figure dans la revente.`,
          format: 'euros',
          valeur: (a) => a.impot_societes,
        }
      : null,
    e.lli
      ? {
          cle: 'creance_taxe_fonciere',
          libelle: 'Créance de taxe foncière',
          formule: `Taxe foncière hors TEOM remboursée par une créance pendant ${formaterNombre(p.lli.creance_taxe_fonciere.valeur.duree_ans)} ans à compter de l’achèvement, au prorata de la détention.`,
          format: 'euros',
          valeur: (a) => a.creance_taxe_fonciere,
        }
      : null,
    {
      cle: 'flux_tresorerie',
      libelle: 'Flux après impôt',
      formule: `Loyers − charges − intérêts − assurance emprunteur − capital remboursé${e.lli ? ' + créance de taxe foncière' : ''} − ${is ? 'impôt sur les sociétés' : 'écart d’impôt sur le revenu − écart de prélèvements sociaux'}. Négatif : effort d’épargne.`,
      format: 'euros',
      valeur: (a) => a.flux_tresorerie,
    },
  ]
  return colonnes.filter((x): x is Colonne<LigneAnnuelle> => x !== null)
}

const LIBELLES_CHARGES: Readonly<Record<keyof ChargesAnnee, string>> = {
  taxe_fonciere: 'Taxe foncière',
  copropriete: 'Copropriété',
  assurance_pno: 'Assurance PNO',
  gestion: 'Gestion',
  assurance_loyers_impayes: 'Loyers impayés',
  entretien: 'Entretien',
  frais_gestion_forfaitaires: 'Frais forfaitaires',
  frais_sci: 'Frais de SCI',
  comptable_et_cfe: 'Comptable et CFE',
}

/** Détail des charges par poste, pour les exports. */
export function colonnesDetailCharges(): Colonne<LigneAnnuelle>[] {
  return (Object.keys(LIBELLES_CHARGES) as (keyof ChargesAnnee)[]).map((cle) => ({
    cle: `charges.${cle}`,
    libelle: LIBELLES_CHARGES[cle],
    formule: `Poste « ${LIBELLES_CHARGES[cle]} » des charges de l’année.`,
    format: 'euros',
    valeur: (a: LigneAnnuelle) => a.charges[cle],
  }))
}

/** Postes de la revente (§8.6), de son prix à son produit net. */
export function lignesSortie(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Colonne<SortieScenario>[] {
  const h = d.hypotheses
  const e = engagementsScenario(id)
  const ancien = d.bien.etat === 'ancien'
  const pv = p.plus_value_immobiliere
  const ira = p.financement.indemnites_remboursement_anticipe_plafond.valeur
  const lignes: (Colonne<SortieScenario> | null)[] = [
    {
      cle: 'prix_revente',
      libelle: 'Prix de revente',
      formule: ancien
        ? `(Prix d’achat + travaux) × (1 + ${taux(h.prix.revalorisation_annuelle)}) puissance la durée de détention.`
        : `Prix TTC au taux normal de ${taux(p.lli.tva_taux_normal.valeur)} × (1 − décote du neuf de ${taux(h.prix.decote_neuf)}) × (1 + ${taux(h.prix.revalorisation_annuelle)}) puissance la durée de détention.`,
      format: 'euros',
      valeur: (o) => o.prix_revente,
    },
    { cle: 'frais_cession', libelle: 'Frais de cession', formule: `${taux(h.frais_cession)} du prix de revente.`, format: 'euros', valeur: (o) => o.frais_cession },
    { cle: 'capital_restant_du', libelle: 'Capital restant dû', formule: 'Capital restant dû remboursé à la revente.', format: 'euros', valeur: (o) => o.capital_restant_du },
    {
      cle: 'indemnites_remboursement_anticipe',
      libelle: 'Indemnités de remboursement anticipé',
      formule: h.ira_appliquees
        ? `Au plus ${formaterNombre(ira.mois_interets)} mois d’intérêts ou ${taux(ira.part_capital_restant_du)} du capital restant dû.`
        : 'Non appliquées (hypothèse du dossier).',
      format: 'euros',
      valeur: (o) => o.indemnites_remboursement_anticipe,
    },
    {
      cle: 'impot_plus_value',
      libelle: 'Impôt de plus-value',
      formule:
        s.regime === 'is'
          ? 'Plus-value professionnelle de la SCI soumise à l’impôt sur les sociétés (variante indicative).'
          : `Plus-value des particuliers : ${taux(pv.taux_ir.valeur)} d’impôt et ${taux(p.prelevements_sociaux.plus_values_immobilieres.valeur.total)} de prélèvements sociaux après abattements pour durée de détention, surtaxe au-delà de ${euros(pv.surtaxe_plus_values_elevees.valeur.seuil)}.`,
      format: 'euros',
      valeur: (o) => o.impot_plus_value,
    },
    s.regime === 'is'
      ? null
      : {
          cle: 'impot_plus_value_reintegration',
          libelle: 'dont amortissements réintégrés',
          formule: 'Impôt de plus-value avec la réintégration des amortissements déduits − impôt sans cette réintégration.',
          format: 'euros',
          valeur: (o) => o.impot_plus_value_reintegration,
        },
    e.lli
      ? {
          cle: 'complement_tva',
          libelle: 'Complément de TVA',
          formule: `Prix HT × (${taux(p.lli.tva_taux_normal.valeur)} − ${taux(p.lli.tva_taux_reduit.valeur)}), dû pour une revente pendant les ${formaterNombre(p.lli.complement_tva.valeur.fin_periode_cession_partielle)} premières années.`,
          format: 'euros',
          valeur: (o) => o.complement_tva,
        }
      : null,
    e.jeanbrun === null
      ? null
      : {
          cle: 'reprise_jeanbrun',
          libelle: 'Reprise Jeanbrun (compris dans la dernière année)',
          formule: `Revente avant ${formaterNombre(p.jeanbrun.duree_engagement_ans.valeur)} ans de location : amortissements déduits réintégrés au revenu (système du quotient) et prélèvements sociaux.`,
          format: 'euros',
          valeur: (o) => o.reprise_jeanbrun,
        },
    e.denormandie === null
      ? null
      : {
          cle: 'reprise_denormandie',
          libelle: 'Reprise Denormandie (compris dans la dernière année)',
          formule: 'Réductions déjà obtenues reprises en cas de revente avant la fin de l’engagement de location.',
          format: 'euros',
          valeur: (o) => o.reprise_denormandie,
        },
    s.regime === 'is'
      ? {
          cle: 'impot_distribution',
          libelle: 'Impôt sur la distribution',
          formule: `Prélèvement forfaitaire unique sur les résultats nets cumulés distribués à la sortie : ${taux(p.placement_reference.pfu_taux_ir.valeur)} d’impôt et ${taux(p.prelevements_sociaux.placements.valeur.cas_general)} de prélèvements sociaux.`,
          format: 'euros',
          valeur: (o) => o.impot_distribution,
        }
      : null,
    {
      cle: 'produit_net',
      libelle: 'Produit net de la revente',
      formule: `Prix − frais de cession − capital restant dû − indemnités − impôt de plus-value${e.lli ? ' − complément de TVA' : ''}${s.regime === 'is' ? ' − impôt sur la distribution' : ''}.`,
      format: 'euros',
      valeur: (o) => o.produit_net,
    },
  ]
  return lignes.filter((x): x is Colonne<SortieScenario> => x !== null)
}

/** Indicateurs du tableau de comparaison (§9), avec leur formule en clair. */
export function lignesIndicateurs(d: Dossier, p: ParametresFiscaux): Colonne<Indicateurs>[] {
  const h = d.hypotheses
  const moisInitiaux = ANNEES_EFFORT_INITIAL * MOIS_PAR_AN
  return [
    {
      cle: 'effort_mensuel_premieres_annees',
      libelle: `Effort mensuel (${String(ANNEES_EFFORT_INITIAL)} premières années)`,
      formule: `Moyenne de −flux après impôt sur les ${String(moisInitiaux)} premiers mois de détention (tableau annuel, colonne « Flux après impôt »).`,
      format: 'euros',
      valeur: (i) => i.effort_mensuel_premieres_annees,
    },
    {
      cle: 'effort_mensuel_moyen',
      libelle: 'Effort mensuel moyen',
      formule: '−Somme des flux après impôt ÷ mois de détention.',
      format: 'euros',
      valeur: (i) => i.effort_mensuel_moyen,
    },
    {
      cle: 'effort_mensuel_pire',
      libelle: 'Effort mensuel de la pire année',
      formule: 'Plus fort −flux après impôt de l’année ÷ mois de détention de l’année.',
      format: 'euros',
      valeur: (i) => i.effort_mensuel_pire,
    },
    { cle: 'pire_annee', libelle: 'Pire année', formule: 'Année de l’effort mensuel le plus fort.', format: 'annee', valeur: (i) => i.pire_annee },
    {
      cle: 'economie_impot_cumulee',
      libelle: 'Économie d’impôt cumulée',
      formule: '−Somme des écarts d’impôt sur le revenu et de prélèvements sociaux pendant la détention, hors reprises à la revente.',
      format: 'euros',
      valeur: (i) => i.economie_impot_cumulee,
    },
    {
      cle: 'reprise_a_la_revente',
      libelle: 'Reprise à la revente',
      formule: 'Impôt de plus-value dû aux amortissements réintégrés + reprises Jeanbrun et Denormandie (tableau de la revente).',
      format: 'euros',
      valeur: (i) => i.reprise_a_la_revente,
    },
    {
      cle: 'economie_impot_nette',
      libelle: 'Économie d’impôt nette',
      formule: 'Économie d’impôt cumulée − reprise à la revente.',
      format: 'euros',
      valeur: (i) => i.economie_impot_nette,
    },
    {
      cle: 'tva_economisee',
      libelle: 'TVA économisée',
      formule: `Logement neuf : prix TTC au taux normal de ${taux(p.lli.tva_taux_normal.valeur)} − prix d’acquisition payé.`,
      format: 'euros',
      valeur: (i) => i.tva_economisee,
    },
    {
      cle: 'creance_taxe_fonciere_cumulee',
      libelle: 'Taxe foncière remboursée',
      formule: 'Somme des créances de taxe foncière du LLI (tableau annuel).',
      format: 'euros',
      valeur: (i) => i.creance_taxe_fonciere_cumulee,
    },
    {
      cle: 'decote_loyer_cumulee',
      libelle: 'Manque à gagner du plafond de loyer',
      formule: 'Somme du manque à gagner du plafond (tableau annuel).',
      format: 'euros',
      valeur: (i) => i.decote_loyer_cumulee,
    },
    {
      cle: 'rendement_brut',
      libelle: 'Rendement brut',
      formule: `Loyer mensuel × ${String(MOIS_PAR_AN)} ÷ prix d’acquisition, première année de location complète.`,
      format: 'taux',
      valeur: (i) => i.rendement_brut,
    },
    {
      cle: 'rendement_net_de_charges',
      libelle: 'Rendement net de charges',
      formule: '(Loyers encaissés − charges) de la même année, annualisés ÷ coût total de l’opération.',
      format: 'taux',
      valeur: (i) => i.rendement_net_de_charges,
    },
    {
      cle: 'rendement_net_net',
      libelle: 'Rendement net-net',
      formule: '(Loyers − charges − impôts de l’année + créance de taxe foncière), annualisés ÷ coût total.',
      format: 'taux',
      valeur: (i) => i.rendement_net_net,
    },
    {
      cle: 'tri',
      libelle: 'TRI après impôt',
      formule: 'Taux qui annule la valeur actuelle des flux : fonds propres versés à la signature, flux après impôt de chaque année (milieu de période), produit net de la revente.',
      format: 'taux',
      valeur: (i) => i.tri,
    },
    {
      cle: 'van',
      libelle: 'VAN',
      formule: `Valeur actuelle des mêmes flux au rendement du placement de référence (${taux(h.rendement_placement)}).`,
      format: 'euros',
      valeur: (i) => i.van,
    },
    { cle: 'capital_net_sortie', libelle: 'Capital net à la sortie', formule: 'Produit net de la revente (tableau de la revente).', format: 'euros', valeur: (i) => i.capital_net_sortie },
    {
      cle: 'enrichissement_net',
      libelle: 'Enrichissement net',
      formule: 'Somme des flux non actualisés : −fonds propres + flux annuels après impôt + produit net de la revente.',
      format: 'euros',
      valeur: (i) => i.enrichissement_net,
    },
    {
      cle: 'tri_placement',
      libelle: 'TRI du placement équivalent',
      formule: `Mêmes versements (fonds propres, puis efforts d’épargne) placés à ${taux(h.rendement_placement)} dans l’enveloppe choisie, après sa fiscalité.`,
      format: 'taux',
      valeur: (i) => i.tri_placement,
    },
    {
      cle: 'ecart_capital_placement',
      libelle: 'Écart de capital au placement',
      formule: 'Capital net à la sortie − capital net du placement équivalent.',
      format: 'euros',
      valeur: (i) => i.ecart_capital_placement,
    },
    {
      cle: 'date_sortie_sans_penalite',
      libelle: 'Revente sans pénalité à partir du',
      formule: 'Fin des engagements du scénario (Jeanbrun, LLI ou Denormandie) ; aucune date sans engagement.',
      format: 'date',
      valeur: (i) => i.date_sortie_sans_penalite,
    },
    {
      cle: 'duree_blocage_ans',
      libelle: 'Durée de blocage',
      formule: 'Années entre le début de la location et la revente sans pénalité.',
      format: 'annees',
      valeur: (i) => i.duree_blocage_ans,
    },
    {
      cle: 'taux_endettement_apres',
      libelle: 'Taux d’endettement après opération',
      formule: `(Crédits en cours + mensualité et assurance du prêt) ÷ revenus imposables mensuels, hors loyers ; seuil de ${taux(p.financement.taux_endettement_max.valeur)}.`,
      format: 'taux',
      valeur: (i) => i.taux_endettement_apres,
    },
  ]
}

/** Régime fiscal des loyers retenu par la simulation, pour l'en-tête du détail. */
export function libelleRegime(s: ResultatSimulation): string {
  return regimeLoyers(s)
}
