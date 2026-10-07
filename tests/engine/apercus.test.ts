import { describe, expect, it } from 'vitest'
import { apercuBien, situationFiscale } from '../../src/engine/apercus'
import { anomaliesDossier, champsAComplete, dossierVierge, foyersPourSituation, type Dossier } from '../../src/engine/dossier'
import { calculerImpot } from '../../src/engine/impot-revenu'
import { prixTtc } from '../../src/engine/lli'
import { coefficientSurface, plafondLoyer, plafondLoyerIntermediaire } from '../../src/engine/loyer-plafond'
import { eligibiliteScenario, SCENARIOS } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierAncien, dossierConcubins, dossierType } from './fixtures/dossier-type'

const AUJOURD_HUI = '2026-10-07'

describe('dossier vierge et saisies manquantes', () => {
  it('le dossier vierge est cohérent mais signale chaque saisie manquante', () => {
    const v = dossierVierge(AUJOURD_HUI, p)
    expect(anomaliesDossier(v)).toEqual([])
    expect(champsAComplete(v)).toEqual([
      'Revenu imposable (Couple)',
      'Capacité d’épargne mensuelle',
      'Prix hors taxes',
      'Frais de notaire',
      'Surface habitable',
      'Loyer de marché nu',
      'Loyer de marché meublé',
    ])
    expect(v.bien.date_acquisition).toBe(AUJOURD_HUI)
    expect(v.financement.duree_mois).toBe(p.financement.duree_max_pret_ans.valeur * 12)
  })

  it('les dossiers d’essai sont complets', () => {
    for (const d of [dossierType, dossierAncien, dossierConcubins]) expect(champsAComplete(d)).toEqual([])
  })

  it('la durée du prêt n’est demandée que s’il y a un emprunt ; le prix d’un logement ancien n’est pas hors taxes', () => {
    const sansDuree: Dossier = { ...dossierType, financement: { ...dossierType.financement, duree_mois: 0 } }
    expect(champsAComplete(sansDuree)).toEqual(['Durée du prêt'])
    expect(champsAComplete({ ...sansDuree, financement: { ...sansDuree.financement, emprunt: 0 } })).toEqual([])
    expect(champsAComplete({ ...dossierAncien, bien: { ...dossierAncien.bien, prix_ht: 0 } })).toEqual(['Prix d’achat'])
  })
})

describe('changement de situation du couple', () => {
  const couple = dossierType.foyers.foyers

  it('concubins : deux foyers à parts égales, une part chacun, saisies du premier conservées', () => {
    const f = foyersPourSituation(couple, 'concubins', p)
    expect(f.map((x) => [x.libelle, x.parts, x.quote_part])).toEqual([
      ['Concubin 1', 1, 0.5],
      ['Concubin 2', 1, 0.5],
    ])
    expect(f[0]?.revenu_imposable).toBe(90000)
    expect(f[1]?.revenu_imposable).toBe(0)
    expect(anomaliesDossier({ ...dossierType, foyers: { ...dossierType.foyers, situation: 'concubins', foyers: f } })).toEqual([])
  })

  it('concubins qui se marient : un foyer qui additionne revenus, crédits et revenus fonciers', () => {
    const [a, b] = foyersPourSituation(couple, 'concubins', p)
    if (a === undefined || b === undefined) throw new Error('deux foyers attendus')
    const deux = [
      { ...a, revenu_imposable: 45000, mensualites_credits_en_cours: 300, revenus_fonciers_existants: { recettes: 6000, charges: 1000, regime: 'micro' as const } },
      { ...b, revenu_imposable: 40000, mensualites_credits_en_cours: 200, deficits_fonciers_existants: [{ annee: 2023, montant: 2000 }] },
    ]
    const [foyer, autre] = foyersPourSituation(deux, 'marie_pacse', p)
    expect(autre).toBeUndefined()
    expect(foyer).toMatchObject({ libelle: 'Couple', revenu_imposable: 85000, mensualites_credits_en_cours: 500, parts: 2, quote_part: 1 })
    expect(foyer?.revenus_fonciers_existants).toEqual({ recettes: 6000, charges: 1000, regime: 'micro' })
    expect(foyer?.deficits_fonciers_existants).toEqual([{ annee: 2023, montant: 2000 }])
    expect(foyersPourSituation(deux, 'personne_seule', p)[0]?.revenu_imposable).toBe(45000)
  })

  it('concubins qui se marient : revenus fonciers au réel si leurs recettes réunies dépassent le seuil du micro-foncier', () => {
    const [a, b] = foyersPourSituation(couple, 'concubins', p)
    if (a === undefined || b === undefined) throw new Error('deux foyers attendus')
    const seuil = p.micro_foncier.seuil_recettes.valeur
    const micro = (recettes: number) => ({ recettes, charges: 0, regime: 'micro' as const })
    const fusion = (ra: number, rb: number) =>
      foyersPourSituation([{ ...a, revenus_fonciers_existants: micro(ra) }, { ...b, revenus_fonciers_existants: micro(rb) }], 'marie_pacse', p)[0]
        ?.revenus_fonciers_existants
    expect(fusion(seuil / 2, seuil / 2)).toEqual({ recettes: seuil, charges: 0, regime: 'micro' })
    expect(fusion(seuil / 2, seuil / 2 + 1)).toEqual({ recettes: seuil + 1, charges: 0, regime: 'reel' })
  })

  it('retour à un seul foyer : quote-part 1, parts de base, libellé personnalisé conservé', () => {
    const concubins = foyersPourSituation(couple, 'concubins', p).map((x, k) => (k === 0 ? { ...x, libelle: 'Alice' } : x))
    expect(foyersPourSituation(concubins, 'marie_pacse', p).map((x) => [x.libelle, x.parts, x.quote_part])).toEqual([['Alice', 2, 1]])
    expect(foyersPourSituation(couple, 'personne_seule', p).map((x) => [x.libelle, x.parts, x.quote_part])).toEqual([['Foyer', 1, 1]])
  })
})

describe('situation fiscale sans l’opération (écran 1)', () => {
  it('reprend l’impôt et la tranche marginale du barème', () => {
    const [s] = situationFiscale(dossierType, p)
    const attendu = calculerImpot(90000, { parts: 2, imposition_commune: true }, p)
    expect(s?.impot).toBe(attendu.impot_du)
    expect(s?.tmi).toBe(attendu.tmi)
    expect(s?.tmi).toBe(0.3)
    expect(s?.niches_disponibles).toBe(p.impot_revenu.plafonnement_global_niches.valeur)
  })

  it('déduit les avantages fiscaux déjà utilisés du plafond global des niches, sans descendre sous zéro', () => {
    const plafond = p.impot_revenu.plafonnement_global_niches.valeur
    const avec = (utilises: number): Dossier => ({
      ...dossierType,
      foyers: { ...dossierType.foyers, foyers: dossierType.foyers.foyers.map((f) => ({ ...f, avantages_niches_deja_utilises: utilises })) },
    })
    expect(situationFiscale(avec(4000), p)[0]?.niches_disponibles).toBe(plafond - 4000)
    expect(situationFiscale(avec(plafond * 2), p)[0]?.niches_disponibles).toBe(0)
  })

  it('impose séparément chaque concubin', () => {
    const situations = situationFiscale(dossierConcubins, p)
    const attendu = calculerImpot(45000, { parts: 1, imposition_commune: false }, p)
    expect(situations.map((s) => s.libelle)).toEqual(['Concubin 1', 'Concubin 2'])
    expect(situations.map((s) => s.impot)).toEqual([attendu.impot_du, attendu.impot_du])
  })

  it('compte les revenus fonciers des autres biens et impute les déficits fonciers antérieurs', () => {
    const avec = (foyer: Partial<Dossier['foyers']['foyers'][number]>): Dossier => ({
      ...dossierType,
      foyers: { ...dossierType.foyers, foyers: dossierType.foyers.foyers.map((f) => ({ ...f, ...foyer })) },
    })
    const couple = { parts: 2, imposition_commune: true }
    const reel = situationFiscale(avec({ revenus_fonciers_existants: { recettes: 30000, charges: 0, regime: 'reel' } }), p)[0]
    expect(reel?.revenu_global_net).toBe(120000)
    expect(reel?.impot).toBe(calculerImpot(120000, couple, p).impot_du)
    const deficits = situationFiscale(
      avec({ revenus_fonciers_existants: { recettes: 30000, charges: 0, regime: 'reel' }, deficits_fonciers_existants: [{ annee: 2022, montant: 10000 }] }),
      p,
    )[0]
    expect(deficits?.revenus_fonciers).toBe(20000)
    expect(deficits?.impot).toBe(calculerImpot(110000, couple, p).impot_du)
    const micro = situationFiscale(avec({ revenus_fonciers_existants: { recettes: 10000, charges: 0, regime: 'micro' } }), p)[0]
    expect(micro?.revenus_fonciers).toBeCloseTo(10000 * (1 - p.micro_foncier.abattement.valeur), 6)
  })

  it('un revenu encore vide donne un impôt nul', () => {
    expect(situationFiscale(dossierVierge(AUJOURD_HUI, p), p).map((s) => [s.impot, s.tmi])).toEqual([[0, 0]])
  })
})

describe('aperçu du bien (écran 2)', () => {
  it('calcule surface, coefficient, plafond intermédiaire et prix TTC avec les fonctions du moteur', () => {
    const a = apercuBien(dossierType, p)
    const surface = dossierType.bien.surface
    expect(a.surface_prise_en_compte).toBe(45)
    expect(a.coefficient_surface).toBe(coefficientSurface(45, p))
    expect(a.loyer_plafond_intermediaire).toBe(plafondLoyerIntermediaire('A', surface, p).loyer_plafond_mensuel)
    expect(a.loyer_plafond_social).toBeNull()
    expect(a.prix_ttc_taux_normal).toBe(prixTtc(250000, p.lli.tva_taux_normal.valeur))
    expect(a.prix_ttc_taux_reduit).toBe(prixTtc(250000, p.lli.tva_taux_reduit.valeur))
    expect(a.prix_m2).toBeCloseTo(a.prix_ttc_taux_normal / 45, 6)
    expect(a.anomalies).toEqual([])
  })

  it('affiche les plafonds social et très social une fois les plafonds au m² de la commune saisis', () => {
    const d: Dossier = { ...dossierType, bien: { ...dossierType.bien, plafonds_m2_loc_avantages: { social: 12, tres_social: 9 } } }
    const a = apercuBien(d, p)
    expect(a.loyer_plafond_social).toBe(plafondLoyer(12, d.bien.surface, p).loyer_plafond_mensuel)
    expect(a.loyer_plafond_tres_social).toBe(plafondLoyer(9, d.bien.surface, p).loyer_plafond_mensuel)
  })

  it('un logement ancien n’a pas de TVA : les deux prix valent le prix saisi', () => {
    const a = apercuBien(dossierAncien, p)
    expect([a.prix_ttc_taux_normal, a.prix_ttc_taux_reduit]).toEqual([150000, 150000])
  })

  it('donne l’éligibilité de chaque scénario, avec ses motifs', () => {
    const a = apercuBien(dossierType, p)
    expect(a.eligibilites.map((e) => e.id)).toEqual([...SCENARIOS])
    for (const e of a.eligibilites) expect(e.eligibilite, e.id).toEqual(eligibiliteScenario(dossierType, e.id, p))
    const s5 = a.eligibilites.find((e) => e.id === 'S5_9')
    expect(s5?.eligibilite.eligible).toBe(false)
    expect(s5?.eligibilite.motifs.length).toBeGreaterThan(0)
  })

  it('reste calculable pendant la saisie : surface vide, montants nuls', () => {
    const a = apercuBien(dossierVierge(AUJOURD_HUI, p), p)
    expect([a.surface_prise_en_compte, a.coefficient_surface, a.loyer_plafond_intermediaire, a.prix_m2]).toEqual([null, null, null, null])
    expect(a.eligibilites).toHaveLength(SCENARIOS.length)
  })

  it('suspend l’éligibilité tant que le dossier est incohérent', () => {
    const d: Dossier = { ...dossierConcubins, foyers: { ...dossierConcubins.foyers, foyers: dossierType.foyers.foyers } }
    const a = apercuBien(d, p)
    expect(a.anomalies.length).toBeGreaterThan(0)
    expect(a.eligibilites).toEqual([])
  })
})
