import type { ComparaisonHorizon } from '../../engine/indicateurs'
import type { IdScenario } from '../../engine/scenario'
import { capitalNetParHorizon, decompositionAvantage, fluxCumules } from '../../engine/series'
import type { Resultat } from '../etat/calculs'
import { Encart } from './Elements'
import { GraphiqueAvantage, GraphiqueCapitalNet, GraphiqueFluxCumules } from './Graphiques'

interface Proprietes {
  readonly comparaison: ComparaisonHorizon
  readonly horizons: Resultat<readonly ComparaisonHorizon[]>
  readonly scenarios: readonly IdScenario[]
}

/** Graphiques de l'écran Comparaison, chargés à la demande (bibliothèque de graphiques volumineuse). */
export default function GraphiquesComparaison({ comparaison, horizons, scenarios }: Proprietes) {
  return (
    <div className="graphiques">
      <GraphiqueFluxCumules points={fluxCumules(comparaison)} scenarios={scenarios} />
      {horizons.ok ? (
        <GraphiqueCapitalNet points={capitalNetParHorizon(horizons.valeur)} scenarios={scenarios} />
      ) : (
        <Encart genre="erreur">{horizons.message}</Encart>
      )}
      <GraphiqueAvantage decomposition={decompositionAvantage(comparaison.indicateurs)} />
    </div>
  )
}
