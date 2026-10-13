import { lazy, Suspense, useCallback, useId, useMemo, useState } from 'react'
import type { Classement, Recommandation } from '../../engine/recommandation'
import { LIBELLES_SCENARIOS, type IdScenario } from '../../engine/scenario'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { EnCours, Encart } from '../composants/Elements'
import { IndicateursCles } from '../composants/IndicateursCles'
import { SelecteurHorizon } from '../composants/SelecteurHorizon'
import { Etiquette } from '../composants/Tuiles'
import { useApplication } from '../etat/application'
import { calculs, essayer, useCalculDiffere } from '../etat/calculs'
import { useEcran } from '../etat/navigation'
import { formaterNombre } from '../format'

const GraphiquesTableauDeBord = lazy(() => import('../composants/GraphiquesTableauDeBord'))

/** Délai sans nouvelle saisie avant le calcul complet de la recommandation (texte, alertes). */
const DELAI_RECOMMANDATION = 400
const NOTE_MAXIMALE = 100
const ALERTES_AFFICHEES = 4

function Verdict({ classement, recommandation }: { readonly classement: Classement; readonly recommandation: Recommandation | undefined }) {
  const [, allerA] = useEcran()
  const investir = classement.choix !== 'placement'
  return (
    <section className={investir ? 'carte verdict verdict-investir' : 'carte verdict verdict-placement'} aria-label="Verdict">
      <p className="verdict-etiquette">
        {investir ? (
          <Etiquette statut="bon">
            Investir : {classement.choix} {LIBELLES_SCENARIOS[classement.choix]}
          </Etiquette>
        ) : (
          <Etiquette statut="attention">Ne pas investir : le placement de référence l’emporte</Etiquette>
        )}
        <span className="attenue"> · revente après {classement.horizon} ans</span>
      </p>
      <p className="verdict-phrase">{recommandation?.texte.phrase ?? 'Rédaction de la recommandation…'}</p>
      <p className="actions-en-ligne">
        <button
          type="button"
          className="bouton-principal"
          onClick={() => {
            allerA('recommandation')
          }}
        >
          Recommandation détaillée
        </button>
        <button
          type="button"
          onClick={() => {
            allerA('comparaison')
          }}
        >
          Comparer les scénarios
        </button>
      </p>
    </section>
  )
}

function ClassementScenarios({
  classement,
  scenario,
  choisir,
}: {
  readonly classement: Classement
  readonly scenario: IdScenario
  readonly choisir: (id: IdScenario) => void
}) {
  const [, allerA] = useEcran()
  const classes = classement.evaluations.filter((e) => e.rang !== null && e.score !== null).sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0))
  const ecartes = classement.evaluations.length - classes.length
  return (
    <section className="carte" aria-labelledby="titre-classement">
      <h3 id="titre-classement">Classement des scénarios</h3>
      <p className="carte-aide">Score sur 100 selon vos objectifs ; choisissez un scénario pour l’analyser.</p>
      <ol className="classement-barres">
        {classes.map((e) => {
          const score = e.score ?? 0
          return (
            <li key={e.id} className={e.id === scenario ? 'classement-actif' : undefined}>
              <span className="classement-rang">{e.rang}</span>
              <button
                type="button"
                className="classement-nom"
                aria-pressed={e.id === scenario}
                onClick={() => {
                  choisir(e.id)
                }}
              >
                <strong>{e.id}</strong> {e.libelle}
              </button>
              <span className="classement-barre" aria-hidden="true">
                <span style={{ width: `${String(Math.min(Math.max(score, 0), NOTE_MAXIMALE))}%` }} />
              </span>
              <span className="classement-score">{formaterNombre(Math.round(score))}</span>
              {e.bat_le_placement ? <Etiquette statut="bon">bat le placement</Etiquette> : <Etiquette statut="attention">sous le placement</Etiquette>}
            </li>
          )
        })}
      </ol>
      {ecartes > 0 ? (
        <p className="carte-aide">
          {ecartes} scénario(s) inéligible(s) ou non tenable(s) :{' '}
          <button
            type="button"
            className="lien"
            onClick={() => {
              allerA('recommandation')
            }}
          >
            voir les motifs
          </button>
          .
        </p>
      ) : null}
    </section>
  )
}

function Vigilance({ recommandation, aConfirmer }: { readonly recommandation: Recommandation | undefined; readonly aConfirmer: number }) {
  const [, allerA] = useEcran()
  // Les valeurs à confirmer sont résumées par leur décompte (liste complète dans l'écran Recommandation).
  const alertes = (recommandation?.alertes ?? []).filter((a) => a.code !== 'valeurs_a_confirmer')
  return (
    <section className="carte" aria-labelledby="titre-vigilance">
      <h3 id="titre-vigilance">Points de vigilance</h3>
      {recommandation === undefined ? <p className="calcul-en-cours">Analyse en cours…</p> : null}
      {recommandation !== undefined && alertes.length === 0 ? <Etiquette statut="bon">Aucune alerte</Etiquette> : null}
      <ul className="liste-vigilance">
        {alertes.slice(0, ALERTES_AFFICHEES).map((a) => (
          <li key={`${a.code}-${a.message}`}>
            <Etiquette statut="attention">{a.message}</Etiquette>
          </li>
        ))}
        {aConfirmer > 0 ? (
          <li>
            <Etiquette statut="attention">{aConfirmer} valeur(s) fiscale(s) à confirmer pour ce scénario</Etiquette>
          </li>
        ) : null}
      </ul>
      {alertes.length > ALERTES_AFFICHEES ? (
        <button
          type="button"
          className="lien"
          onClick={() => {
            allerA('recommandation')
          }}
        >
          {alertes.length - ALERTES_AFFICHEES} autre(s) alerte(s)
        </button>
      ) : null}
    </section>
  )
}

function TableauDeBord() {
  const { dossierCalcul, dossier, p, objectifs } = useApplication()
  const idChoix = useId()
  const horizon = objectifs.horizon
  const classement = useMemo(() => essayer(() => calculs.classement(dossierCalcul, p, objectifs)), [dossierCalcul, p, objectifs])
  const comparaison = useMemo(() => essayer(() => calculs.comparaison(dossierCalcul, p, horizon)), [dossierCalcul, p, horizon])
  const complete = useCalculDiffere(
    useCallback(() => calculs.recommandation(dossierCalcul, p, objectifs), [dossierCalcul, p, objectifs]),
    DELAI_RECOMMANDATION,
  )
  const [choisi, setChoisi] = useState<IdScenario | null>(null)
  if (!classement.ok) return <Encart genre="erreur">{classement.message}</Encart>
  if (!comparaison.ok) return <Encart genre="erreur">{comparaison.message}</Encart>
  const c = classement.valeur
  const recommandation = complete.statut === 'pret' ? complete.valeur : complete.statut === 'en_cours' ? complete.precedent : undefined
  const indicateurs = comparaison.valeur.indicateurs
  const defaut = c.choix === 'placement' ? c.meilleur_immobilier : c.choix
  const scenario = choisi !== null && indicateurs.some((i) => i.id === choisi) ? choisi : defaut
  const i = indicateurs.find((x) => x.id === scenario)
  const capacite = dossier.foyers.capacite_epargne_mensuelle
  if (scenario === null || i === undefined) {
    return <Encart genre="alerte">Aucun scénario immobilier n’est éligible pour ce bien et ce foyer : la comparaison en donne les motifs.</Encart>
  }
  const aConfirmer = c.evaluations.find((e) => e.id === scenario)?.parametres_a_confirmer.length ?? 0
  return (
    <div className="tableau-de-bord">
      {complete.statut === 'erreur' ? <Encart genre="erreur">{complete.message}</Encart> : null}
      <EnCours actif={complete.statut === 'en_cours' && recommandation !== undefined}>
        <Verdict classement={c} recommandation={recommandation} />
      </EnCours>
      <div className="barre-outils filtres">
        <div className="champ">
          <label htmlFor={idChoix}>Scénario analysé</label>
          <select
            id={idChoix}
            value={scenario}
            onChange={(e) => {
              setChoisi(e.target.value as IdScenario)
            }}
          >
            {indicateurs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} {LIBELLES_SCENARIOS[x.id]}
                {x.id === defaut ? (c.choix === 'placement' ? ' (meilleure option immobilière)' : ' (recommandé)') : ''}
              </option>
            ))}
          </select>
        </div>
        <SelecteurHorizon />
      </div>
      <IndicateursCles i={i} capacite={capacite} />
      <div className="deux-colonnes">
        <ClassementScenarios classement={c} scenario={scenario} choisir={setChoisi} />
        <Vigilance recommandation={recommandation} aConfirmer={aConfirmer} />
      </div>
      <Suspense fallback={<p className="calcul-en-cours">Chargement des graphiques…</p>}>
        <GraphiquesTableauDeBord comparaison={comparaison.valeur} scenario={scenario} capacite={capacite} />
      </Suspense>
    </div>
  )
}

export function EcranTableauDeBord() {
  const { complet } = useApplication()
  return <Ecran id="tableau_de_bord">{complet ? <TableauDeBord /> : <DossierIncomplet />}</Ecran>
}
