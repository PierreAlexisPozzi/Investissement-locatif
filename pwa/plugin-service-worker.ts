import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

export const NOM_SERVICE_WORKER = 'sw.js'
const MARQUEUR_VERSION = "const VERSION = 'developpement'"
const MARQUEUR_FICHIERS = 'const FICHIERS = []'

/** Fichiers publiés : chemin relatif à la racine du site, séparé par « / », vers leur contenu. */
export type FichiersPublies = ReadonlyMap<string, string | Uint8Array>

/**
 * Complète le modèle de service worker pour une version : liste des fichiers à précharger (hors page
 * d'accueil, préchargée sous « ./ », et hors service worker) et version tirée de leur contenu. Toute
 * modification d'un fichier change le service worker : le navigateur installe alors la nouvelle version.
 */
export function genererServiceWorker(modele: string, fichiers: FichiersPublies): string {
  for (const marqueur of [MARQUEUR_VERSION, MARQUEUR_FICHIERS]) {
    if (modele.split(marqueur).length !== 2) throw new Error(`Modèle de service worker : « ${marqueur} » attendu une seule fois`)
  }
  const chemins = [...fichiers.keys()].sort()
  const empreinte = createHash('sha256')
  for (const chemin of chemins) {
    empreinte.update(`${chemin}\0`)
    empreinte.update(fichiers.get(chemin) ?? '')
  }
  const version = empreinte.digest('hex').slice(0, 16)
  const aPrecharger = chemins.filter((c) => c !== 'index.html' && c !== NOM_SERVICE_WORKER).map((c) => `./${c}`)
  return modele
    .replace(MARQUEUR_VERSION, () => `const VERSION = '${version}'`)
    .replace(MARQUEUR_FICHIERS, () => `const FICHIERS = ${JSON.stringify(aPrecharger)}`)
}

function listerFichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    return entree.isDirectory() ? listerFichiers(chemin) : [chemin]
  })
}

/** Plugin de construction : publie sw.js à côté de index.html, à partir du modèle donné. */
export function pluginServiceWorker(modele: string): Plugin {
  let dossierPublic = ''
  return {
    name: 'investissement-locatif:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      dossierPublic = config.publicDir
    },
    generateBundle(_options, bundle) {
      const fichiers = new Map<string, string | Uint8Array>()
      for (const [nom, sortie] of Object.entries(bundle)) fichiers.set(nom, sortie.type === 'chunk' ? sortie.code : sortie.source)
      if (dossierPublic !== '') {
        for (const chemin of listerFichiers(dossierPublic)) fichiers.set(relative(dossierPublic, chemin).split(sep).join('/'), readFileSync(chemin))
      }
      this.emitFile({ type: 'asset', fileName: NOM_SERVICE_WORKER, source: genererServiceWorker(modele, fichiers) })
    },
  }
}
