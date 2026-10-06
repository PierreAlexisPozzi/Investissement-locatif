/**
 * Stocks de déficits reportables, tenus par année d'origine (millésime).
 * Sert au déficit foncier (10 ans), au déficit global (6 ans) et, à l'étape 3,
 * au déficit de location meublée (10 ans).
 */

export interface Millesime {
  /** Année au titre de laquelle le déficit est né. */
  readonly annee: number
  readonly montant: number
}

export interface ImputationDeficits {
  /** Montant imputé sur le revenu de l'année. */
  readonly impute: number
  /** Montant imputé par millésime, du plus ancien au plus récent. */
  readonly detail: readonly Millesime[]
  /** Déficits arrivés à péremption avant l'imputation. */
  readonly perime: number
  /** Stock restant après imputation. */
  readonly stock: readonly Millesime[]
}

export function totalStock(stock: readonly Millesime[]): number {
  return stock.reduce((total, m) => total + m.montant, 0)
}

/** Ajoute le déficit né en `annee` au stock (sans effet si le montant est nul ou négatif). */
export function ajouterDeficit(stock: readonly Millesime[], annee: number, montant: number): Millesime[] {
  if (montant <= 0) return [...stock]
  const existant = stock.find((m) => m.annee === annee)
  const autres = stock.filter((m) => m.annee !== annee)
  const ajoute = { annee, montant: montant + (existant?.montant ?? 0) }
  return [...autres, ajoute].sort((a, b) => a.annee - b.annee)
}

/**
 * Impute le stock sur un revenu positif de l'année `annee`, du plus ancien au
 * plus récent. Un déficit né en A est imputable sur les revenus des années
 * A + 1 à A + dureeReportAns ; au-delà, il est périmé.
 */
export function imputerDeficits(
  stock: readonly Millesime[],
  revenu: number,
  annee: number,
  dureeReportAns: number,
): ImputationDeficits {
  const perimes = stock.filter((m) => annee - m.annee > dureeReportAns)
  const vivants = stock.filter((m) => annee - m.annee <= dureeReportAns).sort((a, b) => a.annee - b.annee)

  let disponible = Math.max(0, revenu)
  const detail: Millesime[] = []
  const restant: Millesime[] = []
  for (const m of vivants) {
    const imputable = m.annee < annee ? Math.min(m.montant, disponible) : 0
    if (imputable > 0) {
      detail.push({ annee: m.annee, montant: imputable })
      disponible -= imputable
    }
    if (m.montant - imputable > 0) restant.push({ annee: m.annee, montant: m.montant - imputable })
  }

  return {
    impute: totalStock(detail),
    detail,
    perime: totalStock(perimes),
    stock: restant,
  }
}
