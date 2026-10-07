/**
 * Affichage des valeurs du moteur selon leur format (montant, taux, année,
 * date). Reprend les formats français du moteur ; aucun calcul fiscal.
 */
import { formaterDate, formaterEuros, formaterNombre, formaterTauxCalcule } from '../engine/format'
import type { FormatValeur } from '../engine/presentation'

export { formaterDate, formaterEuros, formaterNombre, formaterTaux, formaterTauxCalcule, libelleZone } from '../engine/format'

/** Valeur affichée ; « — » pour une valeur absente. */
export function afficher(valeur: number | string | null | undefined, format: FormatValeur): string {
  if (valeur === null || valeur === undefined) return format === 'taux' ? formaterTauxCalcule(null) : '—'
  if (typeof valeur === 'string') return format === 'date' ? formaterDate(valeur) : valeur
  if (!Number.isFinite(valeur)) return '—'
  switch (format) {
    case 'euros':
      return formaterEuros(valeur)
    case 'taux':
      return formaterTauxCalcule(valeur)
    case 'annee':
      return String(valeur)
    case 'annees':
      return `${formaterNombre(valeur)} ans`
    case 'nombre':
    case 'date':
      return formaterNombre(valeur)
  }
}

/** Écart entre deux taux, en points de pourcentage : 0,0054 → « 0,54 point ». */
export function formaterPoints(ecart: number | null | undefined): string {
  if (ecart === null || ecart === undefined || !Number.isFinite(ecart)) return formaterTauxCalcule(null)
  const points = ecart * 100
  return `${formaterNombre(points)} ${Math.abs(points) >= 2 ? 'points' : 'point'}`
}

/** Montant mensuel : « 512 €/mois ». */
export function eurosParMois(montant: number): string {
  return `${formaterEuros(montant)}/mois`
}

/** Date du jour au format ISO, dans le fuseau du navigateur. */
export function dateDuJour(maintenant: Date): string {
  const deuxChiffres = (n: number): string => String(n).padStart(2, '0')
  return `${String(maintenant.getFullYear())}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`
}
