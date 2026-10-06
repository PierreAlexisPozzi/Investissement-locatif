import { describe, expect, it } from 'vitest'
import brut from '../../src/params/fiscal-2026.json'
import {
  estUrlOfficielle,
  hypothesesDefaut,
  listerAnomalies,
  listerParametres,
  parametresFiscaux2026,
  STATUTS_PARAMETRE,
  type Elargi,
  type ParametresFiscaux,
} from '../../src/params'

const donnees: Elargi<ParametresFiscaux> = brut
const copie = (): Elargi<ParametresFiscaux> => structuredClone(donnees)

describe('chargement des paramètres', () => {
  it('le fichier fiscal-2026.json se charge sans anomalie', () => {
    expect(listerAnomalies(donnees)).toEqual([])
    expect(parametresFiscaux2026.meta.date_arret).toBe('2026-10-06')
  })

  it('les hypothèses par défaut se chargent', () => {
    expect(hypothesesDefaut.horizons_ans.valeur.length).toBeGreaterThan(0)
  })

  it('chaque paramètre porte les sept champs du cahier des charges, et au plus un arbitrage en plus', () => {
    const obligatoires = ['commentaire', 'date_verification', 'source', 'statut', 'unite', 'url_officielle', 'valeur']
    const entrees = listerParametres(donnees)
    expect(entrees.length).toBeGreaterThan(50)
    for (const { chemin, parametre } of entrees) {
      const champs = Object.keys(parametre).filter((champ) => champ !== 'arbitrage')
      expect(champs.sort(), chemin).toEqual([...obligatoires].sort())
      expect(STATUTS_PARAMETRE, chemin).toContain(parametre.statut)
    }
  })
})

describe('la validation détecte les anomalies', () => {
  it('un statut inconnu', () => {
    const d = copie()
    Object.assign(d.impot_revenu.bareme, { statut: 'presque_verifie' })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('impot_revenu.bareme : statut')])
  })

  it('une URL hors des domaines officiels', () => {
    const d = copie()
    Object.assign(d.jeanbrun.taux_amortissement, { url_officielle: 'https://www.exemple-promoteur.fr/jeanbrun' })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('jeanbrun.taux_amortissement : URL')])
  })

  it('un paramètre vérifié sans date de vérification', () => {
    const d = copie()
    Object.assign(d.micro_foncier.abattement, { date_verification: null })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('micro_foncier.abattement : un paramètre vérifié')])
  })

  it('une date de vérification postérieure à la date d’arrêt', () => {
    const d = copie()
    Object.assign(d.micro_foncier.abattement, { date_verification: '2027-01-01' })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('postérieure')])
  })

  it('un arbitrage incomplet', () => {
    const d = copie()
    Object.assign(d.micro_foncier.abattement, { arbitrage: { date: '2026-10-06', choix: 'Un choix' } })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('micro_foncier.abattement : arbitrage sans')])
  })

  it('une valeur énumérée inconnue', () => {
    const d = copie()
    Object.assign(d.jeanbrun.prorata_premiere_annee, { valeur: 'quotidien' })
    expect(listerAnomalies(d)).toEqual([expect.stringContaining('jeanbrun.prorata_premiere_annee')])
  })
})

describe('domaines officiels', () => {
  it.each([
    'https://www.legifrance.gouv.fr/eli/loi/2026/2/19/CPPX2524517L/jo/article_47',
    'https://bofip.impots.gouv.fr/bofip/9713-PGP.html',
    'https://www.service-public.gouv.fr/particuliers/vosdroits/F39735',
    'https://entreprendre.service-public.gouv.fr/vosdroits/F23575',
    'https://www.senat.fr/dossier-legislatif/pjlf2026.html',
    'https://www.assemblee-nationale.fr/dyn/17/textes/l17t0227_texte-adopte-seance',
  ])('accepte %s', (url) => {
    expect(estUrlOfficielle(url)).toBe(true)
  })

  it.each([
    'http://www.service-public.gouv.fr/particuliers/vosdroits/F39735',
    'https://impots.gouv.fr.exemple.com/page',
    'https://faux-impots.gouv.fr/page',
    'https://www.promoteur-immobilier.fr/simulation',
    'pas une url',
  ])('refuse %s', (url) => {
    expect(estUrlOfficielle(url)).toBe(false)
  })
})
