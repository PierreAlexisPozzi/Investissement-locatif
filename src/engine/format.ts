/**
 * Mise en forme française des montants, taux et dates cités dans les motifs
 * et avertissements produits par le moteur. Les valeurs viennent toujours des
 * paramètres : aucun seuil n'est écrit en dur dans un texte.
 */
import type { StatutParametre } from '../params'
import { lireDate } from './dates'

const EUROS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const TAUX = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 })
const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/** Montant arrondi à l'euro : « 10 700 € ». */
export function formaterEuros(montant: number): string {
  return EUROS.format(montant)
}

/** Taux décimal en pourcentage : 0.172 → « 17,2 % ». */
export function formaterTaux(taux: number): string {
  return TAUX.format(taux)
}

/** Taux éventuellement indéterminé (TRI sans solution) : « non calculable ». */
export function formaterTauxCalcule(taux: number | null | undefined): string {
  return taux === null || taux === undefined ? 'non calculable' : formaterTaux(taux)
}

/** Nombre décimal à la française : 0.5 → « 0,5 ». */
export function formaterNombre(n: number): string {
  return NOMBRE.format(n)
}

/** Date ISO au format JJ/MM/AAAA. */
export function formaterDate(iso: string): string {
  const { annee, mois, jour } = lireDate(iso)
  const deuxChiffres = (n: number): string => String(n).padStart(2, '0')
  return `${deuxChiffres(jour)}/${deuxChiffres(mois)}/${String(annee)}`
}

/** Statut d'un paramètre en clair (badges de l'interface, motifs des questions). */
export const LIBELLES_STATUTS: Readonly<Record<StatutParametre, string>> = {
  verifie: 'vérifié',
  texte_non_consulte: 'texte non consulté',
  a_confirmer: 'à confirmer',
}

/** Zone de loyer lisible : « A_bis » → « A bis ». */
export function libelleZone(zone: string): string {
  return zone.replace('_', ' ')
}
