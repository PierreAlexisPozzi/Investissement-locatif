import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import configuration from '../../vite.config'

const RACINE = join(import.meta.dirname, '..', '..')

/** wrangler.jsonc sans ses lignes de commentaire. */
function lireWrangler(): { name?: string; main?: string; compatibility_date?: string; assets?: { directory?: string } } {
  const texte = readFileSync(join(RACINE, 'wrangler.jsonc'), 'utf8')
  return JSON.parse(texte.split('\n').filter((ligne) => !ligne.trim().startsWith('//')).join('\n')) as ReturnType<typeof lireWrangler>
}

describe('publication sur Cloudflare Workers', () => {
  const wrangler = lireWrangler()

  it('publie le dossier construit par Vite, sans script Worker', () => {
    expect(wrangler.assets?.directory).toBe(`./${configuration.build?.outDir ?? 'dist'}`)
    expect(wrangler.main).toBeUndefined()
  })

  it('porte un nom de Worker et une date de compatibilité valide', () => {
    expect(wrangler.name).toMatch(/^[a-z0-9-]+$/)
    expect(wrangler.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(wrangler.compatibility_date ?? ''))).toBe(false)
  })
})
