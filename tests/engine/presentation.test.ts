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
