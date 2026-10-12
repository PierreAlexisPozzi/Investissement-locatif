import { describe, expect, it, vi } from 'vitest'
import { demanderStockagePersistant, enregistrerServiceWorker } from '../../src/ui/installation'

describe('enregistrement du service worker', () => {
  it('enregistre sw.js sous la base du site', async () => {
    const register = vi.fn(() => Promise.resolve({}))
    expect(await enregistrerServiceWorker({ register }, './')).toBe(true)
    expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' })
  })

  it('sans service worker (hors HTTPS), ne fait rien', async () => {
    expect(await enregistrerServiceWorker(undefined, './')).toBe(false)
  })
})

describe('stockage persistant', () => {
  const stockage = (dejaPersistant: boolean, accorde: boolean) => ({
    persisted: vi.fn(() => Promise.resolve(dejaPersistant)),
    persist: vi.fn(() => Promise.resolve(accorde)),
  })

  it('est demandé une fois l’application installée', async () => {
    const s = stockage(false, true)
    expect(await demanderStockagePersistant(s, true)).toBe(true)
    expect(s.persist).toHaveBeenCalledOnce()
  })

  it('n’est pas redemandé s’il est déjà accordé', async () => {
    const s = stockage(true, true)
    expect(await demanderStockagePersistant(s, true)).toBe(true)
    expect(s.persist).not.toHaveBeenCalled()
  })

  it('n’est pas demandé dans un simple onglet, ni sans API de stockage', async () => {
    const s = stockage(false, true)
    expect(await demanderStockagePersistant(s, false)).toBe(false)
    expect(s.persist).not.toHaveBeenCalled()
    expect(await demanderStockagePersistant(undefined, true)).toBe(false)
  })
})
