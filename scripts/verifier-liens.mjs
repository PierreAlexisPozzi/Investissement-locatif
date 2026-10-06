// Vérifie que chaque URL officielle citée dans un fichier de paramètres répond.
// Outil de mise à jour annuelle, à lancer à la main (accès réseau requis).
// Légifrance, info.gouv.fr et economie.gouv.fr bloquent souvent les accès
// automatisés : une réponse 403 de leur part signifie « à ouvrir dans un navigateur ».
// Usage : npm run params:liens [-- chemin/vers/fichier.json]
import { readFileSync } from 'node:fs'

const fichier = process.argv[2] ?? new URL('../src/params/fiscal-2026.json', import.meta.url)
const racine = JSON.parse(readFileSync(fichier, 'utf8'))

const urls = new Set()
const collecter = (noeud) => {
  if (typeof noeud !== 'object' || noeud === null) return
  if (typeof noeud.url_officielle === 'string') urls.add(noeud.url_officielle)
  Object.values(noeud).forEach(collecter)
}
collecter(racine)

let echecs = 0
for (const url of [...urls].sort()) {
  try {
    const reponse = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (verification des sources)' } })
    const protege = reponse.status === 403 && reponse.headers.get('cf-mitigated') === 'challenge'
    const etat = reponse.ok ? 'ok' : protege ? 'protégé : à ouvrir dans un navigateur' : 'ÉCHEC'
    if (!reponse.ok && !protege) echecs += 1
    console.log(`${reponse.status} ${etat.padEnd(10)} ${url}`)
  } catch (erreur) {
    echecs += 1
    console.log(`--- ÉCHEC      ${url} (${erreur instanceof Error ? erreur.message : String(erreur)})`)
  }
}
console.log(`\n${urls.size} URL contrôlées, ${echecs} en échec.`)
process.exitCode = echecs > 0 ? 1 : 0
