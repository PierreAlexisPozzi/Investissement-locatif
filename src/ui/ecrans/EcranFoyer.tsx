import { useMemo, useState } from 'react'
import { situationFiscale } from '../../engine/apercus'
import { foyersPourSituation, SITUATIONS_FOYERS, type FoyerFiscal, type Foyers } from '../../engine/dossier'
import { endettementExcessif } from '../../engine/emprunt'
import { partsAvecEnfants, salairesNetsImposables } from '../../engine/impot-revenu'
import { tauxEndettementActuel } from '../../engine/indicateurs'
import { ChampCase, ChampListe, ChampMontant, ChampNombre, ChampTaux, ChampTexte, Groupe } from '../composants/Champs'
import { Ecran } from '../composants/Ecran'
import { Encart } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { essayer } from '../etat/calculs'
import { formaterEuros, formaterNombre, formaterTaux } from '../format'
import { LIBELLES_SITUATIONS, options } from '../libelles'

/** Aide de saisie : revenu imposable à partir des salaires de chacun (déduction forfaitaire calculée par le moteur). */
function DepuisSalaires({ onAppliquer }: { readonly onAppliquer: (revenu: number) => void }) {
  const { p } = useApplication()
  const [salaires, setSalaires] = useState<readonly (number | undefined)[]>([undefined, undefined])
  const saisis = salaires.filter((s): s is number => s !== undefined)
  return (
    <details className="aide-saisie">
      <summary>Calculer à partir des salaires nets imposables</summary>
      <div className="grille-champs">
        {salaires.map((s, k) => (
          <ChampMontant
            key={k}
            libelle={`Salaire net imposable ${String(k + 1)}`}
            valeur={s}
            optionnel
            onChange={(v) => {
              setSalaires(salaires.map((x, i) => (i === k ? v : x)))
            }}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={saisis.length === 0}
        onClick={() => {
          onAppliquer(salairesNetsImposables(saisis, p))
        }}
      >
        Reporter {saisis.length === 0 ? '' : formaterEuros(salairesNetsImposables(saisis, p))} après déduction des frais professionnels
      </button>
    </details>
  )
}

/** Aide de saisie : parts selon le nombre d'enfants à charge. */
function DepuisEnfants({ communes, onAppliquer }: { readonly communes: boolean; readonly onAppliquer: (parts: number) => void }) {
  const { p } = useApplication()
  const [enfants, setEnfants] = useState<number | undefined>(undefined)
  return (
    <details className="aide-saisie">
      <summary>Calculer les parts selon les enfants à charge</summary>
      <ChampNombre
        libelle="Enfants à charge"
        valeur={enfants}
        min={0}
        entier
        optionnel
        onChange={setEnfants}
        aide="Hors majorations particulières (parent isolé, invalidité, garde alternée), à saisir directement."
      />
      <button
        type="button"
        disabled={enfants === undefined}
        onClick={() => {
          onAppliquer(partsAvecEnfants(communes, enfants ?? 0, p))
        }}
      >
        Appliquer {enfants === undefined ? '' : `${formaterNombre(partsAvecEnfants(communes, enfants, p))} parts`}
      </button>
    </details>
  )
}

function CarteFoyer({ foyer, rang, situation }: { readonly foyer: FoyerFiscal; readonly rang: number; readonly situation: Foyers['situation'] }) {
  const { actions } = useApplication()
  const maj = (modifier: (f: FoyerFiscal) => FoyerFiscal): void => {
    actions.modifierDossier((d) => ({ ...d, foyers: { ...d.foyers, foyers: d.foyers.foyers.map((f, k) => (k === rang ? modifier(f) : f)) } }))
  }
  const concubins = situation === 'concubins'
  const existants = foyer.revenus_fonciers_existants
  const changement = foyer.changement_revenu
  const deficits = foyer.deficits_fonciers_existants ?? []
  return (
    <Groupe titre={concubins ? `Foyer fiscal ${String(rang + 1)} : ${foyer.libelle}` : 'Foyer fiscal'}>
      {concubins ? (
        <ChampTexte
          libelle="Libellé"
          valeur={foyer.libelle}
          onChange={(v) => {
            maj((f) => ({ ...f, libelle: v ?? '' }))
          }}
        />
      ) : null}
      <div>
        <ChampMontant
          libelle="Revenu net imposable annuel"
          valeur={foyer.revenu_imposable}
          aide="Hors revenus fonciers et hors opération, année de la signature."
          onChange={(v) => {
            maj((f) => ({ ...f, revenu_imposable: v ?? 0 }))
          }}
        />
        <DepuisSalaires
          onAppliquer={(revenu) => {
            maj((f) => ({ ...f, revenu_imposable: revenu }))
          }}
        />
      </div>
      <div>
        <ChampNombre
          libelle="Nombre de parts"
          valeur={foyer.parts}
          min={1}
          onChange={(v) => {
            maj((f) => ({ ...f, parts: v ?? 0 }))
          }}
        />
        <DepuisEnfants
          communes={situation === 'marie_pacse'}
          onAppliquer={(parts) => {
            maj((f) => ({ ...f, parts }))
          }}
        />
      </div>
      {concubins ? (
        <ChampTaux
          libelle="Quote-part dans le bien"
          valeur={foyer.quote_part}
          max={1}
          onChange={(v) => {
            maj((f) => ({ ...f, quote_part: v ?? 0 }))
          }}
        />
      ) : null}
      <ChampMontant
        libelle="Avantages fiscaux déjà utilisés"
        valeur={foyer.avantages_niches_deja_utilises}
        optionnel
        aide="Retenus dans le plafonnement global des niches : emploi à domicile, garde d’enfants…"
        onChange={(v) => {
          maj((f) => ({ ...f, avantages_niches_deja_utilises: v }))
        }}
      />
      <ChampMontant
        libelle="Mensualités des crédits en cours"
        valeur={foyer.mensualites_credits_en_cours}
        optionnel
        unite="€/mois"
        aide="Assurance comprise ; sert au taux d’endettement."
        onChange={(v) => {
          maj((f) => ({ ...f, mensualites_credits_en_cours: v }))
        }}
      />
      <ChampMontant
        libelle="Revenus d’activité"
        valeur={foyer.revenus_activite}
        optionnel
        aide="Pour le statut de loueur en meublé non professionnel ; à défaut, le revenu imposable."
        onChange={(v) => {
          maj((f) => ({ ...f, revenus_activite: v }))
        }}
      />
      <div className="champ-large">
        <ChampCase
          libelle="Changement de revenu prévu (retraite, congé parental, temps partiel…)"
          valeur={changement !== undefined}
          onChange={(oui) => {
            maj((f) => ({ ...f, changement_revenu: oui ? { annee: new Date().getFullYear() + 1, revenu_imposable: f.revenu_imposable } : undefined }))
          }}
        />
        {changement === undefined ? null : (
          <div className="grille-champs">
            <ChampNombre
              libelle="À partir de l’année"
              valeur={changement.annee}
              entier
              min={1900}
              onChange={(v) => {
                maj((f) => ({ ...f, changement_revenu: { annee: v ?? changement.annee, revenu_imposable: f.changement_revenu?.revenu_imposable ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="Revenu net imposable prévu"
              valeur={changement.revenu_imposable}
              onChange={(v) => {
                maj((f) => ({ ...f, changement_revenu: { annee: f.changement_revenu?.annee ?? changement.annee, revenu_imposable: v ?? 0 } }))
              }}
            />
          </div>
        )}
      </div>
      <div className="champ-large">
        <ChampCase
          libelle="Revenus fonciers d’autres biens loués nus"
          valeur={existants !== undefined}
          onChange={(oui) => {
            maj((f) => ({ ...f, revenus_fonciers_existants: oui ? { recettes: 0, charges: 0, regime: 'reel' } : undefined }))
          }}
        />
        {existants === undefined ? null : (
          <div className="grille-champs">
            <ChampMontant
              libelle="Recettes annuelles"
              valeur={existants.recettes}
              onChange={(v) => {
                maj((f) => ({ ...f, revenus_fonciers_existants: { ...existants, recettes: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="Charges déductibles annuelles"
              valeur={existants.charges}
              aide="Hors intérêts ; retenues au régime réel."
              onChange={(v) => {
                maj((f) => ({ ...f, revenus_fonciers_existants: { ...existants, charges: v ?? 0 } }))
              }}
            />
            <ChampListe
              libelle="Régime"
              valeur={existants.regime}
              options={[
                { valeur: 'micro', libelle: 'Micro-foncier' },
                { valeur: 'reel', libelle: 'Réel' },
              ]}
              onChange={(regime) => {
                maj((f) => ({ ...f, revenus_fonciers_existants: { ...existants, regime } }))
              }}
            />
          </div>
        )}
      </div>
      <div className="champ-large">
        <p className="sous-titre">Déficits fonciers reportables existants</p>
        {deficits.length === 0 ? <p className="attenue">Aucun.</p> : null}
        {deficits.map((m, k) => (
          <div className="grille-champs ligne-deficit" key={k}>
            <ChampNombre
              libelle="Année d’origine"
              valeur={m.annee}
              entier
              min={1900}
              onChange={(v) => {
                maj((f) => ({ ...f, deficits_fonciers_existants: deficits.map((x, i) => (i === k ? { ...x, annee: v ?? x.annee } : x)) }))
              }}
            />
            <ChampMontant
              libelle="Montant restant"
              valeur={m.montant}
              onChange={(v) => {
                maj((f) => ({ ...f, deficits_fonciers_existants: deficits.map((x, i) => (i === k ? { ...x, montant: v ?? 0 } : x)) }))
              }}
            />
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                maj((f) => ({ ...f, deficits_fonciers_existants: deficits.filter((_, i) => i !== k) }))
              }}
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            maj((f) => ({ ...f, deficits_fonciers_existants: [...deficits, { annee: new Date().getFullYear() - 1, montant: 0 }] }))
          }}
        >
          Ajouter un déficit
        </button>
      </div>
    </Groupe>
  )
}

function SituationActuelle() {
  const { dossier, p } = useApplication()
  const situations = useMemo(() => essayer(() => situationFiscale(dossier, p)), [dossier, p])
  const endettement = tauxEndettementActuel(dossier)
  return (
    <aside className="apercu" aria-label="Situation fiscale actuelle">
      <h3>Sans l’opération</h3>
      {situations.ok ? (
        <table className="tableau-compact">
          <thead>
            <tr>
              <th scope="col">Foyer</th>
              <th scope="col">Revenu imposé</th>
              <th scope="col">Impôt actuel</th>
              <th scope="col">Tranche marginale</th>
              <th scope="col">Niches disponibles</th>
            </tr>
          </thead>
          <tbody>
            {situations.valeur.map((s) => (
              <tr key={s.libelle}>
                <th scope="row">{s.libelle}</th>
                <td className="nombre">{formaterEuros(s.revenu_global_net)}</td>
                <td className="nombre">{formaterEuros(s.impot)}</td>
                <td className="nombre">{formaterTaux(s.tmi)}</td>
                <td className="nombre">{formaterEuros(s.niches_disponibles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Encart genre="erreur">{situations.message}</Encart>
      )}
      <p className="champ-aide">
        Barème des revenus {p.meta.annee_revenus}, après décote, revenus fonciers des autres biens compris (déficits antérieurs imputés) ; avant les
        réductions et crédits d’impôt déjà obtenus. Plafond global des niches : {formaterEuros(p.impot_revenu.plafonnement_global_niches.valeur)}.
      </p>
      <p>
        Taux d’endettement actuel : <strong>{endettement === null ? '—' : formaterTaux(endettement)}</strong>
        {endettement !== null && endettementExcessif(endettement, p) ? (
          <Encart genre="alerte">Au-delà du seuil de {formaterTaux(p.financement.taux_endettement_max.valeur)} retenu par les banques.</Encart>
        ) : null}
      </p>
    </aside>
  )
}

export function EcranFoyer() {
  const { dossier, p, actions } = useApplication()
  const f = dossier.foyers
  const majFoyers = (modifier: (x: Foyers) => Foyers): void => {
    actions.modifierDossier((d) => ({ ...d, foyers: modifier(d.foyers) }))
  }
  return (
    <Ecran id="foyer">
      <div className="mise-en-page-apercu">
        <div>
          <Groupe titre="Situation">
            <ChampListe
              libelle="Statut du couple"
              valeur={f.situation}
              options={options(LIBELLES_SITUATIONS).filter((o) => SITUATIONS_FOYERS.includes(o.valeur))}
              onChange={(situation) => {
                majFoyers((x) => ({ ...x, situation, foyers: foyersPourSituation(x.foyers, situation, p) }))
              }}
              aide="Changer de statut ramène les parts aux parts de base : ressaisissez les enfants à charge."
            />
            <ChampMontant
              libelle="Capacité d’épargne mensuelle maximale"
              valeur={f.capacite_epargne_mensuelle}
              unite="€/mois"
              onChange={(v) => {
                majFoyers((x) => ({ ...x, capacite_epargne_mensuelle: v ?? 0 }))
              }}
            />
            <ChampMontant
              libelle="Apport disponible"
              valeur={f.apport_disponible}
              onChange={(v) => {
                majFoyers((x) => ({ ...x, apport_disponible: v ?? 0 }))
              }}
            />
          </Groupe>
          {f.foyers.map((foyer, k) => (
            <CarteFoyer key={k} foyer={foyer} rang={k} situation={f.situation} />
          ))}
        </div>
        <SituationActuelle />
      </div>
    </Ecran>
  )
}
