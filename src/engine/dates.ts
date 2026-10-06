/**
 * Dates civiles au format ISO (AAAA-MM-JJ), sans heure ni fuseau horaire :
 * points de départ, périodes d'éligibilité et durées d'engagement.
 */

export interface DateCivile {
  readonly annee: number
  /** De 1 (janvier) à 12 (décembre). */
  readonly mois: number
  readonly jour: number
}

const FORMAT_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Lit une date ISO ; refuse un format ou un jour invalide (31 avril, 29 février d'une année non bissextile…). */
export function lireDate(iso: string): DateCivile {
  const correspondance = FORMAT_ISO.exec(iso)
  const [, a = '', m = '', j = ''] = correspondance ?? []
  const [annee, mois, jour] = [a, m, j].map(Number) as [number, number, number]
  const controle = new Date(Date.UTC(annee, mois - 1, jour))
  if (
    correspondance === null ||
    controle.getUTCFullYear() !== annee ||
    controle.getUTCMonth() !== mois - 1 ||
    controle.getUTCDate() !== jour
  ) {
    throw new RangeError(`Date invalide, format AAAA-MM-JJ attendu : « ${iso} »`)
  }
  return { annee, mois, jour }
}

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

export function ecrireDate(d: DateCivile): string {
  return `${String(d.annee)}-${deuxChiffres(d.mois)}-${deuxChiffres(d.jour)}`
}

/** Négatif si `a` précède `b`, nul si elles sont égales, positif sinon. */
export function comparerDates(a: string, b: string): number {
  const x = ecrireDate(lireDate(a))
  const y = ecrireDate(lireDate(b))
  return x < y ? -1 : x > y ? 1 : 0
}

/** Même jour, `annees` plus tard ; un 29 février devient un 28 février les années non bissextiles. */
export function ajouterAnnees(iso: string, annees: number): string {
  const d = lireDate(iso)
  const annee = d.annee + annees
  const dernierJourDuMois = new Date(Date.UTC(annee, d.mois, 0)).getUTCDate()
  return ecrireDate({ annee, mois: d.mois, jour: Math.min(d.jour, dernierJourDuMois) })
}

/** Nombre d'années révolues entre deux dates (anniversaires atteints). */
export function anneesRevolues(debut: string, fin: string): number {
  const d = lireDate(debut)
  const f = lireDate(fin)
  const anniversaireAtteint = f.mois > d.mois || (f.mois === d.mois && f.jour >= d.jour)
  return f.annee - d.annee - (anniversaireAtteint ? 0 : 1)
}

/** Rang de l'année en cours à la date `fin`, comptée depuis `debut` : 1 pendant la première année. */
export function rangAnnee(debut: string, fin: string): number {
  return anneesRevolues(debut, fin) + 1
}
