import { lazy, Suspense, useMemo } from 'react'
import { lignesIndicateurs } from '../../engine/presentation'
import type { IdScenario } from '../../engine/scenario'
import { versCsv } from '../../export/csv'
import { nomDeFichier, tableauIndicateurs } from '../../export/exports-scenario'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { BadgesParametres, Encart, ListeMotifs, Pastille } from '../composants/Elements'
import { SelecteurHorizon } from '../composants/SelecteurHorizon'
import { useApplication } from '../etat/application'
import { calculs, essayer } from '../etat/calculs'
import { useEcran } from '../etat/navigation'
import { afficher, formaterEuros, formaterPoints } from '../format'
import { telecharger, TYPE_CSV } from '../telechargement'

const GraphiquesComparaison = lazy(() => import('../composants/GraphiquesComparaison'))

function Comparaison() {
  const { dossierCalcul, p, objectifs, enregistre, actions } = useApplication()
  const [, allerA] = useEcran()
  const horizon = objectifs.horizon
  const resultat = useMemo(() => essayer(() => calculs.comparaison(dossierCalcul, p, horizon)), [dossierCalcul, p, horizon])
  const horizons = useMemo(() => essayer(() => calculs.horizons(dossierCalcul, p)), [dossierCalcul, p])
  if (!resultat.ok) return <Encart genre="erreur">{resultat.message}</Encart>
  const c = resultat.valeur
  const lignes = lignesIndicateurs(dossierCalcul, p)
  const parId = new Map(c.indicateurs.map((i) => [i.id, i]))
  const eligibles: IdScenario[] = c.indicateurs.map((i) => i.id)
  const voirDetail = (id: IdScenario): void => {
    actions.choisirScenario(id)
    allerA('detail')
  }
  const exporter = async (format: 'csv' | 'xlsx'): Promise<void> => {
    const tableau = tableauIndicateurs(c, dossierCalcul, p)
    const nom = nomDeFichier(enregistre.nom, `indicateurs-${String(horizon)}-ans`)
    if (format === 'csv') {
      telecharger(`${nom}.csv`, versCsv(tableau), TYPE_CSV)
      return
    }
    // Le module de compression n'est chargé qu'au premier export XLSX.
    const { versXlsx, TYPE_MIME_XLSX } = await import('../../export/xlsx')
    telecharger(`${nom}.xlsx`, versXlsx([tableau]), TYPE_MIME_XLSX)
  }
  const penalite = (id: IdScenario): string => {
    const r = essayer(() => calculs.penalite(dossierCalcul, p, id))
    if (!r.ok) return r.message
    return r.valeur === null ? 'aucune' : `${formaterEuros(r.valeur.montant)} (revente après ${String(r.valeur.horizon)} ans)`
  }

  return (
    <>
      <div className="barre-outils ne-pas-imprimer">
        <SelecteurHorizon />
        <div className="actions-en-ligne">
          <button
            type="button"
            onClick={() => {
              void exporter('csv')
            }}
          >
            Exporter en CSV
          </button>
          <button
            type="button"
            onClick={() => {
              void exporter('xlsx')
            }}
          >
            Exporter en XLSX
          </button>
        </div>
      </div>
      <p className="introduction">
        Revente après {horizon} ans de location. Dépliez un indicateur pour lire sa formule et ouvrir le tableau annuel d’un scénario.
      </p>
      <div className="tableau-defilant">
        <table className="tableau-comparaison">
          <thead>
            <tr>
              <th scope="col">Indicateur</th>
              {c.scenarios.map((r) => (
                <th key={r.id} scope="col" className={r.simulation === null ? 'ineligible' : undefined} title={r.libelle}>
                  {r.simulation === null ? (
                    r.id
                  ) : (
                    <button
                      type="button"
                      className="lien"
                      onClick={() => {
                        voirDetail(r.id)
                      }}
                    >
                      {r.id}
                    </button>
                  )}
                  <span className="sous-libelle">{r.libelle}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Éligibilité</th>
              {c.scenarios.map((r) => (
                <td key={r.id} className={r.simulation === null ? 'ineligible' : undefined}>
                  <Pastille eligibilite={r.eligibilite} />
                  {r.eligibilite.eligible ? null : (
                    <details>
                      <summary>Motifs</summary>
                      <ListeMotifs motifs={r.eligibilite.motifs} />
                    </details>
                  )}
                  {r.eligibilite.eligible && r.eligibilite.avertissements.length > 0 ? (
                    <details>
                      <summary>Points d’attention</summary>
                      <ListeMotifs motifs={r.eligibilite.avertissements} />
                    </details>
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Valeurs à confirmer</th>
              {c.scenarios.map((r) => (
                <td key={r.id} className={r.simulation === null ? 'ineligible' : undefined}>
                  {r.parametres_a_confirmer.length === 0 ? (
                    '—'
                  ) : (
                    <details>
                      <summary>{r.parametres_a_confirmer.length}</summary>
                      <BadgesParametres chemins={r.parametres_a_confirmer} p={p} />
                    </details>
                  )}
                </td>
              ))}
            </tr>
            {lignes.map((l) => (
              <tr key={l.cle}>
                <th scope="row">
                  <details className="tracabilite">
                    <summary>{l.libelle}</summary>
                    <p>{l.formule}</p>
                    <p className="actions-en-ligne">
                      Tableau annuel :
                      {eligibles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className="lien"
                          onClick={() => {
                            voirDetail(id)
                          }}
                        >
                          {id}
                        </button>
                      ))}
                    </p>
                  </details>
                </th>
                {c.scenarios.map((r) => {
                  const i = parId.get(r.id)
                  return (
                    <td key={r.id} className={i === undefined ? 'ineligible' : 'nombre'}>
                      {i === undefined ? '—' : afficher(l.valeur(i), l.format)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">Écart de TRI à S0</th>
              {c.scenarios.map((r) => {
                const e = c.ecarts_s0[r.id]
                return (
                  <td key={r.id} className={e === undefined ? 'ineligible' : 'nombre'}>
                    {e === undefined ? '—' : formaterPoints(e.tri)}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Écart de capital à S0</th>
              {c.scenarios.map((r) => {
                const e = c.ecarts_s0[r.id]
                return (
                  <td key={r.id} className={e === undefined ? 'ineligible' : 'nombre'}>
                    {e === undefined ? '—' : formaterEuros(e.capital_net)}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Pénalité d’une revente un an avant la fin des engagements</th>
              {c.scenarios.map((r) => (
                <td key={r.id} className={r.simulation === null ? 'ineligible' : 'nombre'}>
                  {r.simulation === null ? '—' : penalite(r.id)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {c.scenarios.some((r) => r.simulation === null) ? (
        <p className="attenue">Les scénarios grisés sont inéligibles pour ce bien ou ce foyer : leurs motifs restent consultables.</p>
      ) : null}
      <Suspense fallback={<p className="calcul-en-cours">Chargement des graphiques…</p>}>
        <GraphiquesComparaison comparaison={c} horizons={horizons} scenarios={eligibles} />
      </Suspense>
    </>
  )
}

export function EcranComparaison() {
  const { complet } = useApplication()
  return <Ecran id="comparaison">{complet ? <Comparaison /> : <DossierIncomplet />}</Ecran>
}
