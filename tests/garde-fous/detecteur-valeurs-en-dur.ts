/**
 * Détecteur de valeurs fiscales codées en dur hors de `src/params/`
 * (cahier des charges §0 et §3, principe 1).
 *
 * Le code est analysé avec le compilateur TypeScript : les commentaires sont
 * ignorés, les nombres, chaînes, gabarits et textes JSX sont contrôlés.
 */
import ts from 'typescript'

/** Seuls nombres admis dans le moteur : zéro, unité, moitié de calcul, mois, pourcentage. */
export const NOMBRES_ADMIS_MOTEUR: ReadonlySet<number> = new Set([0, 1, 2, 12, 100])

/** Marqueur à poser en commentaire sur une ligne d'affichage portant une valeur non fiscale. */
export const MARQUEUR_IGNORER = 'garde-fou-ignorer'

export type Mode = 'moteur' | 'general'

export interface Violation {
  readonly fichier: string
  readonly ligne: number
  readonly extrait: string
  readonly motif: string
}

export interface ValeursParametres {
  /** Valeurs numériques distinctives (non entières ou supérieures à 100). */
  readonly nombres: ReadonlySet<number>
  /** Dates ISO présentes dans les valeurs des paramètres. */
  readonly dates: ReadonlySet<string>
}

const normaliser = (n: number): number => Number(n.toFixed(10))

const estDistinctif = (n: number): boolean => Math.abs(n) > 100 || (!Number.isInteger(n) && n !== 0.5)

/** Collecte les nombres et dates figurant dans les champs `valeur` d'un fichier de paramètres. */
export function collecterValeurs(racine: unknown): ValeursParametres {
  const nombres = new Set<number>()
  const dates = new Set<string>()
  const ajouter = (x: unknown): void => {
    if (typeof x === 'number') {
      if (estDistinctif(x)) nombres.add(normaliser(x))
    } else if (typeof x === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(x)) dates.add(x)
    } else if (Array.isArray(x)) {
      x.forEach(ajouter)
    } else if (typeof x === 'object' && x !== null) {
      Object.values(x).forEach(ajouter)
    }
  }
  const parcourir = (noeud: unknown): void => {
    if (typeof noeud !== 'object' || noeud === null || Array.isArray(noeud)) return
    if ('valeur' in noeud) {
      ajouter(noeud.valeur)
      return
    }
    Object.values(noeud).forEach(parcourir)
  }
  parcourir(racine)
  return { nombres, dates }
}

interface Litteral {
  readonly genre: 'nombre' | 'texte'
  /** Valeur interprétée par le compilateur (séparateurs `_` retirés, échappements résolus). */
  readonly texte: string
  /** Extrait tel qu'écrit dans le code source. */
  readonly extrait: string
  readonly ligne: number
}

function extraireLitteraux(code: string, fichier: string): Litteral[] {
  const source = ts.createSourceFile(
    fichier,
    code,
    ts.ScriptTarget.Latest,
    true,
    fichier.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const litteraux: Litteral[] = []
  const ligneDe = (noeud: ts.Node): number => source.getLineAndCharacterOfPosition(noeud.getStart(source)).line + 1
  const visiter = (noeud: ts.Node): void => {
    if (ts.isNumericLiteral(noeud)) {
      litteraux.push({ genre: 'nombre', texte: noeud.text, extrait: noeud.getText(source), ligne: ligneDe(noeud) })
    } else if (
      ts.isStringLiteral(noeud) ||
      ts.isNoSubstitutionTemplateLiteral(noeud) ||
      ts.isTemplateHead(noeud) ||
      ts.isTemplateMiddle(noeud) ||
      ts.isTemplateTail(noeud) ||
      ts.isJsxText(noeud)
    ) {
      litteraux.push({ genre: 'texte', texte: noeud.text, extrait: noeud.getText(source), ligne: ligneDe(noeud) })
    }
    ts.forEachChild(noeud, visiter)
  }
  visiter(source)
  return litteraux
}

const lireNombreFrancais = (texte: string): number => Number(texte.replace(/[\s.\u00a0\u202f]/g, '').replace(',', '.'))

/** Retourne les violations d'un fichier source selon son mode de contrôle. */
export function detecterValeursEnDur(
  code: string,
  fichier: string,
  mode: Mode,
  valeurs: ValeursParametres,
): Violation[] {
  const lignes = code.split('\n')
  const violations: Violation[] = []
  const signaler = (ligne: number, extrait: string, motif: string): void => {
    violations.push({ fichier, ligne, extrait, motif })
  }
  const estFiscal = (n: number): boolean => valeurs.nombres.has(normaliser(n))

  for (const litteral of extraireLitteraux(code, fichier)) {
    if (lignes[litteral.ligne - 1]?.includes(MARQUEUR_IGNORER)) continue

    if (litteral.genre === 'nombre') {
      const n = Number(litteral.texte)
      if (mode === 'moteur' && !NOMBRES_ADMIS_MOTEUR.has(n)) {
        signaler(litteral.ligne, litteral.extrait, 'nombre interdit dans le moteur (à lire dans src/params/)')
      } else if (estFiscal(n) || (!Number.isInteger(n) && estFiscal(n / 100))) {
        signaler(litteral.ligne, litteral.extrait, 'valeur identique à un paramètre fiscal')
      }
      continue
    }

    for (const m of litteral.texte.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) {
      const pourcentage = lireNombreFrancais(m[1] ?? '')
      if (estFiscal(pourcentage / 100)) signaler(litteral.ligne, m[0], 'taux fiscal écrit en dur dans un texte')
    }
    for (const m of litteral.texte.matchAll(/(\d{1,3}(?:[\s.\u00a0\u202f]\d{3})+|\d+)(?:,\d+)?\s*€/g)) {
      if (estFiscal(lireNombreFrancais(m[1] ?? ''))) signaler(litteral.ligne, m[0], 'montant fiscal écrit en dur dans un texte')
    }
    for (const m of litteral.texte.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
      if (valeurs.dates.has(m[0])) signaler(litteral.ligne, m[0], 'date fiscale écrite en dur')
    }
  }
  return violations
}
