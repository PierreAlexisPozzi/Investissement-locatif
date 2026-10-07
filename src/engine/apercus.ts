/**
 * Aperçus calculés en direct pendant la saisie (§11, écrans 1 et 2) : situation
 * fiscale de chaque foyer sans l'opération, loyers plafonds et coefficient de
 * surface du bien, éligibilité de chaque scénario avec son motif.
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument.
 */
import type { ParametresFiscaux } from '../params'
import type { Eligibilite } from './commun'
import { anomaliesDossier, type Dossier } from './dossier'
import { calculerImpot, calculerRevenuGlobal, type DetailImpot } from './impot-revenu'
import { tauxEndettementActuel } from './indicateurs'
import { prixTtc } from './lli'
import { coefficientSurface, plafondLoyer, plafondLoyerIntermediaire, surfacePriseEnCompte } from './loyer-plafond'
import { revenuFoncierMicro, revenuFoncierReel } from './revenus-fonciers'
import { eligibiliteScenario, LIBELLES_SCENARIOS, SCENARIOS, type IdScenario } from './scenario'

export interface SituationFoyer {
  readonly libelle: string
  /** Revenu imposable saisi, hors revenus fonciers. */
  readonly revenu_imposable: number
  /** Revenus fonciers imposables des autres biens, déficits fonciers antérieurs imputés. */
  readonly revenus_fonciers: number
  /** Revenu global net imposé : revenu saisi et revenus fonciers, déficit foncier imputable déduit. */
  readonly revenu_global_net: number
  /** Impôt dû sans l'opération (barème, quotient familial, décote), année des revenus des paramètres. */
  readonly impot: number
  readonly tmi: number
  /** Plafond global des niches restant après les avantages déjà utilisés. */
  readonly niches_disponibles: number
  readonly detail: DetailImpot
}

/**
 * Impôt, tranche marginale et niches disponibles de chaque foyer, sans l'opération (écran 1) : comme la situation
 * de référence du moteur, avec les revenus fonciers des autres biens et les déficits fonciers antérieurs.
 */
export function situationFiscale(d: Dossier, p: ParametresFiscaux): SituationFoyer[] {
  const communes = d.foyers.situation === 'marie_pacse'
  const plafondNiches = p.impot_revenu.plafonnement_global_niches.valeur
  const annee = p.meta.annee_revenus
  return d.foyers.foyers.map((f) => {
    const existants = f.revenus_fonciers_existants
    const deficits = f.deficits_fonciers_existants ?? []
    const foncier =
      existants?.regime === 'micro'
        ? revenuFoncierMicro(annee, existants.recettes, p, { deficits_anterieurs: deficits })
        : revenuFoncierReel(
            { annee, recettes: existants?.recettes ?? 0, charges: { interets: 0, autres_charges: existants?.charges ?? 0 }, deficits_anterieurs: deficits },
            p,
          )
    const global = calculerRevenuGlobal(
      {
        annee,
        revenus_categoriels: Math.max(0, f.revenu_imposable) + foncier.revenu_foncier_imposable,
        deficit_foncier_imputable: 'deficit_imputable_revenu_global' in foncier ? foncier.deficit_imputable_revenu_global : 0,
      },
      p,
    )
    const detail = calculerImpot(global.revenu_global_net, { parts: f.parts, imposition_commune: communes }, p, {
      avantages_niches_deja_utilises: f.avantages_niches_deja_utilises ?? 0,
    })
    return {
      libelle: f.libelle,
      revenu_imposable: f.revenu_imposable,
      revenus_fonciers: foncier.revenu_foncier_imposable,
      revenu_global_net: global.revenu_global_net,
      impot: detail.impot_du,
      tmi: detail.tmi,
      niches_disponibles: Math.max(0, plafondNiches - (f.avantages_niches_deja_utilises ?? 0)),
      detail,
    }
  })
}

export interface EligibiliteAffichee {
  readonly id: IdScenario
  readonly libelle: string
  readonly eligibilite: Eligibilite
}

export interface ApercuBien {
  /** Surface habitable et moitié des annexes plafonnée ; null tant que la surface n'est pas saisie. */
  readonly surface_prise_en_compte: number | null
  readonly coefficient_surface: number | null
  readonly loyer_plafond_intermediaire: number | null
  readonly loyer_plafond_social: number | null
  readonly loyer_plafond_tres_social: number | null
  readonly prix_ttc_taux_normal: number
  readonly prix_ttc_taux_reduit: number
  /** Prix au m² habitable, TTC au taux normal pour le neuf. */
  readonly prix_m2: number | null
  readonly taux_endettement_actuel: number | null
  readonly anomalies: readonly string[]
  readonly eligibilites: readonly EligibiliteAffichee[]
}

/** Loyers plafonds, coefficient de surface, prix et éligibilité de chaque scénario (écran 2). */
export function apercuBien(d: Dossier, p: ParametresFiscaux): ApercuBien {
  const b = d.bien
  const surfaceSaisie = b.surface.habitable > 0
  const surface = surfaceSaisie ? surfacePriseEnCompte(b.surface, p) : null
  const plafondSaisi = (m2: number | undefined): number | null =>
    surfaceSaisie && m2 !== undefined && m2 > 0 ? plafondLoyer(m2, b.surface, p).loyer_plafond_mensuel : null
  const ttcNormal = b.etat === 'ancien' ? b.prix_ht : prixTtc(b.prix_ht, p.lli.tva_taux_normal.valeur)
  const anomalies = anomaliesDossier(d)
  return {
    surface_prise_en_compte: surface,
    coefficient_surface: surface === null ? null : coefficientSurface(surface, p),
    loyer_plafond_intermediaire: surfaceSaisie ? plafondLoyerIntermediaire(b.zone, b.surface, p).loyer_plafond_mensuel : null,
    loyer_plafond_social: plafondSaisi(b.plafonds_m2_loc_avantages?.social),
    loyer_plafond_tres_social: plafondSaisi(b.plafonds_m2_loc_avantages?.tres_social),
    prix_ttc_taux_normal: ttcNormal,
    prix_ttc_taux_reduit: b.etat === 'ancien' ? b.prix_ht : prixTtc(b.prix_ht, p.lli.tva_taux_reduit.valeur),
    prix_m2: surfaceSaisie ? ttcNormal / b.surface.habitable : null,
    taux_endettement_actuel: tauxEndettementActuel(d),
    anomalies,
    eligibilites: anomalies.length > 0 ? [] : SCENARIOS.map((id) => ({ id, libelle: LIBELLES_SCENARIOS[id], eligibilite: eligibiliteEnCours(d, id, p) })),
  }
}

/** Éligibilité pendant la saisie : une donnée encore vide qui empêche une règle de s'appliquer devient un motif. */
function eligibiliteEnCours(d: Dossier, id: IdScenario, p: ParametresFiscaux): Eligibilite {
  try {
    return eligibiliteScenario(d, id, p)
  } catch (erreur) {
    // Seules les erreurs de saisie (valeurs hors domaine) deviennent des motifs ; toute autre erreur reste une anomalie du moteur.
    if (!(erreur instanceof RangeError)) throw erreur
    return { eligible: false, motifs: [`Saisie incomplète : ${erreur.message}`], avertissements: [] }
  }
}
