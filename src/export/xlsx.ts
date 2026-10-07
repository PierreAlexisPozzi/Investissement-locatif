/**
 * Classeur XLSX minimal (Office Open XML, ECMA-376) : une feuille par tableau,
 * textes en ligne, ligne d'en-tête figée et en gras, montants, taux et années
 * mis en forme. L'archive est compressée par fflate, sans appel réseau.
 */
import { strToU8, zipSync } from 'fflate'
import { formatCellule, type Cellule, type FormatCellule, type Tableau } from './tableau'

const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml'
const RELATIONS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PRINCIPAL = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const TYPE_MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Styles de cellule, dans l'ordre de `cellXfs` de styles.xml. */
const STYLE = { standard: 0, entete: 1, euros: 2, taux: 3, entier: 4, decimal: 5, texte: 6 } as const

const STYLES_XML =
  ENTETE_XML +
  `<styleSheet xmlns="${PRINCIPAL}">` +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>' +
  '<numFmt numFmtId="165" formatCode="0.00%"/>' +
  '</numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

/** Caractères interdits en XML 1.0 (contrôles hors tabulation et sauts de ligne). */
// eslint-disable-next-line no-control-regex
const CARACTERES_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

function echapper(texte: string): string {
  return texte
    .replace(CARACTERES_INTERDITS, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Référence de colonne : 0 → A, 25 → Z, 26 → AA. */
export function lettreColonne(indice: number): string {
  let n = indice + 1
  let lettres = ''
  while (n > 0) {
    const reste = (n - 1) % 26
    lettres = String.fromCharCode(65 + reste) + lettres
    n = Math.floor((n - 1) / 26)
  }
  return lettres
}

/** Longueur maximale et caractères interdits d'un nom de feuille. */
const LONGUEUR_NOM_FEUILLE = 31
const INTERDITS_NOM_FEUILLE = /[[\]:*?/\\]/g

function nomFeuille(titre: string, deja: ReadonlySet<string>): string {
  const base = titre.replace(INTERDITS_NOM_FEUILLE, ' ').trim().slice(0, LONGUEUR_NOM_FEUILLE) || 'Feuille'
  let nom = base
  for (let k = 2; deja.has(nom.toLowerCase()); k++) {
    const suffixe = ` (${String(k)})`
    nom = base.slice(0, LONGUEUR_NOM_FEUILLE - suffixe.length) + suffixe
  }
  return nom
}

function styleNombre(format: FormatCellule | undefined): number {
  switch (format) {
    case 'euros':
      return STYLE.euros
    case 'taux':
      return STYLE.taux
    case 'annee':
      return STYLE.entier
    case 'nombre':
    case 'annees':
      return STYLE.decimal
    default:
      return STYLE.standard
  }
}

function celluleXml(reference: string, valeur: Cellule, style: number): string {
  if (valeur === null) return ''
  if (typeof valeur === 'number') {
    return Number.isFinite(valeur) ? `<c r="${reference}" s="${String(style)}"><v>${String(valeur)}</v></c>` : ''
  }
  return `<c r="${reference}" s="${String(style)}" t="inlineStr"><is><t xml:space="preserve">${echapper(valeur)}</t></is></c>`
}

const LARGEUR_MINIMALE = 8
const LARGEUR_MAXIMALE = 60

function feuilleXml(t: Tableau): string {
  const largeurs = t.colonnes.map((c, k) => {
    const contenus = [c.libelle.length, ...t.lignes.map((l) => String(l[k] ?? '').length)]
    return c.largeur ?? Math.min(LARGEUR_MAXIMALE, Math.max(LARGEUR_MINIMALE, ...contenus) + 2)
  })
  const cols = largeurs.map((l, k) => `<col min="${String(k + 1)}" max="${String(k + 1)}" width="${String(l)}" customWidth="1"/>`).join('')
  const entete = `<row r="1">${t.colonnes.map((c, k) => celluleXml(`${lettreColonne(k)}1`, c.libelle, STYLE.entete)).join('')}</row>`
  const lignes = t.lignes.map((ligne, i) => {
    const r = i + 2
    const cellules = ligne.map((v, k) => {
      const format = formatCellule(t, i, k)
      const style = typeof v === 'string' ? (t.colonnes[k]?.format === 'texte' ? STYLE.texte : STYLE.standard) : styleNombre(format)
      return celluleXml(`${lettreColonne(k)}${String(r)}`, v, style)
    })
    return `<row r="${String(r)}">${cellules.join('')}</row>`
  })
  const vue =
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
  return `${ENTETE_XML}<worksheet xmlns="${PRINCIPAL}" xmlns:r="${RELATIONS}">${vue}<cols>${cols}</cols><sheetData>${entete}${lignes.join('')}</sheetData></worksheet>`
}

/** Classeur XLSX : une feuille par tableau, dans l'ordre donné. */
export function versXlsx(tableaux: readonly Tableau[]): Uint8Array<ArrayBuffer> {
  if (tableaux.length === 0) throw new RangeError('Un classeur contient au moins une feuille')
  const noms = new Set<string>()
  const feuilles = tableaux.map((t, k) => {
    const nom = nomFeuille(t.titre, noms)
    noms.add(nom.toLowerCase())
    return { nom, chemin: `worksheets/sheet${String(k + 1)}.xml`, xml: feuilleXml(t) }
  })
  const fichiers: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${ENTETE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${TYPE_XLSX}.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${TYPE_XLSX}.styles+xml"/>` +
        feuilles.map((f) => `<Override PartName="/xl/${f.chemin}" ContentType="${TYPE_XLSX}.worksheet+xml"/>`).join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${ENTETE_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${RELATIONS}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `${ENTETE_XML}<workbook xmlns="${PRINCIPAL}" xmlns:r="${RELATIONS}"><sheets>` +
        feuilles.map((f, k) => `<sheet name="${echapper(f.nom)}" sheetId="${String(k + 1)}" r:id="rId${String(k + 1)}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${ENTETE_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        feuilles.map((f, k) => `<Relationship Id="rId${String(k + 1)}" Type="${RELATIONS}/worksheet" Target="${f.chemin}"/>`).join('') +
        `<Relationship Id="rId${String(feuilles.length + 1)}" Type="${RELATIONS}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  }
  for (const f of feuilles) fichiers[`xl/${f.chemin}`] = strToU8(f.xml)
  return zipSync(fichiers)
}
