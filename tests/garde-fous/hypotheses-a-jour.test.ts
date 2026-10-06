import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listerParametres, parametresFiscaux2026 } from '../../src/params'

const contenu = readFileSync(join(import.meta.dirname, '..', '..', 'HYPOTHESES.md'), 'utf8')
const entrees = listerParametres(parametresFiscaux2026)
const nonVerifies = entrees.filter((e) => e.parametre.statut !== 'verifie')

function sectionNonVerifies(): string {
  const debut = contenu.indexOf('<!-- debut:parametres-non-verifies -->')
  const fin = contenu.indexOf('<!-- fin:parametres-non-verifies -->')
  if (debut < 0 || fin < debut) throw new Error('Balises de la section des paramètres non vérifiés introuvables')
  return contenu.slice(debut, fin)
}

describe('HYPOTHESES.md suit le fichier de paramètres', () => {
  it('liste exactement les paramètres dont le statut n’est pas « verifie », avec leur statut', () => {
    const lignes = sectionNonVerifies()
      .split('\n')
      .filter((ligne) => ligne.startsWith('| `'))
    const listes = lignes.map((ligne) => {
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
})
