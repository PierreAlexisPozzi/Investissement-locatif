import { useMemo } from 'react'
import type { ContreExpertise, IndicateurAnnonce, ResultatContreExpertise, SimulationVendeur } from '../../engine/contre-expertise'
import { LIBELLES_SCENARIOS, SCENARIOS, type IdScenario } from '../../engine/scenario'
import { hypothesesDefaut } from '../../params'
import { ChampListe, ChampMontant, ChampNombre, ChampTaux, Groupe } from '../composants/Champs'
import { DossierIncomplet, Ecran } from '../composants/Ecran'
import { Encart, ListeMotifs } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { calculs, essayer } from '../etat/calculs'
import { eurosParMois, formaterEuros, formaterPoints, formaterTaux, formaterTauxCalcule } from '../format'

function valeurAnnoncee(indicateur: IndicateurAnnonce, v: number): string {
  switch (indicateur) {
    case 'tri':
      return formaterTaux(v)
    case 'effort_epargne':
      return eurosParMois(v)
    case 'economie_impot':
    case 'impot_plus_value':
      return formaterEuros(v)
  }
}

function Saisie({ v }: { readonly v: SimulationVendeur }) {
  const { actions } = useApplication()
  const maj = (patch: Partial<SimulationVendeur>): void => {
    actions.modifierVendeur({ ...v, ...patch })
  }
  return (
    <>
      <Groupe titre="Opération présentée">
        <ChampListe<IdScenario>
          libelle="Dispositif"
          valeur={v.scenario}
          options={SCENARIOS.map((id) => ({ valeur: id, libelle: `${id} ${LIBELLES_SCENARIOS[id]}` }))}
          onChange={(scenario) => {
            maj({ scenario })
          }}
        />
        <ChampNombre libelle="Revente après" valeur={v.horizon} min={1} entier unite="ans" onChange={(h) => { maj({ horizon: h ?? v.horizon }) }} />
        <ChampMontant
          libelle="Prix annoncé"
          valeur={v.prix}
          aide="TTC au taux de TVA du dispositif ; prix d’achat pour un logement ancien."
          onChange={(prix) => {
            maj({ prix: prix ?? 0 })
          }}
        />
        <ChampMontant libelle="Loyer mensuel annoncé" valeur={v.loyer_mensuel} unite="€/mois" onChange={(x) => { maj({ loyer_mensuel: x ?? 0 }) }} />
        <ChampTaux libelle="Taux d’emprunt" valeur={v.taux_emprunt} onChange={(x) => { maj({ taux_emprunt: x ?? 0 }) }} />
      </Groupe>
      <Groupe titre="Hypothèses du vendeur" aide="Laissez vide un poste que la simulation du vendeur ignore : l’outil le signale.">
        <ChampTaux libelle="Revalorisation des loyers" valeur={v.revalorisation_loyers} min={-1} onChange={(x) => { maj({ revalorisation_loyers: x ?? 0 }) }} />
        <ChampTaux libelle="Revalorisation du bien" valeur={v.revalorisation_prix} min={-1} onChange={(x) => { maj({ revalorisation_prix: x ?? 0 }) }} />
        <ChampNombre libelle="Vacance" valeur={v.vacance_mois_par_an} min={0} max={12} unite="mois/an" onChange={(x) => { maj({ vacance_mois_par_an: x ?? 0 }) }} />
        <ChampMontant libelle="Charges de copropriété" valeur={v.charges_copropriete} optionnel unite="€/an" onChange={(charges_copropriete) => { maj({ charges_copropriete }) }} />
        <ChampTaux libelle="Entretien" valeur={v.entretien_part_loyers} optionnel max={1} aide="Part des loyers." onChange={(entretien_part_loyers) => { maj({ entretien_part_loyers }) }} />
        <ChampMontant libelle="Taxe foncière" valeur={v.taxe_fonciere} optionnel unite="€/an" onChange={(taxe_fonciere) => { maj({ taxe_fonciere }) }} />
        <ChampMontant libelle="Frais annuels de la SCI" valeur={v.frais_sci_annuels} optionnel unite="€/an" onChange={(frais_sci_annuels) => { maj({ frais_sci_annuels }) }} />
        <ChampMontant
          libelle="Prix de revente annoncé"
          valeur={v.prix_revente}
          optionnel
          aide="À défaut, prix revalorisé sans décote du neuf."
          onChange={(prix_revente) => {
            maj({ prix_revente })
          }}
        />
        <ChampTaux libelle="Tranche marginale supposée" valeur={v.tmi_supposee} optionnel max={1} onChange={(tmi_supposee) => { maj({ tmi_supposee }) }} />
      </Groupe>
      <Groupe titre="Résultats annoncés">
        <ChampNombre
          libelle="Économie d’impôt cumulée annoncée"
          valeur={v.economie_impot_annoncee}
          optionnel
          unite="€"
          onChange={(economie_impot_annoncee) => {
            maj({ economie_impot_annoncee })
          }}
        />
        <ChampNombre
          libelle="Effort d’épargne mensuel annoncé"
          valeur={v.effort_epargne_annonce}
          optionnel
          unite="€/mois"
          onChange={(effort_epargne_annonce) => {
            maj({ effort_epargne_annonce })
          }}
        />
        <ChampMontant
          libelle="Impôt de plus-value annoncé"
          valeur={v.impot_plus_value_annonce}
          optionnel
          onChange={(impot_plus_value_annonce) => {
            maj({ impot_plus_value_annonce })
          }}
        />
        <ChampTaux libelle="TRI annoncé" valeur={v.tri_annonce} optionnel min={-1} onChange={(tri_annonce) => { maj({ tri_annonce }) }} />
      </Groupe>
    </>
  )
}

function Resultats({ c }: { readonly c: ContreExpertise }) {
  const tolerance = hypothesesDefaut.contre_expertise.tolerance_ecart.valeur
  const lignes: readonly { libelle: string; valeur: (r: ResultatContreExpertise) => string }[] = [
    { libelle: 'Effort d’épargne mensuel moyen', valeur: (r) => eurosParMois(r.indicateurs.effort_mensuel_moyen) },
    { libelle: 'Économie d’impôt cumulée', valeur: (r) => formaterEuros(r.indicateurs.economie_impot_cumulee) },
    { libelle: 'Économie d’impôt nette des reprises', valeur: (r) => formaterEuros(r.indicateurs.economie_impot_nette) },
    { libelle: 'Prix de revente', valeur: (r) => formaterEuros(r.sortie.prix_revente) },
    { libelle: 'Impôt de plus-value', valeur: (r) => formaterEuros(r.sortie.impot_plus_value) },
    { libelle: 'Capital net à la sortie', valeur: (r) => formaterEuros(r.indicateurs.capital_net_sortie) },
    { libelle: 'TRI après impôt', valeur: (r) => formaterTauxCalcule(r.indicateurs.tri) },
  ]
  return (
    <section aria-labelledby="titre-resultats-contre">
      <h3 id="titre-resultats-contre">Contre-expertise</h3>
      <p className="phrase-recommandation">{c.synthese}</p>
      {!c.eligible ? (
        <Encart genre="alerte" titre="Dispositif inéligible pour ce dossier :">
          <ListeMotifs motifs={c.motifs_ineligibilite} />
        </Encart>
      ) : null}
      <h4>Hypothèses optimistes relevées</h4>
      {c.hypotheses_optimistes.length === 0 ? <p>Aucune.</p> : <ListeMotifs motifs={c.hypotheses_optimistes.map((h) => h.message)} classe="alertes" />}
      <h4>Résultats annoncés et recalcul avec les hypothèses du vendeur</h4>
      {c.ecarts.length === 0 ? (
        <p>Aucun résultat annoncé saisi.</p>
      ) : (
        <div className="defilement-horizontal">
          <table className="tableau-compact">
            <thead>
              <tr>
                <th scope="col">Indicateur</th>
                <th scope="col">Annoncé</th>
                <th scope="col">Recalculé</th>
                <th scope="col">Écart</th>
                <th scope="col">Écart relatif</th>
              </tr>
            </thead>
            <tbody>
              {c.ecarts.map((e) => (
                <tr key={e.indicateur} className={e.significatif ? 'ecart-significatif' : undefined}>
                  <th scope="row">{e.libelle}</th>
                  <td className="nombre">{valeurAnnoncee(e.indicateur, e.annonce)}</td>
                  <td className="nombre">{valeurAnnoncee(e.indicateur, e.recalcule)}</td>
                  <td className="nombre">{e.indicateur === 'tri' ? formaterPoints(e.ecart) : valeurAnnoncee(e.indicateur, e.ecart)}</td>
                  <td className="nombre">
                    {Number.isFinite(e.ecart_relatif) ? formaterTaux(e.ecart_relatif) : '—'}
                    {e.significatif ? <span className="badge badge-a_confirmer"> au-delà de {formaterTaux(tolerance)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4>Hypothèses du vendeur et hypothèses prudentes</h4>
      <div className="defilement-horizontal">
        <table className="tableau-compact">
          <thead>
            <tr>
              <th scope="col">Indicateur</th>
              <th scope="col">Hypothèses du vendeur</th>
              <th scope="col">Hypothèses prudentes</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.libelle}>
                <th scope="row">{l.libelle}</th>
                <td className="nombre">{c.recalcul_vendeur === null ? '—' : l.valeur(c.recalcul_vendeur)}</td>
                <td className="nombre">{c.rejeu_prudent === null ? '—' : l.valeur(c.rejeu_prudent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Écart d’effort d’épargne : <strong>{c.ecart_effort_prudent === null ? '—' : eurosParMois(c.ecart_effort_prudent)}</strong> ; écart de TRI :{' '}
        <strong>{formaterPoints(c.ecart_tri_prudent)}</strong> (hypothèses prudentes moins hypothèses du vendeur).
      </p>
    </section>
  )
}

function ContreExpertiser() {
  const { dossierCalcul, p, enregistre, objectifs, etat, actions } = useApplication()
  const v = enregistre.simulation_vendeur
  const resultat = useMemo(
    () => (v === undefined || !(v.prix > 0) || !(v.loyer_mensuel > 0) ? null : essayer(() => calculs.contreExpertise(dossierCalcul, p, v))),
    [dossierCalcul, p, v],
  )
  if (v === undefined) {
    return (
      <>
        <p className="introduction">
          Saisissez les hypothèses et les résultats de la simulation remise par le vendeur : l’outil la recalcule, relève les hypothèses optimistes et la
          rejoue avec les hypothèses prudentes.
        </p>
        <button
          type="button"
          onClick={() => {
            actions.modifierVendeur({
              scenario: etat.scenario,
              horizon: objectifs.horizon,
              prix: 0,
              loyer_mensuel: 0,
              revalorisation_loyers: 0,
              revalorisation_prix: 0,
              vacance_mois_par_an: 0,
              taux_emprunt: dossierCalcul.financement.taux_annuel,
            })
          }}
        >
          Saisir la simulation du vendeur
        </button>
      </>
    )
  }
  return (
    <div className="mise-en-page-moitie">
      <div>
        <Saisie v={v} />
        <button
          type="button"
          className="bouton-discret"
          onClick={() => {
            actions.modifierVendeur(undefined)
          }}
        >
          Effacer la simulation du vendeur
        </button>
      </div>
      <div>
        {resultat === null ? (
          <Encart genre="info">Saisissez au moins le prix et le loyer annoncés.</Encart>
        ) : resultat.ok ? (
          <Resultats c={resultat.valeur} />
        ) : (
          <Encart genre="erreur">{resultat.message}</Encart>
        )}
      </div>
    </div>
  )
}

export function EcranContreExpertise() {
  const { complet } = useApplication()
  return <Ecran id="contre_expertise">{complet ? <ContreExpertiser /> : <DossierIncomplet />}</Ecran>
}
