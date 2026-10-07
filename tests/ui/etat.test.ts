import { describe, expect, it } from 'vitest'
import { dossierVierge } from '../../src/engine/dossier'
import { fichierDossier } from '../../src/engine/dossier-json'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierCourant, nomDisponible, reduire, type EtatApplication } from '../../src/ui/etat/etat'
import { etatInitial } from '../../src/ui/etat/initialisation'
import {
  CLE_DOSSIERS,
  CLE_PARAMETRES,
  ecrireDossiers,
  ecrireSurcharges,
  lireDossiers,
  lireSurcharges,
  type DossierEnregistre,
  type Stockage,
} from '../../src/ui/etat/stockage'
import { dossierType } from '../engine/fixtures/dossier-type'
import { simulationOptimiste } from '../engine/fixtures/simulation-vendeur'

const H = '2026-10-07T08:00:00.000Z'

/** Stockage en mémoire ; `plein` simule un dépassement de quota. */
function stockageMemoire(initial: Record<string, string> = {}, plein = false): Stockage & { contenu: Map<string, string> } {
  const contenu = new Map(Object.entries(initial))
  return {
    contenu,
    getItem: (cle) => contenu.get(cle) ?? null,
    setItem: (cle, valeur) => {
      if (plein) throw new DOMException('Quota dépassé', 'QuotaExceededError')
      contenu.set(cle, valeur)
    },
  }
}

const enregistre = (id: string, nom: string, dossier = dossierType): DossierEnregistre => ({ id, nom, dossier, modifie_le: H })
const etat = (dossiers: DossierEnregistre[]): EtatApplication => ({ dossiers, courant: dossiers[0]?.id ?? '', surcharges: {}, scenario: 'S0', messages: [] })

describe('réducteur de l’état de l’application', () => {
  it('modifie le dossier courant seulement, et le date', () => {
    const e = etat([enregistre('a', 'A'), enregistre('b', 'B')])
    const r = reduire(e, { type: 'modifier_dossier', modifier: (d) => ({ ...d, bien: { ...d.bien, zone: 'B1' } }), horodatage: '2026-10-08T00:00:00.000Z' })
    expect(dossierCourant(r).dossier.bien.zone).toBe('B1')
    expect(dossierCourant(r).modifie_le).toBe('2026-10-08T00:00:00.000Z')
    expect(r.dossiers[1]?.dossier.bien.zone).toBe('A')
  })

  it('ajoute un dossier sous un nom libre et le sélectionne', () => {
    const r = reduire(etat([enregistre('a', 'Dossier')]), { type: 'ajouter', dossier: enregistre('b', 'Dossier') })
    expect(r.dossiers.map((x) => x.nom)).toEqual(['Dossier', 'Dossier (2)'])
    expect(r.courant).toBe('b')
    expect(nomDisponible(r.dossiers, 'Dossier')).toBe('Dossier (3)')
  })

  it('renomme sans doublon ni nom vide', () => {
    const e = etat([enregistre('a', 'A'), enregistre('b', 'B')])
    expect(dossierCourant(reduire(e, { type: 'renommer', nom: '  B ', horodatage: H })).nom).toBe('B (2)')
    expect(reduire(e, { type: 'renommer', nom: '  ', horodatage: H })).toBe(e)
  })

  it('supprime le dossier courant ; le dernier est remplacé par un dossier vierge', () => {
    const e = etat([enregistre('a', 'A'), enregistre('b', 'B')])
    const r = reduire(e, { type: 'supprimer', remplacant: enregistre('v', 'Vierge') })
    expect(r.dossiers.map((x) => x.id)).toEqual(['b'])
    expect(r.courant).toBe('b')
    const dernier = reduire(r, { type: 'supprimer', remplacant: enregistre('v', 'Vierge') })
    expect(dernier.dossiers.map((x) => x.id)).toEqual(['v'])
  })

  it('simulation du vendeur : ajout puis retrait', () => {
    const e = etat([enregistre('a', 'A')])
    const avec = reduire(e, { type: 'modifier_vendeur', simulation: simulationOptimiste, horodatage: H })
    expect(dossierCourant(avec).simulation_vendeur).toEqual(simulationOptimiste)
    const sans = reduire(avec, { type: 'modifier_vendeur', simulation: undefined, horodatage: H })
    expect('simulation_vendeur' in dossierCourant(sans)).toBe(false)
  })

  it('paramètres modifiés : ajout, retrait, réinitialisation ; messages sans doublon', () => {
    const e = etat([enregistre('a', 'A')])
    const r = reduire(e, { type: 'surcharger', chemin: 'micro_foncier.abattement', surcharge: { valeur: 0.35 } })
    expect(r.surcharges).toEqual({ 'micro_foncier.abattement': { valeur: 0.35 } })
    expect(reduire(r, { type: 'surcharger', chemin: 'micro_foncier.abattement', surcharge: null }).surcharges).toEqual({})
    expect(reduire(r, { type: 'reinitialiser_surcharges' }).surcharges).toEqual({})
    const m = reduire(reduire(e, { type: 'signaler', message: 'x' }), { type: 'signaler', message: 'x' })
    expect(m.messages).toEqual(['x'])
  })
})

describe('stockage local', () => {
  it('écrit puis relit les dossiers au format du fichier d’export', () => {
    const s = stockageMemoire()
    const dossiers = [{ ...enregistre('a', 'Cas type'), simulation_vendeur: simulationOptimiste }, enregistre('b', 'Vierge', dossierVierge('2026-10-07', p))]
    expect(ecrireDossiers(s, { dossiers, courant: 'b' })).toBeNull()
    const lu = lireDossiers(s, H)
    expect(lu.erreurs).toEqual([])
    expect(lu.valeur).toEqual({ dossiers, courant: 'b' })
  })

  it('met de côté un contenu illisible au lieu de l’écraser', () => {
    const s = stockageMemoire({ [CLE_DOSSIERS]: '{pas du json' })
    const lu = lireDossiers(s, H)
    expect(lu.valeur.dossiers).toEqual([])
    expect(lu.erreurs[0]).toContain(`${CLE_DOSSIERS}.illisible-${H}`)
    expect(s.contenu.get(`${CLE_DOSSIERS}.illisible-${H}`)).toBe('{pas du json')
  })

  it('écarte un dossier invalide, garde les autres et conserve l’original', () => {
    const valide = { id: 'a', fichier: fichierDossier('A', dossierType, H) }
    const invalide = { id: 'b', fichier: { ...fichierDossier('B', dossierType, H), dossier: { ...dossierType, bien: { ...dossierType.bien, zone: 'Z' } } } }
    const brut = JSON.stringify({ version: 1, courant: 'b', dossiers: [valide, invalide] })
    const s = stockageMemoire({ [CLE_DOSSIERS]: brut })
    const lu = lireDossiers(s, H)
    expect(lu.valeur.dossiers.map((x) => x.id)).toEqual(['a'])
    expect(lu.valeur.courant).toBe('a')
    expect(lu.erreurs[0]).toMatch(/^Dossier n° 2 illisible \(dossier\.bien\.zone : valeur admise parmi /)
    expect(s.contenu.get(`${CLE_DOSSIERS}.illisible-${H}`)).toBe(brut)
  })

  it('signale un stockage plein ou indisponible', () => {
    expect(ecrireDossiers(stockageMemoire({}, true), { dossiers: [], courant: null })).toMatch(/stockage du navigateur plein/)
    expect(ecrireDossiers(null, { dossiers: [], courant: null })).toMatch(/indisponible/)
    expect(ecrireSurcharges(stockageMemoire({}, true), {})).toMatch(/plein/)
  })

  it('paramètres modifiés : relecture et contenu illisible mis de côté', () => {
    const s = stockageMemoire()
    expect(ecrireSurcharges(s, { 'micro_foncier.abattement': { valeur: 0.35 } })).toBeNull()
    expect(lireSurcharges(s, H)).toEqual({ valeur: { 'micro_foncier.abattement': { valeur: 0.35 } }, erreurs: [] })
    const abime = stockageMemoire({ [CLE_PARAMETRES]: '[1, 2]' })
    const lu = lireSurcharges(abime, H)
    expect(lu.valeur).toEqual({})
    expect(lu.erreurs).toHaveLength(1)
  })

  it('état initial : un dossier vierge s’il n’y a rien d’enregistré', () => {
    const e = etatInitial(stockageMemoire(), new Date('2026-10-07T10:00:00'), p)
    expect(e.dossiers).toHaveLength(1)
    expect(e.courant).toBe(e.dossiers[0]?.id)
    expect(e.dossiers[0]?.dossier.bien.date_acquisition).toBe('2026-10-07')
    expect(e.messages).toEqual([])
  })
})
