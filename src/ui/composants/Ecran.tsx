import type { ReactNode } from 'react'
import { useApplication } from '../etat/application'
import { ECRANS, type IdEcran } from '../etat/etat'
import { useEcran } from '../etat/navigation'

/** Cadre d'un écran : titre, actions à droite. */
export function Ecran({ id, actions, children }: { readonly id: IdEcran; readonly actions?: ReactNode; readonly children: ReactNode }) {
  const libelle = ECRANS.find((e) => e.id === id)?.titre ?? id
  return (
    <section className="ecran" aria-labelledby={`titre-${id}`}>
      <header className="ecran-entete">
        <h2 id={`titre-${id}`}>{libelle}</h2>
        {actions === undefined ? null : <div className="ecran-actions ne-pas-imprimer">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

/** Écrans de résultats tant que le dossier est incomplet ou incohérent : ce qui manque, et où le saisir. */
export function DossierIncomplet() {
  const { manquants, anomalies } = useApplication()
  const [, allerA] = useEcran()
  return (
    <div className="encart encart-info">
      <p>
        <strong>Le dossier n’est pas encore calculable.</strong>
      </p>
      {manquants.length > 0 ? <p>À compléter : {manquants.join(', ')}.</p> : null}
      {anomalies.length > 0 ? <p>À corriger : {anomalies.join(' ; ')}.</p> : null}
      <p className="actions-en-ligne">
        <button
          type="button"
          onClick={() => {
            allerA('foyer')
          }}
        >
          Mon foyer
        </button>
        <button
          type="button"
          onClick={() => {
            allerA('bien')
          }}
        >
          Le bien et le financement
        </button>
      </p>
    </div>
  )
}
