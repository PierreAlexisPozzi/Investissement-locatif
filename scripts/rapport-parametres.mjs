// Rapport sur un fichier de paramètres fiscaux : décompte par statut et tableau
// Markdown des paramètres non vérifiés (pour HYPOTHESES.md et les descriptions de PR).
// Usage : npm run params:rapport [-- chemin/vers/fichier.json]
import { readFileSync } from 'node:fs'

const fichier = process.argv[2] ?? new URL('../src/params/fiscal-2026.json', import.meta.url)
const racine = JSON.parse(readFileSync(fichier, 'utf8'))

function* parcourir(noeud, chemin = '') {
  if (typeof noeud !== 'object' || noeud === null || Array.isArray(noeud)) return
  if ('valeur' in noeud) {
    yield { chemin, parametre: noeud }
    return
  }
  for (const [cle, enfant] of Object.entries(noeud)) {
    if (chemin === '' && cle === 'meta') continue
    yield* parcourir(enfant, chemin === '' ? cle : `${chemin}.${cle}`)
  }
}

const entrees = [...parcourir(racine)]
const comptes = new Map()
for (const { parametre } of entrees) comptes.set(parametre.statut, (comptes.get(parametre.statut) ?? 0) + 1)

console.log(`Paramètres arrêtés au ${racine.meta.date_arret} : ${entrees.length} au total`)
for (const [statut, nombre] of comptes) console.log(`- ${statut} : ${nombre}`)
console.log('')
console.log('| Paramètre | Statut | Valeur | Source |')
console.log('|---|---|---|---|')
for (const { chemin, parametre } of entrees) {
  if (parametre.statut === 'verifie') continue
  console.log(`| \`${chemin}\` | ${parametre.statut} | \`${JSON.stringify(parametre.valeur)}\` | ${parametre.source} |`)
}
