/**
 * Persistance locale (§4) : les dossiers, avec leurs paramètres modifiés,
 * vivent dans le `localStorage` du navigateur, jamais dans le dépôt. Chaque
 * dossier est stocké au format du fichier d'export et relu avec les mêmes
 * contrôles. Un contenu illisible est mis de côté avant d'être remplacé.
 */
import type { SimulationVendeur } from '../../engine/contre-expertise'
import type { Dossier } from '../../engine/dossier'
import { fichierDossier, lireFichierDossier, type FichierDossier } from '../../engine/dossier-json'
import type { SurchargesParametres } from '../../params'

export const CLE_DOSSIERS = 'investissement-locatif/dossiers'
/**
 * Dossier ouvert, à part des dossiers : chaque onglet garde le sien (deux onglets sur deux dossiers ne se réécrivent
 * pas l'un l'autre) ; le dernier choisi sert au lancement suivant.
 */
export const CLE_DOSSIER_COURANT = 'investissement-locatif/dossier-courant'
const VERSION_STOCKAGE = 1

/** Sous-ensemble de l'interface `Storage`, remplaçable dans les tests. */
export interface Stockage {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
}

export interface DossierEnregistre {
  readonly id: string
  readonly nom: string
  readonly dossier: Dossier
  readonly simulation_vendeur?: SimulationVendeur
  /** Paramètres fiscaux modifiés pour ce dossier seulement (écran 8). */
  readonly parametres_modifies?: SurchargesParametres
  /** Horodatage ISO de la dernière modification. */
  readonly modifie_le: string
}

export interface EtatDossiers {
  readonly dossiers: readonly DossierEnregistre[]
  readonly courant: string | null
}

export interface Lecture<T> {
  readonly valeur: T
  /** Contenus écartés, et où ils ont été mis de côté. */
  readonly erreurs: readonly string[]
}

/** `localStorage` s'il est accessible (navigation privée stricte, iframe isolée : non). */
export function stockageNavigateur(): Stockage | null {
  try {
    const s = window.localStorage
    const essai = `${CLE_DOSSIERS}/essai`
    s.setItem(essai, '1')
    s.removeItem(essai)
    return s
  } catch {
    return null
  }
}

function lireJson(stockage: Stockage, cle: string): { ok: true; contenu: unknown } | { ok: false } {
  const brut = stockage.getItem(cle)
  if (brut === null) return { ok: true, contenu: undefined }
  try {
    return { ok: true, contenu: JSON.parse(brut) as unknown }
  } catch {
    return { ok: false }
  }
}

/** Copie un contenu illisible sous une clé datée, pour ne jamais l'écraser sans trace. */
function mettreDeCote(stockage: Stockage, cle: string, horodatage: string): string {
  const copie = `${cle}.illisible-${horodatage}`
  try {
    stockage.setItem(copie, stockage.getItem(cle) ?? '')
    return `copie conservée sous la clé « ${copie} »`
  } catch {
    return 'copie impossible (stockage plein)'
  }
}

function estObjet(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Dossiers enregistrés ; ceux qui ne se relisent plus sont signalés et mis de côté. */
export function lireDossiers(stockage: Stockage | null, horodatage: string): Lecture<EtatDossiers> {
  const vide: EtatDossiers = { dossiers: [], courant: null }
  if (stockage === null) return { valeur: vide, erreurs: [] }
  const lu = lireJson(stockage, CLE_DOSSIERS)
  if (!lu.ok || (lu.contenu !== undefined && (!estObjet(lu.contenu) || lu.contenu.version !== VERSION_STOCKAGE || !Array.isArray(lu.contenu.dossiers)))) {
    return { valeur: vide, erreurs: [`Dossiers enregistrés illisibles : ${mettreDeCote(stockage, CLE_DOSSIERS, horodatage)}`] }
  }
  if (lu.contenu === undefined) return { valeur: vide, erreurs: [] }
  const contenu = lu.contenu as { dossiers: unknown[] }
  const dossiers: DossierEnregistre[] = []
  const erreurs: string[] = []
  for (const [k, entree] of contenu.dossiers.entries()) {
    const id = estObjet(entree) && typeof entree.id === 'string' ? entree.id : null
    const lecture = estObjet(entree) ? lireFichierDossier(entree.fichier) : null
    if (id === null || lecture === null || !lecture.ok) {
      const detail = lecture !== null && !lecture.ok ? ` (${lecture.erreurs.slice(0, 3).join(' ; ')})` : ''
      erreurs.push(`Dossier n° ${String(k + 1)} illisible${detail}`)
      continue
    }
    const fichier = (entree as { fichier: FichierDossier }).fichier
    dossiers.push({
      id,
      nom: lecture.nom,
      dossier: lecture.dossier,
      ...(lecture.simulation_vendeur === undefined ? {} : { simulation_vendeur: lecture.simulation_vendeur }),
      ...(lecture.parametres_modifies === undefined ? {} : { parametres_modifies: lecture.parametres_modifies }),
      modifie_le: typeof fichier.enregistre_le === 'string' ? fichier.enregistre_le : horodatage,
    })
  }
  if (erreurs.length > 0) erreurs.push(`Contenu d’origine : ${mettreDeCote(stockage, CLE_DOSSIERS, horodatage)}`)
  const ouvert = stockage.getItem(CLE_DOSSIER_COURANT)
  const courant = dossiers.some((x) => x.id === ouvert) ? ouvert : (dossiers[0]?.id ?? null)
  return { valeur: { dossiers, courant }, erreurs }
}

/** Écrit une clé si son contenu change : pas d'écriture, donc pas d'événement inutile dans les autres onglets. */
function ecrireSiChange(stockage: Stockage, cle: string, texte: string): void {
  if (stockage.getItem(cle) !== texte) stockage.setItem(cle, texte)
}

/** Enregistre les dossiers ; retourne un message si le navigateur refuse (stockage plein ou interdit). */
export function ecrireDossiers(stockage: Stockage | null, dossiers: readonly DossierEnregistre[]): string | null {
  if (stockage === null) return 'Stockage du navigateur indisponible : exportez vos dossiers en JSON pour les conserver'
  const contenu = {
    version: VERSION_STOCKAGE,
    dossiers: dossiers.map((x) => ({ id: x.id, fichier: fichierDossier(x.nom, x.dossier, x.modifie_le, x.simulation_vendeur, x.parametres_modifies) })),
  }
  try {
    ecrireSiChange(stockage, CLE_DOSSIERS, JSON.stringify(contenu))
    return null
  } catch {
    return 'Enregistrement impossible : stockage du navigateur plein ou interdit ; exportez vos dossiers en JSON'
  }
}

/** Retient le dossier ouvert pour le lancement suivant ; sans conséquence s'il échoue (le premier dossier s'ouvre). */
export function ecrireDossierCourant(stockage: Stockage | null, id: string): void {
  if (stockage === null) return
  try {
    ecrireSiChange(stockage, CLE_DOSSIER_COURANT, id)
  } catch {
    // Stockage plein : l'enregistrement des dossiers le signale déjà.
  }
}
