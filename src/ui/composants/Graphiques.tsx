import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IdScenario } from '../../engine/scenario'
import type { DecompositionAvantage, PointSerie } from '../../engine/series'
import { COULEURS_AVANTAGE, COULEURS_SCENARIOS } from '../couleurs'
import { formaterEuros } from '../format'

/** Taille avant la première mesure du conteneur (affichage immédiat, environnement de test). */
const DIMENSION_INITIALE = { width: 520, height: 300 }

const EUROS_COMPACTS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

const axeEuros = (v: unknown): string => (typeof v === 'number' ? EUROS_COMPACTS.format(v) : String(v))
const bulleEuros = (v: unknown): string => (typeof v === 'number' ? formaterEuros(v) : String(v))

/** Lignes de données Recharts : une colonne par scénario. */
function lignes(points: readonly PointSerie[]): Record<string, number>[] {
  return points.map((x) => ({ abscisse: x.abscisse, ...x.valeurs }))
}

interface ProprietesSeries {
  readonly titre: string
  readonly points: readonly PointSerie[]
  readonly scenarios: readonly IdScenario[]
  readonly libelleAbscisse: string
}

function GraphiqueLignes({ titre, points, scenarios, libelleAbscisse }: ProprietesSeries) {
  return (
    <figure className="graphique">
      <figcaption>{titre}</figcaption>
      <div className="graphique-zone" role="img" aria-label={titre}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
          <LineChart data={lignes(points)} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="abscisse" name={libelleAbscisse} />
            <YAxis tickFormatter={axeEuros} width={72} />
            <ReferenceLine y={0} stroke="#888" />
            <Tooltip formatter={bulleEuros} labelFormatter={(l) => (typeof l === 'number' || typeof l === 'string' ? `${libelleAbscisse} ${String(l)}` : libelleAbscisse)} />
            <Legend />
            {scenarios.map((id) => (
              <Line key={id} type="monotone" dataKey={id} name={id} stroke={COULEURS_SCENARIOS[id]} dot={false} strokeWidth={2} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/** Trésorerie cumulée après impôt, année par année, revente comprise la dernière année. */
export function GraphiqueFluxCumules({ points, scenarios }: { readonly points: readonly PointSerie[]; readonly scenarios: readonly IdScenario[] }) {
  return <GraphiqueLignes titre="Flux de trésorerie cumulé après impôt (revente comprise)" points={points} scenarios={scenarios} libelleAbscisse="Année" />
}

/** Capital net à la sortie selon l'horizon de revente. */
export function GraphiqueCapitalNet({ points, scenarios }: { readonly points: readonly PointSerie[]; readonly scenarios: readonly IdScenario[] }) {
  return <GraphiqueLignes titre="Capital net à la sortie selon l’horizon (années de location)" points={points} scenarios={scenarios} libelleAbscisse="Horizon" />
}

const LIBELLES_AVANTAGE: Readonly<Record<keyof typeof COULEURS_AVANTAGE, string>> = {
  impot_evite: 'Impôt évité',
  tva_economisee: 'TVA économisée',
  taxe_fonciere_remboursee: 'Taxe foncière remboursée',
  impot_plus_value_repris: 'Impôt de plus-value et reprises',
}

/** Décomposition de l'avantage fiscal de chaque scénario : composantes empilées, reprises en négatif. */
export function GraphiqueAvantage({ decomposition }: { readonly decomposition: readonly DecompositionAvantage[] }) {
  const titre = 'Décomposition de l’avantage fiscal sur la détention'
  const cles = Object.keys(LIBELLES_AVANTAGE) as (keyof typeof LIBELLES_AVANTAGE)[]
  return (
    <figure className="graphique">
      <figcaption>{titre}</figcaption>
      <div className="graphique-zone" role="img" aria-label={titre}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
          <BarChart data={decomposition.map((x) => ({ ...x }))} stackOffset="sign" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="id" />
            <YAxis tickFormatter={axeEuros} width={72} />
            <ReferenceLine y={0} stroke="#888" />
            <Tooltip formatter={bulleEuros} />
            <Legend />
            {cles.map((cle) => (
              <Bar key={cle} dataKey={cle} name={LIBELLES_AVANTAGE[cle]} stackId="avantage" fill={COULEURS_AVANTAGE[cle]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
