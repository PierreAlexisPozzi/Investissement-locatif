/**
 * Questions à poser (§11, écran 9) : liste générée par règles selon le scénario
 * étudié, les alertes de la recommandation, les valeurs à confirmer et, s'il y
 * en a une, la contre-expertise de la simulation du vendeur. Chaque question
 * dit à qui la poser et pourquoi.
 *
 * Fonctions pures ; les chiffres cités viennent des paramètres et du dossier.
 */
import type { ParametresFiscaux } from '../params'
import { listerParametres } from '../params'
import { MOIS_PAR_AN } from './constantes-numeriques'
import type { ContreExpertise } from './contre-expertise'
import type { Dossier } from './dossier'
import { formaterEuros, formaterTaux, LIBELLES_STATUTS } from './format'
import type { Alerte } from './recommandation'
import { caracteristiquesScenario, engagementsScenario, LIBELLES_SCENARIOS, parametresAConfirmer, type IdScenario } from './scenario'

export const INTERLOCUTEURS = ['vendeur', 'notaire', 'expert_comptable', 'banque'] as const
export type Interlocuteur = (typeof INTERLOCUTEURS)[number]

export const LIBELLES_INTERLOCUTEURS: Readonly<Record<Interlocuteur, string>> = {
  vendeur: 'Au vendeur',
  notaire: 'Au notaire',
  expert_comptable: 'À l’expert-comptable',
  banque: 'À la banque',
}

export interface Question {
  readonly interlocuteur: Interlocuteur
  readonly texte: string
  /** Pourquoi la question se pose : règle, alerte, valeur à confirmer ou hypothèse du vendeur. */
  readonly motif: string
  /** Paramètre à confirmer qui motive la question. */
  readonly parametre?: string
}

export interface ContexteQuestions {
  readonly alertes?: readonly Alerte[]
  readonly contre_expertise?: ContreExpertise | null
}

/** Valeurs à confirmer : à qui les soumettre et comment poser la question. */
function questionParametre(chemin: string, p: ParametresFiscaux): { interlocuteur: Interlocuteur; texte: string } {
  const forfait = p.plus_value_immobiliere.forfait_travaux.valeur
  switch (chemin) {
    case 'jeanbrun.prorata_premiere_annee':
      return { interlocuteur: 'expert_comptable', texte: 'Comment calculer la première annuité d’amortissement Jeanbrun : au prorata des mois ?' }
    case 'jeanbrun.plafond_proratise_premiere_annee':
      return {
        interlocuteur: 'expert_comptable',
        texte: 'Le plafond annuel de l’amortissement Jeanbrun est-il proratisé les années incomplètes (première année, année de la revente) ?',
      }
    case 'jeanbrun.concubins_plafond_par_foyer':
      return { interlocuteur: 'notaire', texte: 'Entre concubins coacquéreurs, le plafond Jeanbrun s’applique-t-il à la quote-part de chaque foyer ?' }
    case 'lmnp.modelisation':
      return {
        interlocuteur: 'expert_comptable',
        texte: 'En LMNP, quelle part de terrain, quelles durées d’amortissement et quel traitement des frais d’acquisition retenir ?',
      }
    case 'lmnp.perimetre_reintegration_pv':
      return {
        interlocuteur: 'notaire',
        texte: 'À la revente, les amortissements du mobilier sont-ils réintégrés dans la plus-value, ou seulement ceux de l’immeuble ?',
      }
    case 'lli.tf_deductible_si_creance':
      return {
        interlocuteur: 'expert_comptable',
        texte: 'La taxe foncière qui ouvre droit à la créance du LLI reste-t-elle déductible des revenus fonciers des associés de la SCI ?',
      }
    case 'cumul_jeanbrun_lli.statut_cumul':
      return {
        interlocuteur: 'notaire',
        texte: 'Le cumul du Jeanbrun et du taux réduit de TVA du LLI est-il admis pour ce programme ? Aucune source officielle ne le traite : demander un écrit, voire un rescrit.',
      }
    case 'plus_value_immobiliere.forfait_travaux_bien_neuf_amorti':
      return {
        interlocuteur: 'notaire',
        texte: `Le forfait travaux de ${formaterTaux(forfait.taux)} (détention de plus de ${forfait.detention_superieure_a_ans} ans) s’applique-t-il à la revente d’un logement neuf amorti ?`,
      }
    case 'plus_value_immobiliere.frais_acquisition_deduits_en_charge':
      return {
        interlocuteur: 'notaire',
        texte: 'Les frais d’acquisition passés en charge en LMNP restent-ils retenus, au réel ou au forfait, dans la plus-value ?',
      }
    case 'plus_value_immobiliere.travaux_denormandie_retenus':
      return {
        interlocuteur: 'notaire',
        texte: 'Les travaux compris dans la réduction Denormandie majorent-ils le prix d’acquisition pour la plus-value quand la réduction n’est pas reprise ?',
      }
    case 'sci_ir.frais_constitution_deductibles':
      return { interlocuteur: 'expert_comptable', texte: 'Les frais de constitution de la SCI sont-ils déductibles des revenus fonciers ?' }
    case 'sci_ir.frais_bancaires_couverts_par_forfait':
      return { interlocuteur: 'expert_comptable', texte: 'Les frais bancaires de la SCI sont-ils couverts par le forfait de frais de gestion ?' }
    case 'lli.tva_taux_normal':
      return { interlocuteur: 'notaire', texte: 'Quel taux normal de TVA retenir pour le prix de référence du logement neuf ?' }
    default:
      return { interlocuteur: 'expert_comptable', texte: `Confirmer la règle « ${chemin} » retenue par l’outil.` }
  }
}

/** Questions à poser pour un scénario du dossier, regroupées par interlocuteur dans l'ordre de `INTERLOCUTEURS`. */
export function questionsAPoser(d: Dossier, id: IdScenario, p: ParametresFiscaux, contexte: ContexteQuestions = {}): Question[] {
  const questions: Question[] = []
  const ajouter = (interlocuteur: Interlocuteur, texte: string, motif: string, parametre?: string): void => {
    questions.push(parametre === undefined ? { interlocuteur, texte, motif } : { interlocuteur, texte, motif, parametre })
  }
  const b = d.bien
  const caracteristiques = caracteristiquesScenario(id)
  const engagements = engagementsScenario(id)
  const neuf = b.etat !== 'ancien'
  const nom = `${id} (${LIBELLES_SCENARIOS[id]})`
  // Une alerte sans scénario désigné vaut pour tous.
  const concerne = (a: Alerte): boolean => a.scenarios.length === 0 || a.scenarios.includes(id)

  // Au vendeur.
  if (neuf) {
    ajouter('vendeur', 'Le prix comprend-il le parking et les annexes ? Quel est le prix au m² habitable hors parking ?', 'Comparaison avec le prix de l’ancien récent du quartier')
  }
  if (b.etat === 'vefa') {
    ajouter('vendeur', 'Quelle date de livraison le contrat garantit-il, et quelles pénalités de retard prévoit-il ?', 'La livraison fixe le début de la location et des avantages fiscaux')
  }
  ajouter(
    'vendeur',
    'Sur quelles références de marché repose le loyer annoncé ?',
    `Loyer de marché constaté au dossier : ${formaterEuros(caracteristiques.meuble ? b.loyer_marche_meuble : b.loyer_marche_nu)} par mois`,
  )
  if (engagements.jeanbrun !== null) {
    ajouter(
      'vendeur',
      'Le logement remplit-il toutes les conditions du Jeanbrun (immeuble collectif, loyer et ressources plafonnés, mise en location dans les délais) ?',
      `Engagement de location de ${p.jeanbrun.duree_engagement_ans.valeur} ans à respecter sous peine de reprise`,
    )
  }
  if (engagements.lli) {
    ajouter(
      'vendeur',
      `Le programme compte-t-il au moins ${formaterTaux(p.lli.mixite_sociale_seuil.valeur)} de logements sociaux ? Pouvez-vous en fournir la preuve ?`,
      'Condition du taux réduit de TVA du LLI',
    )
    ajouter(
      'vendeur',
      `Qui gérera la SCI et la location intermédiaire pendant ${p.lli.duree_conditions_ans.valeur} ans ?`,
      'Les conditions du LLI s’imposent sur toute la durée',
    )
  }
  for (const a of contexte.alertes ?? []) {
    if (a.code === 'prix_neuf_eleve') ajouter('vendeur', 'Comment justifiez-vous l’écart de prix avec l’ancien récent du quartier ?', a.message)
    if (a.code === 'plafond_superieur_marche' && concerne(a)) {
      ajouter('vendeur', 'Le loyer annoncé est-il le loyer plafond ? Trouve-t-il preneur au-dessus du marché constaté ?', a.message)
    }
  }
  for (const h of contexte.contre_expertise?.hypotheses_optimistes ?? []) {
    ajouter('vendeur', 'Sur quelle base votre simulation retient-elle cette hypothèse ?', h.message)
  }

  // Valeurs à confirmer du scénario : au notaire ou à l'expert-comptable.
  const parametres = new Map(listerParametres(p).map((e) => [e.chemin, e.parametre]))
  for (const chemin of parametresAConfirmer(d, id, p)) {
    const { interlocuteur, texte } = questionParametre(chemin, p)
    const parametre = parametres.get(chemin)
    ajouter(interlocuteur, texte, `Paramètre ${chemin}${parametre === undefined ? '' : ` : ${LIBELLES_STATUTS[parametre.statut]}`}`, chemin)
  }

  // Au notaire.
  if (d.foyers.situation === 'concubins') {
    ajouter('notaire', 'Comment rédiger l’acte et la convention d’indivision pour fixer les quotes-parts de chacun ?', 'Achat à deux foyers fiscaux')
  }
  if (caracteristiques.detention !== 'nom_propre') {
    ajouter('notaire', 'Quels statuts de SCI prévoir (objet, gérance, cession des parts, transmission) ?', `${nom} se détient en SCI`)
  }

  // À l'expert-comptable.
  if (caracteristiques.meuble) {
    ajouter(
      'expert_comptable',
      'Quel régime retenir (micro-BIC ou réel), et que coûtent la tenue de la comptabilité et la CFE ?',
      'Location meublée : régime à choisir chaque année',
    )
    if (d.foyers.foyers.length > 1 && p.lmnp.micro_bic_exclu_indivision.valeur) {
      ajouter(
        'expert_comptable',
        'Le micro-BIC étant exclu en indivision, comment organiser la déclaration au réel de chaque foyer et que coûtera-t-elle ?',
        `Indivision entre plusieurs foyers : ${p.lmnp.micro_bic_exclu_indivision.source}`,
      )
    }
  }
  if (caracteristiques.detention === 'sci_is') {
    ajouter('expert_comptable', 'La variante à l’IS est simplifiée dans l’outil : pouvez-vous chiffrer l’IS, l’amortissement et la distribution ?', 'SCI à l’IS indicative')
  }

  // À la banque.
  const f = d.financement
  if (f.emprunt > 0) {
    ajouter(
      'banque',
      'Quel est le TAEG, assurance et frais de dossier et de garantie compris ?',
      `Prêt de ${formaterEuros(f.emprunt)} à ${formaterTaux(f.taux_annuel)} sur ${f.duree_mois / MOIS_PAR_AN} ans`,
    )
    ajouter(
      'banque',
      'Quelles indemnités de remboursement anticipé s’appliqueraient en cas de revente avant le terme du prêt ?',
      'La revente prévue peut intervenir avant la fin du prêt',
    )
    ajouter(
      'banque',
      'Quel taux d’endettement retenez-vous, et quelle part des loyers futurs prenez-vous en compte ?',
      `Seuil de ${formaterTaux(p.financement.taux_endettement_max.valeur)} du Haut Conseil de stabilité financière`,
    )
    if (b.etat === 'vefa' && (f.differe_mois ?? 0) > 0) {
      ajouter('banque', 'Comment sont calculés les intérêts intercalaires et l’assurance pendant la construction ?', `Différé de ${f.differe_mois ?? 0} mois`)
    }
  }
  for (const a of contexte.alertes ?? []) {
    if (a.code === 'apport_insuffisant' && concerne(a)) {
      ajouter('banque', 'Pouvez-vous financer les frais d’acquisition au-delà de notre apport ?', a.message)
    }
  }

  const ordre = (q: Question): number => INTERLOCUTEURS.indexOf(q.interlocuteur)
  return questions.map((q, k) => ({ q, k })).sort((a, b) => ordre(a.q) - ordre(b.q) || a.k - b.k).map(({ q }) => q)
}
