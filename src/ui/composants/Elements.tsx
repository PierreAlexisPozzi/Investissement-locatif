import type { ReactNode } from 'react'
import type { Eligibilite } from '../../engine/commun'
import { listerParametres, type EntreeParametre, type ParametresFiscaux } from '../../params'
import { LIBELLES_STATUTS } from '../libelles'

/** Formule ou précision dépliable au clavier (Entrée ou Espace sur le symbole). */
export function Infobulle({ texte, libelle = 'Formule' }: { readonly texte: ReactNode; readonly libelle?: string }) {
  return (
    <details className="infobulle">
      <summary aria-label={libelle} title={libelle}>
        ⓘ
      </summary>
      <div className="infobulle-texte" role="note">
        {texte}
        <button
          type="button"
          className="infobulle-fermer"
          onClick={(e) => {
            e.currentTarget.closest('details')?.removeAttribute('open')
          }}
        >
          Fermer
        </button>
      </div>
    </details>
  )
}

/** Badge d'une valeur non vérifiée, avec lien vers la source officielle à consulter (§3, principe 5). */
export function BadgeStatut({ entree, avecChemin = false }: { readonly entree: EntreeParametre; readonly avecChemin?: boolean }) {
  const { chemin, parametre } = entree
  const titre = `${chemin} : ${LIBELLES_STATUTS[parametre.statut]}. Source : ${parametre.source}. ${parametre.commentaire}`
  return (
    <a className={`badge badge-${parametre.statut}`} href={parametre.url_officielle} target="_blank" rel="noopener noreferrer" title={titre}>
      {avecChemin ? `${chemin} — ` : ''}
      {LIBELLES_STATUTS[parametre.statut]}
    </a>
  )
}

/** Badge d'un paramètre affiché directement, s'il n'est pas vérifié (§3, principe 5). */
export function BadgeParametre({ chemin, p }: { readonly chemin: string; readonly p: ParametresFiscaux }) {
  const entree = listerParametres(p).find((e) => e.chemin === chemin)
  return entree === undefined || entree.parametre.statut === 'verifie' ? null : <BadgeStatut entree={entree} />
}

/** Badges des paramètres non vérifiés dont dépend un scénario. */
export function BadgesParametres({ chemins, p }: { readonly chemins: readonly string[]; readonly p: ParametresFiscaux }) {
  if (chemins.length === 0) return null
  const entrees = new Map(listerParametres(p).map((e) => [e.chemin, e]))
  return (
    <ul className="badges">
      {chemins.map((c) => {
        const entree = entrees.get(c)
        return <li key={c}>{entree === undefined ? c : <BadgeStatut entree={entree} avecChemin />}</li>
      })}
    </ul>
  )
}

/** Pastille d'éligibilité, avec les motifs d'un scénario écarté. */
export function Pastille({ eligibilite }: { readonly eligibilite: Eligibilite }) {
  return eligibilite.eligible ? (
    <span className="pastille pastille-ok">éligible</span>
  ) : (
    <span className="pastille pastille-ko" title={eligibilite.motifs.join(' ; ')}>
      inéligible
    </span>
  )
}

export function ListeMotifs({ motifs, classe = 'motifs' }: { readonly motifs: readonly string[]; readonly classe?: string }) {
  if (motifs.length === 0) return null
  return (
    <ul className={classe}>
      {motifs.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  )
}

/** Message mis en avant : information, avertissement ou erreur. */
export function Encart({ genre, titre, children }: { readonly genre: 'info' | 'alerte' | 'erreur'; readonly titre?: string; readonly children: ReactNode }) {
  return (
    <div className={`encart encart-${genre}`} role={genre === 'erreur' ? 'alert' : undefined}>
      {titre === undefined ? null : <strong>{titre} </strong>}
      {children}
    </div>
  )
}

/** Calcul en cours : le résultat précédent reste affiché, atténué. */
export function EnCours({ actif, children }: { readonly actif: boolean; readonly children: ReactNode }) {
  return (
    <div className={actif ? 'en-cours' : undefined} aria-busy={actif}>
      {actif ? <p className="calcul-en-cours">Calcul en cours…</p> : null}
      {children}
    </div>
  )
}
