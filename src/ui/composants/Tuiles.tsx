import type { ReactNode } from 'react'

/** État signalé par une tuile : toujours une icône et un libellé, jamais la couleur seule. */
export type Statut = 'bon' | 'attention' | 'critique'

const ICONES: Readonly<Record<Statut, string>> = { bon: '✓', attention: '!', critique: '✕' }

export function Etiquette({ statut, children }: { readonly statut: Statut; readonly children: ReactNode }) {
  return (
    <span className={`statut statut-${statut}`}>
      <span className="statut-icone" aria-hidden="true">
        {ICONES[statut]}
      </span>
      {children}
    </span>
  )
}

/** Jauge d'une valeur face à un seuil : remplissage, repère du seuil, couleur d'alerte au-delà. */
export function Jauge({
  libelle,
  valeur,
  seuil,
  maximum,
  texte,
}: {
  readonly libelle: string
  readonly valeur: number
  readonly seuil: number
  readonly maximum: number
  /** Valeur lue par les lecteurs d'écran. */
  readonly texte: string
}) {
  const part = (x: number): string => `${String(Math.min(Math.max(x / maximum, 0), 1) * 100)}%`
  return (
    <div className="jauge" role="meter" aria-label={libelle} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={valeur} aria-valuetext={texte}>
      <div className={valeur > seuil ? 'jauge-remplissage jauge-depassee' : 'jauge-remplissage'} style={{ width: part(valeur) }} />
      <div className="jauge-seuil" style={{ left: part(seuil) }} />
    </div>
  )
}

/** Indicateur clé : libellé, valeur, état éventuel, jauge et précision. */
export function Tuile({
  libelle,
  valeur,
  statut,
  libelleStatut,
  jauge,
  detail,
}: {
  readonly libelle: string
  readonly valeur: string
  readonly statut?: Statut
  readonly libelleStatut?: string
  readonly jauge?: ReactNode
  readonly detail?: ReactNode
}) {
  return (
    <div className="tuile">
      <p className="tuile-libelle">{libelle}</p>
      <p className="tuile-valeur">{valeur}</p>
      {statut === undefined || libelleStatut === undefined ? null : <Etiquette statut={statut}>{libelleStatut}</Etiquette>}
      {jauge}
      {detail === undefined ? null : <p className="tuile-detail">{detail}</p>}
    </div>
  )
}
