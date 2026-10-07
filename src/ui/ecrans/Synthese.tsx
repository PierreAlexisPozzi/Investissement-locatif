import { useMemo } from 'react'
import { situationFiscale } from '../../engine/apercus'
import { lignesIndicateurs } from '../../engine/presentation'
import { LIBELLES_SCENARIOS } from '../../engine/scenario'
import { listerParametres } from '../../params'
import { Encart } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { calculs, essayer } from '../etat/calculs'
import { afficher, formaterDate, formaterEuros, formaterNombre, formaterTaux, formaterTauxCalcule, libelleZone } from '../format'
import { LIBELLES_ETATS, LIBELLES_SITUATIONS, LIBELLES_STATUTS } from '../libelles'

/** Indicateurs repris dans la synthèse ; le détail complet reste dans l'écran Comparaison et les exports. */
const INDICATEURS_SYNTHESE = [
  'effort_mensuel_premieres_annees',
  'effort_mensuel_moyen',
  'economie_impot_nette',
  'tri',
  'van',
  'capital_net_sortie',
  'tri_placement',
  'ecart_capital_placement',
  'duree_blocage_ans',
]

/** Synthèse imprimable du dossier courant (PDF par l'impression du navigateur). */
export function Synthese({ editeeLe }: { readonly editeeLe: string }) {
  const { dossier, dossierCalcul, p, parametres, objectifs, enregistre } = useApplication()
  const recommandation = useMemo(() => essayer(() => calculs.recommandation(dossierCalcul, p, objectifs)), [dossierCalcul, p, objectifs])
  const comparaison = useMemo(() => essayer(() => calculs.comparaison(dossierCalcul, p, objectifs.horizon)), [dossierCalcul, p, objectifs.horizon])
  const situations = useMemo(() => essayer(() => situationFiscale(dossier, p)), [dossier, p])
  const b = dossier.bien
  const f = dossier.financement
  const lignes = lignesIndicateurs(dossierCalcul, p).filter((l) => INDICATEURS_SYNTHESE.includes(l.cle))
  const entrees = new Map(listerParametres(p).map((e) => [e.chemin, e]))
  return (
    <article className="synthese" aria-label="Synthèse imprimable">
      <h1>Synthèse : {enregistre.nom}</h1>
      <p className="attenue">
        Éditée le {formaterDate(editeeLe)} ; paramètres fiscaux arrêtés au {formaterDate(p.meta.date_arret)} ; revente après {objectifs.horizon} ans de location.
      </p>
      {parametres.modifies.length > 0 ? (
        <p>
          <strong>Paramètres fiscaux modifiés pour ce dossier :</strong> {parametres.modifies.join(', ')}.
        </p>
      ) : null}
      {parametres.erreurs.length > 0 ? (
        <p>
          <strong>Paramètres modifiés de ce dossier ignorés, car invalides :</strong> les résultats suivent le fichier versionné.
        </p>
      ) : null}

      <h2>Foyer</h2>
      <p>{LIBELLES_SITUATIONS[dossier.foyers.situation]}.</p>
      {situations.ok ? (
        <ul>
          {situations.valeur.map((s) => (
            <li key={s.libelle}>
              {s.libelle} : revenu imposable {formaterEuros(s.revenu_imposable)}, impôt actuel {formaterEuros(s.impot)}, tranche marginale {formaterTaux(s.tmi)}
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        Capacité d’épargne {formaterEuros(dossier.foyers.capacite_epargne_mensuelle)} par mois, apport disponible {formaterEuros(dossier.foyers.apport_disponible)}.
      </p>

      <h2>Bien et financement</h2>
      <p>
        {LIBELLES_ETATS[b.etat]}
        {b.commune === undefined ? '' : ` à ${b.commune}`}, zone {libelleZone(b.zone)}, {formaterNombre(b.surface.habitable)} m² ; prix{' '}
        {b.etat === 'ancien' ? 'd’achat' : 'hors taxes'} {formaterEuros(b.prix_ht)}, frais de notaire {formaterEuros(b.frais_notaire)}
        {b.etat === 'ancien' ? `, travaux ${formaterEuros(b.travaux ?? 0)}` : ''}. Loyers de marché {formaterEuros(b.loyer_marche_nu)} nu,{' '}
        {formaterEuros(b.loyer_marche_meuble)} meublé, par mois. Emprunt de {formaterEuros(f.emprunt)} à {formaterTaux(f.taux_annuel)} sur{' '}
        {formaterNombre(f.duree_mois / 12)} ans.
      </p>

      <h2>Recommandation</h2>
      {recommandation.ok ? (
        <>
          <p className="phrase-recommandation">{recommandation.valeur.texte.phrase}</p>
          <ol>
            {recommandation.valeur.texte.raisons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          {recommandation.valeur.texte.risques.length > 0 ? (
            <>
              <h3>Points bloquants et risques</h3>
              <ul>
                {recommandation.valeur.texte.risques.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          ) : null}
          {recommandation.valeur.texte.bascules.length > 0 ? (
            <>
              <h3>Ce qui ferait changer la recommandation</h3>
              <ul>
                {recommandation.valeur.texte.bascules.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          ) : null}
          {recommandation.valeur.alertes.length > 0 ? (
            <>
              <h3>Alertes</h3>
              <ul>
                {recommandation.valeur.alertes.map((a) => (
                  <li key={`${a.code}-${a.message}`}>{a.message}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>Classement</h3>
          <table className="tableau-compact">
            <thead>
              <tr>
                <th scope="col">Rang</th>
                <th scope="col">Scénario</th>
                <th scope="col">Score</th>
                <th scope="col">TRI</th>
                <th scope="col">Effort moyen</th>
                <th scope="col">Capital net</th>
                <th scope="col">Observations</th>
              </tr>
            </thead>
            <tbody>
              {recommandation.valeur.evaluations.map((e) => (
                <tr key={e.id}>
                  <td className="nombre">{e.rang ?? '—'}</td>
                  <th scope="row">
                    {e.id} {LIBELLES_SCENARIOS[e.id]}
                  </th>
                  <td className="nombre">{e.score === null ? '—' : formaterNombre(e.score)}</td>
                  <td className="nombre">{e.indicateurs === null ? '—' : formaterTauxCalcule(e.indicateurs.tri)}</td>
                  <td className="nombre">{e.indicateurs === null ? '—' : formaterEuros(e.indicateurs.effort_mensuel_moyen)}</td>
                  <td className="nombre">{e.indicateurs === null ? '—' : formaterEuros(e.indicateurs.capital_net_sortie)}</td>
                  <td>{!e.eligible ? e.motifs_ineligibilite.join(' ; ') : !e.tenable ? `Non tenable : ${e.motifs_non_tenable.join(' ; ')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recommandation.valeur.choix !== 'placement' ? (
            <>
              <h3>Valeurs à confirmer pour {recommandation.valeur.choix}</h3>
              <ul>
                {(recommandation.valeur.evaluations.find((e) => e.id === recommandation.valeur.choix)?.parametres_a_confirmer ?? []).map((c) => {
                  const e = entrees.get(c)
                  return (
                    <li key={c}>
                      {c} ({e === undefined ? '' : LIBELLES_STATUTS[e.parametre.statut]}) : {e?.parametre.source} {e?.parametre.url_officielle}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <Encart genre="erreur">{recommandation.message}</Encart>
      )}

      {comparaison.ok ? (
        <>
          <h2>Indicateurs clés</h2>
          <table className="tableau-compact">
            <thead>
              <tr>
                <th scope="col">Indicateur</th>
                {comparaison.valeur.indicateurs.map((i) => (
                  <th key={i.id} scope="col">
                    {i.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle}>
                  <th scope="row">{l.libelle}</th>
                  {comparaison.valeur.indicateurs.map((i) => (
                    <td key={i.id} className="nombre">
                      {afficher(l.valeur(i), l.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      <p className="attenue">
        Outil d’aide à la décision personnelle : il ne remplace ni un notaire ni un expert-comptable. Formules et tableaux annuels détaillés dans l’outil et
        ses exports.
      </p>
    </article>
  )
}
