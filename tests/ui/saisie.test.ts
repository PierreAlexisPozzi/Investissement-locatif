import { describe, expect, it } from 'vitest'
import { apercuValeur, lireEdition, texteEdition } from '../../src/ui/edition-parametre'
import { afficherSaisie, lireSaisie } from '../../src/ui/saisie'

describe('saisie des nombres à la française', () => {
  it('espaces de milliers (y compris insécables), virgule ou point décimal, signe', () => {
    expect(lireSaisie('250 000')).toEqual({ ok: true, valeur: 250000 })
    expect(lireSaisie('250\u00a0000,5')).toEqual({ ok: true, valeur: 250000.5 })
    expect(lireSaisie('1\u202f250.25')).toEqual({ ok: true, valeur: 1250.25 })
    expect(lireSaisie('-3,5')).toEqual({ ok: true, valeur: -3.5 })
    expect(lireSaisie(',5')).toEqual({ ok: true, valeur: 0.5 })
  })

  it('refuse une saisie qui n’est pas un nombre, ou vide sans être optionnelle', () => {
    expect(lireSaisie('12a')).toEqual({ ok: false, erreur: 'Nombre attendu, par exemple 1 250,50' })
    expect(lireSaisie('1,2,3').ok).toBe(false)
    expect(lireSaisie('')).toEqual({ ok: false, erreur: 'Valeur obligatoire' })
    expect(lireSaisie('  ', { optionnel: true })).toEqual({ ok: true, valeur: undefined })
    expect(lireSaisie('9'.repeat(400))).toEqual({ ok: false, erreur: 'Nombre trop grand' })
  })

  it('pourcentages saisis en points, bornes et entiers', () => {
    expect(lireSaisie('3,4', { pourcentage: true })).toEqual({ ok: true, valeur: 0.034 })
    expect(afficherSaisie(0.034, { pourcentage: true })).toBe('3,4')
    expect(lireSaisie('120', { pourcentage: true, max: 1 })).toEqual({ ok: false, erreur: 'Au plus 100 %' })
    expect(lireSaisie('-1', { min: 0 })).toEqual({ ok: false, erreur: 'Au moins 0' })
    expect(lireSaisie('2,5', { entier: true })).toEqual({ ok: false, erreur: 'Nombre entier attendu' })
  })

  it('affichage avec séparateur de milliers, relu à l’identique', () => {
    for (const n of [0, 7500, 250000, 1234567.891, 0.5]) expect(lireSaisie(afficherSaisie(n))).toEqual({ ok: true, valeur: n })
    expect(afficherSaisie(undefined)).toBe('')
  })
})

describe('édition d’une valeur de paramètre', () => {
  it('nombre, booléen, texte : saisie simple', () => {
    expect(lireEdition(texteEdition(0.172), 0.172)).toEqual({ ok: true, valeur: 0.172 })
    expect(lireEdition('0,18', 0.172)).toEqual({ ok: true, valeur: 0.18 })
    expect(texteEdition(true)).toBe('oui')
    expect(lireEdition('non', true)).toEqual({ ok: true, valeur: false })
    expect(lireEdition('peut-être', true).ok).toBe(false)
    expect(lireEdition(' aucun ', 'mensuel')).toEqual({ ok: true, valeur: 'aucun' })
    expect(lireEdition('', 'mensuel').ok).toBe(false)
  })

  it('valeur structurée : JSON indenté, erreur de syntaxe expliquée', () => {
    const bareme = [{ jusqua: 11600, taux: 0 }]
    expect(lireEdition(texteEdition(bareme), bareme)).toEqual({ ok: true, valeur: bareme })
    const lu = lireEdition('[{ "jusqua": 11600, ', bareme)
    expect(lu.ok).toBe(false)
    if (!lu.ok) expect(lu.erreur).toMatch(/^JSON invalide : /)
  })

  it('aperçu : nombres à la française, objets abrégés', () => {
    expect(apercuValeur(0.0165)).toBe('0,0165')
    expect(apercuValeur(false)).toBe('non')
    expect(apercuValeur({ a: 'x'.repeat(200) }).endsWith('…')).toBe(true)
  })
})
