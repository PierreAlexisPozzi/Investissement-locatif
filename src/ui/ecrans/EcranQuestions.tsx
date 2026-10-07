import { useCallback, useMemo } from 'react'
import { INTERLOCUTEURS, LIBELLES_INTERLOCUTEURS, questionsAPoser } from '../../engine/questions'
import type { Alerte } from '../../engine/recommandation'
import { LIBELLES_SCENARIOS, SCENARIOS, type IdScenario } from '../../engine/scenario'
import { ChampListe } from '../composants/Champs'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { Encart } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { calculs, essayer, useCalculDiffere } from '../etat/calculs'

const SANS_ALERTE: readonly Alerte[] = []

function Questions() {
  const { dossierCalcul, p, objectifs, etat, enregistre, actions } = useApplication()
  const id = etat.scenario
  // Les alertes de la recommandation enrichissent la liste ; elle s'affiche sans elles pendant leur calcul.
  const recommandation = useCalculDiffere(
    useCallback(() => calculs.recommandation(dossierCalcul, p, objectifs), [dossierCalcul, p, objectifs]),
    0,
  )
  const alertes = recommandation.statut === 'pret' ? recommandation.valeur.alertes : SANS_ALERTE
  const vendeur = enregistre.simulation_vendeur
  const questions = useMemo(
    () =>
      essayer(() => {
        const contre = vendeur !== undefined && vendeur.scenario === id && vendeur.prix > 0 && vendeur.loyer_mensuel > 0 ? calculs.contreExpertise(dossierCalcul, p, vendeur) : null
        return questionsAPoser(dossierCalcul, id, p, { alertes, contre_expertise: contre })
      }),
    [dossierCalcul, p, id, alertes, vendeur],
  )
  const choix = recommandation.statut === 'pret' ? recommandation.valeur.choix : null
  return (
    <>
      <div className="barre-outils ne-pas-imprimer">
        <ChampListe<IdScenario>
          libelle="Scénario étudié"
          valeur={id}
          options={SCENARIOS.map((x) => ({ valeur: x, libelle: `${x} ${LIBELLES_SCENARIOS[x]}${x === choix ? ' (recommandé)' : ''}` }))}
          onChange={actions.choisirScenario}
        />
        <button
          type="button"
          onClick={() => {
            window.print()
          }}
        >
          Imprimer
        </button>
      </div>
      <p className="introduction">
        Questions pour {id} ({LIBELLES_SCENARIOS[id]}), générées selon le scénario, les alertes
        {recommandation.statut === 'en_cours' ? ' (en cours de calcul)' : ''}, les valeurs à confirmer
        {vendeur?.scenario === id ? ' et la contre-expertise de la simulation du vendeur' : ''}.
      </p>
      {questions.ok ? (
        INTERLOCUTEURS.map((interlocuteur) => {
          const liste = questions.valeur.filter((q) => q.interlocuteur === interlocuteur)
          if (liste.length === 0) return null
          return (
            <section key={interlocuteur} className="questions" aria-labelledby={`questions-${interlocuteur}`}>
              <h3 id={`questions-${interlocuteur}`}>{LIBELLES_INTERLOCUTEURS[interlocuteur]}</h3>
              <ol>
                {liste.map((q) => (
                  <li key={`${q.texte}-${q.motif}`}>
                    {q.texte}
                    <br />
                    <span className="motif-question">Pourquoi : {q.motif}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })
      ) : (
        <Encart genre="erreur">{questions.message}</Encart>
      )}
    </>
  )
}

export function EcranQuestions() {
  const { complet } = useApplication()
  return <Ecran id="questions">{complet ? <Questions /> : <DossierIncomplet />}</Ecran>
}
