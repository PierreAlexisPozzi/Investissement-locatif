import { useCallback, useId, useMemo } from 'react'
import { objectifsParDefaut, type BaremesQualitatifs, type Objectifs } from '../../engine/dossier'
import { CRITERES, LIBELLES_CRITERES, type Classement, type Critere, type EvaluationScenario, type Recommandation } from '../../engine/recommandation'
import { LIBELLES_SCENARIOS, SCENARIOS } from '../../engine/scenario'
import { hypothesesDefaut } from '../../params'
import { ChampNombre } from '../composants/Champs'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { BadgesParametres, EnCours, Encart, ListeMotifs } from '../composants/Elements'
import { SelecteurHorizon } from '../composants/SelecteurHorizon'
import { useApplication } from '../etat/application'
import { calculs, essayer, useCalculDiffere } from '../etat/calculs'
import { useEcran } from '../etat/navigation'
import { formaterNombre, formaterTauxCalcule } from '../format'

/** Délai sans nouveau mouvement de curseur avant le calcul complet (seuils de bascule compris). */
const DELAI_RECOMMANDATION = 400
const PAS_CURSEUR = 5
const NOTE_MAXIMALE = 100

function Curseur({ critere, objectifs }: { readonly critere: Critere; readonly objectifs: Objectifs }) {
  const { actions } = useApplication()
  const id = useId()
  const valeur = objectifs.ponderations[critere]
  return (
    <div className="curseur">
      <label htmlFor={id}>{LIBELLES_CRITERES[critere]}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={NOTE_MAXIMALE}
        step={PAS_CURSEUR}
        value={valeur}
        onChange={(e) => {
          const v = Number(e.target.value)
          actions.modifierObjectifs((o) => ({ ...o, ponderations: { ...o.ponderations, [critere]: v } }))
        }}
      />
      <output htmlFor={id}>{valeur}</output>
    </div>
  )
}

function Curseurs({ objectifs }: { readonly objectifs: Objectifs }) {
  const { actions } = useApplication()
  const total = CRITERES.reduce((somme, c) => somme + objectifs.ponderations[c], 0)
  return (
    <section className="groupe" aria-labelledby="titre-objectifs">
      <h3 id="titre-objectifs">Objectifs</h3>
      {CRITERES.map((c) => (
        <Curseur key={c} critere={c} objectifs={objectifs} />
      ))}
      <p className={total === NOTE_MAXIMALE ? 'attenue' : 'avertissement'}>
        Total : {total} {total === NOTE_MAXIMALE ? '' : '(les poids sont rapportés à leur total)'}
      </p>
      <button
        type="button"
        onClick={() => {
          actions.modifierObjectifs((o) => ({ ...o, ponderations: objectifsParDefaut().ponderations }))
        }}
      >
        Pondérations par défaut
      </button>
      <p className="champ-aide">{hypothesesDefaut.objectifs.ponderations.commentaire}</p>
    </section>
  )
}

/** Colonnes du classement : rang, scénario, score, critères, TRI, comparaison au placement. */
const COLONNES_CLASSEMENT = CRITERES.length + 5

/** Le scénario a-t-il des motifs ou des valeurs à confirmer à afficher sous sa ligne ? */
function observations(e: EvaluationScenario): boolean {
  return !e.eligible || !e.tenable || (e.rang !== null && e.parametres_a_confirmer.length > 0)
}

function TableauClassement({ classement }: { readonly classement: Classement }) {
  const { actions, p } = useApplication()
  const [, allerA] = useEcran()
  return (
    <div className="tableau-defilant">
      <table className="tableau-compact tableau-classement">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Scénario</th>
            <th scope="col">Score</th>
            {CRITERES.map((c) => (
              <th key={c} scope="col" title="Note sur 100 et points apportés au score">
                {LIBELLES_CRITERES[c]}
              </th>
            ))}
            <th scope="col">TRI</th>
            <th scope="col">Bat le placement</th>
          </tr>
        </thead>
        {classement.evaluations.map((e) => (
          // Un groupe de lignes par scénario : ses valeurs, puis ses observations sur toute la largeur.
          <tbody key={e.id} className={e.rang === null ? 'ineligible' : undefined}>
            <tr>
              <td className="nombre">{e.rang ?? '—'}</td>
              <th scope="row">
                <button
                  type="button"
                  className="lien"
                  onClick={() => {
                    actions.choisirScenario(e.id)
                    allerA('detail')
                  }}
                >
                  {e.id}
                </button>{' '}
                {e.libelle}
              </th>
              <td className="nombre">{e.score === null ? '—' : formaterNombre(e.score)}</td>
              {CRITERES.map((c) => {
                const n = e.notes.find((x) => x.critere === c)
                return (
                  <td key={c} className="nombre" title={n === undefined ? undefined : `Valeur ${formaterNombre(n.valeur)}, note ${formaterNombre(n.note)}`}>
                    {n === undefined ? '—' : `${formaterNombre(n.note)} → ${formaterNombre(n.points)}`}
                  </td>
                )
              })}
              <td className="nombre">{e.indicateurs === null ? '—' : formaterTauxCalcule(e.indicateurs.tri)}</td>
              <td>{e.rang === null ? '—' : e.bat_le_placement ? 'oui' : 'non'}</td>
            </tr>
            {observations(e) ? (
              <tr className="ligne-observations">
                <td />
                <td colSpan={COLONNES_CLASSEMENT - 1}>
                  {!e.eligible ? <ListeMotifs motifs={e.motifs_ineligibilite} /> : null}
                  {e.eligible && !e.tenable ? <ListeMotifs motifs={e.motifs_non_tenable.map((m) => `Non tenable : ${m}`)} /> : null}
                  {e.rang !== null && e.parametres_a_confirmer.length > 0 ? (
                    <details>
                      <summary>{e.parametres_a_confirmer.length} valeur(s) à confirmer</summary>
                      <BadgesParametres chemins={e.parametres_a_confirmer} p={p} />
                    </details>
                  ) : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function TexteRecommande({ r }: { readonly r: Recommandation }) {
  const t = r.texte
  return (
    <div className="recommandation">
      <p className="phrase-recommandation">{t.phrase}</p>
      {t.raisons.length > 0 ? (
        <>
          <h4>Raisons</h4>
          <ol>
            {t.raisons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </>
      ) : null}
      {t.risques.length > 0 ? (
        <>
          <h4>Points bloquants et risques</h4>
          <ul>
            {t.risques.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {t.bascules.length > 0 ? (
        <>
          <h4>Ce qui ferait changer la recommandation</h4>
          <ul>
            {t.bascules.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {r.alertes.length > 0 ? (
        <>
          <h4>Alertes</h4>
          <ul className="alertes">
            {r.alertes.map((a) => (
              <li key={`${a.code}-${a.message}`}>
                {a.message}
                {a.scenarios.length > 0 ? <span className="attenue"> ({a.scenarios.join(', ')})</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

/** Notes qualitatives modifiables (§10.3) : souplesse, simplicité, transmission. */
function Baremes({ objectifs }: { readonly objectifs: Objectifs }) {
  const { actions } = useApplication()
  const r = hypothesesDefaut.recommandation
  const defauts: BaremesQualitatifs = { souplesse: r.souplesse.valeur, simplicite: r.simplicite.valeur, transmission: r.transmission.valeur }
  const criteres = ['souplesse', 'simplicite', 'transmission'] as const
  const cles = [...SCENARIOS, 'S4_micro'] as const
  const note = (critere: (typeof criteres)[number], cle: string): number | undefined => objectifs.baremes?.[critere]?.[cle] ?? defauts[critere][cle]
  return (
    <details className="groupe">
      <summary>Barèmes qualitatifs (souplesse, simplicité, transmission)</summary>
      <p className="champ-aide">{r.souplesse.commentaire}</p>
      <p className="champ-aide">{r.simplicite.commentaire}</p>
      <div className="tableau-defilant">
        <table className="tableau-compact">
          <thead>
            <tr>
              <th scope="col">Scénario</th>
              {criteres.map((c) => (
                <th key={c} scope="col">
                  {LIBELLES_CRITERES[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cles.map((cle) => (
              <tr key={cle}>
                <th scope="row">{cle === 'S4_micro' ? 'S4 au micro-BIC' : `${cle} ${LIBELLES_SCENARIOS[cle]}`}</th>
                {criteres.map((c) => {
                  const defaut = defauts[c][cle]
                  if (defaut === undefined) return <td key={c}>—</td>
                  return (
                    <td key={c}>
                      <ChampNombre
                        libelle={`${LIBELLES_CRITERES[c]} ${cle}`}
                        libelleMasque
                        valeur={note(c, cle)}
                        min={0}
                        max={NOTE_MAXIMALE}
                        onChange={(v) => {
                          actions.modifierObjectifs((o) => ({
                            ...o,
                            baremes: { ...o.baremes, [c]: { ...o.baremes?.[c], [cle]: v ?? defaut } },
                          }))
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => {
          actions.modifierObjectifs((o) => ({ ponderations: o.ponderations, horizon: o.horizon }))
        }}
      >
        Barèmes par défaut
      </button>
    </details>
  )
}

function Recommander() {
  const { dossierCalcul, p, objectifs } = useApplication()
  const classement = useMemo(() => essayer(() => calculs.classement(dossierCalcul, p, objectifs)), [dossierCalcul, p, objectifs])
  const complete = useCalculDiffere(
    useCallback(() => calculs.recommandation(dossierCalcul, p, objectifs), [dossierCalcul, p, objectifs]),
    DELAI_RECOMMANDATION,
  )
  const affichee = complete.statut === 'pret' ? complete.valeur : complete.statut === 'en_cours' ? complete.precedent : undefined
  return (
    <div className="mise-en-page-apercu mise-en-page-gauche">
      <div className="colonne-etroite">
        <SelecteurHorizon />
        <Curseurs objectifs={objectifs} />
      </div>
      <div>
        {complete.statut === 'erreur' ? <Encart genre="erreur">{complete.message}</Encart> : null}
        <EnCours actif={complete.statut === 'en_cours'}>{affichee === undefined ? null : <TexteRecommande r={affichee} />}</EnCours>
        <h3>Classement</h3>
        {classement.ok ? <TableauClassement classement={classement.valeur} /> : <Encart genre="erreur">{classement.message}</Encart>}
        <Baremes objectifs={objectifs} />
      </div>
    </div>
  )
}

export function EcranRecommandation() {
  const { complet } = useApplication()
  return <Ecran id="recommandation">{complet ? <Recommander /> : <DossierIncomplet />}</Ecran>
}
