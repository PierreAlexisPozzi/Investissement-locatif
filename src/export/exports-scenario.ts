/**
 * Tableaux exportés (§4, §11 écran 6) : tableau annuel complet d'un scénario,
 * postes de la revente, formules, et comparaison des indicateurs. Les valeurs
 * sont celles du moteur, sans recalcul.
 */
import type { Dossier } from '../engine/dossier'
import { formaterDate } from '../engine/format'
import type { ComparaisonHorizon } from '../engine/indicateurs'
import { colonnesDetailCharges, colonnesTableauAnnuel, lignesIndicateurs, lignesSortie, type Colonne } from '../engine/presentation'
import { LIBELLES_SCENARIOS, type IdScenario, type ResultatSimulation } from '../engine/scenario'
import type { ParametresFiscaux } from '../params'
import type { Cellule, Tableau } from './tableau'

const LARGEUR_LIBELLE = 40
const LARGEUR_FORMULE = 100

function valeurExportee<T>(c: Colonne<T>, ligne: T): Cellule {
  const v = c.valeur(ligne)
  if (c.format === 'date' && typeof v === 'string') return formaterDate(v)
  return v
}

/** Tableau annuel complet : colonnes affichées, puis détail des charges par poste. */
export function tableauAnnuel(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Tableau {
  const colonnes = [...colonnesTableauAnnuel(d, id, s, p), ...colonnesDetailCharges()]
  return {
    titre: `${id} tableau annuel`,
    colonnes: colonnes.map((c) => ({ libelle: c.libelle, format: c.format })),
    lignes: s.annees.map((a) => colonnes.map((c) => valeurExportee(c, a))),
  }
}

/** Postes de la revente, avec leur formule. */
export function tableauRevente(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Tableau {
  return {
    titre: `${id} revente`,
    colonnes: [
      { libelle: 'Poste', format: 'texte', largeur: LARGEUR_LIBELLE },
      { libelle: 'Montant', format: 'euros' },
      { libelle: 'Formule', format: 'texte', largeur: LARGEUR_FORMULE },
    ],
    lignes: lignesSortie(d, id, s, p).map((c) => [c.libelle, valeurExportee(c, s.sortie), c.formule]),
  }
}

/** Formule de chaque colonne du tableau annuel. */
export function tableauFormules(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Tableau {
  return {
    titre: `${id} formules`,
    colonnes: [
      { libelle: 'Colonne', format: 'texte', largeur: LARGEUR_LIBELLE },
      { libelle: 'Formule', format: 'texte', largeur: LARGEUR_FORMULE },
    ],
    lignes: [...colonnesTableauAnnuel(d, id, s, p), ...colonnesDetailCharges()].map((c) => [c.libelle, c.formule]),
  }
}

/** Indicateurs de chaque scénario éligible à l'horizon de la comparaison, avec leur formule. */
export function tableauIndicateurs(c: ComparaisonHorizon, d: Dossier, p: ParametresFiscaux): Tableau {
  const lignes = lignesIndicateurs(d, p)
  return {
    titre: `Indicateurs ${String(c.horizon)} ans`,
    colonnes: [
      { libelle: 'Indicateur', format: 'texte', largeur: LARGEUR_LIBELLE },
      ...c.indicateurs.map((i) => ({ libelle: `${i.id} ${LIBELLES_SCENARIOS[i.id]}`, format: 'euros' as const })),
      { libelle: 'Formule', format: 'texte', largeur: LARGEUR_FORMULE },
    ],
    lignes: lignes.map((l) => [l.libelle, ...c.indicateurs.map((i) => valeurExportee(l, i)), l.formule]),
    formats_lignes: lignes.map((l) => l.format),
  }
}

/** Classeur d'un scénario : tableau annuel, revente, formules. */
export function classeurScenario(d: Dossier, id: IdScenario, s: ResultatSimulation, p: ParametresFiscaux): Tableau[] {
  return [tableauAnnuel(d, id, s, p), tableauRevente(d, id, s, p), tableauFormules(d, id, s, p)]
}

/** Nom de fichier sans caractère problématique : lettres, chiffres, tirets. */
export function nomDeFichier(...parties: readonly string[]): string {
  return parties
    .map((x) =>
      x
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter((x) => x !== '')
    .join('-')
}
