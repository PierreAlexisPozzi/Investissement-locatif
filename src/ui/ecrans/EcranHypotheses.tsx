import { hypothesesParDefaut, type HypothesesSimulation, type ScenarioMarche } from '../../engine/dossier'
import { ENVELOPPES_PLACEMENT, hypothesesDefaut, MODES_EVOLUTION, type Hypothese } from '../../params'
import { ChampCase, ChampListe, ChampNombre, ChampTaux, Groupe } from '../composants/Champs'
import { Ecran } from '../composants/Ecran'
import { useApplication } from '../etat/application'
import { formaterNombre, formaterTaux } from '../format'
import { LIBELLES_ENVELOPPES, LIBELLES_MODES_EVOLUTION } from '../libelles'

const MARCHES: readonly { readonly id: ScenarioMarche; readonly libelle: string }[] = [
  { id: 'pessimiste', libelle: 'Pessimiste' },
  { id: 'central', libelle: 'Central' },
  { id: 'optimiste', libelle: 'Optimiste' },
]

/** Rappel de la valeur par défaut et de son origine (cahier des charges ou choix de l'outil). */
function parDefaut<T>(h: Hypothese<T>, affichage: (v: T) => string): string {
  return `Par défaut : ${affichage(h.valeur)}. ${h.origine}. ${h.commentaire}`
}

export function EcranHypotheses() {
  const { dossier, actions } = useApplication()
  const h = dossier.hypotheses
  const d = hypothesesDefaut
  const maj = (patch: Partial<HypothesesSimulation>): void => {
    actions.modifierDossier((x) => ({ ...x, hypotheses: { ...x.hypotheses, ...patch } }))
  }
  const marcheActif = MARCHES.find((m) => {
    const prix = hypothesesParDefaut(m.id).prix
    return prix.decote_neuf === h.prix.decote_neuf && prix.revalorisation_annuelle === h.prix.revalorisation_annuelle
  })?.id
  return (
    <Ecran
      id="hypotheses"
      actions={
        <button
          type="button"
          onClick={() => {
            maj(hypothesesParDefaut('central'))
          }}
        >
          Hypothèses prudentes
        </button>
      }
    >
      <p className="introduction">
        Valeurs par défaut prudentes (§5.5), modifiables. « Hypothèses prudentes » rétablit toutes les valeurs par défaut, scénario de prix central compris.
      </p>
      <Groupe titre="Évolution du prix du bien">
        <div className="champ-large">
          <p className="sous-titre" id="marches">
            Scénario de marché
          </p>
          <div className="boutons-bascule" role="group" aria-labelledby="marches">
            {MARCHES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={marcheActif === m.id}
                onClick={() => {
                  maj({ prix: hypothesesParDefaut(m.id).prix })
                }}
              >
                {m.libelle} : décote {formaterTaux(hypothesesParDefaut(m.id).prix.decote_neuf)}
              </button>
            ))}
          </div>
          <p className="champ-aide">{d.marche.scenarios_prix.commentaire}</p>
        </div>
        <ChampTaux
          libelle="Décote du neuf à la revente"
          valeur={h.prix.decote_neuf}
          max={1}
          onChange={(v) => {
            maj({ prix: { ...h.prix, decote_neuf: v ?? 0 } })
          }}
        />
        <ChampTaux
          libelle="Revalorisation annuelle du prix"
          valeur={h.prix.revalorisation_annuelle}
          min={-1}
          onChange={(v) => {
            maj({ prix: { ...h.prix, revalorisation_annuelle: v ?? 0 } })
          }}
        />
        <ChampTaux
          libelle="Frais de cession"
          valeur={h.frais_cession}
          max={1}
          aide={parDefaut(d.marche.frais_cession, formaterTaux)}
          onChange={(v) => {
            maj({ frais_cession: v ?? 0 })
          }}
        />
      </Groupe>

      <Groupe titre="Loyers et charges">
        <ChampTaux
          libelle="Revalorisation annuelle des loyers"
          valeur={h.revalorisation_loyers}
          min={-1}
          aide={parDefaut(d.marche.revalorisation_loyers, formaterTaux)}
          onChange={(v) => {
            maj({ revalorisation_loyers: v ?? 0 })
          }}
        />
        <ChampTaux
          libelle="Revalorisation annuelle des charges"
          valeur={h.revalorisation_charges}
          min={-1}
          aide={parDefaut(d.marche.revalorisation_charges, formaterTaux)}
          onChange={(v) => {
            maj({ revalorisation_charges: v ?? 0 })
          }}
        />
        <ChampNombre
          libelle="Vacance locative"
          valeur={h.vacance_mois_par_an}
          min={0}
          max={12}
          unite="mois/an"
          aide={parDefaut(d.marche.vacance_mois_par_an, formaterNombre)}
          onChange={(v) => {
            maj({ vacance_mois_par_an: v ?? 0 })
          }}
        />
        <ChampTaux
          libelle="Provision pour entretien"
          valeur={h.entretien_part_loyers}
          max={1}
          aide={parDefaut(d.marche.entretien_part_loyers, formaterTaux)}
          onChange={(v) => {
            maj({ entretien_part_loyers: v ?? 0 })
          }}
        />
        <ChampNombre
          libelle="Exonération de taxe foncière du neuf"
          valeur={h.annees_exoneration_taxe_fonciere}
          min={0}
          entier
          unite="ans"
          aide={parDefaut(d.bien.annees_exoneration_taxe_fonciere, formaterNombre)}
          onChange={(v) => {
            maj({ annees_exoneration_taxe_fonciere: v ?? 0 })
          }}
        />
      </Groupe>

      <Groupe titre="Inflation, barème et revenus">
        <ChampTaux
          libelle="Inflation"
          valeur={h.inflation}
          min={-1}
          aide={parDefaut(d.marche.inflation, formaterTaux)}
          onChange={(v) => {
            maj({ inflation: v ?? 0 })
          }}
        />
        <ChampListe
          libelle="Barème de l’impôt"
          valeur={h.indexation_bareme}
          options={MODES_EVOLUTION.map((m) => ({ valeur: m, libelle: LIBELLES_MODES_EVOLUTION[m] }))}
          aide={d.marche.indexation_bareme_ir.commentaire}
          onChange={(indexation_bareme) => {
            maj({ indexation_bareme })
          }}
        />
        <ChampListe
          libelle="Revenus du foyer"
          valeur={h.evolution_revenus}
          options={MODES_EVOLUTION.map((m) => ({ valeur: m, libelle: LIBELLES_MODES_EVOLUTION[m] }))}
          aide={d.marche.evolution_revenus.commentaire}
          onChange={(evolution_revenus) => {
            maj({ evolution_revenus })
          }}
        />
        <ChampCase
          libelle="CSG déductible l’année suivante"
          valeur={h.csg_deductible}
          aide="Option désactivée par défaut (HYPOTHESES.md) : la part déductible de la CSG des revenus de l’opération réduit le revenu imposable de l’année suivante."
          onChange={(csg_deductible) => {
            maj({ csg_deductible })
          }}
        />
      </Groupe>

      <Groupe titre="Financement et placement de référence">
        <ChampCase
          libelle="Indemnités de remboursement anticipé à la revente"
          valeur={h.ira_appliquees}
          aide={d.financement.ira_appliquees.commentaire}
          onChange={(ira_appliquees) => {
            maj({ ira_appliquees })
          }}
        />
        <ChampTaux
          libelle="Rendement du placement de référence"
          valeur={h.rendement_placement}
          min={-1}
          aide={parDefaut(d.placement_reference.rendement_net_frais, formaterTaux)}
          onChange={(v) => {
            maj({ rendement_placement: v ?? 0 })
          }}
        />
        <ChampListe
          libelle="Enveloppe du placement"
          valeur={h.enveloppe_placement}
          options={ENVELOPPES_PLACEMENT.map((e) => ({ valeur: e, libelle: LIBELLES_ENVELOPPES[e] }))}
          aide={d.placement_reference.enveloppe.commentaire}
          onChange={(enveloppe_placement) => {
            maj({ enveloppe_placement })
          }}
        />
      </Groupe>
    </Ecran>
  )
}
