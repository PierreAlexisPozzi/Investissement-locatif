/**
 * Mise en forme française des montants, taux et dates cités dans les motifs
 * et avertissements produits par le moteur. Les valeurs viennent toujours des
 * paramètres : aucun seuil n'est écrit en dur dans un texte.
 */
import { lireDate } from './dates'

const EUROS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const TAUX = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 })

/** Montant arrondi à l'euro : « 10 700 € ». */
export function formaterEuros(montant: number): string {
  return EUROS.format(montant)
}

/** Taux décimal en pourcentage : 0.172 → « 17,2 % ». */
export function formaterTaux(taux: number): string {
  return TAUX.format(taux)
}

/** Date ISO au format JJ/MM/AAAA. */
export function formaterDate(iso: string): string {
  const { annee, mois, jour } = lireDate(iso)
  const deuxChiffres = (n: number): string => String(n).padStart(2, '0')
  return `${deuxChiffres(jour)}/${deuxChiffres(mois)}/${String(annee)}`
}

/** Zone de loyer lisible : « A_bis » → « A bis ». */
export function libelleZone(zone: string): string {
  return zone.replace('_', ' ')
}
