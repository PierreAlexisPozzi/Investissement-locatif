import { useId, useState, type ReactNode } from 'react'
import { lireDate } from '../../engine/dates'
import { afficherSaisie, lireSaisie, type ContraintesSaisie } from '../saisie'

interface ProprietesCommunes {
  readonly libelle: string
  /** Libellé lu par les lecteurs d'écran mais masqué à l'affichage (cellule de tableau). */
  readonly libelleMasque?: boolean
  /** Précision affichée sous le champ. */
  readonly aide?: ReactNode
  readonly desactive?: boolean
}

function Aide({ id, aide }: { readonly id: string; readonly aide: ReactNode }) {
  return (
    <span className="champ-aide" id={id}>
      {aide}
    </span>
  )
}

interface ProprietesNombre extends ProprietesCommunes, ContraintesSaisie {
  readonly valeur: number | undefined
  readonly onChange: (valeur: number | undefined) => void
  /** Unité affichée après la saisie : €, %, mois, m²… */
  readonly unite?: string
}

/**
 * Nombre saisi à la française (« 250 000 », « 3,4 ») ; un pourcentage se saisit en points. La valeur n'est
 * transmise que valide ; une saisie refusée reste affichée avec son motif jusqu'à correction.
 */
export function ChampNombre({ libelle, libelleMasque, aide, desactive, valeur, onChange, unite, ...contraintes }: ProprietesNombre) {
  const id = useId()
  const [saisie, setSaisie] = useState<string | null>(null)
  const affichee = saisie ?? afficherSaisie(valeur, contraintes)
  const lecture = saisie === null ? null : lireSaisie(saisie, contraintes)
  const erreur = lecture !== null && !lecture.ok ? lecture.erreur : null
  const decrit = [aide === undefined ? null : `${id}-aide`, erreur === null ? null : `${id}-erreur`].filter((x) => x !== null).join(' ')
  return (
    <div className="champ">
      <label htmlFor={id} className={libelleMasque === true ? 'visuellement-masque' : undefined}>
        {libelle}
      </label>
      <span className="champ-saisie">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={affichee}
          disabled={desactive}
          aria-invalid={erreur !== null}
          aria-describedby={decrit === '' ? undefined : decrit}
          onFocus={() => {
            setSaisie(affichee)
          }}
          onChange={(e) => {
            const texte = e.target.value
            setSaisie(texte)
            const lu = lireSaisie(texte, contraintes)
            if (lu.ok) onChange(lu.valeur)
          }}
          onBlur={() => {
            if (lecture === null || lecture.ok) setSaisie(null)
          }}
        />
        {unite === undefined ? null : <span className="unite">{unite}</span>}
      </span>
      {erreur === null ? null : (
        <span className="champ-erreur" id={`${id}-erreur`} role="alert">
          {erreur}
        </span>
      )}
      {aide === undefined ? null : <Aide id={`${id}-aide`} aide={aide} />}
    </div>
  )
}

/** Montant en euros, positif par défaut. */
export function ChampMontant(proprietes: Omit<ProprietesNombre, 'unite'> & { readonly unite?: string }) {
  return <ChampNombre min={0} unite="€" {...proprietes} />
}

/** Taux décimal saisi en pourcentage : 0,034 se saisit « 3,4 ». */
export function ChampTaux(proprietes: Omit<ProprietesNombre, 'unite' | 'pourcentage'>) {
  return <ChampNombre min={0} {...proprietes} pourcentage unite="%" />
}

export interface OptionListe<T extends string> {
  readonly valeur: T
  readonly libelle: string
}

interface ProprietesListe<T extends string> extends ProprietesCommunes {
  readonly valeur: T
  readonly options: readonly OptionListe<T>[]
  readonly onChange: (valeur: T) => void
}

export function ChampListe<T extends string>({ libelle, aide, desactive, valeur, options, onChange }: ProprietesListe<T>) {
  const id = useId()
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <select
        id={id}
        value={valeur}
        disabled={desactive}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(e) => {
          const choisie = options.find((o) => o.valeur === e.target.value)
          if (choisie !== undefined) onChange(choisie.valeur)
        }}
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      {aide === undefined ? null : <Aide id={`${id}-aide`} aide={aide} />}
    </div>
  )
}

interface ProprietesCase extends ProprietesCommunes {
  readonly valeur: boolean
  readonly onChange: (valeur: boolean) => void
}

export function ChampCase({ libelle, aide, desactive, valeur, onChange }: ProprietesCase) {
  const id = useId()
  return (
    <div className="champ champ-case">
      <input
        id={id}
        type="checkbox"
        checked={valeur}
        disabled={desactive}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
      />
      <label htmlFor={id}>{libelle}</label>
      {aide === undefined ? null : <Aide id={`${id}-aide`} aide={aide} />}
    </div>
  )
}

interface ProprietesDate extends ProprietesCommunes {
  readonly valeur: string
  readonly onChange: (valeur: string) => void
}

/** Années admises pour une date du dossier : une année en cours de frappe (0002, 0020…) n'est pas transmise. */
const ANNEE_MINIMALE = 1900
const ANNEE_MAXIMALE = 2200

function dateAdmise(texte: string): boolean {
  try {
    const { annee } = lireDate(texte)
    return annee >= ANNEE_MINIMALE && annee <= ANNEE_MAXIMALE
  } catch {
    return false
  }
}

/**
 * Date AAAA-MM-JJ. Pendant la frappe, le navigateur transmet des dates partielles (année 0002, puis 0020…) : elles
 * restent affichées sans être transmises, jusqu'à une date complète et plausible.
 */
export function ChampDate({ libelle, aide, desactive, valeur, onChange }: ProprietesDate) {
  const id = useId()
  const [saisie, setSaisie] = useState<string | null>(null)
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        type="date"
        value={saisie ?? valeur}
        disabled={desactive}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(e) => {
          const texte = e.target.value
          setSaisie(texte)
          if (dateAdmise(texte)) onChange(texte)
        }}
        onBlur={() => {
          setSaisie(null)
        }}
      />
      {aide === undefined ? null : <Aide id={`${id}-aide`} aide={aide} />}
    </div>
  )
}

interface ProprietesTexte extends ProprietesCommunes {
  readonly valeur: string | undefined
  readonly onChange: (valeur: string | undefined) => void
}

/** Texte libre ; vide, il devient indéfini. */
export function ChampTexte({ libelle, aide, desactive, valeur, onChange }: ProprietesTexte) {
  const id = useId()
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        type="text"
        value={valeur ?? ''}
        disabled={desactive}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : e.target.value)
        }}
      />
      {aide === undefined ? null : <Aide id={`${id}-aide`} aide={aide} />}
    </div>
  )
}

/** Groupe de champs titré. */
export function Groupe({ titre, children, aide }: { readonly titre: string; readonly children: ReactNode; readonly aide?: ReactNode }) {
  return (
    <fieldset className="groupe">
      <legend>{titre}</legend>
      {aide === undefined ? null : <p className="groupe-aide">{aide}</p>}
      <div className="grille-champs">{children}</div>
    </fieldset>
  )
}
