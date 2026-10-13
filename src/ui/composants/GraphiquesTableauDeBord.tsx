import type { ComparaisonHorizon } from '../../engine/indicateurs'
import type { IdScenario } from '../../engine/scenario'
import { capitalCompareAuPlacement, effortParAnnee, fluxCumules } from '../../engine/series'
import { GraphiqueCapitalCompare, GraphiqueEffortAnnuel, GraphiqueFluxCumules } from './Graphiques'

interface Proprietes {
  readonly comparaison: ComparaisonHorizon
  /** Scénario analysé, mis en avant. */
  readonly scenario: IdScenario
  readonly capacite: number
}

/** Graphiques du tableau de bord, chargés à la demande (bibliothèque de graphiques volumineuse). */
export default function GraphiquesTableauDeBord({ comparaison, scenario, capacite }: Proprietes) {
  const simulation = comparaison.scenarios.find((r) => r.id === scenario)?.simulation
  const eligibles = comparaison.indicateurs.map((i) => i.id)
  return (
    <div className="graphiques">
      <GraphiqueCapitalCompare lignes={capitalCompareAuPlacement(comparaison.indicateurs)} emphase={scenario} />
      {simulation === undefined || simulation === null ? null : <GraphiqueEffortAnnuel efforts={effortParAnnee(simulation)} capacite={capacite} scenario={scenario} />}
      <GraphiqueFluxCumules points={fluxCumules(comparaison)} scenarios={eligibles} emphase={scenario} />
    </div>
  )
}
