/**
 * Tableau générique des exports CSV et XLSX : un titre, des colonnes typées et
 * des lignes de valeurs brutes. La mise en forme dépend du format de chaque
 * colonne : montant, taux, nombre, année ou texte.
 */
import type { FormatValeur } from '../engine/presentation'

export type Cellule = number | string | null

export interface ColonneTableau {
  readonly libelle: string
  readonly format: FormatValeur | 'texte'
  /** Largeur indicative en caractères (XLSX). */
  readonly largeur?: number
}

export type FormatCellule = ColonneTableau['format']

export interface Tableau {
  /** Nom de la feuille XLSX ou du fichier CSV. */
  readonly titre: string
  readonly colonnes: readonly ColonneTableau[]
  readonly lignes: readonly (readonly Cellule[])[]
  /** Format des nombres de chaque ligne, quand il dépend de la ligne et non de la colonne (indicateurs). */
  readonly formats_lignes?: readonly (FormatCellule | undefined)[]
}

/** Format d'une cellule : celui de sa ligne s'il est défini, sinon celui de sa colonne. */
export function formatCellule(t: Tableau, ligne: number, colonne: number): FormatCellule | undefined {
  return t.formats_lignes?.[ligne] ?? t.colonnes[colonne]?.format
}
