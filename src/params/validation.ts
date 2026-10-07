import { listerParametres } from './parcours'
import { estUrlOfficielle } from './sources-officielles'
import {
  DEPARTS_DETENTION_VEFA,
  EXCEPTIONS_RUPTURE_JEANBRUN,
  MODES_APPRECIATION_SURTAXE,
  MODES_ARRONDI_IMPOT,
  MODES_PRORATA,
  PERIMETRES_ASSIMILES_LLI,
  PERIMETRES_REINTEGRATION_LMNP,
  POINTS_DE_DEPART_JEANBRUN,
  PREMIERES_ANNEES_DENORMANDIE,
  REPARTITIONS_PLAFOND_CONCUBINS,
  STATUTS_CUMUL_JEANBRUN_LLI,
  STATUTS_PARAMETRE,
  TRAITEMENTS_FRAIS_ACQUISITION_LMNP,
  TRAITEMENTS_FRAIS_DEDUITS_PV,
  ZONES,
  type Elargi,
  type ParametresFiscaux,
} from './types'

const FORMAT_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

function estDateIso(valeur: string): boolean {
  return FORMAT_DATE_ISO.test(valeur) && !Number.isNaN(Date.parse(valeur))
}

function estTexteRenseigne(valeur: unknown): boolean {
  return typeof valeur === 'string' && valeur.trim() !== ''
}

/** Contrôle la forme de chaque paramètre : champs obligatoires, statut, URL, date. */
function anomaliesDeForme(racine: unknown, dateArret: string): string[] {
  const anomalies: string[] = []
  for (const { chemin, parametre } of listerParametres(racine)) {
    const p = parametre as unknown as Record<string, unknown>
    for (const champ of ['unite', 'source', 'url_officielle'] as const) {
      if (!estTexteRenseigne(p[champ])) anomalies.push(`${chemin} : champ « ${champ} » absent ou vide`)
    }
    if (typeof p.commentaire !== 'string') anomalies.push(`${chemin} : champ « commentaire » absent`)
    if (!(STATUTS_PARAMETRE as readonly unknown[]).includes(p.statut)) {
      anomalies.push(`${chemin} : statut « ${String(p.statut)} » inconnu`)
    }
    if (typeof p.url_officielle === 'string' && !estUrlOfficielle(p.url_officielle)) {
      anomalies.push(`${chemin} : URL hors des domaines officiels admis (${p.url_officielle})`)
    }
    const date = p.date_verification
    if (date !== null && (typeof date !== 'string' || !estDateIso(date))) {
      anomalies.push(`${chemin} : date de vérification invalide (${JSON.stringify(date)})`)
    } else if (typeof date === 'string' && date > dateArret) {
      anomalies.push(`${chemin} : date de vérification postérieure à la date d'arrêt`)
    }
    if (p.statut === 'verifie' && date === null) {
      anomalies.push(`${chemin} : un paramètre vérifié doit porter sa date de vérification`)
    }
    if ('arbitrage' in p) anomalies.push(...anomaliesArbitrage(chemin, p.arbitrage, dateArret))
  }
  return anomalies
}

/** Un arbitrage porte sa date de décision, le choix retenu et l'option écartée. */
function anomaliesArbitrage(chemin: string, arbitrage: unknown, dateArret: string): string[] {
  if (typeof arbitrage !== 'object' || arbitrage === null) return [`${chemin} : arbitrage mal formé`]
  const a = arbitrage as Record<string, unknown>
  const anomalies: string[] = []
  if (typeof a.date !== 'string' || !estDateIso(a.date) || a.date > dateArret) {
    anomalies.push(`${chemin} : date d'arbitrage invalide ou postérieure à la date d'arrêt`)
  }
  for (const champ of ['choix', 'alternative_ecartee'] as const) {
    if (!estTexteRenseigne(a[champ])) anomalies.push(`${chemin} : arbitrage sans « ${champ} »`)
  }
  return anomalies
}

/** Contrôle les valeurs textuelles qui doivent appartenir à une liste fermée. */
function anomaliesEnumerations(d: Elargi<ParametresFiscaux>): string[] {
  const anomalies: string[] = []
  const verifier = (chemin: string, valeur: string | readonly string[], admises: readonly string[]): void => {
    const valeurs = typeof valeur === 'string' ? [valeur] : valeur
    for (const v of valeurs) {
      if (!admises.includes(v)) anomalies.push(`${chemin} : « ${v} » n'est pas admis (${admises.join(', ')})`)
    }
  }
  verifier('impot_revenu.arrondi', d.impot_revenu.arrondi.valeur, MODES_ARRONDI_IMPOT)
  verifier('jeanbrun.point_de_depart', d.jeanbrun.point_de_depart.valeur, POINTS_DE_DEPART_JEANBRUN)
  verifier('jeanbrun.prorata_premiere_annee', d.jeanbrun.prorata_premiere_annee.valeur, MODES_PRORATA)
  verifier(
    'jeanbrun.rupture_engagement.exceptions',
    d.jeanbrun.rupture_engagement.valeur.exceptions,
    EXCEPTIONS_RUPTURE_JEANBRUN,
  )
  verifier(
    'jeanbrun.concubins_plafond_par_foyer',
    d.jeanbrun.concubins_plafond_par_foyer.valeur,
    REPARTITIONS_PLAFOND_CONCUBINS,
  )
  verifier(
    'lmnp.modelisation.frais_acquisition',
    d.lmnp.modelisation.valeur.frais_acquisition,
    TRAITEMENTS_FRAIS_ACQUISITION_LMNP,
  )
  verifier('lmnp.perimetre_reintegration_pv', d.lmnp.perimetre_reintegration_pv.valeur, PERIMETRES_REINTEGRATION_LMNP)
  verifier('lli.zones_eligibles', d.lli.zones_eligibles.valeur, ZONES)
  verifier('lli.perimetres_assimiles', d.lli.perimetres_assimiles.valeur, PERIMETRES_ASSIMILES_LLI)
  verifier('cumul_jeanbrun_lli.statut_cumul', d.cumul_jeanbrun_lli.statut_cumul.valeur, STATUTS_CUMUL_JEANBRUN_LLI)
  verifier(
    'denormandie.premiere_annee_imputation',
    d.denormandie.premiere_annee_imputation.valeur,
    PREMIERES_ANNEES_DENORMANDIE,
  )
  verifier(
    'plus_value_immobiliere.surtaxe_appreciation_seuil',
    Object.values(d.plus_value_immobiliere.surtaxe_appreciation_seuil.valeur),
    MODES_APPRECIATION_SURTAXE,
  )
  verifier(
    'plus_value_immobiliere.frais_acquisition_deduits_en_charge',
    d.plus_value_immobiliere.frais_acquisition_deduits_en_charge.valeur,
    TRAITEMENTS_FRAIS_DEDUITS_PV,
  )
  verifier(
    'plus_value_immobiliere.depart_detention_vefa',
    d.plus_value_immobiliere.depart_detention_vefa.valeur,
    DEPARTS_DETENTION_VEFA,
  )
  const datesAControler = {
    'jeanbrun.periode_acquisition.debut': d.jeanbrun.periode_acquisition.valeur.debut,
    'jeanbrun.periode_acquisition.fin': d.jeanbrun.periode_acquisition.valeur.fin,
    'denormandie.periode.debut': d.denormandie.periode.valeur.debut,
    'denormandie.periode.fin': d.denormandie.periode.valeur.fin,
    'lmnp.reintegration_amortissements_pv.cessions_a_compter_du':
      d.lmnp.reintegration_amortissements_pv.valeur.cessions_a_compter_du,
    'lli.creance_taxe_fonciere.achevement_a_compter_du': d.lli.creance_taxe_fonciere.valeur.achevement_a_compter_du,
  }
  for (const [chemin, date] of Object.entries(datesAControler)) {
    if (!estDateIso(date)) anomalies.push(`${chemin} : date invalide (${date})`)
  }
  return anomalies
}

/** Un taux ou une fraction se lit entre 0 et 1 : unité « taux décimal » ou « part … », ou clé `taux…`, `part_…`, `abattement`. */
function estUnTaux(cle: string, unite: string): boolean {
  const uniteDeTaux = (unite.startsWith('taux décimal') && !unite.includes(';')) || unite.startsWith('part ')
  return uniteDeTaux || /^(taux|part_)/.test(cle) || cle === 'abattement'
}

/**
 * Domaine des valeurs, contrôlé aussi sur les paramètres modifiés dans l'interface : nombres finis et positifs,
 * taux entre 0 et 1, barème de l'impôt et tranches d'abattement ou de surtaxe ordonnés.
 */
function anomaliesDeValeur(d: Elargi<ParametresFiscaux>): string[] {
  const anomalies: string[] = []
  for (const { chemin, parametre } of listerParametres(d)) {
    const unite = parametre.unite
    const visiter = (valeur: unknown, ici: string, cle: string): void => {
      if (typeof valeur === 'number') {
        if (!Number.isFinite(valeur) || valeur < 0) anomalies.push(`${ici} : nombre positif ou nul attendu (${String(valeur)})`)
        else if (estUnTaux(cle, unite) && valeur > 1) anomalies.push(`${ici} : taux décimal entre 0 et 1 attendu (${String(valeur)}) ; 0,3 signifie 30 %`)
      } else if (Array.isArray(valeur)) {
        valeur.forEach((x: unknown, k) => {
          visiter(x, `${ici}[${String(k)}]`, cle)
        })
      } else if (typeof valeur === 'object' && valeur !== null) {
        for (const [k, x] of Object.entries(valeur)) visiter(x, `${ici}.${k}`, k)
      }
    }
    visiter(parametre.valeur, chemin, chemin.split('.').at(-1) ?? chemin)
  }

  const bareme = d.impot_revenu.bareme.valeur
  if (bareme.length === 0) anomalies.push('impot_revenu.bareme : au moins une tranche attendue')
  bareme.forEach((t, k) => {
    const derniere = k === bareme.length - 1
    const precedente = bareme[k - 1]
    if (derniere !== (t.jusqua === null)) anomalies.push(`impot_revenu.bareme[${String(k)}] : seule la dernière tranche est ouverte (borne null)`)
    if (precedente !== undefined && t.jusqua !== null && precedente.jusqua !== null && !(t.jusqua > precedente.jusqua)) {
      anomalies.push(`impot_revenu.bareme[${String(k)}] : bornes croissantes attendues`)
    }
    if (precedente !== undefined && t.taux < precedente.taux) anomalies.push(`impot_revenu.bareme[${String(k)}] : taux croissants attendus`)
  })

  const tranchesOrdonnees = (chemin: string, tranches: readonly { readonly de: number; readonly a: number | null }[]): void => {
    tranches.forEach((t, k) => {
      const precedente = tranches[k - 1]
      if (t.a !== null && t.a < t.de) anomalies.push(`${chemin}[${String(k)}] : borne « a » inférieure à « de »`)
      if (precedente !== undefined && (precedente.a === null || t.de < precedente.a)) anomalies.push(`${chemin}[${String(k)}] : tranches ordonnées attendues`)
    })
  }
  const pv = d.plus_value_immobiliere
  tranchesOrdonnees('plus_value_immobiliere.abattement_ir.tranches', pv.abattement_ir.valeur.tranches)
  tranchesOrdonnees('plus_value_immobiliere.abattement_ps.tranches', pv.abattement_ps.valeur.tranches)
  tranchesOrdonnees('plus_value_immobiliere.surtaxe_plus_values_elevees.tranches', pv.surtaxe_plus_values_elevees.valeur.tranches)
  return anomalies
}

/** Liste toutes les anomalies du fichier de paramètres ; liste vide si tout est conforme. */
export function listerAnomalies(d: Elargi<ParametresFiscaux>): string[] {
  const anomalies: string[] = []
  if (!estDateIso(d.meta.date_arret)) anomalies.push(`meta.date_arret : date invalide (${d.meta.date_arret})`)
  anomalies.push(...anomaliesDeForme(d, d.meta.date_arret))
  anomalies.push(...anomaliesEnumerations(d))
  anomalies.push(...anomaliesDeValeur(d))
  return anomalies
}

/** Valide les paramètres et les retourne typés ; lève une erreur détaillée sinon. */
export function verifierParametres(d: Elargi<ParametresFiscaux>): ParametresFiscaux {
  const anomalies = listerAnomalies(d)
  if (anomalies.length > 0) {
    throw new Error(`Paramètres fiscaux invalides :\n- ${anomalies.join('\n- ')}`)
  }
  return d as ParametresFiscaux
}
