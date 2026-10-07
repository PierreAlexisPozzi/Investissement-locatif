import { describe, expect, it } from 'vitest'
import { dossierVierge } from '../../src/engine/dossier'
import { fichierDossier } from '../../src/engine/dossier-json'
import { parametresFiscaux2026 as p } from '../../src/params'
import { dossierCourant, nomDisponible, reduire, type EtatApplication } from '../../src/ui/etat/etat'
import { etatInitial } from '../../src/ui/etat/initialisation'
import {
  CLE_DOSSIER_COURANT,
  CLE_DOSSIERS,
  ecrireDossierCourant,
  ecrireDossiers,
  lireDossiers,
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
const etat = (dossiers: DossierEnregistre[]): EtatApplication => ({ dossiers, courant: dossiers[0]?.id ?? '', scenario: 'S0', messages: [] })

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

  it('rechargement depuis un autre onglet : dossier courant conservé s’il existe encore', () => {
    const e = { ...etat([enregistre('a', 'A'), enregistre('b', 'B')]), courant: 'b' }
    const action = { type: 'recharger', message: 'm' } as const
    const r = reduire(e, { ...action, dossiers: [enregistre('a', 'A2'), enregistre('b', 'B2'), enregistre('c', 'C')] })
    expect(r.dossiers.map((x) => x.nom)).toEqual(['A2', 'B2', 'C'])
    expect(r.courant).toBe('b')
    expect(r.messages).toEqual(['m'])
    expect(reduire(e, { ...action, dossiers: [enregistre('c', 'C')] }).courant).toBe('c')
    expect(reduire(e, { ...action, dossiers: [] })).toBe(e)
  })

  it('paramètres modifiés : propres au dossier courant, datés ; retrait et réinitialisation', () => {
    const e = etat([enregistre('a', 'A'), enregistre('b', 'B')])
    const abattement = { valeur: 0.35 }
    const r = reduire(e, { type: 'surcharger', chemin: 'micro_foncier.abattement', surcharge: abattement, horodatage: '2026-10-08T00:00:00.000Z' })
    expect(dossierCourant(r).parametres_modifies).toEqual({ 'micro_foncier.abattement': abattement })
    expect(dossierCourant(r).modifie_le).toBe('2026-10-08T00:00:00.000Z')
    expect(r.dossiers[1]).toBe(e.dossiers[1])
    const deux = reduire(r, { type: 'surcharger', chemin: 'micro_foncier.seuil_recettes', surcharge: { valeur: 20000 }, horodatage: H })
    expect(Object.keys(dossierCourant(deux).parametres_modifies ?? {})).toEqual(['micro_foncier.abattement', 'micro_foncier.seuil_recettes'])
    const retire = reduire(r, { type: 'surcharger', chemin: 'micro_foncier.abattement', surcharge: null, horodatage: H })
    expect('parametres_modifies' in dossierCourant(retire)).toBe(false)
    expect('parametres_modifies' in dossierCourant(reduire(deux, { type: 'reinitialiser_surcharges', horodatage: H }))).toBe(false)
    const copie = reduire(r, { type: 'ajouter', dossier: { ...dossierCourant(r), id: 'c', nom: 'A (copie)' } })
    expect(dossierCourant(copie).parametres_modifies).toEqual({ 'micro_foncier.abattement': abattement })
  })

  it('messages sans doublon', () => {
    const e = etat([enregistre('a', 'A')])
    const m = reduire(reduire(e, { type: 'signaler', message: 'x' }), { type: 'signaler', message: 'x' })
    expect(m.messages).toEqual(['x'])
  })
})

describe('stockage local', () => {
  it('écrit puis relit les dossiers au format du fichier d’export ; le dossier ouvert a sa propre clé', () => {
    const s = stockageMemoire()
    const dossiers = [
      { ...enregistre('a', 'Cas type'), simulation_vendeur: simulationOptimiste, parametres_modifies: { 'micro_foncier.abattement': { valeur: 0.35 } } },
      enregistre('b', 'Vierge', dossierVierge('2026-10-07', p)),
    ]
    expect(ecrireDossiers(s, dossiers)).toBeNull()
    ecrireDossierCourant(s, 'b')
    const lu = lireDossiers(s, H)
    expect(lu.erreurs).toEqual([])
    expect(lu.valeur).toEqual({ dossiers, courant: 'b' })
    expect(s.contenu.get(CLE_DOSSIER_COURANT)).toBe('b')
    expect(s.contenu.get(CLE_DOSSIERS)).not.toContain('courant')
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
    const brut = JSON.stringify({ version: 1, dossiers: [valide, invalide] })
    const s = stockageMemoire({ [CLE_DOSSIERS]: brut, [CLE_DOSSIER_COURANT]: 'b' })
    const lu = lireDossiers(s, H)
    expect(lu.valeur.dossiers.map((x) => x.id)).toEqual(['a'])
    expect(lu.valeur.courant).toBe('a')
    expect(lu.erreurs[0]).toMatch(/^Dossier n° 2 illisible \(dossier\.bien\.zone : valeur admise parmi /)
    expect(s.contenu.get(`${CLE_DOSSIERS}.illisible-${H}`)).toBe(brut)
  })

  it('n’écrit pas un contenu identique (pas d’événement inutile dans les autres onglets)', () => {
    const s = stockageMemoire()
    const ecrites: string[] = []
    const compte: Stockage = {
      getItem: (cle) => s.getItem(cle),
      setItem: (cle, valeur) => {
        ecrites.push(cle)
        s.setItem(cle, valeur)
      },
    }
    const dossiers = [enregistre('a', 'A'), enregistre('b', 'B')]
    for (let k = 0; k < 2; k++) {
      ecrireDossiers(compte, dossiers)
      ecrireDossierCourant(compte, 'a')
    }
    expect(ecrites).toEqual([CLE_DOSSIERS, CLE_DOSSIER_COURANT])
  })

  it('deux onglets ouverts sur deux dossiers ne se réécrivent pas l’un l’autre sans fin', () => {
    const partage = stockageMemoire()
    const ecrites: string[] = []
    const stockage: Stockage = {
      getItem: (cle) => partage.getItem(cle),
      setItem: (cle, valeur) => {
        ecrites.push(cle)
        partage.setItem(cle, valeur)
      },
    }
    const dossiers = [enregistre('a', 'A'), enregistre('b', 'B')]
    const onglets: [EtatApplication, EtatApplication] = [{ ...etat(dossiers), courant: 'a' }, { ...etat(dossiers), courant: 'b' }]
    // Comme les effets de l'application et l'événement `storage` du navigateur : un enregistrement des dossiers est
    // relu par l'autre onglet, dont l'état change, ce qui l'enregistre à son tour ; le dossier ouvert n'est écrit
    // que lorsqu'il change.
    const enregistrer = (k: 0 | 1, echanges = 0): void => {
      if (echanges > 10) throw new Error('réécritures sans fin entre les onglets')
      const avant = ecrites.length
      const courant = onglets[k].courant
      ecrireDossiers(stockage, onglets[k].dossiers)
      const autre = k === 0 ? 1 : 0
      if (ecrites.slice(avant).includes(CLE_DOSSIERS)) {
        const ouvert = onglets[autre].courant
        onglets[autre] = reduire(onglets[autre], { type: 'recharger', dossiers: lireDossiers(stockage, H).valeur.dossiers, message: 'm' })
        if (onglets[autre].courant !== ouvert) ecrireDossierCourant(stockage, onglets[autre].courant)
        enregistrer(autre, echanges + 1)
      }
      expect(onglets[k].courant).toBe(courant)
    }
    for (const k of [0, 1] as const) {
      enregistrer(k)
      ecrireDossierCourant(stockage, onglets[k].courant)
    }
    expect(onglets.map((o) => o.courant)).toEqual(['a', 'b'])
    expect(lireDossiers(stockage, H).valeur.courant).toBe('b')

    ecrites.length = 0
    onglets[0] = reduire(onglets[0], { type: 'renommer', nom: 'A2', horodatage: H })
    enregistrer(0)
    expect(ecrites.filter((c) => c === CLE_DOSSIERS).length).toBeLessThanOrEqual(2)
    expect(ecrites).not.toContain(CLE_DOSSIER_COURANT)
    expect(onglets[1].dossiers.map((x) => x.nom)).toEqual(['A2', 'B'])
    expect(onglets.map((o) => o.courant)).toEqual(['a', 'b'])
  })

  it('signale un stockage plein ou indisponible', () => {
    expect(ecrireDossiers(stockageMemoire({}, true), [])).toMatch(/stockage du navigateur plein/)
    expect(ecrireDossiers(null, [])).toMatch(/indisponible/)
    expect(() => {
      ecrireDossierCourant(stockageMemoire({}, true), 'a')
    }).not.toThrow()
  })

  it('état initial : un dossier vierge s’il n’y a rien d’enregistré', () => {
    const e = etatInitial(stockageMemoire(), new Date('2026-10-07T10:00:00'), p)
    expect(e.dossiers).toHaveLength(1)
    expect(e.courant).toBe(e.dossiers[0]?.id)
    expect(e.dossiers[0]?.dossier.bien.date_acquisition).toBe('2026-10-07')
    expect(e.messages).toEqual([])
  })
})
