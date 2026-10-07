import { describe, expect, it } from 'vitest'
import { contreExpertiser } from '../../src/engine/contre-expertise'
import type { Dossier } from '../../src/engine/dossier'
import { INTERLOCUTEURS, questionsAPoser, type Interlocuteur, type Question } from '../../src/engine/questions'
import { recommander, type Alerte } from '../../src/engine/recommandation'
import { parametresAConfirmer, SCENARIOS, type IdScenario } from '../../src/engine/scenario'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierAncien, dossierConcubins, dossierType } from './fixtures/dossier-type'
import { simulationOptimiste } from './fixtures/simulation-vendeur'

const a = (interlocuteur: Interlocuteur, questions: readonly Question[]): Question[] => questions.filter((q) => q.interlocuteur === interlocuteur)
const contient = (questions: readonly Question[], extrait: string): boolean => questions.some((q) => q.texte.includes(extrait))

describe('questions à poser (écran 9)', () => {
  it('sont regroupées par interlocuteur, dans l’ordre vendeur, notaire, expert-comptable, banque', () => {
    for (const id of SCENARIOS) {
      const rangs = questionsAPoser(dossierType, id, p).map((q) => INTERLOCUTEURS.indexOf(q.interlocuteur))
      expect(rangs, id).toEqual([...rangs].sort((x, y) => x - y))
    }
  })

  it('chaque valeur à confirmer du scénario donne une question qui la cite', () => {
    for (const id of SCENARIOS) {
      const cites = questionsAPoser(dossierType, id, p).flatMap((q) => (q.parametre === undefined ? [] : [q.parametre]))
      expect(cites, id).toEqual(expect.arrayContaining(parametresAConfirmer(dossierType, id, p)))
      expect(cites, id).toHaveLength(parametresAConfirmer(dossierType, id, p).length)
    }
  })

  it('neuf en VEFA avec emprunt : parking, livraison, références de loyer, puis TAEG, IRA, endettement et différé', () => {
    const q = questionsAPoser(dossierType, 'S0', p)
    expect(contient(a('vendeur', q), 'parking')).toBe(true)
    expect(contient(a('vendeur', q), 'livraison')).toBe(true)
    expect(contient(a('vendeur', q), 'références de marché')).toBe(true)
    expect(a('banque', q).map((x) => x.texte)).toHaveLength(4)
    expect(a('banque', q)[0]?.motif).toContain('25 ans')
    expect(contient(a('notaire', q), 'statuts de SCI')).toBe(false)
  })

  it('selon le scénario : conditions Jeanbrun et LLI au vendeur, statuts de SCI au notaire, régime au comptable', () => {
    const s2 = questionsAPoser(dossierType, 'S2', p)
    expect(contient(a('vendeur', s2), 'conditions du Jeanbrun')).toBe(true)
    expect(a('vendeur', s2).some((x) => x.texte.includes('logements sociaux'))).toBe(true)
    expect(contient(a('notaire', s2), 'statuts de SCI')).toBe(true)
    const s4 = questionsAPoser(dossierType, 'S4', p)
    expect(contient(a('expert_comptable', s4), 'micro-BIC ou réel')).toBe(true)
    expect(contient(a('expert_comptable', s4), 'indivision')).toBe(false)
  })

  it('LLI : la sortie par cession des parts de la SCI, non modélisée, est soumise au notaire', () => {
    for (const id of ['S2', 'S3', 'S3_IS'] as const) {
      const q = a('notaire', questionsAPoser(dossierType, id, p)).find((x) => x.texte.includes('cession des parts de la SCI'))
      expect(q?.motif, id).toContain(p.lli.cession_parts_sans_complement.source)
    }
    expect(contient(questionsAPoser(dossierType, 'S1', p), 'cession des parts de la SCI')).toBe(false)
  })

  it('concubins : convention d’indivision au notaire ; en meublé, déclaration au réel faute de micro-BIC', () => {
    const q = questionsAPoser(dossierConcubins, 'S4', p)
    expect(contient(a('notaire', q), 'convention d’indivision')).toBe(true)
    const indivision = a('expert_comptable', q).find((x) => x.texte.includes('indivision'))
    expect(indivision?.motif).toContain(p.lmnp.micro_bic_exclu_indivision.source)
  })

  it('logement ancien sans emprunt : ni parking ni livraison, aucune question à la banque', () => {
    const d: Dossier = { ...dossierAncien, financement: { ...dossierAncien.financement, emprunt: 0 } }
    const q = questionsAPoser(d, 'S5_9', p)
    expect(contient(q, 'parking')).toBe(false)
    expect(contient(q, 'livraison')).toBe(false)
    expect(a('banque', q)).toEqual([])
  })

  it('reprend les alertes de la recommandation qui concernent le scénario', () => {
    const plafond: Alerte = { code: 'plafond_superieur_marche', message: 'Plafond au-dessus du marché', scenarios: ['S1'] }
    const apport: Alerte = { code: 'apport_insuffisant', message: 'Apport insuffisant', scenarios: [] }
    const pourS1 = questionsAPoser(dossierType, 'S1', p, { alertes: [plafond, apport] })
    expect(pourS1.some((q) => q.interlocuteur === 'vendeur' && q.motif === plafond.message)).toBe(true)
    expect(pourS1.some((q) => q.interlocuteur === 'banque' && q.motif === apport.message)).toBe(true)
    const pourS0 = questionsAPoser(dossierType, 'S0', p, { alertes: [plafond] })
    expect(pourS0.some((q) => q.motif === plafond.message)).toBe(false)
  })

  it('demande au vendeur de justifier chaque hypothèse optimiste de sa simulation', () => {
    const contre = contreExpertiser(dossierType, simulationOptimiste, p)
    expect(contre.hypotheses_optimistes.length).toBeGreaterThan(0)
    const q = questionsAPoser(dossierType, 'S1', p, { contre_expertise: contre })
    for (const h of contre.hypotheses_optimistes) expect(q.some((x) => x.interlocuteur === 'vendeur' && x.motif === h.message), h.code).toBe(true)
  })

  it('s’appuie sur les alertes réelles du dossier d’essai sans erreur', () => {
    const { alertes } = recommander(dossierType, p)
    const ids: IdScenario[] = ['S0', 'S1', 'S4']
    for (const id of ids) expect(questionsAPoser(dossierType, id, p, { alertes }).length, id).toBeGreaterThan(0)
  })
})
