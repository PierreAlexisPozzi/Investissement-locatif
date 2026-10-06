/**
 * Placement de référence (S6) : les mêmes décaissements nets que le scénario
 * immobilier comparé, placés au rendement paramétré, avec la fiscalité de
 * sortie de l'enveloppe choisie (§5.5, §8.7). C'est le coût d'opportunité.
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument. Conventions (simplifications listées dans HYPOTHESES.md) :
 * - versement initial au début de la première année, versements de l'année
 *   répartis en fin de mois, capitalisation mensuelle au taux équivalent ;
 * - un flux négatif est un retrait, sans imposition au moment du retrait ;
 * - impôt et prélèvements sociaux calculés en une fois au rachat total, à
 *   l'horizon, sur le gain cumulé ;
 * - PEA : versements au-delà du plafond par titulaire placés sur un compte-titres.
 */
import type { EnveloppePlacement, ParametresFiscaux } from '../params'
import { MOIS_PAR_AN } from './constantes-numeriques'
import { formaterEuros } from './format'

export interface EntreePlacement {
  /** Apport et frais d'acquisition du scénario comparé, placés au début de la première année. */
  readonly versement_initial: number
  /** Versements nets de chaque année, de la première à l'horizon ; négatifs pour un retrait. */
  readonly versements_annuels: readonly number[]
  /** Mois de placement de chaque année (années civiles partielles) ; 12 par défaut. */
  readonly mois_par_annee?: readonly number[]
  /** Rendement annuel net de frais, avant fiscalité. */
  readonly rendement_annuel: number
  readonly enveloppe: EnveloppePlacement
  /** Couple soumis à imposition commune : abattement de l'assurance-vie doublé, deux titulaires de PEA. */
  readonly couple: boolean
  /** Primes déjà versées sur d'autres contrats d'assurance-vie, pour le seuil du taux réduit. */
  readonly primes_assurance_vie_existantes?: number
}

export interface AnneePlacement {
  /** Rang de l'année : 1 pour la première. */
  readonly rang: number
  readonly versements: number
  readonly capital_fin: number
  /** Part du capital sur un compte-titres (excédent du plafond du PEA). */
  readonly dont_compte_titres: number
}

export interface ResultatPlacement {
  readonly annees: readonly AnneePlacement[]
  readonly versements_nets: number
  readonly capital_brut: number
  readonly gain: number
  readonly impot_revenu: number
  readonly prelevements_sociaux: number
  /** Capital disponible après rachat total et fiscalité de sortie. */
  readonly capital_net: number
  readonly alertes: readonly string[]
}

interface Poche {
  capital: number
  versementsNets: number
}

interface FiscaliteSortie {
  readonly impot_revenu: number
  readonly prelevements_sociaux: number
}

function fiscaliteCompteTitres(gain: number, p: ParametresFiscaux): FiscaliteSortie {
  const g = Math.max(0, gain)
  return {
    impot_revenu: g * p.placement_reference.pfu_taux_ir.valeur,
    prelevements_sociaux: g * p.prelevements_sociaux.placements.valeur.cas_general,
  }
}

function fiscalitePea(gain: number, dureeAns: number, p: ParametresFiscaux): FiscaliteSortie {
  const g = Math.max(0, gain)
  const exonere = dureeAns >= p.placement_reference.pea.valeur.duree_exoneration_ir_ans
  return {
    impot_revenu: exonere ? 0 : g * p.placement_reference.pfu_taux_ir.valeur,
    prelevements_sociaux: g * p.prelevements_sociaux.placements.valeur.cas_general,
  }
}

function fiscaliteAssuranceVie(
  gain: number,
  dureeAns: number,
  primesContrat: number,
  e: EntreePlacement,
  p: ParametresFiscaux,
): FiscaliteSortie {
  const av = p.placement_reference.assurance_vie.valeur
  const g = Math.max(0, gain)
  const prelevements = g * p.prelevements_sociaux.placements.valeur.assurance_vie
  if (dureeAns < av.duree_avantage_ans) {
    return { impot_revenu: g * av.taux_ir_avant_8_ans, prelevements_sociaux: prelevements }
  }
  const abattement = e.couple ? av.abattement_couple : av.abattement_personne_seule
  const imposable = Math.max(0, g - abattement)
  // Taux réduit sur la fraction des gains correspondant aux primes sous le seuil, tous contrats confondus.
  const seuilRestant = Math.max(0, av.seuil_primes - (e.primes_assurance_vie_existantes ?? 0))
  const fractionReduite = primesContrat > 0 ? Math.min(1, seuilRestant / primesContrat) : 1
  const taux = fractionReduite * av.taux_ir_primes_jusqua_seuil + (1 - fractionReduite) * av.taux_ir_primes_au_dela
  return { impot_revenu: imposable * taux, prelevements_sociaux: prelevements }
}

export function simulerPlacement(e: EntreePlacement, p: ParametresFiscaux): ResultatPlacement {
  const tauxMensuel = (1 + e.rendement_annuel) ** (1 / MOIS_PAR_AN) - 1
  const pea = e.enveloppe === 'pea'
  const titulaires = e.couple ? 2 : 1
  const plafondPea = pea ? p.placement_reference.pea.valeur.plafond_versements * titulaires : Number.POSITIVE_INFINITY
  const principale: Poche = { capital: 0, versementsNets: 0 }
  const compteTitres: Poche = { capital: 0, versementsNets: 0 }
  let versementsPea = 0
  let primesContrat = 0

  const verser = (montant: number): void => {
    if (montant >= 0) {
      const versable = Math.min(montant, Math.max(0, plafondPea - versementsPea))
      versementsPea += versable
      primesContrat += montant
      principale.capital += versable
      principale.versementsNets += versable
      compteTitres.capital += montant - versable
      compteTitres.versementsNets += montant - versable
      return
    }
    // Retrait : sur le compte-titres d'abord, puis sur l'enveloppe principale.
    const surCompteTitres = Math.min(-montant, Math.max(0, compteTitres.capital))
    compteTitres.capital -= surCompteTitres
    compteTitres.versementsNets -= surCompteTitres
    principale.capital -= -montant - surCompteTitres
    principale.versementsNets -= -montant - surCompteTitres
  }

  verser(e.versement_initial)
  const annees: AnneePlacement[] = []
  e.versements_annuels.forEach((versementAnnuel, i) => {
    const moisDeLAnnee = e.mois_par_annee?.[i] ?? MOIS_PAR_AN
    for (let mois = 0; mois < moisDeLAnnee; mois++) {
      principale.capital *= 1 + tauxMensuel
      compteTitres.capital *= 1 + tauxMensuel
      verser(versementAnnuel / moisDeLAnnee)
    }
    annees.push({
      rang: i + 1,
      versements: versementAnnuel,
      capital_fin: principale.capital + compteTitres.capital,
      dont_compte_titres: compteTitres.capital,
    })
  })

  const duree = e.versements_annuels.reduce((total, _, i) => total + (e.mois_par_annee?.[i] ?? MOIS_PAR_AN), 0) / MOIS_PAR_AN
  const gainPrincipal = principale.capital - principale.versementsNets
  const gainCompteTitres = compteTitres.capital - compteTitres.versementsNets
  const fiscalitePrincipale =
    e.enveloppe === 'pea'
      ? fiscalitePea(gainPrincipal, duree, p)
      : e.enveloppe === 'assurance_vie'
        ? fiscaliteAssuranceVie(gainPrincipal, duree, primesContrat, e, p)
        : fiscaliteCompteTitres(gainPrincipal, p)
  const fiscaliteExcedent = fiscaliteCompteTitres(gainCompteTitres, p)
  const impot = fiscalitePrincipale.impot_revenu + fiscaliteExcedent.impot_revenu
  const prelevements = fiscalitePrincipale.prelevements_sociaux + fiscaliteExcedent.prelevements_sociaux
  const capitalBrut = principale.capital + compteTitres.capital

  const alertes: string[] = []
  if (primesContrat > plafondPea) {
    alertes.push(
      `Versements au-delà du plafond du PEA (${formaterEuros(p.placement_reference.pea.valeur.plafond_versements)} par titulaire) : l’excédent est placé sur un compte-titres`,
    )
  }
  if (annees.some((a) => a.capital_fin < 0)) {
    alertes.push('Les retraits dépassent le capital placé : le placement de référence devient négatif')
  }

  return {
    annees,
    versements_nets: principale.versementsNets + compteTitres.versementsNets,
    capital_brut: capitalBrut,
    gain: gainPrincipal + gainCompteTitres,
    impot_revenu: impot,
    prelevements_sociaux: prelevements,
    capital_net: capitalBrut - impot - prelevements,
    alertes,
  }
}
