import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Script } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { genererServiceWorker, NOM_SERVICE_WORKER } from '../../pwa/plugin-service-worker'

const MODELE = readFileSync(join(import.meta.dirname, '..', '..', 'pwa', 'service-worker.js'), 'utf8')

const fichiers = new Map<string, string | Uint8Array>([
  ['index.html', '<!doctype html>'],
  ['assets/index-abc.js', 'console.log(1)'],
  ['assets/EcranDetail-def.js', 'export {}'],
  ['icone-192.png', new Uint8Array([137, 80, 78, 71])],
  ['manifest.webmanifest', '{}'],
])

function lire(code: string): { version: string; fichiers: string[] } {
  const version = /const VERSION = '([0-9a-f]+)'/.exec(code)?.[1]
  const liste = /const FICHIERS = (\[.*\])/.exec(code)?.[1]
  if (version === undefined || liste === undefined) throw new Error('VERSION ou FICHIERS non remplacé')
  return { version, fichiers: JSON.parse(liste) as string[] }
}

describe('service worker généré à la construction', () => {
  it('précharge tous les fichiers publiés, sauf la page (préchargée sous « ./ ») et le service worker', () => {
    const code = genererServiceWorker(MODELE, new Map([...fichiers, [NOM_SERVICE_WORKER, 'ancien']]))
    expect(lire(code).fichiers).toEqual(['./assets/EcranDetail-def.js', './assets/index-abc.js', './icone-192.png', './manifest.webmanifest'])
    expect(code).toContain("const PAGE = './'")
  })

  it('produit un script valide', () => {
    // Compilé sans être exécuté.
    expect(() => new Script(genererServiceWorker(MODELE, fichiers))).not.toThrow()
  })

  it('change de version quand un fichier change, et seulement dans ce cas', () => {
    const v1 = lire(genererServiceWorker(MODELE, fichiers)).version
    expect(lire(genererServiceWorker(MODELE, new Map([...fichiers].reverse()))).version).toBe(v1)
    expect(lire(genererServiceWorker(MODELE, new Map([...fichiers, ['index.html', '<!doctype html><title>v2</title>']]))).version).not.toBe(v1)
    expect(lire(genererServiceWorker(MODELE, new Map([...fichiers, ['icone-192.png', new Uint8Array([0])]]))).version).not.toBe(v1)
  })

  it('refuse un modèle dont les marqueurs ont disparu', () => {
    expect(() => genererServiceWorker(MODELE.replace("const VERSION = 'developpement'", "const VERSION = 'x'"), fichiers)).toThrow(/VERSION/)
    expect(() => genererServiceWorker(MODELE.replace('const FICHIERS = []', 'const FICHIERS = [1]'), fichiers)).toThrow(/FICHIERS/)
  })
})
