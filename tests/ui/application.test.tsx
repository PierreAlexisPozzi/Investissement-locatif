// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fichierDossier } from '../../src/engine/dossier-json'
import { parametresFiscaux2026 as p } from '../../src/params'
import { App } from '../../src/ui/App'
import { ECRANS } from '../../src/ui/etat/etat'
import { FournisseurApplication } from '../../src/ui/etat/FournisseurApplication'
import { etatInitial } from '../../src/ui/etat/initialisation'
import { CLE_DOSSIER_COURANT, CLE_DOSSIERS, CLE_PARAMETRES, type Stockage } from '../../src/ui/etat/stockage'
import { dossierType } from '../engine/fixtures/dossier-type'
import { simulationOptimiste } from '../engine/fixtures/simulation-vendeur'

/** Délai laissé aux calculs différés (recommandation complète, sensibilités). */
const ATTENTE_CALCUL = { timeout: 10000 }

function stockageMemoire(initial: Record<string, string> = {}): Stockage & { contenu: Map<string, string> } {
  const contenu = new Map(Object.entries(initial))
  return {
    contenu,
    getItem: (cle) => contenu.get(cle) ?? null,
    setItem: (cle, valeur) => {
      contenu.set(cle, valeur)
    },
  }
}

/** Stockage contenant le dossier d'essai fictif et une simulation de vendeur. */
function stockageEssai(surcharges?: Record<string, unknown>) {
  const dossiers = {
    version: 1,
    dossiers: [{ id: 'essai', fichier: fichierDossier('Cas type (fictif)', dossierType, '2026-10-07T08:00:00.000Z', simulationOptimiste) }],
  }
  return stockageMemoire({
    [CLE_DOSSIERS]: JSON.stringify(dossiers),
    ...(surcharges === undefined ? {} : { [CLE_PARAMETRES]: JSON.stringify(surcharges) }),
  })
}

function monter(stockage: Stockage) {
  render(
    <FournisseurApplication etatInitial={etatInitial(stockage, new Date('2026-10-07T10:00:00'), p)} stockage={stockage} parametresDeBase={p}>
      <App />
    </FournisseurApplication>,
  )
}

const titreEcran = (nom: string | RegExp) => screen.findByRole('heading', { level: 2, name: nom }, ATTENTE_CALCUL)

beforeAll(() => {
  // Les graphiques mesurent leur conteneur ; jsdom ne fait pas de mise en page et mesurerait zéro.
  const rectangle = { x: 0, y: 0, top: 0, left: 0, width: 600, height: 300, right: 600, bottom: 300 }
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ ...rectangle, toJSON: () => rectangle }),
  })
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  })
})

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('application', () => {
  it('dossier vierge : la tranche marginale suit la saisie, les résultats attendent un dossier complet', async () => {
    const user = userEvent.setup()
    const stockage = stockageMemoire()
    monter(stockage)
    await titreEcran('Mon foyer')
    const revenu = screen.getByLabelText('Revenu net imposable annuel')
    await user.clear(revenu)
    await user.type(revenu, '90000')
    const situation = screen.getByRole('complementary', { name: 'Situation fiscale actuelle' })
    expect(within(situation).getByText(/^30\s%$/)).toBeTruthy()

    const enregistre = JSON.parse(stockage.contenu.get(CLE_DOSSIERS) ?? '{}') as { dossiers: { fichier: { dossier: typeof dossierType } }[] }
    expect(enregistre.dossiers[0]?.fichier.dossier.foyers.foyers[0]?.revenu_imposable).toBe(90000)

    await user.click(screen.getByRole('link', { name: /Comparaison/ }))
    await titreEcran('Comparaison')
    expect(screen.getByText('Le dossier n’est pas encore calculable.')).toBeTruthy()
    expect(screen.getByText(/À compléter : .*Prix hors taxes/)).toBeTruthy()
  })

  it('dossier d’essai : chaque écran s’affiche avec ses résultats', async () => {
    const user = userEvent.setup()
    monter(stockageEssai())
    const attendus: Record<string, () => Promise<unknown>> = {
      foyer: () => screen.findByText('Sans l’opération'),
      bien: () => screen.findByText('Éligibilité par dispositif'),
      hypotheses: () => screen.findByRole('button', { name: 'Hypothèses prudentes' }),
      comparaison: () => screen.findByRole('button', { name: 'Exporter en XLSX' }),
      recommandation: () => screen.findByText(/^Ne pas investir/, {}, ATTENTE_CALCUL),
      detail: () => screen.findByText(/^Tornado du TRI/, {}, ATTENTE_CALCUL),
      contre_expertise: () => screen.findByText('Hypothèses optimistes relevées'),
      parametres: () => screen.findByText('jeanbrun.prorata_premiere_annee'),
      questions: () => screen.findByRole('heading', { name: 'Au vendeur' }, ATTENTE_CALCUL),
    }
    for (const e of ECRANS) {
      await user.click(screen.getByRole('link', { name: new RegExp(e.titre) }))
      await titreEcran(e.titre)
      await attendus[e.id]?.()
    }
  }, 60000)

  it('comparaison : scénarios inéligibles grisés avec leurs motifs, formule dépliable', async () => {
    window.location.hash = '/comparaison'
    monter(stockageEssai())
    await titreEcran('Comparaison')
    const tableau = await screen.findByRole('table')
    const enTetes = within(tableau).getAllByRole('columnheader')
    const s59 = enTetes.find((th) => th.textContent.startsWith('S5_9'))
    expect(s59?.className).toBe('ineligible')
    expect(within(tableau).getAllByText('inéligible').length).toBeGreaterThan(0)
    expect(within(tableau).getAllByText(/Denormandie : logement ancien avec travaux uniquement/).length).toBeGreaterThan(0)
    expect(within(tableau).getByText(/Taux qui annule la valeur actuelle des flux/)).toBeTruthy()
  })

  it('paramètres modifiés dans le navigateur : signalés et appliqués', async () => {
    window.location.hash = '/parametres'
    monter(stockageEssai({ 'micro_foncier.abattement': { valeur: 0.35 } }))
    await titreEcran('Paramètres fiscaux')
    expect(screen.getAllByText('1 paramètre(s) modifié(s)').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Exporter fiscal-2026\.json modifié/ })).toBeTruthy()
  })

  it('paramètres modifiés invalides : ignorés, avec leur motif', async () => {
    window.location.hash = '/parametres'
    monter(stockageEssai({ 'micro_foncier.abattement': { valeur: 'trente' } }))
    await titreEcran('Paramètres fiscaux')
    expect(screen.getByText('micro_foncier.abattement : la valeur n’a pas la forme de l’original')).toBeTruthy()
  })

  it('« Imprimer la synthèse » : la synthèse est rendue avant l’ouverture de l’impression, dès le premier clic', async () => {
    const user = userEvent.setup()
    let synthesePresente: boolean | null = null
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {
      synthesePresente = document.querySelector('article.synthese') !== null
    })
    monter(stockageEssai())
    await titreEcran('Mon foyer')
    await user.click(screen.getByRole('button', { name: 'Imprimer la synthèse' }))
    expect(imprimer).toHaveBeenCalledTimes(1)
    expect(synthesePresente).toBe(true)
    imprimer.mockRestore()
  })

  it('le lien d’évitement déplace le focus sans changer d’écran', async () => {
    const user = userEvent.setup()
    window.location.hash = '/hypotheses'
    monter(stockageEssai())
    await titreEcran('Hypothèses')
    await user.click(screen.getByRole('link', { name: 'Aller au contenu' }))
    expect(window.location.hash).toBe('#/hypotheses')
    expect(document.activeElement?.id).toBe('contenu')
    expect(screen.getByRole('heading', { level: 2, name: 'Hypothèses' })).toBeTruthy()
  })

  it('un enregistrement fait dans un autre onglet est rechargé ; son choix de dossier ne l’est pas', async () => {
    const stockage = stockageEssai()
    monter(stockage)
    await titreEcran('Mon foyer')
    stockage.contenu.set(CLE_DOSSIER_COURANT, 'autre')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: CLE_DOSSIER_COURANT }))
    })
    expect(screen.queryByText('Dossiers mis à jour depuis un autre onglet')).toBeNull()
    const autre = JSON.parse(stockage.contenu.get(CLE_DOSSIERS) ?? '{}') as { dossiers: { id: string; fichier: { nom: string } }[] }
    const premier = autre.dossiers[0]
    if (premier === undefined) throw new Error('aucun dossier')
    premier.fichier.nom = 'Renommé ailleurs'
    stockage.contenu.set(CLE_DOSSIERS, JSON.stringify(autre))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: CLE_DOSSIERS }))
    })
    expect(screen.getByRole('option', { name: 'Renommé ailleurs' })).toBeTruthy()
    expect(screen.getByText('Dossiers mis à jour depuis un autre onglet')).toBeTruthy()
  })
})

describe('revenus fonciers existants', () => {
  it('signale un micro-foncier déclaré au-delà du seuil', async () => {
    const user = userEvent.setup()
    window.location.hash = '/foyer'
    monter(stockageEssai())
    await titreEcran('Mon foyer')
    await user.click(screen.getByLabelText('Revenus fonciers d’autres biens loués nus'))
    await user.selectOptions(screen.getByLabelText('Régime'), 'micro')
    expect(screen.queryByText(/le régime réel est obligatoire/)).toBeNull()
    const recettes = screen.getByLabelText('Recettes annuelles')
    await user.clear(recettes)
    await user.type(recettes, String(p.micro_foncier.seuil_recettes.valeur + 1))
    expect(screen.getByText(/le régime réel est obligatoire/)).toBeTruthy()
  })
})
