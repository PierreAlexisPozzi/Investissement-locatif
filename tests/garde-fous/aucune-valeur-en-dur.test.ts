import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import fiscal from '../../src/params/fiscal-2026.json'
import {
  collecterValeurs,
  detecterValeursEnDur,
  MARQUEUR_IGNORER,
  type Mode,
} from './detecteur-valeurs-en-dur'

const RACINE = join(import.meta.dirname, '..', '..')
const valeurs = collecterValeurs(fiscal)

function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return fichiersSource(chemin)
    return /\.tsx?$/.test(entree.name) ? [chemin] : []
  })
}

function modeDe(cheminRelatif: string): Mode | null {
  const segments = cheminRelatif.split(sep)
  if (segments[1] === 'params') return null
  if (segments[1] === 'engine' && segments[2] !== 'constantes-numeriques.ts') return 'moteur'
  return 'general'
}

describe('détecteur de valeurs en dur (auto-contrôle)', () => {
  const analyser = (code: string, mode: Mode, fichier = 'exemple.ts') =>
    detecterValeursEnDur(code, fichier, mode, valeurs).map((v) => v.extrait)

  it('collecte les valeurs distinctives des paramètres', () => {
    expect(valeurs.nombres.has(0.172)).toBe(true)
    expect(valeurs.nombres.has(10700)).toBe(true)
    expect(valeurs.dates.has('2026-02-21')).toBe(true)
  })

  it('signale un taux, un plafond ou une date fiscale écrits dans le code', () => {
    expect(analyser('const ps = 0.172', 'general')).toEqual(['0.172'])
    expect(analyser('const plafond = 10_700', 'general')).toEqual(['10_700'])
    expect(analyser('const taux = 17.2 / 100', 'general')).toEqual(['17.2'])
    expect(analyser("const debut = '2026-02-21'", 'general')).toEqual(['2026-02-21'])
  })

  it('signale un taux ou un montant fiscal écrits dans un texte affiché', () => {
    expect(analyser('const t = <p>Prélèvements sociaux : 17,2 %</p>', 'general', 'x.tsx')).toEqual(['17,2 %'])
    expect(analyser('const m = `Plafond : 10 700 € par an`', 'general')).toEqual(['10 700 €'])
  })

  it('ignore les commentaires et les valeurs non fiscales', () => {
    expect(analyser('// le taux de 0.172 vient des paramètres\nconst n = 3', 'general')).toEqual([])
    expect(analyser('const total = 100 * 12 / 2', 'moteur')).toEqual([])
  })

  it('interdit dans le moteur tout nombre hors de la liste admise', () => {
    expect(analyser('const duree = 9', 'moteur')).toEqual(['9'])
    expect(analyser('const seuil = 15000', 'moteur')).toEqual(['15000'])
  })

  it('respecte le marqueur explicite sur une ligne d’affichage', () => {
    expect(analyser(`const opacite = 0.3 // ${MARQUEUR_IGNORER} : opacité du graphique`, 'general')).toEqual([])
  })
})

describe('aucun taux ni plafond fiscal en dur hors de src/params/', () => {
  it('le code de src/ ne contient aucune valeur fiscale littérale', () => {
    const violations = fichiersSource(join(RACINE, 'src')).flatMap((chemin) => {
      const cheminRelatif = relative(RACINE, chemin)
      const mode = modeDe(cheminRelatif)
      if (mode === null) return []
      return detecterValeursEnDur(readFileSync(chemin, 'utf8'), cheminRelatif, mode, valeurs)
    })
    const rapport = violations.map((v) => `${v.fichier}:${v.ligne} « ${v.extrait} » — ${v.motif}`)
    expect(rapport).toEqual([])
  })
})
