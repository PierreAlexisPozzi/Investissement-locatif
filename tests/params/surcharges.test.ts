import { describe, expect, it } from 'vitest'
import { appliquerSurcharges, memeForme, parametresFiscaux2026 as p } from '../../src/params'

describe('forme d’une valeur modifiée', () => {
  it('nombres, textes, booléens', () => {
    expect(memeForme(0.172, 0.18)).toBe(true)
    expect(memeForme(0.172, '0.18')).toBe(false)
    expect(memeForme(0.172, Number.NaN)).toBe(false)
    expect(memeForme('mensuel', 'aucun')).toBe(true)
    expect(memeForme(true, false)).toBe(true)
    expect(memeForme(true, 1)).toBe(false)
  })

  it('objets : mêmes clés ; listes non vides, chaque élément de la forme d’un élément d’origine ; null seulement là où il était', () => {
    expect(memeForme({ taux: 0.1, minimum: 509 }, { minimum: 510, taux: 0.1 })).toBe(true)
    expect(memeForme({ taux: 0.1, minimum: 509 }, { taux: 0.1 })).toBe(false)
    expect(memeForme({ taux: 0.1 }, { taux: 0.1, autre: 1 })).toBe(false)
    const bareme = p.impot_revenu.bareme.valeur
    expect(memeForme(bareme, [{ jusqua: 12000, taux: 0 }, { jusqua: 30000, taux: 0.11 }, { jusqua: null, taux: 0.2 }])).toBe(true)
    expect(memeForme(bareme, [{ jusqua: 'x', taux: 0 }])).toBe(false)
    expect(memeForme(bareme, [{ jusqua: 12000, taux: null }])).toBe(false)
    expect(memeForme(bareme, [])).toBe(false)
    expect(memeForme(0.172, null)).toBe(false)
    expect(memeForme(null, 'texte')).toBe(false)
    expect(memeForme([], [])).toBe(true)
    expect(memeForme([], ['A'])).toBe(false)
  })
})

describe('application des modifications', () => {
  it('sans modification, les paramètres d’origine', () => {
    expect(appliquerSurcharges(p, {})).toEqual({ parametres: p, modifies: [], erreurs: [] })
  })

  it('modifie une copie : valeur, statut et date ; l’original reste intact', () => {
    const r = appliquerSurcharges(p, {
      'jeanbrun.plafond_annuel': { valeur: { intermediaire: 9000, social: 10000, tres_social: 12000 } },
      'jeanbrun.prorata_premiere_annee': { statut: 'verifie', date_verification: '2026-10-01' },
    })
    expect(r.erreurs).toEqual([])
    expect(r.modifies).toEqual(['jeanbrun.plafond_annuel', 'jeanbrun.prorata_premiere_annee'])
    expect(r.parametres.jeanbrun.plafond_annuel.valeur.intermediaire).toBe(9000)
    expect(r.parametres.jeanbrun.prorata_premiere_annee.statut).toBe('verifie')
    expect(p.jeanbrun.plafond_annuel.valeur.intermediaire).toBe(8000)
    expect(p.jeanbrun.prorata_premiere_annee.statut).toBe('a_confirmer')
  })

  it('une vérification postérieure repousse la date d’arrêt des paramètres', () => {
    const r = appliquerSurcharges(p, { 'lli.tva_taux_normal': { statut: 'verifie', date_verification: '2026-12-01' } })
    expect(r.erreurs).toEqual([])
    expect(r.parametres.meta.date_arret).toBe('2026-12-01')
    expect(p.meta.date_arret).toBe('2026-10-06')
  })

  it('refuse toutes les modifications si l’une est invalide', () => {
    const cas = [
      [{ 'jeanbrun.inconnu': { valeur: 1 } }, 'jeanbrun.inconnu : paramètre inconnu'],
      [{ jeanbrun: { valeur: 1 } }, 'jeanbrun : paramètre inconnu'],
      [{ 'micro_foncier.abattement': { valeur: '30 %' } }, 'micro_foncier.abattement : la valeur n’a pas la forme de l’original'],
      [{ 'micro_foncier.abattement': { date_verification: '01/10/2026' } }, 'micro_foncier.abattement : date de vérification AAAA-MM-JJ attendue'],
      [{ 'lli.zones_eligibles': { valeur: ['A', 'Z'] } }, expect.stringContaining('lli.zones_eligibles : « Z » n\'est pas admis')],
      [{ 'jeanbrun.prorata_premiere_annee': { statut: 'verifie', date_verification: null } }, expect.stringContaining('doit porter sa date de vérification')],
      [{ 'impot_revenu.bareme': { valeur: [] } }, 'impot_revenu.bareme : la valeur n’a pas la forme de l’original'],
      [
        { 'impot_revenu.bareme': { valeur: [{ jusqua: 30000, taux: 0 }, { jusqua: 11600, taux: 0.11 }, { jusqua: null, taux: 0.45 }] } },
        'impot_revenu.bareme[1] : bornes croissantes attendues',
      ],
      [{ 'impot_revenu.bareme': { valeur: [{ jusqua: 11600, taux: null }, { jusqua: null, taux: 0.45 }] } }, 'impot_revenu.bareme : la valeur n’a pas la forme de l’original'],
      [{ 'micro_foncier.abattement': { valeur: 30 } }, expect.stringContaining('micro_foncier.abattement : taux décimal entre 0 et 1 attendu (30)')],
      [{ 'lmnp.micro_bic': { valeur: { ...p.lmnp.micro_bic.valeur, abattement: 50 } } }, expect.stringContaining('lmnp.micro_bic.abattement : taux décimal entre 0 et 1')],
      [{ 'impot_revenu.plafonnement_global_niches': { valeur: -1 } }, expect.stringContaining('nombre positif ou nul attendu')],
    ] as const
    for (const [surcharges, erreur] of cas) {
      const r = appliquerSurcharges(p, { 'micro_foncier.seuil_recettes': { valeur: 20000 }, ...surcharges })
      expect(r.parametres).toBe(p)
      expect(r.modifies).toEqual([])
      expect(r.erreurs).toEqual([erreur])
    }
  })
})
