/**
 * Loyer plafond : surface prise en compte (annexes plafonnées), coefficient de
 * surface, arrondis, loyer retenu et manque à gagner par rapport au marché
 * (§6.3, §8.1 point 1).
 *
 * Fonctions pures, sans effet de bord ; les paramètres fiscaux sont reçus en
 * argument.
 */
import type { ParametresFiscaux, Zone } from '../params'
import { arrondir, arrondirCentimes } from './arrondis'

export interface Surface {
  /** Surface habitable (m²). */
  readonly habitable: number
  /** Annexes réservées à l'occupant (cave, balcon, loggia…), hors parkings et garages (m²). */
  readonly annexes?: number
}

/** Surface habitable + moitié des annexes, cette moitié étant plafonnée (BOI-IR-RICI-230-20-20). */
export function surfacePriseEnCompte(s: Surface, p: ParametresFiscaux): number {
  if (!(s.habitable > 0)) throw new RangeError('La surface habitable doit être strictement positive')
  const { part_annexes, plafond_annexes_m2 } = p.loyers_plafonds.surface_prise_en_compte.valeur
  return s.habitable + Math.min(Math.max(0, s.annexes ?? 0) * part_annexes, plafond_annexes_m2)
}

/** Coefficient = constante + numérateur / S, arrondi puis plafonné. */
export function coefficientSurface(surface: number, p: ParametresFiscaux): number {
  const { constante, numerateur, maximum, decimales } = p.loyers_plafonds.coefficient_surface.valeur
  return Math.min(maximum, arrondir(constante + numerateur / surface, decimales))
}

export interface DetailPlafondLoyer {
  readonly surface: number
  readonly coefficient: number
  readonly plafond_m2_bareme: number
  /** Plafond au m² après coefficient, arrondi au centime (arbitrage du 06/10/2026). */
  readonly plafond_m2_ajuste: number
  /** Loyer mensuel maximal, hors charges. */
  readonly loyer_plafond_mensuel: number
}

/** Plafond mensuel pour un barème au m² donné : intermédiaire, ou social et très social saisis par commune. */
export function plafondLoyer(plafondM2: number, s: Surface, p: ParametresFiscaux): DetailPlafondLoyer {
  const surface = surfacePriseEnCompte(s, p)
  const coefficient = coefficientSurface(surface, p)
  const plafondAjuste = arrondir(plafondM2 * coefficient, p.loyers_plafonds.arrondi_plafond_m2.valeur.decimales)
  return {
    surface,
    coefficient,
    plafond_m2_bareme: plafondM2,
    plafond_m2_ajuste: plafondAjuste,
    loyer_plafond_mensuel: arrondirCentimes(plafondAjuste * surface),
  }
}

export function plafondLoyerIntermediaire(zone: Zone, s: Surface, p: ParametresFiscaux): DetailPlafondLoyer {
  return plafondLoyer(p.loyers_plafonds.intermediaire_m2.valeur[zone], s, p)
}

export interface LoyerRetenu {
  readonly loyer_mensuel: number
  /** Vrai lorsque le plafond est inférieur au loyer de marché. */
  readonly plafond_contraignant: boolean
  /** Manque à gagner mensuel par rapport au marché : coût caché du dispositif (§8.1). */
  readonly decote_mensuelle: number
  readonly decote_relative: number
}

/** Loyer retenu = min(loyer de marché, loyer plafond). */
export function loyerRetenu(loyerMarche: number, loyerPlafond: number): LoyerRetenu {
  const loyer = Math.min(loyerMarche, loyerPlafond)
  const decote = loyerMarche - loyer
  return {
    loyer_mensuel: loyer,
    plafond_contraignant: loyerPlafond < loyerMarche,
    decote_mensuelle: decote,
    decote_relative: loyerMarche > 0 ? decote / loyerMarche : 0,
  }
}

export interface CompositionLocataire {
  readonly couple: boolean
  readonly personnes_a_charge: number
}

/** Plafond de ressources du locataire en location intermédiaire (affichage informatif, §6.3). */
export function plafondRessourcesIntermediaire(zone: Zone, c: CompositionLocataire, p: ParametresFiscaux): number {
  const r = p.loyers_plafonds.ressources_locataires_intermediaire.valeur
  if (c.personnes_a_charge <= 0) return (c.couple ? r.couple : r.personne_seule)[zone]
  const parNombre = [
    r.une_personne_a_charge,
    r.deux_personnes_a_charge,
    r.trois_personnes_a_charge,
    r.quatre_personnes_a_charge,
  ]
  const derniere = parNombre.length
  const rang = Math.min(c.personnes_a_charge, derniere)
  const plafond = parNombre[rang - 1]?.[zone] ?? 0
  return plafond + Math.max(0, c.personnes_a_charge - derniere) * r.majoration_par_personne_supplementaire[zone]
}
