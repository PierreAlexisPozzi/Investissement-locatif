import { describe, expect, it } from 'vitest'
import type { Dossier } from '../../src/engine/dossier'
import { formaterEuros, formaterTaux } from '../../src/engine/format'
import { comparerScenarios } from '../../src/engine/indicateurs'
import { colonnesDetailCharges, colonnesTableauAnnuel, lignesIndicateurs, lignesSortie } from '../../src/engine/presentation'
import type { IdScenario, LigneAnnuelle, ResultatSimulation } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p, type ParametresFiscaux } from '../../src/params'
import { dossierAncien, dossierType } from './fixtures/dossier-type'

const PRECISION = 6
const comparaison = comparerScenarios(dossierType, 16, p)
const ancien = comparerScenarios(dossierAncien, 16, p)

const simulation = (c: typeof comparaison, id: IdScenario): ResultatSimulation => {
  const s = c.scenarios.find((r) => r.id === id)?.simulation
  if (s === null || s === undefined) throw new Error(`${id} inéligible`)
  return s
}
const cles = (d: Dossier, id: IdScenario, s: ResultatSimulation, params: ParametresFiscaux = p): string[] =>
  colonnesTableauAnnuel(d, id, s, params).map((c) => c.cle)

/** Toutes les simulations éligibles des deux dossiers d'essai. */
const simulations = [
  ...comparaison.scenarios.flatMap((r) => (r.simulation === null ? [] : [{ d: dossierType, id: r.id, s: r.simulation }])),
  ...ancien.scenarios.flatMap((r) => (r.simulation === null ? [] : [{ d: dossierAncien, id: r.id, s: r.simulation }])),
]

describe('colonnes du tableau annuel (écran 6)', () => {
  it('chaque colonne a un libellé et une formule', () => {
    expect(simulations.map((x) => x.id)).toEqual(expect.arrayContaining(['S0', 'S1', 'S2', 'S3', 'S3_IS', 'S4', 'S5_6', 'S5_9', 'S5_12']))
    for (const { d, id, s } of simulations) {
      for (const c of [...colonnesTableauAnnuel(d, id, s, p), ...colonnesDetailCharges()]) {
        expect(c.libelle, `${id} ${c.cle}`).not.toBe('')
        expect(c.formule.length, `${id} ${c.cle}`).toBeGreaterThan(10)
      }
    }
  })

  it('n’affiche que les colonnes utiles au scénario', () => {
    const s0 = cles(dossierType, 'S0', simulation(comparaison, 'S0'))
    expect(s0).not.toContain('amortissement_deduit')
    expect(s0).not.toContain('decote_loyer')
    expect(s0).not.toContain('creance_taxe_fonciere')
    expect(cles(dossierType, 'S1', simulation(comparaison, 'S1'))).toEqual(expect.arrayContaining(['amortissement_deduit', 'decote_loyer']))
    expect(cles(dossierType, 'S3', simulation(comparaison, 'S3'))).toContain('creance_taxe_fonciere')
    const is = cles(dossierType, 'S3_IS', simulation(comparaison, 'S3_IS'))
    expect(is).toContain('impot_societes')
    expect(is).not.toContain('impot_revenu_differentiel')
    expect(cles(dossierAncien, 'S5_9', simulation(ancien, 'S5_9'))).toEqual(expect.arrayContaining(['reduction_impot_imputee', 'reduction_impot_perdue']))
  })

  it('le flux après impôt se retrouve à partir des autres colonnes, comme le dit sa formule', () => {
    for (const { id, s } of simulations) {
      for (const a of s.annees) {
        const recalcule =
          a.loyers_encaisses -
          a.charges_total -
          a.interets -
          a.assurance_emprunteur -
          a.capital_rembourse +
          a.creance_taxe_fonciere -
          a.impot_revenu_differentiel -
          a.prelevements_sociaux -
          a.impot_societes
        expect(recalcule, `${id} ${String(a.annee)}`).toBeCloseTo(a.flux_tresorerie, PRECISION)
      }
    }
  })

  it('les charges sont la somme de leurs postes', () => {
    const postes = colonnesDetailCharges()
    for (const { id, s } of simulations) {
      for (const a of s.annees) {
        const somme = postes.reduce((total, c) => total + Number(c.valeur(a)), 0)
        expect(somme, `${id} ${String(a.annee)}`).toBeCloseTo(a.charges_total, PRECISION)
      }
    }
  })

  it('les formules citent les valeurs des paramètres et suivent leur modification', () => {
    const s1 = simulation(comparaison, 'S1')
    const amortissement = (params: ParametresFiscaux): string =>
      colonnesTableauAnnuel(dossierType, 'S1', s1, params).find((c) => c.cle === 'amortissement_deduit')?.formule ?? ''
    const jb = p.jeanbrun
    expect(amortissement(p)).toContain(formaterTaux(jb.taux_amortissement.valeur.intermediaire))
    expect(amortissement(p)).toContain(formaterEuros(jb.plafond_annuel.valeur.intermediaire))
    const modifies: ParametresFiscaux = {
      ...p,
      jeanbrun: { ...jb, plafond_annuel: { ...jb.plafond_annuel, valeur: { ...jb.plafond_annuel.valeur, intermediaire: 9000 } } },
    }
    expect(amortissement(modifies)).toContain(formaterEuros(9000))
  })
})

describe('résultat fiscal : la colonne suit sa formule', () => {
  const formule = (d: Dossier, id: IdScenario, s: ResultatSimulation): string =>
    colonnesTableauAnnuel(d, id, s, p).find((c) => c.cle === 'resultat_fiscal')?.formule ?? ''
  const fraisEmprunt = (d: Dossier, a: LigneAnnuelle): number =>
    a.annee === Number(d.bien.date_acquisition.slice(0, 4)) ? d.financement.frais_dossier + d.financement.frais_garantie : 0

  it('location nue et Jeanbrun au réel : loyers − intérêts − assurance − frais d’emprunt − charges − amortissement', () => {
    for (const id of ['S0', 'S1'] as const) {
      const s = simulation(comparaison, id)
      expect(s.regime, id).toBe('reel')
      for (const a of s.annees) {
        const attendu = a.loyers_encaisses - a.interets - a.assurance_emprunteur - fraisEmprunt(dossierType, a) - a.charges_total - a.amortissement_deduit
        expect(a.resultat_fiscal, `${id} ${String(a.annee)}`).toBeCloseTo(attendu, PRECISION)
      }
      expect(formule(dossierType, id, s)).toContain('frais d’emprunt (année de la signature)')
    }
  })

  it('micro-foncier retenu : la colonne reste le résultat au réel, et la formule le dit', () => {
    // Sans crédit ni charges, l'abattement du micro-foncier l'emporte sur les charges réelles.
    const sansCredit: Dossier = {
      ...dossierType,
      bien: { ...dossierType.bien, taxe_fonciere: 0, teom: 0, charges_copropriete_non_recuperables: 0 },
      financement: { ...dossierType.financement, emprunt: 0, differe_mois: 0, frais_dossier: 0, frais_garantie: 0 },
      exploitation: { ...dossierType.exploitation, frais_gestion_part_loyers: 0, assurance_loyers_impayes_part_loyers: 0, assurance_pno_annuelle: 0 },
      hypotheses: { ...dossierType.hypotheses, entretien_part_loyers: 0 },
      foyers: { ...dossierType.foyers, apport_disponible: 400000 },
    }
    const s = comparerScenarios(sansCredit, 16, p).scenarios.find((r) => r.id === 'S0')?.simulation
    if (s === null || s === undefined) throw new Error('S0 inéligible')
    expect(s.regime).toBe('micro')
    for (const a of s.annees) expect(a.resultat_fiscal, String(a.annee)).toBeCloseTo(a.loyers_encaisses - a.charges_total, PRECISION)
    expect(formule(sansCredit, 'S0', s)).toContain(`l’impôt est calculé sur les loyers × (1 − ${formaterTaux(p.micro_foncier.abattement.valeur)})`)
  })

  it('location meublée au réel : nul avant le début de la location, charges reportées sur la première année louée', () => {
    const s = simulation(comparaison, 'S4')
    expect(s.regime).toBe('reel')
    const avant = s.annees.filter((a) => a.mois_location === 0)
    expect(avant.length).toBeGreaterThan(0)
    for (const a of avant) expect(a.resultat_fiscal, String(a.annee)).toBe(0)
    expect(formule(dossierType, 'S4', s)).toContain('Nul avant le début de la location')
  })

  it('SCI à l’IS, année de la signature : frais d’emprunt, de constitution et d’acquisition en charge', () => {
    const s = simulation(comparaison, 'S3_IS')
    const [premiere] = s.annees
    if (premiere === undefined) throw new Error('aucune année')
    const f = dossierType.financement
    const attendu =
      premiere.loyers_encaisses -
      premiere.charges_total -
      premiere.interets -
      premiere.assurance_emprunteur -
      (f.frais_dossier + f.frais_garantie) -
      dossierType.exploitation.sci.constitution -
      dossierType.bien.frais_notaire -
      premiere.amortissement_deduit
    expect(premiere.charges.taxe_fonciere).toBe(0)
    expect(premiere.resultat_fiscal).toBeCloseTo(attendu, PRECISION)
    expect(formule(dossierType, 'S3_IS', s)).toContain('d’acquisition (passés en charge, paramètre lmnp.modelisation)')
  })
})

describe('revente et indicateurs : la formule décrit le calcul', () => {
  it('produit net = prix − frais − capital restant dû − indemnités − impôt de plus-value − complément de TVA − impôt de distribution', () => {
    for (const { d, id, s } of simulations) {
      const o = s.sortie
      const attendu =
        o.prix_revente - o.frais_cession - o.capital_restant_du - o.indemnites_remboursement_anticipe - o.impot_plus_value - o.complement_tva - o.impot_distribution
      expect(o.produit_net, id).toBeCloseTo(attendu, PRECISION)
      const lignes = lignesSortie(d, id, s, p)
      expect(lignes.at(-1)?.cle, id).toBe('produit_net')
      expect(lignes.find((l) => l.cle === 'produit_net')?.valeur(o), id).toBe(o.produit_net)
    }
  })

  it('indicateurs retrouvés à partir du tableau annuel et de la revente', () => {
    for (const i of comparaison.indicateurs) {
      const s = simulation(comparaison, i.id)
      const flux = s.annees.reduce((total, a) => total + a.flux_tresorerie, 0)
      const mois = s.annees.reduce((total, a) => total + a.mois_detention, 0)
      expect(i.effort_mensuel_moyen, i.id).toBeCloseTo(-flux / mois, PRECISION)
      expect(i.enrichissement_net, i.id).toBeCloseTo(-s.apport + flux + s.sortie.produit_net, PRECISION)
      expect(i.capital_net_sortie, i.id).toBe(s.sortie.produit_net)
      expect(i.economie_impot_nette, i.id).toBeCloseTo(i.economie_impot_cumulee - i.reprise_a_la_revente, PRECISION)
      expect(i.creance_taxe_fonciere_cumulee, i.id).toBeCloseTo(
        s.annees.reduce((total, a: LigneAnnuelle) => total + a.creance_taxe_fonciere, 0),
        PRECISION,
      )
    }
  })

  it('chaque indicateur a un libellé, un format et une formule', () => {
    const lignes = lignesIndicateurs(dossierType, p)
    expect(new Set(lignes.map((l) => l.cle)).size).toBe(lignes.length)
    const [premier] = comparaison.indicateurs
    if (premier === undefined) throw new Error('aucun indicateur')
    for (const l of lignes) {
      expect(l.formule.length, l.cle).toBeGreaterThan(10)
      expect(l.cle in premier, l.cle).toBe(true)
      expect(l.valeur(premier), l.cle).toBe(premier[l.cle as keyof typeof premier])
    }
  })
})
