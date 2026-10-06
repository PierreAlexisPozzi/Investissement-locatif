import { describe, expect, it } from 'vitest'
import { hypothesesParDefaut, objectifsParDefaut, type Dossier, type Objectifs } from '../../src/engine/dossier'
import { avecRevenus } from '../../src/engine/indicateurs'
import { classer, CRITERES, recommander, type Classement, type CodeAlerte } from '../../src/engine/recommandation'
import { SCENARIOS, type IdScenario } from '../../src/engine/scenario'
import { hypothesesDefaut, parametresFiscaux2026 as p, type PonderationsObjectifs } from '../../src/params'
import { dossierAncien, dossierFavorable, dossierType } from './fixtures/dossier-type'

const PRECISION = 6
const NOTE_MAXIMALE = 100

const objectifs = (horizon = 16, autres: Partial<Objectifs> = {}): Objectifs => ({ ...objectifsParDefaut(), horizon, ...autres })
const seulement = (critere: keyof PonderationsObjectifs): PonderationsObjectifs => ({
  economie_impot: 0,
  effort_epargne: 0,
  tri: 0,
  souplesse: 0,
  simplicite: 0,
  transmission: 0,
  [critere]: NOTE_MAXIMALE,
})
const evaluation = (c: Classement, id: IdScenario) => {
  const e = c.evaluations.find((x) => x.id === id)
  if (e === undefined) throw new Error(`${id} absent`)
  return e
}
const classes = (c: Classement) => c.evaluations.filter((e) => e.rang !== null)
const codes = (d: Dossier): CodeAlerte[] => recommander(d, p).alertes.map((a) => a.code)
const alerte = (d: Dossier, code: CodeAlerte) => recommander(d, p).alertes.find((a) => a.code === code)
/** Scénarios visés par toutes les alertes d’un code (certaines alertes sont émises scénario par scénario). */
const vises = (d: Dossier, code: CodeAlerte): IdScenario[] =>
  recommander(d, p).alertes.filter((a) => a.code === code).flatMap((a) => a.scenarios)

describe('barèmes et pondérations par défaut (§5.6, §10.3)', () => {
  it('chaque scénario a une note de souplesse, de simplicité et de transmission ; le LMNP au micro-BIC aussi', () => {
    const r = hypothesesDefaut.recommandation
    for (const id of SCENARIOS) {
      expect(r.souplesse.valeur[id], id).toBeTypeOf('number')
      expect(r.simplicite.valeur[id], id).toBeTypeOf('number')
      expect(r.transmission.valeur[id], id).toBeTypeOf('number')
    }
    expect(r.simplicite.valeur.S4_micro).toBeTypeOf('number')
  })

  it('les barèmes du cahier des charges sont repris', () => {
    const r = hypothesesDefaut.recommandation
    expect(r.souplesse.valeur).toMatchObject({ S4: 90, S0: 80, S5_6: 60, S1: 45, S5_12: 35, S2: 15, S3: 15 })
    expect(r.simplicite.valeur).toMatchObject({ S0: 90, S1: 75, S5_6: 50, S4: 50, S2: 30, S3: 30 })
    expect(r.transmission.valeur).toMatchObject({ S2: 80, S3: 80, S0: 40, S4: 40 })
  })

  it('les pondérations par défaut totalisent 100', () => {
    const o = objectifsParDefaut()
    expect(CRITERES.reduce((total, c) => total + o.ponderations[c], 0)).toBe(NOTE_MAXIMALE)
  })

  it('refuse des pondérations négatives ou toutes nulles', () => {
    const nulles = { ...seulement('tri'), tri: 0 }
    expect(() => classer(dossierType, objectifs(16, { ponderations: nulles }), p)).toThrow(RangeError)
    expect(() => classer(dossierType, objectifs(16, { ponderations: { ...seulement('tri'), souplesse: -1 } }), p)).toThrow(RangeError)
  })
})

describe('filtres d’éligibilité et de faisabilité (§10.1, §10.2)', () => {
  const c = classer(dossierType, objectifs(), p)

  it('un scénario inéligible garde son motif et n’est pas classé', () => {
    const ineligibles = c.evaluations.filter((e) => !e.eligible)
    expect(ineligibles.map((e) => e.id)).toEqual(['S1_social', 'S1_tres_social', 'S5_6', 'S5_9', 'S5_12'])
    expect(ineligibles.every((e) => e.motifs_ineligibilite.length > 0 && e.rang === null && e.score === null)).toBe(true)
  })

  it('effort d’épargne au-delà de la capacité déclarée : non tenable, avec la raison', () => {
    // LLI seul : 848 € par mois les premières années pour 800 € de capacité.
    const s3 = evaluation(c, 'S3')
    expect(s3).toMatchObject({ eligible: true, tenable: false, rang: null })
    expect(s3.motifs_non_tenable[0]).toContain('capacité déclarée')
  })

  it('horizon plus court que les engagements : non tenable', () => {
    // Revente après 12 ans de location : le complément de TVA du LLI reste dû.
    const court = classer(dossierType, objectifs(12), p)
    for (const id of ['S2', 'S3', 'S3_IS'] as const) {
      expect(evaluation(court, id).motifs_non_tenable.some((m) => m.includes('fin des engagements')), id).toBe(true)
    }
    expect(evaluation(court, 'S1').tenable).toBe(true)
  })

  it('taux d’endettement au-delà du seuil : aucun scénario tenable, ne pas investir', () => {
    const endette = classer(avecRevenus(dossierType, 0.4), objectifs(), p)
    const eligibles = endette.evaluations.filter((e) => e.eligible)
    expect(eligibles.every((e) => e.motifs_non_tenable.some((m) => m.includes('endettement')))).toBe(true)
    expect(endette).toMatchObject({ choix: 'placement', meilleur_immobilier: null, placement_domine: true })
  })

  it('ordre de présentation : classés, puis non tenables, puis inéligibles', () => {
    const groupes = c.evaluations.map((e) => (e.rang !== null ? 0 : e.eligible ? 1 : 2))
    expect([...groupes].sort()).toEqual(groupes)
  })
})

describe('score sur 100 (§10.3)', () => {
  const c = classer(dossierFavorable, objectifs(), p)

  it('chaque critère va de 0 à 100 sur les scénarios classés ; le score est la somme des points', () => {
    for (const critere of CRITERES) {
      const notes = classes(c).map((e) => e.notes.find((n) => n.critere === critere)?.note ?? Number.NaN)
      expect(Math.max(...notes), critere).toBeCloseTo(NOTE_MAXIMALE, PRECISION)
      expect(Math.min(...notes), critere).toBeCloseTo(0, PRECISION)
    }
    for (const e of classes(c)) {
      expect(e.score).toBeCloseTo(e.notes.reduce((total, n) => total + n.points, 0), PRECISION)
    }
    const scores = classes(c).map((e) => e.score ?? 0)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(classes(c).map((e) => e.rang)).toEqual(classes(c).map((_, k) => k + 1))
  })

  it('l’effort d’épargne le plus faible reçoit la meilleure note', () => {
    const effort = (id: IdScenario) => evaluation(c, id).notes.find((n) => n.critere === 'effort_epargne')
    const meilleur = classes(c).reduce((m, e) => ((e.indicateurs?.effort_mensuel_moyen ?? 0) < (m.indicateurs?.effort_mensuel_moyen ?? 0) ? e : m))
    expect(effort(meilleur.id)?.note).toBeCloseTo(NOTE_MAXIMALE, PRECISION)
  })

  it('un critère qui ne départage pas donne la note maximale à tous', () => {
    // Les scénarios classés au cas type sont tous en nom propre ou en SCI : la transmission, elle, départage ;
    // avec un barème uniforme, elle ne départage plus.
    const uniforme = Object.fromEntries(SCENARIOS.map((id) => [id, 40]))
    const u = classer(dossierFavorable, objectifs(16, { baremes: { transmission: uniforme } }), p)
    for (const e of classes(u)) expect(e.notes.find((n) => n.critere === 'transmission')?.note).toBe(NOTE_MAXIMALE)
  })

  it('les curseurs orientent le classement : toute la pondération sur la souplesse place le LMNP en tête', () => {
    expect(classer(dossierFavorable, objectifs(16, { ponderations: seulement('souplesse') }), p).meilleur_immobilier).toBe('S4')
    expect(classer(dossierFavorable, objectifs(16, { ponderations: seulement('simplicite') }), p).meilleur_immobilier).toBe('S0')
    expect(classer(dossierFavorable, objectifs(16, { ponderations: seulement('economie_impot') }), p).meilleur_immobilier).toBe('S2')
  })

  it('les barèmes modifiés par l’utilisateur priment sur les valeurs par défaut', () => {
    const souplesse = { S0: NOTE_MAXIMALE }
    const o = objectifs(16, { ponderations: seulement('souplesse'), baremes: { souplesse } })
    expect(classer(dossierFavorable, o, p).meilleur_immobilier).toBe('S0')
  })

  it('LMNP au micro-BIC : la note de simplicité du micro remplace celle du réel', () => {
    // Petit prix, loyer élevé, achat comptant : le micro-BIC est retenu.
    const micro: Dossier = {
      ...dossierFavorable,
      bien: { ...dossierFavorable.bien, prix_ht: 60000, frais_notaire: 2000, loyer_marche_meuble: 3000 },
      financement: { ...dossierFavorable.financement, emprunt: 0, frais_dossier: 0, frais_garantie: 0 },
    }
    const s4 = evaluation(classer(micro, objectifs(), p), 'S4')
    expect(s4.simulation?.regime).toBe('micro')
    expect(s4.notes.find((n) => n.critere === 'simplicite')?.valeur).toBe(hypothesesDefaut.recommandation.simplicite.valeur.S4_micro)
  })
})

describe('cas type : ne pas investir (§3, principe 6, et §10.4)', () => {
  const r = recommander(dossierType, p)

  it('le placement de référence domine tous les scénarios : la phrase le dit sans détour', () => {
    expect(r).toMatchObject({ choix: 'placement', placement_domine: true, meilleur_immobilier: 'S2' })
    expect(r.texte.phrase).toMatch(/^Ne pas investir/)
    expect(r.texte.phrase).toContain('S2')
  })

  it('trois raisons chiffrées, dont le prix de revente qui égalerait le placement', () => {
    expect(r.texte.raisons).toHaveLength(3)
    for (const raison of r.texte.raisons) expect(raison).toMatch(/\d/)
    expect(r.seuils.prix_revente?.prix ?? 0).toBeGreaterThan(r.seuils.prix_revente?.prix_central ?? 0)
    expect(r.texte.raisons[2]).toContain('égaler le placement')
  })

  it('les risques rappellent l’hypothèse du placement et l’engagement du mieux classé', () => {
    expect(r.texte.risques.some((t) => t.startsWith('Le placement de référence suppose'))).toBe(true)
    expect(r.texte.risques.some((t) => t.startsWith('Engagement jusqu’au'))).toBe(true)
  })

  it('non-régression du classement : Jeanbrun + LLI, Jeanbrun, location nue, LMNP', () => {
    expect(classes(r).map((e) => e.id)).toEqual(['S2', 'S1', 'S0', 'S4'])
  })
})

describe('la recommandation change de façon cohérente avec la TMI, l’horizon et le prix de revente (§14)', () => {
  it('TMI : à 30 %, le LMNP ; à 41 %, le Jeanbrun + LLI passe devant', () => {
    expect(classer(dossierFavorable, objectifs(), p).choix).toBe('S4')
    expect(classer(avecRevenus(dossierFavorable, 2.5), objectifs(), p).choix).toBe('S2')
  })

  it('horizon : revendu après 9 ans, la location nue classique est préférable', () => {
    expect(classer(dossierFavorable, objectifs(9), p).choix).toBe('S0')
    expect(classer(dossierFavorable, objectifs(16), p).choix).toBe('S4')
  })

  it('prix de revente : avec la décote et la revalorisation centrales, le placement l’emporte', () => {
    const central: Dossier = { ...dossierFavorable, hypotheses: { ...dossierFavorable.hypotheses, prix: hypothesesParDefaut('central').prix } }
    expect(classer(central, objectifs(), p).choix).toBe('placement')
  })

  it('les seuils de bascule retrouvent ces changements, de part et d’autre du seuil', () => {
    const r = recommander(dossierFavorable, p)
    expect(r.choix).toBe('S4')
    const hausse = r.seuils.revenus_hausse
    if (hausse === null) throw new Error('aucune bascule à la hausse des revenus')
    expect(hausse).toMatchObject({ choix: 'S2', tmi: [0.41], motif: null })
    expect(classer(avecRevenus(dossierFavorable, hausse.facteur), objectifs(), p).choix).toBe('S2')
    expect(classer(avecRevenus(dossierFavorable, hausse.facteur * 0.995), objectifs(), p).choix).toBe('S4')

    // À la baisse, c'est l'endettement qui rend le LMNP non tenable.
    expect(r.seuils.revenus_baisse?.choix).toBe('placement')
    expect(r.seuils.revenus_baisse?.motif).toContain('endettement')

    expect(r.seuils.horizon_plus_court).toMatchObject({ horizon: 11, choix: 'S0', annee_cession: 2039 })
    expect(classer(dossierFavorable, objectifs(12), p).choix).toBe('S4')

    const prix = r.seuils.prix_revente
    expect(prix?.prix ?? 0).toBeLessThan(prix?.prix_central ?? 0)
  })

  it('texte : une phrase avec le score et le TRI, trois raisons, les bascules chiffrées', () => {
    const r = recommander(dossierFavorable, p)
    expect(r.texte.phrase).toMatch(/^Recommandation : S4 \(LMNP\), score de \d+\/100, TRI après impôt de/)
    expect(r.texte.raisons).toHaveLength(3)
    expect(r.texte.bascules[0]).toMatch(/^En dessous de .* de prix de revente/)
    expect(r.texte.bascules.some((t) => t.includes('tranche marginale de 41') && t.includes('S2 (Jeanbrun + LLI'))).toBe(true)
    expect(r.texte.bascules.some((t) => t.startsWith('En revendant après 11 ans'))).toBe(true)
  })

  it('aucun scénario tenable : ne pas investir, avec les motifs', () => {
    const sansCapacite: Dossier = { ...dossierType, foyers: { ...dossierType.foyers, capacite_epargne_mensuelle: 0 } }
    const r = recommander(sansCapacite, p)
    expect(r.choix).toBe('placement')
    expect(r.texte.phrase).toContain('aucun scénario n’est à la fois éligible et tenable')
    expect(r.texte.raisons[0]).toContain('capacité déclarée')
  })
})

describe('alertes toujours évaluées (§10.5)', () => {
  it('prix du neuf supérieur de plus de 20 % à l’ancien récent du quartier', () => {
    // 300 000 € TTC pour 45 m², soit 6 667 €/m², contre 5 500 €/m² dans l’ancien récent.
    expect(alerte(dossierType, 'prix_neuf_eleve')?.scenarios).toEqual([])
    const proche: Dossier = { ...dossierType, bien: { ...dossierType.bien, prix_m2_ancien_recent: 6000 } }
    expect(codes(proche)).not.toContain('prix_neuf_eleve')
  })

  it('loyer plafond supérieur au loyer de marché', () => {
    // Plafond intermédiaire de 738 € pour 45 m² en zone A, marché à 600 €.
    const bas: Dossier = { ...dossierType, bien: { ...dossierType.bien, loyer_marche_nu: 600 } }
    expect(alerte(bas, 'plafond_superieur_marche')?.scenarios).toEqual(expect.arrayContaining(['S1', 'S2', 'S3']))
    expect(codes(dossierType)).not.toContain('plafond_superieur_marche')
  })

  it('TMI de 11 % ou moins : l’avantage Jeanbrun est faible', () => {
    expect(alerte(avecRevenus(dossierType, 0.5), 'tmi_faible')?.scenarios).toEqual(expect.arrayContaining(['S1', 'S2']))
    expect(codes(dossierType)).not.toContain('tmi_faible')
  })

  it('baisse de revenus prévue pendant l’engagement', () => {
    const baisse: Dossier = {
      ...dossierType,
      foyers: {
        ...dossierType.foyers,
        foyers: [{ libelle: 'Couple', revenu_imposable: 90000, parts: 2, quote_part: 1, changement_revenu: { annee: 2030, revenu_imposable: 40000 } }],
      },
    }
    const a = alerte(baisse, 'tmi_en_baisse')
    expect(a?.scenarios).toEqual(expect.arrayContaining(['S1', 'S2']))
    expect(a?.scenarios).not.toContain('S0')
  })

  it('Denormandie : réduction perdue faute d’impôt suffisant', () => {
    const modeste: Dossier = {
      ...dossierAncien,
      foyers: { ...dossierAncien.foyers, foyers: [{ libelle: 'Couple', revenu_imposable: 30000, parts: 2, quote_part: 1 }] },
    }
    expect(vises(modeste, 'reduction_perdue')).toEqual(expect.arrayContaining(['S5_6', 'S5_9', 'S5_12']))
  })

  it('Jeanbrun : amortissement plafonné au-delà du seuil de prix, pour le seul S1 au cas type', () => {
    // S1 : 300 000 € TTC, au-delà de 285 714 € ; S2 : 275 000 € TTC à 10 %, en deçà.
    expect(vises(dossierType, 'jeanbrun_plafonne')).toEqual(['S1'])
  })

  it('valeurs à confirmer utilisées par le scénario retenu ou le mieux classé', () => {
    expect(alerte(dossierType, 'valeurs_a_confirmer')?.message).toContain('lli.tva_taux_normal')
  })

  it('fonds propres nécessaires au-delà de l’apport disponible', () => {
    // Prix TTC à 20 % et frais : 61 000 € de fonds propres pour 40 000 € d’apport ; le LLI en demande moins.
    const a = alerte(dossierType, 'apport_insuffisant')
    expect(a?.scenarios).toEqual(expect.arrayContaining(['S0', 'S1', 'S4']))
    expect(a?.scenarios).not.toContain('S2')
  })

  it('effort de la pire année au-delà de la capacité, pour les scénarios tenables', () => {
    // Pire année (2028, construction et premiers loyers) : 860 € pour S2, 871 € pour S0, 934 € pour S4, 773 € pour S1.
    expect(vises(dossierType, 'effort_pire_annee').sort()).toEqual(['S0', 'S2', 'S4'])
  })

  it('endettement actuel déjà au-delà du seuil', () => {
    const endette: Dossier = {
      ...dossierType,
      foyers: {
        ...dossierType.foyers,
        foyers: [{ libelle: 'Couple', revenu_imposable: 90000, parts: 2, quote_part: 1, mensualites_credits_en_cours: 3000 }],
      },
    }
    expect(codes(endette)).toContain('endettement_actuel')
    expect(codes(dossierType)).not.toContain('endettement_actuel')
  })
})
