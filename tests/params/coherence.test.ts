/**
 * Contrôles de cohérence des valeurs : ils détectent une faute de saisie lors
 * de la mise à jour annuelle de fiscal-2026.json. Les montants attendus sont
 * ceux des exemples officiels cités en commentaire.
 */
import { describe, expect, it } from 'vitest'
import { parametresFiscaux2026 as p, ZONES, type TrancheAbattement, type TrancheSurtaxe } from '../../src/params'

const PRECISION = 9

describe('impôt sur le revenu', () => {
  const bareme = p.impot_revenu.bareme.valeur

  it('les bornes du barème sont croissantes et la dernière tranche est ouverte', () => {
    const bornes = bareme.map((t) => t.jusqua)
    expect(bornes.at(-1)).toBeNull()
    const fermees = bornes.slice(0, -1) as number[]
    expect(fermees).toEqual([...fermees].sort((a, b) => a - b))
    expect(new Set(fermees).size).toBe(fermees.length)
  })

  it('les taux du barème sont croissants et compris entre 0 et 1', () => {
    const taux = bareme.map((t) => t.taux)
    expect(taux).toEqual([...taux].sort((a, b) => a - b))
    for (const t of taux) expect(t).toBeGreaterThanOrEqual(0)
    for (const t of taux) expect(t).toBeLessThanOrEqual(1)
  })

  it('la décote s’annule exactement au seuil', () => {
    const { couple, personne_seule, taux } = p.impot_revenu.decote.valeur
    // Le forfait égale à l'euro près 45,25 % du seuil : la décote est continue.
    expect(Math.abs(couple.forfait - taux * couple.seuil_impot_brut)).toBeLessThan(1)
    expect(Math.abs(personne_seule.forfait - taux * personne_seule.seuil_impot_brut)).toBeLessThan(1)
  })
})

describe('prélèvements sociaux', () => {
  it.each([
    ['revenus fonciers', p.prelevements_sociaux.revenus_fonciers.valeur],
    ['location meublée', p.prelevements_sociaux.location_meublee_non_professionnelle.valeur],
    ['plus-values immobilières', p.prelevements_sociaux.plus_values_immobilieres.valeur],
  ])('%s : le total est la somme des composantes', (_, taux) => {
    expect(taux.csg + taux.crds + taux.prelevement_solidarite).toBeCloseTo(taux.total, PRECISION)
  })
})

describe('loyers plafonds', () => {
  it('les plafonds au m² ne croissent pas de la zone A bis à la zone C', () => {
    const plafonds = ZONES.map((z) => p.loyers_plafonds.intermediaire_m2.valeur[z])
    expect(plafonds).toEqual([...plafonds].sort((a, b) => b - a))
  })

  it('les plafonds de ressources du couple dépassent ceux d’une personne seule', () => {
    const r = p.loyers_plafonds.ressources_locataires_intermediaire.valeur
    for (const z of ZONES) expect(r.couple[z]).toBeGreaterThan(r.personne_seule[z])
  })
})

describe('Jeanbrun', () => {
  const { taux_amortissement, plafond_annuel, part_foncier_forfaitaire } = p.jeanbrun

  it('social et très social majorent le taux d’un et deux points (texte de l’article 31)', () => {
    expect(taux_amortissement.valeur.social - taux_amortissement.valeur.intermediaire).toBeCloseTo(0.01, PRECISION)
    expect(taux_amortissement.valeur.tres_social - taux_amortissement.valeur.intermediaire).toBeCloseTo(0.02, PRECISION)
  })

  it('social et très social majorent le plafond de 2 000 € et 4 000 €', () => {
    expect(plafond_annuel.valeur.social - plafond_annuel.valeur.intermediaire).toBe(2000)
    expect(plafond_annuel.valeur.tres_social - plafond_annuel.valeur.intermediaire).toBe(4000)
  })

  it('le plafond intermédiaire est atteint à partir de 285 714 € (cahier des charges §13)', () => {
    const base = 1 - part_foncier_forfaitaire.valeur
    const seuil = plafond_annuel.valeur.intermediaire / (taux_amortissement.valeur.intermediaire * base)
    expect(Math.floor(seuil)).toBe(285714)
  })
})

describe('Denormandie', () => {
  it('un engagement total de 12 ans donne 21 % quel que soit l’engagement initial', () => {
    const { six_ans, neuf_ans } = p.denormandie.taux_engagement_initial.valeur
    const { initial_six_ans, initial_neuf_ans } = p.denormandie.complement_prorogation.valeur
    const somme = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
    expect(six_ans + somme(initial_six_ans)).toBeCloseTo(0.21, PRECISION)
    expect(neuf_ans + somme(initial_neuf_ans)).toBeCloseTo(0.21, PRECISION)
  })
})

describe('LLI', () => {
  it('le calendrier du complément de TVA est ordonné et s’achève avec la durée des conditions', () => {
    const c = p.lli.complement_tva.valeur
    expect(c.fin_periode_toujours_du).toBeLessThan(c.fin_periode_cession_partielle)
    expect(c.fin_periode_cession_partielle).toBeLessThan(c.fin_periode_cession_libre)
    expect(c.fin_periode_cession_libre).toBe(p.lli.duree_conditions_ans.valeur)
    expect(p.lli.creance_taxe_fonciere.valeur.duree_ans).toBe(p.lli.duree_conditions_ans.valeur)
  })
})

describe('plus-value immobilière', () => {
  const ir = p.plus_value_immobiliere.abattement_ir.valeur.tranches
  const ps = p.plus_value_immobiliere.abattement_ps.valeur.tranches
  const total = (tranches: readonly TrancheAbattement[]) =>
    tranches.reduce((somme, t) => somme + (t.a - t.de + 1) * t.taux_annuel, 0)

  it.each([
    ['impôt sur le revenu', ir],
    ['prélèvements sociaux', ps],
  ])('%s : les tranches d’abattement sont contiguës et commencent à la 6e année', (_, tranches) => {
    expect(tranches[0]?.de).toBe(6)
    tranches.slice(1).forEach((t, i) => {
      expect(t.de).toBe((tranches[i]?.a ?? Number.NaN) + 1)
    })
  })

  it('l’abattement pour l’impôt sur le revenu atteint 100 % à la 22e année', () => {
    expect(ir.at(-1)?.a).toBe(22)
    expect(total(ir)).toBeCloseTo(1, PRECISION)
  })

  it('l’abattement pour les prélèvements sociaux atteint 100 % à la 30e année', () => {
    expect(ps.at(-1)?.a).toBe(30)
    expect(total(ps)).toBeCloseTo(1, PRECISION)
  })

  describe('surtaxe sur les plus-values élevées', () => {
    const { seuil, tranches } = p.plus_value_immobiliere.surtaxe_plus_values_elevees.valeur
    const taxeTranche = (t: TrancheSurtaxe, pv: number) =>
      t.taux * pv - (t.lissage_borne === null ? 0 : (t.lissage_borne - pv) * t.lissage_coefficient)
    const surtaxe = (pv: number) => {
      const t = tranches.find((x) => pv > x.de && (x.a === null || pv <= x.a))
      return t === undefined ? 0 : taxeTranche(t, pv)
    }

    it('les tranches sont contiguës à partir du seuil', () => {
      expect(tranches[0]?.de).toBe(seuil)
      expect(tranches.at(-1)?.a).toBeNull()
      tranches.slice(1).forEach((t, i) => {
        expect(t.de).toBe(tranches[i]?.a)
      })
    })

    it('le barème est continu à chaque changement de tranche', () => {
      tranches.slice(1).forEach((t, i) => {
        const precedente = tranches[i]
        if (precedente === undefined) throw new Error('tranche manquante')
        expect(taxeTranche(t, t.de)).toBeCloseTo(taxeTranche(precedente, t.de), PRECISION)
      })
    })

    it.each([
      [50000, 0, 'cahier des charges §13'],
      [55000, 850, 'cahier des charges §13'],
      [80000, 1600, 'cahier des charges §13'],
      [105000, 2650, 'cahier des charges §13'],
      [103400, 2442, 'BOI-RFPI-TPVIE-20, §75, exemple 1'],
      [61000, 1220, 'BOI-RFPI-TPVIE-20, §75, exemple 2 (quote-part d’un époux)'],
      [52500, 675, 'BOI-RFPI-TPVIE-20, §75, exemple 3 (SCI)'],
    ])('plus-value imposable de %i € → %i € (%s)', (pv, attendu) => {
      expect(surtaxe(pv)).toBeCloseTo(attendu, PRECISION)
    })
  })
})

describe('périodes', () => {
  it.each([
    ['Jeanbrun', p.jeanbrun.periode_acquisition.valeur],
    ['Denormandie', p.denormandie.periode.valeur],
  ])('%s : la période commence avant de finir', (_, periode) => {
    expect(periode.debut < periode.fin).toBe(true)
  })
})
