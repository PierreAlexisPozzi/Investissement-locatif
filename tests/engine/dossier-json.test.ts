import { describe, expect, it } from 'vitest'
import { objectifsParDefaut, type Dossier } from '../../src/engine/dossier'
import { fichierDossier, FORMAT_FICHIER_DOSSIER, lireFichierDossier, VERSION_FICHIER_DOSSIER } from '../../src/engine/dossier-json'
import { dossierAncien, dossierConcubins, dossierType } from './fixtures/dossier-type'
import { simulationOptimiste, simulationPrudente } from './fixtures/simulation-vendeur'

const HORODATAGE = '2026-10-07T08:00:00.000Z'

/** Fichier tel qu'il serait relu après un export : passage par le texte JSON. */
const exporte = (d: Dossier, nom = 'Essai'): unknown => JSON.parse(JSON.stringify(fichierDossier(nom, d, HORODATAGE)))

/** Fichier exporté dont on altère le dossier brut. */
function altere(modifier: (dossier: Record<string, Record<string, unknown>>) => void): unknown {
  const brut = exporte(dossierType) as { dossier: Record<string, Record<string, unknown>> }
  modifier(brut.dossier)
  return brut
}

const erreurs = (contenu: unknown): readonly string[] => {
  const lu = lireFichierDossier(contenu)
  return lu.ok ? [] : lu.erreurs
}

describe('export et relecture d’un dossier JSON', () => {
  it('relit à l’identique les dossiers d’essai, objectifs compris', () => {
    const avecObjectifs: Dossier = {
      ...dossierType,
      objectifs: { ...objectifsParDefaut(), horizon: 12, baremes: { souplesse: { S0: 80 } } },
      bien: { ...dossierType.bien, commune: 'Commune fictive', nombre_pieces: 2, qpv: false, dpe_apres: 'A' },
    }
    for (const d of [dossierType, dossierAncien, dossierConcubins, avecObjectifs]) {
      const lu = lireFichierDossier(exporte(d))
      expect(lu).toEqual({ ok: true, nom: 'Essai', dossier: d, anomalies: [] })
    }
  })

  it('conserve la simulation du vendeur saisie pour la contre-expertise', () => {
    for (const v of [simulationOptimiste, simulationPrudente]) {
      const lu = lireFichierDossier(JSON.parse(JSON.stringify(fichierDossier('Essai', dossierType, HORODATAGE, v))))
      expect(lu).toEqual({ ok: true, nom: 'Essai', dossier: dossierType, simulation_vendeur: v, anomalies: [] })
    }
    const brut = JSON.parse(JSON.stringify(fichierDossier('Essai', dossierType, HORODATAGE, { ...simulationOptimiste, scenario: 'S9' as 'S1' }))) as unknown
    expect(erreurs(brut)).toEqual([expect.stringMatching(/^simulation_vendeur\.scenario : valeur admise parmi /) as unknown])
  })

  it('conserve les paramètres fiscaux modifiés pour le dossier ; n’écrit rien quand il n’y en a pas', () => {
    const modifies = {
      'micro_foncier.abattement': { valeur: 0.35, statut: 'a_confirmer' as const, date_verification: null },
      'impot_revenu.plafonnement_global_niches': { date_verification: '2026-10-07' },
    }
    const relu = (contenu: unknown) => lireFichierDossier(JSON.parse(JSON.stringify(contenu)))
    expect(relu(fichierDossier('Essai', dossierType, HORODATAGE, undefined, modifies))).toEqual({
      ok: true,
      nom: 'Essai',
      dossier: dossierType,
      parametres_modifies: modifies,
      anomalies: [],
    })
    expect('parametres_modifies' in fichierDossier('Essai', dossierType, HORODATAGE, undefined, {})).toBe(false)
    expect(relu(fichierDossier('Essai', dossierType, HORODATAGE))).toEqual({ ok: true, nom: 'Essai', dossier: dossierType, anomalies: [] })
  })

  it('refuse des paramètres modifiés mal formés, en citant leur chemin', () => {
    const avec = (parametres_modifies: unknown) => ({ ...fichierDossier('Essai', dossierType, HORODATAGE), parametres_modifies })
    expect(erreurs(avec([]))).toEqual(['parametres_modifies : objet attendu'])
    // Clé « __proto__ » propre, comme la produit JSON.parse : refusée au lieu de changer le prototype.
    const injecte = JSON.parse('{"__proto__": {"valeur": 1}}') as unknown
    expect(erreurs(avec(injecte))).toEqual(['parametres_modifies : « __proto__ » n’est pas un chemin de paramètre'])
    expect(erreurs(avec({ abattement: { valeur: 1 } }))).toEqual(['parametres_modifies : « abattement » n’est pas un chemin de paramètre'])
    expect(erreurs(avec({ 'micro_foncier.abattement': { statut: 'douteux' } }))).toEqual([
      expect.stringMatching(/^parametres_modifies\.micro_foncier\.abattement\.statut : valeur admise parmi /) as unknown,
    ])
    expect(erreurs(avec({ 'micro_foncier.abattement': { date_verification: '07/10/2026' } }))).toEqual([
      'parametres_modifies.micro_foncier.abattement.date_verification : date AAAA-MM-JJ attendue',
    ])
  })

  it('l’en-tête du fichier identifie le format et sa version', () => {
    expect(fichierDossier('Essai', dossierType, HORODATAGE)).toMatchObject({
      format: FORMAT_FICHIER_DOSSIER,
      version: VERSION_FICHIER_DOSSIER,
      nom: 'Essai',
      enregistre_le: HORODATAGE,
    })
  })

  it('refuse un contenu qui n’est pas un dossier de l’outil ou d’une autre version', () => {
    expect(erreurs(null)).toEqual(['Le fichier ne contient pas un dossier'])
    expect(erreurs([])).toEqual(['Le fichier ne contient pas un dossier'])
    expect(erreurs({ format: 'autre', version: 1 })).toEqual(['Ce fichier n’est pas un dossier de cet outil'])
    expect(erreurs({ format: FORMAT_FICHIER_DOSSIER, version: 99 })).toEqual(['Version de dossier non prise en charge : 99'])
  })

  it('signale chaque valeur invalide avec son chemin', () => {
    const e = erreurs(
      altere((d) => {
        ;(d.bien as Record<string, unknown>).prix_ht = '250000'
        ;(d.bien as Record<string, unknown>).zone = 'Z'
        ;(d.bien as Record<string, unknown>).date_livraison = '2028-13-01'
        ;(d.financement as Record<string, unknown>).emprunt = -1
        delete (d.foyers as Record<string, unknown>).apport_disponible
      }),
    )
    expect(e).toEqual(
      expect.arrayContaining([
        'dossier.bien.prix_ht : nombre attendu',
        expect.stringMatching(/^dossier\.bien\.zone : valeur admise parmi /) as unknown,
        'dossier.bien.date_livraison : date AAAA-MM-JJ attendue',
        'dossier.financement.emprunt : valeur inférieure à 0',
        'dossier.foyers.apport_disponible : champ manquant',
      ]),
    )
    expect(e).toHaveLength(5)
  })

  it('signale les éléments invalides d’une liste avec leur rang', () => {
    const e = erreurs(
      altere((d) => {
        ;(d.foyers as Record<string, unknown>).foyers = [{ libelle: 'Couple', revenu_imposable: 'beaucoup', parts: 2, quote_part: 1 }]
      }),
    )
    expect(e).toEqual(['dossier.foyers.foyers[0].revenu_imposable : nombre attendu'])
  })

  it('ignore les champs inconnus, y compris un prototype injecté', () => {
    const brut = JSON.parse(
      JSON.stringify(fichierDossier('Essai', dossierType, HORODATAGE)).replace('"zone":"A"', '"zone":"A","inconnu":1,"__proto__":{"pollue":true}'),
    ) as { dossier: { bien: Record<string, unknown> } }
    expect(Object.hasOwn(brut.dossier.bien, 'inconnu') && Object.hasOwn(brut.dossier.bien, '__proto__')).toBe(true)
    const lu = lireFichierDossier(brut)
    if (!lu.ok) throw new Error(lu.erreurs.join(' ; '))
    expect(lu.dossier).toEqual(dossierType)
    expect(Object.keys(lu.dossier.bien)).not.toContain('inconnu')
    expect(({} as Record<string, unknown>).pollue).toBeUndefined()
    expect(Object.getPrototypeOf(lu.dossier.bien)).toBe(Object.prototype)
  })

  it('n’ajoute pas de champ optionnel absent du fichier', () => {
    const lu = lireFichierDossier(exporte(dossierType))
    if (!lu.ok) throw new Error(lu.erreurs.join(' ; '))
    expect('travaux' in lu.dossier.bien).toBe(false)
    expect('objectifs' in lu.dossier).toBe(false)
  })

  it('relit un dossier incohérent mais en signale les anomalies', () => {
    const d: Dossier = { ...dossierConcubins, foyers: { ...dossierConcubins.foyers, foyers: dossierType.foyers.foyers } }
    const lu = lireFichierDossier(exporte(d))
    expect(lu.ok).toBe(true)
    if (lu.ok) expect(lu.anomalies.length).toBeGreaterThan(0)
  })

  it('refuse un horizon de recommandation nul', () => {
    const e = erreurs(exporte({ ...dossierType, objectifs: { ...objectifsParDefaut(), horizon: 0 } }))
    expect(e).toEqual(['dossier.objectifs.horizon : valeur inférieure à 1'])
  })
})
