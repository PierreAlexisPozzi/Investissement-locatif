import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listerParametres, parametresFiscaux2026 } from '../../src/params'

const contenu = readFileSync(join(import.meta.dirname, '..', '..', 'HYPOTHESES.md'), 'utf8')
const entrees = listerParametres(parametresFiscaux2026)
const nonVerifies = entrees.filter((e) => e.parametre.statut !== 'verifie')
const arbitres = entrees.filter((e) => e.parametre.arbitrage !== undefined)

/** Lignes de tableau commençant par un chemin de paramètre, entre deux balises nommées. */
function lignesDeSection(nom: string): string[] {
  const debut = contenu.indexOf(`<!-- debut:${nom} -->`)
  const fin = contenu.indexOf(`<!-- fin:${nom} -->`)
  if (debut < 0 || fin < debut) throw new Error(`Balises de la section « ${nom} » introuvables dans HYPOTHESES.md`)
  return contenu
    .slice(debut, fin)
    .split('\n')
    .filter((ligne) => ligne.startsWith('| `'))
}

describe('HYPOTHESES.md suit le fichier de paramètres', () => {
  it('liste exactement les paramètres dont le statut n’est pas « verifie », avec leur statut', () => {
    const listes = lignesDeSection('parametres-non-verifies').map((ligne) => {
      const [, chemin = '', statut = ''] = /^\| `([^`]+)` \| (\w+) \|/.exec(ligne) ?? []
      return `${chemin} (${statut})`
    })
    const attendus = nonVerifies.map((e) => `${e.chemin} (${e.parametre.statut})`)
    expect(listes.sort()).toEqual(attendus.sort())
  })

  it('annonce le bon décompte par statut', () => {
    const compter = (statut: string) => entrees.filter((e) => e.parametre.statut === statut).length
    const attendu =
      `Décompte : ${entrees.length} paramètres, dont ${compter('verifie')} vérifiés, ` +
      `${compter('a_confirmer')} à confirmer et ${compter('texte_non_consulte')} dont le texte n'a pas été consulté.`
    expect(contenu).toContain(attendu)
  })

  it('liste exactement les paramètres qui portent un arbitrage, avec sa date', () => {
    const listes = lignesDeSection('arbitrages').map((ligne) => {
      const [, chemin = '', date = ''] = /^\| `([^`]+)` \| ([\d/]+) \|/.exec(ligne) ?? []
      return `${chemin} (${date})`
    })
    const attendus = arbitres.map((e) => {
      const [annee, mois, jour] = (e.parametre.arbitrage?.date ?? '').split('-')
      return `${e.chemin} (${jour ?? ''}/${mois ?? ''}/${annee ?? ''})`
    })
    expect(listes.sort()).toEqual(attendus.sort())
  })
})
