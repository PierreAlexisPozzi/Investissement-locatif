import { useCallback, useMemo } from 'react'
import type { DetailPlusValue } from '../../engine/plus-value'
import { colonnesDetailCharges, colonnesTableauAnnuel, libelleRegime, lignesSortie, type Colonne } from '../../engine/presentation'
import { LIBELLES_SCENARIOS, SCENARIOS, type IdScenario, type LigneAnnuelle, type ResultatScenario, type ResultatSimulation } from '../../engine/scenario'
import { versCsv } from '../../export/csv'
import { classeurScenario, nomDeFichier, tableauAnnuel } from '../../export/exports-scenario'
import { hypothesesDefaut } from '../../params'
import { ChampListe } from '../composants/Champs'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { BadgesParametres, EnCours, Encart, Infobulle, ListeMotifs } from '../composants/Elements'
import { SelecteurHorizon } from '../composants/SelecteurHorizon'
import { useApplication } from '../etat/application'
import { calculs, essayer, useCalculDiffere, type Sensibilites } from '../etat/calculs'
import { afficher, formaterDate, formaterEuros, formaterPoints, formaterTaux, formaterTauxCalcule } from '../format'
import { telecharger, TYPE_CSV } from '../telechargement'

/** Délai avant le calcul des sensibilités (tornado, tableau croisé, prix d'équilibre). */
const DELAI_SENSIBILITES = 200

function TableauAnnuel({ colonnes, annees, legende }: { readonly colonnes: readonly Colonne<LigneAnnuelle>[]; readonly annees: readonly LigneAnnuelle[]; readonly legende: string }) {
  return (
    <div className="tableau-defilant">
      <table className="tableau-annuel">
        <caption className="visuellement-masque">{legende}</caption>
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th key={c.cle} scope="col">
                {c.libelle} <Infobulle texte={c.formule} libelle={`Formule : ${c.libelle}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {annees.map((a) => (
            <tr key={a.annee}>
              {colonnes.map((c, k) =>
                k === 0 ? (
                  <th key={c.cle} scope="row">
                    {afficher(c.valeur(a), c.format)}
                  </th>
                ) : (
                  <td key={c.cle} className="nombre">
                    {afficher(c.valeur(a), c.format)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailPlusValueTableau({ pv }: { readonly pv: DetailPlusValue }) {
  const lignes: readonly [string, string][] = [
    ['Prix de cession net de frais', formaterEuros(pv.prix_cession_net)],
    [`Frais d’acquisition retenus${pv.frais_acquisition_forfaitaires ? ' (forfait)' : ''}`, formaterEuros(pv.frais_acquisition_retenus)],
    [`Travaux retenus${pv.travaux_forfaitaires ? ' (forfait)' : ''}`, formaterEuros(pv.travaux_retenus)],
    ['Amortissements réintégrés', formaterEuros(pv.amortissements_reintegres)],
    ['Prix d’acquisition corrigé', formaterEuros(pv.prix_acquisition_corrige)],
    ['Plus-value brute', formaterEuros(pv.plus_value_brute)],
    ['Abattement pour durée de détention (impôt)', formaterTaux(pv.taux_abattement_ir)],
    ['Abattement pour durée de détention (prélèvements sociaux)', formaterTaux(pv.taux_abattement_ps)],
    ['Plus-value imposable (impôt)', formaterEuros(pv.plus_value_imposable_ir)],
    ['Plus-value imposable (prélèvements sociaux)', formaterEuros(pv.plus_value_imposable_ps)],
    ['Impôt sur le revenu', formaterEuros(pv.impot_revenu)],
    ['Prélèvements sociaux', formaterEuros(pv.prelevements_sociaux)],
    ['Surtaxe sur les plus-values élevées', formaterEuros(pv.surtaxe)],
    ['Impôt de plus-value total', formaterEuros(pv.impot_total)],
  ]
  return (
    <details>
      <summary>Détail de la plus-value</summary>
      <table className="tableau-compact">
        <tbody>
          {lignes.map(([libelle, valeur]) => (
            <tr key={libelle}>
              <th scope="row">{libelle}</th>
              <td className="nombre">{valeur}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function SensibilitesScenario({ s, horizon }: { readonly s: Sensibilites; readonly horizon: number }) {
  const { dossier } = useApplication()
  const sens = hypothesesDefaut.sensibilites
  const prixActuel = dossier.hypotheses.prix
  return (
    <>
      {s.tornado === null ? null : (
        <>
          <h4>
            Tornado du TRI <Infobulle texte={sens.commentaire} libelle="Amplitudes du tornado" />
          </h4>
          <p>TRI central : {formaterTauxCalcule(s.tornado.tri_central)}</p>
          <table className="tableau-compact">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">TRI, variable basse</th>
                <th scope="col">TRI, variable haute</th>
                <th scope="col">Amplitude</th>
              </tr>
            </thead>
            <tbody>
              {s.tornado.branches.map((b) => (
                <tr key={b.variable}>
                  <th scope="row">{b.libelle}</th>
                  <td className="nombre">{formaterTauxCalcule(b.tri_bas)}</td>
                  <td className="nombre">{formaterTauxCalcule(b.tri_haut)}</td>
                  <td className="nombre">{formaterPoints(b.amplitude)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {s.croise === null ? null : (
        <>
          <h4>TRI selon la décote du neuf et la revalorisation du prix (revente après {horizon} ans)</h4>
          <table className="tableau-compact tableau-croise">
            <thead>
              <tr>
                <th scope="col">Décote \ revalorisation</th>
                {s.croise.revalorisations.map((r) => (
                  <th key={r} scope="col">
                    {formaterTaux(r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.croise.decotes.map((decote, i) => (
                <tr key={decote}>
                  <th scope="row">{formaterTaux(decote)}</th>
                  {s.croise?.revalorisations.map((r, j) => (
                    <td
                      key={r}
                      className={decote === prixActuel.decote_neuf && r === prixActuel.revalorisation_annuelle ? 'nombre cellule-courante' : 'nombre'}
                    >
                      {formaterTauxCalcule(s.croise?.tri[i]?.[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {s.equilibre === null ? null : (
        <p>
          Prix de revente d’équilibre avec le placement de référence :{' '}
          <strong>{s.equilibre.prix === null ? 'hors de l’intervalle étudié' : formaterEuros(s.equilibre.prix)}</strong> (prix central{' '}
          {formaterEuros(s.equilibre.prix_central)}, TRI du placement {formaterTauxCalcule(s.equilibre.tri_placement)}).
        </p>
      )}
      <p>
        Pénalité d’une revente un an avant la fin des engagements :{' '}
        <strong>{s.penalite === null ? 'aucune' : `${formaterEuros(s.penalite.montant)} (revente après ${String(s.penalite.horizon)} ans)`}</strong>.
      </p>
    </>
  )
}

function Simulation({ r, s }: { readonly r: ResultatScenario; readonly s: ResultatSimulation }) {
  const { dossierCalcul, p, objectifs, enregistre } = useApplication()
  const horizon = objectifs.horizon
  const colonnes = colonnesTableauAnnuel(dossierCalcul, r.id, s, p)
  const sensibilites = useCalculDiffere(
    useCallback(() => calculs.sensibilites(dossierCalcul, p, r.id, horizon), [dossierCalcul, p, r.id, horizon]),
    DELAI_SENSIBILITES,
  )
  const nom = nomDeFichier(enregistre.nom, r.id, `${String(horizon)}-ans`)
  const o = s.sortie
  return (
    <>
      <div className="actions-en-ligne ne-pas-imprimer">
        <button
          type="button"
          onClick={() => {
            telecharger(`${nom}-tableau-annuel.csv`, versCsv(tableauAnnuel(dossierCalcul, r.id, s, p)), TYPE_CSV)
          }}
        >
          Exporter le tableau annuel en CSV
        </button>
        <button
          type="button"
          onClick={() => {
            // Le module de compression n'est chargé qu'au premier export XLSX.
            void import('../../export/xlsx').then(({ versXlsx, TYPE_MIME_XLSX }) => {
              telecharger(`${nom}.xlsx`, versXlsx(classeurScenario(dossierCalcul, r.id, s, p)), TYPE_MIME_XLSX)
            })
          }}
        >
          Exporter en XLSX (tableau, revente, formules)
        </button>
      </div>
      <dl className="definitions definitions-en-ligne">
        <dt>Régime fiscal des loyers</dt>
        <dd>{libelleRegime(s)}</dd>
        <dt>Prix d’acquisition</dt>
        <dd>{formaterEuros(s.prix_acquisition)}</dd>
        <dt>Coût total</dt>
        <dd>{formaterEuros(s.cout_total)}</dd>
        <dt>Emprunt</dt>
        <dd>{formaterEuros(s.emprunt)}</dd>
        <dt>Fonds propres à la signature</dt>
        <dd>{formaterEuros(s.apport)}</dd>
        <dt>Revente</dt>
        <dd>
          {formaterDate(o.date_cession)}, après {o.annees_detention} ans de détention
        </dd>
      </dl>
      <ListeMotifs motifs={[...r.eligibilite.avertissements, ...s.alertes]} classe="alertes" />
      <BadgesParametres chemins={r.parametres_a_confirmer} p={p} />
      <h3>Tableau annuel</h3>
      <TableauAnnuel colonnes={colonnes} annees={s.annees} legende={`Tableau annuel de ${r.id}`} />
      <details>
        <summary>Détail des charges par poste</summary>
        <TableauAnnuel colonnes={[...colonnes.slice(0, 1), ...colonnesDetailCharges()]} annees={s.annees} legende="Détail des charges" />
      </details>
      <h3>Revente</h3>
      <table className="tableau-compact">
        <tbody>
          {lignesSortie(dossierCalcul, r.id, s, p).map((l) => (
            <tr key={l.cle}>
              <th scope="row">
                {l.libelle} <Infobulle texte={l.formule} libelle={`Formule : ${l.libelle}`} />
              </th>
              <td className="nombre">{afficher(l.valeur(o), l.format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.plus_value === null ? null : <DetailPlusValueTableau pv={o.plus_value} />}
      <h3>Sensibilités</h3>
      {sensibilites.statut === 'erreur' ? <Encart genre="erreur">{sensibilites.message}</Encart> : null}
      <EnCours actif={sensibilites.statut === 'en_cours'}>
        {sensibilites.statut === 'pret' ? (
          <SensibilitesScenario s={sensibilites.valeur} horizon={horizon} />
        ) : sensibilites.statut === 'en_cours' && sensibilites.precedent !== undefined ? (
          <SensibilitesScenario s={sensibilites.precedent} horizon={horizon} />
        ) : null}
      </EnCours>
    </>
  )
}

function Detail() {
  const { dossierCalcul, p, objectifs, etat, actions } = useApplication()
  const horizon = objectifs.horizon
  const resultat = useMemo(() => essayer(() => calculs.comparaison(dossierCalcul, p, horizon)), [dossierCalcul, p, horizon])
  if (!resultat.ok) return <Encart genre="erreur">{resultat.message}</Encart>
  const scenarios = resultat.valeur.scenarios
  const r = scenarios.find((x) => x.id === etat.scenario)
  return (
    <>
      <div className="barre-outils ne-pas-imprimer">
        <ChampListe<IdScenario>
          libelle="Scénario"
          valeur={etat.scenario}
          options={SCENARIOS.map((id) => {
            const eligible = scenarios.find((x) => x.id === id)?.simulation !== null
            return { valeur: id, libelle: `${id} ${LIBELLES_SCENARIOS[id]}${eligible ? '' : ' (inéligible)'}` }
          })}
          onChange={actions.choisirScenario}
        />
        <SelecteurHorizon />
      </div>
      {r === undefined ? null : r.simulation === null ? (
        <Encart genre="info" titre={`${r.id} est inéligible :`}>
          <ListeMotifs motifs={r.eligibilite.motifs} />
        </Encart>
      ) : (
        <Simulation r={r} s={r.simulation} />
      )}
    </>
  )
}

export function EcranDetail() {
  const { complet } = useApplication()
  return <Ecran id="detail">{complet ? <Detail /> : <DossierIncomplet />}</Ecran>
}
