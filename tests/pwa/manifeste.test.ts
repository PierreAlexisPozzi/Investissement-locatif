import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RACINE = join(import.meta.dirname, '..', '..')
const PUBLIC = join(RACINE, 'public')

interface Icone {
  readonly src: string
  readonly sizes: string
  readonly type: string
  readonly purpose: string
}

const manifeste = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as {
  readonly start_url: string
  readonly scope: string
  readonly display: string
  readonly icons: readonly Icone[]
}

/** Largeur et hauteur d'un PNG, lues dans son en-tête IHDR. */
function dimensionsPng(chemin: string): string {
  const octets = readFileSync(chemin)
  return `${String(octets.readUInt32BE(16))}x${String(octets.readUInt32BE(20))}`
}

describe('application installable', () => {
  it('le manifeste vaut à la racine d’un domaine comme dans un sous-dossier', () => {
    expect(manifeste.start_url).toBe('./')
    expect(manifeste.scope).toBe('./')
    expect(manifeste.display).toBe('standalone')
  })

  it('les icônes du manifeste existent aux tailles annoncées, dont 192 et 512 px et une icône masquable', () => {
    for (const icone of manifeste.icons) {
      expect(icone.type).toBe('image/png')
      expect(dimensionsPng(join(PUBLIC, icone.src))).toBe(icone.sizes)
    }
    expect(manifeste.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifeste.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('index.html déclare le manifeste et les icônes, présents dans public/', () => {
    const html = readFileSync(join(RACINE, 'index.html'), 'utf8')
    const liens = [...html.matchAll(/<link rel="(manifest|icon|apple-touch-icon)" href="\/([^"]+)"/g)].map((m) => [m[1], m[2]] as const)
    expect(liens.map(([rel]) => rel).sort()).toEqual(['apple-touch-icon', 'icon', 'manifest'])
    for (const [, fichier] of liens) expect(existsSync(join(PUBLIC, fichier ?? ''))).toBe(true)
    expect(dimensionsPng(join(PUBLIC, 'apple-touch-icon.png'))).toBe('180x180')
  })
})
