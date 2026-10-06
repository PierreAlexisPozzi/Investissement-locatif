import { describe, expect, it } from 'vitest'
import {
  amortissementsReintegresLmnp,
  anneeBasculeVersMicro,
  dotationLineaire,
  ETAT_INITIAL_LMNP,
  exerciceLmnpReel,
  microBic,
  planAmortissementLmnp,
  prelevementsSociauxLmnp,
  simulerLmnpReel,
  statutLoueurMeuble,
  type EntreeLmnpReel,
} from '../../src/engine/lmnp'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'

const PRECISION = 6

const exercice = (annee: number, recettes: number, charges: number, immeuble: number, mobilier = 0): EntreeLmnpReel => ({
  annee,
  recettes,
  charges,
  dotations: { immeuble, mobilier },
})

describe('régime réel : limitation de l’amortissement (CGI art. 39 C)', () => {
  it('résultat avant amortissement 3 000, dotation 9 000 → 3 000 déduits, 6 000 différés, BIC 0 (§13)', () => {
    const r = exerciceLmnpReel(exercice(2028, 10000, 7000, 9000), ETAT_INITIAL_LMNP, p)
    expect(r.resultat_avant_amortissement).toBe(3000)
    expect(r.amortissement_deduit).toBe(3000)
    expect(r.amortissement_differe).toBe(6000)
    expect(r.benefice_imposable).toBe(0)
  })

  it('adapté de l’exemple officiel (BOI-BIC-AMT-20-40-10-20, §90) : 1 500 déductibles, 2 100 reportables', () => {
    // L'exemple officiel porte sur un véhicule et écarte d'abord 540 € (limite propre aux véhicules de
    // tourisme), d'où 1 560 € reportables ; un logement n'est pas soumis à cette limite.
    const r = exerciceLmnpReel(exercice(2028, 2500, 1000, 3600), ETAT_INITIAL_LMNP, p)
    expect(r.amortissement_deduit).toBe(1500)
    expect(r.amortissement_differe).toBe(2100)
  })

  it('les amortissements différés s’imputent ensuite sous la même limite, sans limite de durée', () => {
    const an1 = exerciceLmnpReel(exercice(2028, 10000, 7000, 9000), ETAT_INITIAL_LMNP, p)
    const an2 = exerciceLmnpReel(exercice(2040, 12000, 4000, 3000), an1.etat, p)
    expect(an2.amortissement_disponible).toBe(9000)
    expect(an2.amortissement_deduit).toBe(8000)
    expect(an2.etat.amortissements_differes.immeuble).toBe(1000)
  })

  it('le montant déduit se répartit entre composants au prorata des montants disponibles', () => {
    const r = exerciceLmnpReel(exercice(2028, 10000, 6000, 6000, 2000), ETAT_INITIAL_LMNP, p)
    expect(r.etat.amortissements_deduits.immeuble).toBeCloseTo(3000, PRECISION)
    expect(r.etat.amortissements_deduits.mobilier).toBeCloseTo(1000, PRECISION)
    expect(r.etat.amortissements_differes).toEqual({ immeuble: 3000, mobilier: 1000 })
  })
})

describe('régime réel : déficits', () => {
  it('seules les charges créent un déficit ; il s’impute après l’amortissement de l’année (§8.4)', () => {
    const an1 = exerciceLmnpReel(exercice(2028, 6000, 8000, 4000), ETAT_INITIAL_LMNP, p)
    expect(an1.deficit_ne).toBe(2000)
    expect(an1.amortissement_deduit).toBe(0)
    expect(an1.etat.amortissements_differes.immeuble).toBe(4000)
    const an2 = exerciceLmnpReel(exercice(2029, 13000, 3000, 4000), an1.etat, p)
    // Résultat avant amortissement 10 000 : 8 000 d'amortissements (4 000 + 4 000 différés), puis 2 000 de déficit.
    expect(an2.amortissement_deduit).toBe(8000)
    expect(an2.deficits_anterieurs_imputes).toBe(2000)
    expect(an2.benefice_imposable).toBe(0)
  })

  it('un déficit qui n’a pas pu s’imputer se périme après 10 ans', () => {
    const an1 = exerciceLmnpReel(exercice(2028, 6000, 8000, 0), ETAT_INITIAL_LMNP, p)
    const an12 = exerciceLmnpReel(exercice(2039, 10000, 2000, 0), an1.etat, p)
    expect(an12.deficits_perimes).toBe(2000)
    expect(an12.benefice_imposable).toBe(8000)
  })

  it('enchaîne les exercices en reportant les stocks', () => {
    const r = simulerLmnpReel([exercice(2028, 10000, 7000, 9000), exercice(2029, 10000, 2000, 9000)], p)
    expect(r.map((x) => x.amortissement_deduit)).toEqual([3000, 8000])
    expect(r[1]?.etat.amortissements_differes.immeuble).toBe(7000)
  })
})

describe('plan d’amortissement par composants (hypothèses à confirmer)', () => {
  const composants = { prix_acquisition: 300000, frais_acquisition: 7500, mobilier: 5000 }

  it('frais passés en charge l’année 1 (arbitrage du 06/10/2026) ; terrain de 15 % non amortissable', () => {
    const plan = planAmortissementLmnp(composants, p)
    expect(plan.terrain).toBeCloseTo(45000, PRECISION)
    expect(plan.bati).toBeCloseTo(255000, PRECISION)
    expect(plan.frais_en_charge).toBe(7500)
  })

  it('option écartée : frais incorporés au prix de revient, amortis hors part du terrain', () => {
    const amortis: ParametresFiscaux = {
      ...p,
      lmnp: {
        ...p.lmnp,
        modelisation: { ...p.lmnp.modelisation, valeur: { ...p.lmnp.modelisation.valeur, frais_acquisition: 'amortis' } },
      },
    }
    const plan = planAmortissementLmnp(composants, amortis)
    expect(plan.bati).toBeCloseTo(307500 * 0.85, PRECISION)
    expect(plan.frais_en_charge).toBe(0)
  })

  it('dotation linéaire : prorata la première année, solde l’année suivant la dernière annuité pleine', () => {
    expect(dotationLineaire(210000, 30, 1, 6)).toBeCloseTo(3500, PRECISION)
    expect(dotationLineaire(210000, 30, 2, 6)).toBeCloseTo(7000, PRECISION)
    expect(dotationLineaire(210000, 30, 31, 6)).toBeCloseTo(3500, PRECISION)
    expect(dotationLineaire(210000, 30, 32, 6)).toBe(0)
    const total = Array.from({ length: 32 }, (_, i) => dotationLineaire(210000, 30, i + 1, 6)).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(210000, PRECISION)
  })
})

describe('micro-BIC, statut et prélèvements sociaux', () => {
  it('abattement de 50 %, avec un minimum de 305 €', () => {
    expect(microBic(2027, 10000, p).benefice_imposable).toBe(5000)
    expect(microBic(2027, 500, p).abattement).toBe(305)
    expect(microBic(2027, 200, p).benefice_imposable).toBe(0)
  })

  it('seuil de 77 700 € pour les revenus 2025, de 83 600 € ensuite', () => {
    expect(microBic(2025, 80000, p).eligible).toBe(false)
    expect(microBic(2026, 80000, p).eligible).toBe(true)
    expect(microBic(2030, 90000, p).motifs_ineligibilite).toHaveLength(1)
  })

  it('professionnel seulement au-delà de 23 000 € de recettes et des autres revenus d’activité', () => {
    expect(statutLoueurMeuble(20000, 10000, p)).toBe('non_professionnel')
    expect(statutLoueurMeuble(30000, 40000, p)).toBe('non_professionnel')
    expect(statutLoueurMeuble(30000, 20000, p)).toBe('professionnel')
  })

  it('prélèvements sociaux de 18,6 % sur le bénéfice', () => {
    expect(prelevementsSociauxLmnp(5000, p)).toBeCloseTo(930, PRECISION)
    expect(prelevementsSociauxLmnp(-1000, p)).toBe(0)
  })
})

describe('revente et choix du régime', () => {
  it('réintègre les amortissements de l’immeuble déduits, pour une cession depuis le 15/02/2025', () => {
    const r = exerciceLmnpReel(exercice(2028, 10000, 6000, 6000, 2000), ETAT_INITIAL_LMNP, p)
    expect(amortissementsReintegresLmnp(r.etat, '2036-06-30', p)).toBeCloseTo(3000, PRECISION)
    expect(amortissementsReintegresLmnp(r.etat, '2025-02-14', p)).toBe(0)
  })

  it('repère la première année où le micro-BIC deviendrait plus favorable', () => {
    const reel = simulerLmnpReel([exercice(2028, 10000, 2000, 9000), exercice(2029, 10000, 2000, 1000)], p)
    const micro = [microBic(2028, 10000, p), microBic(2029, 10000, p)]
    // 2028 : 0 au réel contre 5 000 au micro ; 2029 : 6 000 au réel (2 000 d'amortissements disponibles) contre 5 000.
    expect(anneeBasculeVersMicro(reel, micro)).toBe(2029)
    expect(anneeBasculeVersMicro(reel.slice(0, 1), micro)).toBeNull()
  })
})
