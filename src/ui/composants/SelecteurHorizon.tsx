import { useId } from 'react'
import { hypothesesDefaut } from '../../params'
import { useApplication } from '../etat/application'

/** Horizon de revente (années de location), commun à la comparaison, à la recommandation et au détail. */
export function SelecteurHorizon() {
  const { objectifs, actions } = useApplication()
  const nom = useId()
  const proposes = hypothesesDefaut.horizons_ans.valeur
  const horizons = proposes.includes(objectifs.horizon) ? proposes : [...proposes, objectifs.horizon].sort((a, b) => a - b)
  return (
    <fieldset className="selecteur-horizon">
      <legend>Revente après</legend>
      {horizons.map((h) => (
        <label key={h}>
          <input
            type="radio"
            name={nom}
            checked={objectifs.horizon === h}
            onChange={() => {
              actions.modifierObjectifs((o) => ({ ...o, horizon: h }))
            }}
          />
          {h} ans
        </label>
      ))}
    </fieldset>
  )
}
