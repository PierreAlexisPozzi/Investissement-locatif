/**
 * Export CSV lisible par un tableur réglé en français : séparateur
 * point-virgule, virgule décimale, encodage UTF-8 avec indicateur d'ordre des
 * octets, fins de ligne CRLF (RFC 4180).
 */
import { formatCellule, type Cellule, type FormatCellule, type Tableau } from './tableau'

const SEPARATEUR = ';'
const FIN_DE_LIGNE = '\r\n'
const BOM = '\uFEFF'
/** Montants au centime, taux à la précision d'un centième de point. */
const DECIMALES_MONTANT = 2
const DECIMALES_TAUX = 6

/** Un texte qui commence par l'un de ces caractères serait lu comme une formule par le tableur. */
const DEBUT_FORMULE = /^[=+\-@\t\r]/

function texte(valeur: string): string {
  const neutralise = DEBUT_FORMULE.test(valeur) ? `'${valeur}` : valeur
  return /[";\r\n]/.test(neutralise) || neutralise.trim() !== neutralise ? `"${neutralise.replaceAll('"', '""')}"` : neutralise
}

function nombre(valeur: number, decimales: number): string {
  if (!Number.isFinite(valeur)) return ''
  const arrondi = Number(valeur.toFixed(decimales))
  // Pas de séparateur de milliers : le tableur reconnaît le nombre.
  return (Object.is(arrondi, -0) ? 0 : arrondi).toString().replace('.', ',')
}

function cellule(valeur: Cellule, format: FormatCellule | undefined): string {
  if (valeur === null) return ''
  if (typeof valeur === 'string') return texte(valeur)
  return nombre(valeur, format === 'taux' ? DECIMALES_TAUX : DECIMALES_MONTANT)
}

/** Contenu d'un fichier CSV : ligne d'en-tête puis une ligne par enregistrement. */
export function versCsv(t: Tableau): string {
  const entete = t.colonnes.map((c) => texte(c.libelle)).join(SEPARATEUR)
  const lignes = t.lignes.map((ligne, i) => ligne.map((v, k) => cellule(v, formatCellule(t, i, k))).join(SEPARATEUR))
  return BOM + [entete, ...lignes].join(FIN_DE_LIGNE) + FIN_DE_LIGNE
}
