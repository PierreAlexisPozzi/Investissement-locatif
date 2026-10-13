import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type YAxisTickContentProps,
} from 'recharts'
import { LIBELLES_SCENARIOS, type IdScenario } from '../../engine/scenario'
import type { CapitalCompare, DecompositionAvantage, EffortAnnuel, PointSerie } from '../../engine/series'
import { COULEURS_AVANTAGE, COULEURS_SCENARIOS, HABILLAGE } from '../couleurs'
import { eurosParMois, formaterEuros } from '../format'

/** Taille avant la première mesure du conteneur (affichage immédiat, environnement de test). */
const DIMENSION_INITIALE = { width: 520, height: 300 }

/** Épaisseur maximale d'une barre et rayon de son extrémité : des marques fines, la barre ne remplit pas sa bande. */
const BARRE_MAX = 24
const BARRE_GROUPEE = 14
const RAYON = 4
const TRAIT = 2
const TRAIT_EMPHASE = 3
const TRAIT_RETRAIT = 1.5
const OPACITE_RETRAIT = 0.55
/** Hauteur du graphique en barres horizontales : une bande par scénario, plus l'axe (rem). */
const HAUTEUR_PAR_SCENARIO = 3
const HAUTEUR_AXE = 3
const HAUTEUR_MINIMALE = 12

const EUROS_COMPACTS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

const compact = (v: unknown): string => (typeof v === 'number' ? EUROS_COMPACTS.format(v) : String(v))
const bulleEuros = (v: unknown): string => (typeof v === 'number' ? formaterEuros(v) : String(v))

/** Habillage commun : grille horizontale fine et pleine, axes discrets. */
const PROPS_AXE = { stroke: HABILLAGE.axe, tick: { fill: HABILLAGE.texte_axe, fontSize: 12 }, tickLine: false } as const
const PROPS_BULLE = {
  contentStyle: { border: `1px solid ${HABILLAGE.grille}`, borderRadius: 8, boxShadow: '0 4px 12px #1018281f', fontSize: 13 },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
  cursor: { fill: '#1018280a', stroke: HABILLAGE.axe },
} as const
const MARGES = { top: 12, right: 20, bottom: 4, left: 4 }

export interface DonneesGraphique {
  readonly colonnes: readonly string[]
  readonly lignes: readonly (readonly string[])[]
}

/** Cadre d'un graphique : titre, zone tracée, légende éventuelle et, repliées, les données en tableau (lecture sans couleur ni survol). */
export function CadreGraphique({
  titre,
  sousTitre,
  donnees,
  legende,
  hauteur,
  children,
}: {
  readonly titre: string
  readonly sousTitre?: string
  readonly donnees: DonneesGraphique
  readonly legende?: ReactNode
  /** Hauteur de la zone tracée quand elle dépend des données (une barre par scénario). */
  readonly hauteur?: string
  readonly children: ReactNode
}) {
  return (
    <figure className="graphique">
      <figcaption>
        <span className="graphique-titre">{titre}</span>
        {sousTitre === undefined ? null : <span className="graphique-sous-titre">{sousTitre}</span>}
      </figcaption>
      <div
        className="graphique-zone"
        role="img"
        aria-label={sousTitre === undefined ? titre : `${titre}. ${sousTitre}`}
        style={hauteur === undefined ? undefined : { height: hauteur }}
      >
        {children}
      </div>
      {legende}
      <details className="donnees-graphique">
        <summary>Voir les données</summary>
        <div className="defilement-horizontal">
          <table className="tableau-compact">
            <thead>
              <tr>
                {donnees.colonnes.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((l) => (
                <tr key={l.join('|')}>
                  {l.map((v, k) =>
                    k === 0 ? (
                      <th key={k} scope="row">
                        {v}
                      </th>
                    ) : (
                      <td key={k} className="nombre">
                        {v}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Légende écrite à côté du graphique : un trait ou une pastille de la couleur de la série, le libellé en texte. */
export function LegendeGraphique({ elements }: { readonly elements: readonly { readonly libelle: string; readonly couleur: string; readonly forme: 'trait' | 'carre' }[] }) {
  return (
    <ul className="legende-graphique">
      {elements.map((e) => (
        <li key={e.libelle}>
          <span className={`legende-${e.forme}`} style={{ background: e.couleur }} aria-hidden="true" />
          {e.libelle}
        </li>
      ))}
    </ul>
  )
}

/** Barre à extrémité arrondie côté valeur, carrée sur la ligne de base, quel que soit le signe ; opacité selon la donnée (mise en avant). */
function barreArrondie(horizontale: boolean, opacite: (donnee: unknown) => number = () => 1) {
  return function Forme(props: BarShapeProps) {
    const { x, y, width, height, fill } = props
    const negative = typeof props.value === 'number' && props.value < 0
    const gauche = Math.min(x, x + width)
    const haut = Math.min(y, y + height)
    const l = Math.abs(width)
    const h = Math.abs(height)
    if (l === 0 || h === 0) return <g />
    const r = Math.min(RAYON, l / 2, h / 2)
    const d = horizontale
      ? negative
        ? `M${String(gauche + l)},${String(haut)}H${String(gauche + r)}Q${String(gauche)},${String(haut)} ${String(gauche)},${String(haut + r)}V${String(haut + h - r)}Q${String(gauche)},${String(haut + h)} ${String(gauche + r)},${String(haut + h)}H${String(gauche + l)}Z`
        : `M${String(gauche)},${String(haut)}H${String(gauche + l - r)}Q${String(gauche + l)},${String(haut)} ${String(gauche + l)},${String(haut + r)}V${String(haut + h - r)}Q${String(gauche + l)},${String(haut + h)} ${String(gauche + l - r)},${String(haut + h)}H${String(gauche)}Z`
      : negative
        ? `M${String(gauche)},${String(haut)}V${String(haut + h - r)}Q${String(gauche)},${String(haut + h)} ${String(gauche + r)},${String(haut + h)}H${String(gauche + l - r)}Q${String(gauche + l)},${String(haut + h)} ${String(gauche + l)},${String(haut + h - r)}V${String(haut)}Z`
        : `M${String(gauche)},${String(haut + h)}V${String(haut + r)}Q${String(gauche)},${String(haut)} ${String(gauche + r)},${String(haut)}H${String(gauche + l - r)}Q${String(gauche + l)},${String(haut)} ${String(gauche + l)},${String(haut + r)}V${String(haut + h)}Z`
    return <path d={d} fill={fill} fillOpacity={opacite(props.payload)} />
  }
}

const COLONNE = barreArrondie(false)
const BARRE_HORIZONTALE = barreArrondie(true)

/** Lignes de données Recharts : une colonne par scénario. */
function lignes(points: readonly PointSerie[]): Record<string, number>[] {
  return points.map((x) => ({ abscisse: x.abscisse, ...x.valeurs }))
}

function donneesSeries(points: readonly PointSerie[], scenarios: readonly IdScenario[], libelleAbscisse: string): DonneesGraphique {
  return {
    colonnes: [libelleAbscisse, ...scenarios],
    lignes: points.map((x) => [String(x.abscisse), ...scenarios.map((id) => (x.valeurs[id] === undefined ? '—' : formaterEuros(x.valeurs[id])))]),
  }
}

interface ProprietesSeries {
  readonly titre: string
  readonly sousTitre?: string
  readonly points: readonly PointSerie[]
  readonly scenarios: readonly IdScenario[]
  readonly libelleAbscisse: string
  /** Scénario mis en avant : les autres passent en gris, sans légende par couleur. */
  readonly emphase?: IdScenario
}

function GraphiqueLignes({ titre, sousTitre, points, scenarios, libelleAbscisse, emphase }: ProprietesSeries) {
  // Le scénario mis en avant est tracé en dernier, au-dessus des autres.
  const ordre = emphase === undefined ? scenarios : [...scenarios.filter((id) => id !== emphase), ...scenarios.filter((id) => id === emphase)]
  const derniers = new Map(ordre.map((id) => [id, points.findLastIndex((x) => x.valeurs[id] !== undefined)]))
  const legende =
    emphase === undefined ? undefined : (
      <LegendeGraphique
        elements={[
          { libelle: `${emphase} ${LIBELLES_SCENARIOS[emphase]}`, couleur: COULEURS_SCENARIOS[emphase], forme: 'trait' },
          { libelle: 'Autres scénarios éligibles', couleur: HABILLAGE.retrait, forme: 'trait' },
        ]}
      />
    )
  return (
    <CadreGraphique titre={titre} sousTitre={sousTitre} donnees={donneesSeries(points, scenarios, libelleAbscisse)} legende={legende}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
        <LineChart data={lignes(points)} margin={{ ...MARGES, right: emphase === undefined ? MARGES.right : 56 }}>
          <CartesianGrid stroke={HABILLAGE.grille} vertical={false} />
          <XAxis dataKey="abscisse" name={libelleAbscisse} {...PROPS_AXE} />
          <YAxis tickFormatter={compact} width={64} {...PROPS_AXE} axisLine={false} />
          <ReferenceLine y={0} stroke={HABILLAGE.axe} />
          <Tooltip
            {...PROPS_BULLE}
            formatter={bulleEuros}
            labelFormatter={(l) => (typeof l === 'number' || typeof l === 'string' ? `${libelleAbscisse} ${String(l)}` : libelleAbscisse)}
          />
          {emphase === undefined ? <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, color: HABILLAGE.texte_axe }} /> : null}
          {ordre.map((id) => {
            const enAvant = emphase === undefined || id === emphase
            return (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={id}
                stroke={enAvant ? COULEURS_SCENARIOS[id] : HABILLAGE.retrait}
                strokeWidth={emphase === undefined ? TRAIT : enAvant ? TRAIT_EMPHASE : TRAIT_RETRAIT}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              >
                {id === emphase ? (
                  <LabelList
                    dataKey={id}
                    content={(p) => {
                      const { x, y, value, index } = p
                      if (index !== derniers.get(id) || typeof x !== 'number' || typeof y !== 'number') return null
                      return (
                        <text x={x + 8} y={y} dy={4} fontSize={12} fontWeight={600} fill="#161b26">
                          {compact(value)}
                        </text>
                      )
                    }}
                  />
                ) : null}
              </Line>
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </CadreGraphique>
  )
}

/** Trésorerie cumulée après impôt, année par année, revente comprise la dernière année. */
export function GraphiqueFluxCumules({
  points,
  scenarios,
  emphase,
}: {
  readonly points: readonly PointSerie[]
  readonly scenarios: readonly IdScenario[]
  readonly emphase?: IdScenario
}) {
  return (
    <GraphiqueLignes
      titre="Trésorerie cumulée après impôt"
      sousTitre="Fonds propres versés, flux de chaque année, puis produit net de la revente"
      points={points}
      scenarios={scenarios}
      libelleAbscisse="Année"
      emphase={emphase}
    />
  )
}

/** Capital net à la sortie selon l'horizon de revente. */
export function GraphiqueCapitalNet({ points, scenarios }: { readonly points: readonly PointSerie[]; readonly scenarios: readonly IdScenario[] }) {
  return (
    <GraphiqueLignes
      titre="Capital net à la sortie selon l’horizon"
      sousTitre="Années de location avant la revente"
      points={points}
      scenarios={scenarios}
      libelleAbscisse="Horizon"
    />
  )
}

const LIBELLES_AVANTAGE: Readonly<Record<keyof typeof COULEURS_AVANTAGE, string>> = {
  impot_evite: 'Impôt évité',
  tva_economisee: 'TVA économisée',
  taxe_fonciere_remboursee: 'Taxe foncière remboursée',
  impot_plus_value_repris: 'Impôt de plus-value et reprises',
}

/** Décomposition de l'avantage fiscal de chaque scénario : composantes empilées, reprises en négatif. */
export function GraphiqueAvantage({ decomposition }: { readonly decomposition: readonly DecompositionAvantage[] }) {
  const cles = Object.keys(LIBELLES_AVANTAGE) as (keyof typeof LIBELLES_AVANTAGE)[]
  const donnees: DonneesGraphique = {
    colonnes: ['Scénario', ...cles.map((c) => LIBELLES_AVANTAGE[c]), 'Total'],
    lignes: decomposition.map((x) => [x.id, ...cles.map((c) => formaterEuros(x[c])), formaterEuros(x.total)]),
  }
  return (
    <CadreGraphique titre="Avantage fiscal sur la détention" sousTitre="Gains empilés au-dessus de zéro, reprises à la revente en dessous" donnees={donnees}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
        <BarChart data={decomposition.map((x) => ({ ...x }))} stackOffset="sign" margin={MARGES}>
          <CartesianGrid stroke={HABILLAGE.grille} vertical={false} />
          <XAxis dataKey="id" {...PROPS_AXE} />
          <YAxis tickFormatter={compact} width={64} {...PROPS_AXE} axisLine={false} />
          <ReferenceLine y={0} stroke={HABILLAGE.axe} />
          <Tooltip {...PROPS_BULLE} formatter={bulleEuros} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: HABILLAGE.texte_axe }} />
          {cles.map((cle) => (
            // Un liseré de la couleur du fond sépare les segments empilés.
            <Bar
              key={cle}
              dataKey={cle}
              name={LIBELLES_AVANTAGE[cle]}
              stackId="avantage"
              fill={COULEURS_AVANTAGE[cle]}
              stroke="#fff"
              strokeWidth={TRAIT}
              maxBarSize={BARRE_MAX}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </CadreGraphique>
  )
}

/** Capital net à la sortie de chaque scénario, à côté de celui des mêmes décaissements placés au rendement de référence. */
export function GraphiqueCapitalCompare({ lignes: donnees, emphase }: { readonly lignes: readonly CapitalCompare[]; readonly emphase: IdScenario }) {
  const lignesGraphique = donnees.map((l) => ({ ...l, libelle: l.id }))
  // Le scénario analysé en plein, les autres atténués.
  const barreMiseEnAvant = barreArrondie(true, (d) => ((d as CapitalCompare | undefined)?.id === emphase ? 1 : OPACITE_RETRAIT))
  const hauteur = `${String(Math.max(donnees.length * HAUTEUR_PAR_SCENARIO + HAUTEUR_AXE, HAUTEUR_MINIMALE))}rem`
  return (
    <CadreGraphique
      titre="Capital net à la sortie"
      sousTitre="Immobilier, et placement des mêmes sommes au rendement de référence"
      hauteur={hauteur}
      donnees={{
        colonnes: ['Scénario', 'Immobilier', 'Placement équivalent', 'Écart'],
        lignes: donnees.map((l) => [`${l.id} ${LIBELLES_SCENARIOS[l.id]}`, formaterEuros(l.capital), formaterEuros(l.placement), formaterEuros(l.ecart)]),
      }}
      legende={
        <LegendeGraphique
          elements={[
            { libelle: 'Immobilier', couleur: HABILLAGE.principale, forme: 'carre' },
            { libelle: 'Placement équivalent', couleur: HABILLAGE.retrait, forme: 'carre' },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
        <BarChart data={lignesGraphique} layout="vertical" margin={{ ...MARGES, right: 64 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid stroke={HABILLAGE.grille} horizontal={false} />
          <XAxis type="number" tickFormatter={compact} {...PROPS_AXE} />
          <YAxis
            type="category"
            dataKey="libelle"
            width={56}
            {...PROPS_AXE}
            axisLine={false}
            tick={(p: YAxisTickContentProps) => {
              const valeur = String(p.payload.value)
              return (
                <text x={Number(p.x) - 6} y={Number(p.y)} dy={4} textAnchor="end" fontSize={12} fontWeight={valeur === emphase ? 700 : 400} fill="#161b26">
                  {valeur}
                </text>
              )
            }}
          />
          <Tooltip {...PROPS_BULLE} formatter={bulleEuros} labelFormatter={(l) => (typeof l === 'string' && l in LIBELLES_SCENARIOS ? `${l} ${LIBELLES_SCENARIOS[l as IdScenario]}` : '')} />
          <Bar dataKey="capital" name="Immobilier" barSize={BARRE_GROUPEE} fill={HABILLAGE.principale} shape={barreMiseEnAvant} isAnimationActive={false}>
            <LabelList dataKey="capital" position="right" formatter={compact} fontSize={12} fill="#161b26" />
          </Bar>
          <Bar dataKey="placement" name="Placement équivalent" barSize={BARRE_GROUPEE} fill={HABILLAGE.retrait} shape={BARRE_HORIZONTALE} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </CadreGraphique>
  )
}

/** Effort d'épargne mensuel de chaque année de détention, face à la capacité d'épargne déclarée. */
export function GraphiqueEffortAnnuel({ efforts, capacite, scenario }: { readonly efforts: readonly EffortAnnuel[]; readonly capacite: number; readonly scenario: IdScenario }) {
  return (
    <CadreGraphique
      titre="Effort d’épargne mensuel, année par année"
      sousTitre={`${scenario} ${LIBELLES_SCENARIOS[scenario]} ; en dessous de zéro, l’opération dégage de la trésorerie`}
      donnees={{ colonnes: ['Année', 'Effort mensuel'], lignes: efforts.map((e) => [String(e.annee), eurosParMois(e.mensuel)]) }}
      legende={
        <LegendeGraphique
          elements={[
            { libelle: 'Effort mensuel moyen de l’année', couleur: HABILLAGE.principale, forme: 'carre' },
            { libelle: `Capacité d’épargne : ${eurosParMois(capacite)}`, couleur: HABILLAGE.reference, forme: 'trait' },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={DIMENSION_INITIALE}>
        <BarChart data={efforts.map((e) => ({ ...e }))} margin={MARGES}>
          <CartesianGrid stroke={HABILLAGE.grille} vertical={false} />
          <XAxis dataKey="annee" {...PROPS_AXE} />
          <YAxis tickFormatter={compact} width={64} {...PROPS_AXE} axisLine={false} />
          <ReferenceLine y={0} stroke={HABILLAGE.axe} />
          <ReferenceLine y={capacite} stroke={HABILLAGE.reference} strokeWidth={TRAIT_RETRAIT} />
          <Tooltip {...PROPS_BULLE} formatter={(v) => (typeof v === 'number' ? eurosParMois(v) : String(v))} labelFormatter={(l) => (typeof l === 'number' ? `Année ${String(l)}` : '')} />
          <Bar dataKey="mensuel" name="Effort mensuel" fill={HABILLAGE.principale} maxBarSize={BARRE_MAX} shape={COLONNE} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </CadreGraphique>
  )
}
