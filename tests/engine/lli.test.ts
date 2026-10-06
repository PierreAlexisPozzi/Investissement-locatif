import { describe, expect, it } from 'vitest'
import { eligibilite } from '../../src/engine/commun'
import {
  complementTvaLli,
  creanceTaxeFonciere,
  economieTvaLli,
  eligibiliteCumulJeanbrunLli,
  eligibiliteLli,
  premieresAnneesSortieSansComplement,
  rangAnneeDepuisLivraison,
  taxeFonciereDeductibleLli,
  type EntreeCreanceTaxeFonciere,
  type EntreeEligibiliteLli,
} from '../../src/engine/lli'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'

const PRECISION = 6

describe('TVA à taux réduit (cahier des charges §13)', () => {
  it('HT 250 000 € : 300 000 € à 20 %, 275 000 € à 10 %, gain 25 000 €', () => {
    const t = economieTvaLli(250000, p)
    expect(t.prix_ttc_taux_normal).toBeCloseTo(300000, PRECISION)
    expect(t.prix_ttc_taux_reduit).toBeCloseTo(275000, PRECISION)
    expect(t.economie).toBeCloseTo(25000, PRECISION)
  })
})

describe('complément de TVA selon l’année de sortie', () => {
  const unique = { prix_ht: 250000, motif: 'cession' as const }

  it('logement unique, cession l’année 12 → 25 000 € dus (§13)', () => {
    const c = complementTvaLli({ ...unique, rang_annee_sortie: 12 }, p)
    expect(c.du).toBe(true)
    expect(c.montant).toBeCloseTo(25000, PRECISION)
  })

  it('logement unique, cession l’année 16 → 0 € (§13)', () => {
    expect(complementTvaLli({ ...unique, rang_annee_sortie: 16 }, p)).toMatchObject({ du: false, montant: 0 })
  })

  it('pendant les 10 premières années, le complément est dû même en cas de cession', () => {
    expect(complementTvaLli({ ...unique, rang_annee_sortie: 10 }, p).du).toBe(true)
    expect(complementTvaLli({ ...unique, rang_annee_sortie: 1 }, p).du).toBe(true)
  })

  it('années 11 à 15 : pas de complément si la société cède la moitié de ses logements au plus', () => {
    const partielle = { ...unique, rang_annee_sortie: 11, logements_detenus: 4, logements_cedes: 2 }
    expect(complementTvaLli(partielle, p).du).toBe(false)
    expect(complementTvaLli({ ...partielle, logements_cedes: 3 }, p).du).toBe(true)
  })

  it('années 16 à 20 : dû si les conditions cessent sans cession ; libre au-delà de 20 ans', () => {
    expect(complementTvaLli({ ...unique, motif: 'fin_des_conditions', rang_annee_sortie: 18 }, p).du).toBe(true)
    expect(complementTvaLli({ ...unique, motif: 'fin_des_conditions', rang_annee_sortie: 21 }, p).du).toBe(false)
  })

  it('le rang de l’année court depuis la livraison', () => {
    expect(rangAnneeDepuisLivraison('2027-06-30', '2037-06-29')).toBe(10)
    expect(rangAnneeDepuisLivraison('2027-06-30', '2037-06-30')).toBe(11)
    expect(rangAnneeDepuisLivraison('2027-06-30', '2042-12-31')).toBe(16)
    expect(() => rangAnneeDepuisLivraison('2027-06-30', '2027-01-01')).toThrow(RangeError)
  })

  it('sortie sans pénalité : 16e année pour un logement unique (§6.6), 11e pour une cession partielle', () => {
    expect(premieresAnneesSortieSansComplement(1, p)).toEqual({ cession_totale: 16, cession_partielle: null })
    expect(premieresAnneesSortieSansComplement(4, p)).toEqual({ cession_totale: 16, cession_partielle: 11 })
  })
})

describe('créance de taxe foncière', () => {
  const base: EntreeCreanceTaxeFonciere = {
    detention: 'sci_ir',
    date_achevement: '2027-06-30',
    taxe_fonciere: 900,
    teom: 150,
    rang_annee: 1,
    annees_exoneration_totale: 0,
  }

  it('taxe foncière 900 € dont TEOM 150 € → créance 750 €/an, versée à la SCI (§13)', () => {
    expect(creanceTaxeFonciere(base, p)).toMatchObject({ eligible: true, duree_ans: 20, montant: 750 })
  })

  it('exemple officiel (BOI-IS-RICI-40-10-20, §50) : 2 ans d’exonération → 18 ans de créance', () => {
    const exonere = { ...base, annees_exoneration_totale: 2 }
    expect(creanceTaxeFonciere(exonere, p).duree_ans).toBe(18)
    expect(creanceTaxeFonciere({ ...exonere, rang_annee: 2 }, p).montant).toBe(0)
    expect(creanceTaxeFonciere({ ...exonere, rang_annee: 3 }, p).montant).toBe(750)
    expect(creanceTaxeFonciere({ ...exonere, rang_annee: 20 }, p).montant).toBe(750)
    expect(creanceTaxeFonciere({ ...exonere, rang_annee: 21 }, p).montant).toBe(0)
  })

  it('réservée aux personnes morales et aux logements achevés depuis le 01/01/2024', () => {
    expect(creanceTaxeFonciere({ ...base, detention: 'nom_propre' }, p).eligible).toBe(false)
    const ancien = creanceTaxeFonciere({ ...base, date_achevement: '2023-12-31' }, p)
    expect(ancien.eligible).toBe(false)
    expect(ancien.montant).toBe(0)
  })

  it('la taxe qui ouvre droit à la créance n’est pas déductible (défaut prudent, à confirmer)', () => {
    expect(taxeFonciereDeductibleLli(750, true, p)).toBe(0)
    expect(taxeFonciereDeductibleLli(750, false, p)).toBe(750)
  })
})

describe('éligibilité au LLI', () => {
  const base: EntreeEligibiliteLli = { etat: 'vefa', detention: 'sci_ir', zone: 'A', mixite_sociale: true }

  it('SCI, logement neuf en zone A, mixité sociale remplie : éligible', () => {
    const r = eligibiliteLli(base, p)
    expect(r.eligible).toBe(true)
    expect(r.avertissements).toHaveLength(1)
  })

  it.each([
    [{ detention: 'nom_propre' as const }, 'personnes morales'],
    [{ etat: 'ancien' as const }, 'neuf'],
    [{ zone: 'B2' as const }, 'zone B2'],
    [{ zone: 'C' as const }, 'zone C'],
    [{ mixite_sociale: false }, 'mixité sociale'],
  ])('motif d’inéligibilité : %o', (modif, extrait) => {
    const r = eligibiliteLli({ ...base, ...modif }, p)
    expect(r.eligible).toBe(false)
    expect(r.motifs.join(' ')).toContain(extrait)
  })

  it('zone B2 sous convention ORT ou contrat de PPA : éligible (arbitrage du 06/10/2026)', () => {
    expect(eligibiliteLli({ ...base, zone: 'B2', perimetre_assimile: 'convention_ort' }, p).eligible).toBe(true)
    expect(eligibiliteLli({ ...base, zone: 'C', perimetre_assimile: 'contrat_ppa' }, p).eligible).toBe(true)
  })
})

describe('cumul Jeanbrun + LLI (S2)', () => {
  const ok = eligibilite([])

  it('non exclu par les textes lus : calculé, avec l’avertissement à faire confirmer', () => {
    const r = eligibiliteCumulJeanbrunLli(ok, ok, p)
    expect(r.eligible).toBe(true)
    expect(r.avertissements.join(' ')).toContain('confirmation écrite')
  })

  it('reprend les motifs de chacun des deux régimes', () => {
    const r = eligibiliteCumulJeanbrunLli(eligibilite(['motif Jeanbrun']), eligibilite(['motif LLI']), p)
    expect(r.motifs).toEqual(['motif Jeanbrun', 'motif LLI'])
  })

  it('si un texte venait à l’exclure, le scénario devient inéligible', () => {
    const exclu: ParametresFiscaux = {
      ...p,
      cumul_jeanbrun_lli: { statut_cumul: { ...p.cumul_jeanbrun_lli.statut_cumul, valeur: 'exclu' } },
    }
    expect(eligibiliteCumulJeanbrunLli(ok, ok, exclu).eligible).toBe(false)
  })
})
