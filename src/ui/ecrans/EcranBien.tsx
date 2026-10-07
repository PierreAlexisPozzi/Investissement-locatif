import { useMemo } from 'react'
import { apercuBien } from '../../engine/apercus'
import { ETATS_BIEN, TYPES_LOGEMENT } from '../../engine/commun'
import type { Bien, Exploitation, Financement } from '../../engine/dossier'
import { PERIMETRES_ASSIMILES_LLI, ZONES } from '../../params'
import { ChampCase, ChampDate, ChampListe, ChampMontant, ChampNombre, ChampTaux, ChampTexte, Groupe } from '../composants/Champs'
import { Ecran } from '../composants/Ecran'
import { BadgeParametre, Encart, ListeMotifs, Pastille } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { essayer } from '../etat/calculs'
import { formaterEuros, formaterNombre, formaterTaux, libelleZone } from '../format'
import { LIBELLES_ETATS, LIBELLES_PERIMETRES_LLI, LIBELLES_TYPES_LOGEMENT } from '../libelles'

const SANS_PERIMETRE = 'aucun'
const SELON_PARAMETRE = 'parametre'

function ApercuBien() {
  const { dossier, p } = useApplication()
  const apercu = useMemo(() => essayer(() => apercuBien(dossier, p)), [dossier, p])
  if (!apercu.ok) return <Encart genre="erreur">{apercu.message}</Encart>
  const a = apercu.valeur
  const loyer = (montant: number | null): string => (montant === null ? '—' : `${formaterEuros(montant)}/mois`)
  return (
    <aside className="apercu" aria-label="Aperçu du bien">
      <h3>Calcul immédiat</h3>
      <dl className="definitions">
        <dt>Surface prise en compte</dt>
        <dd>{a.surface_prise_en_compte === null ? '—' : `${formaterNombre(a.surface_prise_en_compte)} m²`}</dd>
        <dt>Coefficient de surface</dt>
        <dd>{a.coefficient_surface === null ? '—' : formaterNombre(a.coefficient_surface)}</dd>
        <dt>Loyer plafond intermédiaire</dt>
        <dd>{loyer(a.loyer_plafond_intermediaire)}</dd>
        <dt>Loyer plafond social</dt>
        <dd>{loyer(a.loyer_plafond_social)}</dd>
        <dt>Loyer plafond très social</dt>
        <dd>{loyer(a.loyer_plafond_tres_social)}</dd>
        <dt>Loyer de marché nu</dt>
        <dd>{loyer(dossier.bien.loyer_marche_nu)}</dd>
        {dossier.bien.etat === 'ancien' ? null : (
          <>
            <dt>
              Prix TTC au taux normal ({formaterTaux(p.lli.tva_taux_normal.valeur)}) <BadgeParametre chemin="lli.tva_taux_normal" p={p} />
            </dt>
            <dd>{formaterEuros(a.prix_ttc_taux_normal)}</dd>
            <dt>Prix TTC au taux réduit ({formaterTaux(p.lli.tva_taux_reduit.valeur)})</dt>
            <dd>{formaterEuros(a.prix_ttc_taux_reduit)}</dd>
          </>
        )}
        <dt>Prix au m² habitable</dt>
        <dd>{a.prix_m2 === null ? '—' : formaterEuros(a.prix_m2)}</dd>
      </dl>
      {a.anomalies.length > 0 ? (
        <Encart genre="alerte" titre="À corriger :">
          <ListeMotifs motifs={a.anomalies} />
        </Encart>
      ) : null}
      <h3>Éligibilité par dispositif</h3>
      <ul className="eligibilites">
        {a.eligibilites.map((e) => (
          <li key={e.id} className={e.eligibilite.eligible ? undefined : 'ineligible'}>
            <Pastille eligibilite={e.eligibilite} /> <strong>{e.id}</strong> {e.libelle}
            <ListeMotifs motifs={e.eligibilite.eligible ? e.eligibilite.avertissements : e.eligibilite.motifs} />
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function EcranBien() {
  const { dossier, p, actions } = useApplication()
  const b = dossier.bien
  const f = dossier.financement
  const ex = dossier.exploitation
  const majBien = (patch: Partial<Bien>): void => {
    actions.modifierDossier((d) => ({ ...d, bien: { ...d.bien, ...patch } }))
  }
  const majFinancement = (patch: Partial<Financement>): void => {
    actions.modifierDossier((d) => ({ ...d, financement: { ...d.financement, ...patch } }))
  }
  const majExploitation = (modifier: (x: Exploitation) => Exploitation): void => {
    actions.modifierDossier((d) => ({ ...d, exploitation: modifier(d.exploitation) }))
  }
  const ancien = b.etat === 'ancien'
  const travauxDenormandieDefaut = p.plus_value_immobiliere.travaux_denormandie_retenus.valeur
  return (
    <Ecran id="bien">
      <div className="mise-en-page-apercu">
        <div>
          <Groupe titre="Le bien">
            <ChampTexte libelle="Commune" valeur={b.commune} onChange={(commune) => { majBien({ commune }) }} />
            <ChampListe
              libelle="Zone"
              valeur={b.zone}
              options={ZONES.map((z) => ({ valeur: z, libelle: libelleZone(z) }))}
              onChange={(zone) => {
                majBien({ zone })
              }}
            />
            <ChampListe
              libelle="État"
              valeur={b.etat}
              options={ETATS_BIEN.map((e) => ({ valeur: e, libelle: LIBELLES_ETATS[e] }))}
              onChange={(etat) => {
                majBien(etat === 'ancien' ? { etat, travaux: b.travaux ?? 0 } : { etat })
              }}
            />
            <ChampListe
              libelle="Type de logement"
              valeur={b.type_logement}
              options={TYPES_LOGEMENT.map((t) => ({ valeur: t, libelle: LIBELLES_TYPES_LOGEMENT[t] }))}
              onChange={(type_logement) => {
                majBien({ type_logement })
              }}
            />
            <ChampNombre
              libelle="Surface habitable"
              valeur={b.surface.habitable}
              min={0}
              unite="m²"
              onChange={(v) => {
                majBien({ surface: { ...b.surface, habitable: v ?? 0 } })
              }}
            />
            <ChampNombre
              libelle="Surfaces annexes"
              valeur={b.surface.annexes}
              min={0}
              optionnel
              unite="m²"
              aide={`Balcon, terrasse, cave : retenues à ${formaterTaux(p.loyers_plafonds.surface_prise_en_compte.valeur.part_annexes)}, dans la limite de ${formaterNombre(p.loyers_plafonds.surface_prise_en_compte.valeur.plafond_annexes_m2)} m².`}
              onChange={(annexes) => {
                majBien({ surface: { ...b.surface, annexes } })
              }}
            />
            <ChampNombre
              libelle="Nombre de pièces"
              valeur={b.nombre_pieces}
              min={1}
              entier
              optionnel
              onChange={(nombre_pieces) => {
                majBien({ nombre_pieces })
              }}
            />
            <ChampCase libelle="Quartier prioritaire de la ville (QPV)" valeur={b.qpv ?? false} onChange={(qpv) => { majBien({ qpv }) }} />
            <ChampCase
              libelle="Commune Denormandie (Action Cœur de Ville, ORT ou fort besoin de réhabilitation)"
              valeur={b.commune_denormandie}
              onChange={(commune_denormandie) => {
                majBien({ commune_denormandie })
              }}
            />
            <ChampListe
              libelle="Périmètre assimilé du LLI hors zone tendue"
              valeur={b.perimetre_lli ?? SANS_PERIMETRE}
              options={[
                { valeur: SANS_PERIMETRE, libelle: 'Aucun' },
                ...PERIMETRES_ASSIMILES_LLI.map((x) => ({ valeur: x, libelle: LIBELLES_PERIMETRES_LLI[x] })),
              ]}
              onChange={(v) => {
                majBien({ perimetre_lli: v === SANS_PERIMETRE ? undefined : v })
              }}
            />
          </Groupe>

          <Groupe titre="Prix et calendrier">
            <ChampMontant
              libelle={ancien ? 'Prix d’achat' : 'Prix hors taxes'}
              valeur={b.prix_ht}
              aide="Parking et annexes acquis avec le logement compris."
              onChange={(v) => {
                majBien({ prix_ht: v ?? 0 })
              }}
            />
            <ChampMontant libelle="Frais de notaire" valeur={b.frais_notaire} onChange={(v) => { majBien({ frais_notaire: v ?? 0 }) }} />
            {ancien ? null : (
              <ChampCase
                libelle="Programme proposé au taux réduit du LLI (mixité sociale comprise)"
                valeur={b.programme_lli}
                aide="Déclaration du vendeur, à faire confirmer par écrit."
                onChange={(programme_lli) => {
                  majBien({ programme_lli })
                }}
              />
            )}
            <ChampDate
              libelle={b.etat === 'vefa' ? 'Signature du contrat de VEFA' : 'Signature de l’acte'}
              valeur={b.date_acquisition}
              onChange={(date_acquisition) => {
                majBien({ date_acquisition })
              }}
            />
            <ChampDate
              libelle={ancien ? 'Fin des travaux' : 'Achèvement (livraison)'}
              valeur={b.date_livraison}
              onChange={(date_livraison) => {
                majBien({ date_livraison })
              }}
            />
            <ChampDate libelle="Début de la location" valeur={b.date_debut_location} onChange={(date_debut_location) => { majBien({ date_debut_location }) }} />
          </Groupe>

          {ancien ? (
            <Groupe titre="Travaux">
              <ChampMontant libelle="Montant des travaux" valeur={b.travaux} onChange={(travaux) => { majBien({ travaux: travaux ?? 0 }) }} />
              <ChampTexte libelle="Nature des travaux" valeur={b.nature_travaux} onChange={(nature_travaux) => { majBien({ nature_travaux }) }} />
              <ChampTexte libelle="DPE avant travaux" valeur={b.dpe_avant} onChange={(dpe_avant) => { majBien({ dpe_avant }) }} />
              <ChampTexte libelle="DPE après travaux" valeur={b.dpe_apres} onChange={(dpe_apres) => { majBien({ dpe_apres }) }} />
              <ChampCase
                libelle="Travaux d’amélioration déductibles en location nue classique (S0)"
                valeur={b.travaux_deductibles !== false}
                onChange={(travaux_deductibles) => {
                  majBien({ travaux_deductibles })
                }}
              />
              <ChampListe
                libelle="Travaux Denormandie retenus dans la plus-value"
                valeur={b.travaux_denormandie_dans_plus_value === undefined ? SELON_PARAMETRE : b.travaux_denormandie_dans_plus_value ? 'oui' : 'non'}
                options={[
                  { valeur: SELON_PARAMETRE, libelle: `Selon le paramètre (${travauxDenormandieDefaut ? 'oui' : 'non'})` },
                  { valeur: 'oui', libelle: 'Oui' },
                  { valeur: 'non', libelle: 'Non' },
                ]}
                aide="Tolérance du BOFiP non tranchée : à confirmer avec le notaire selon la commune."
                onChange={(v) => {
                  majBien({ travaux_denormandie_dans_plus_value: v === SELON_PARAMETRE ? undefined : v === 'oui' })
                }}
              />
            </Groupe>
          ) : null}

          <Groupe titre="Loyers et charges">
            <ChampMontant
              libelle="Loyer de marché nu"
              valeur={b.loyer_marche_nu}
              unite="€/mois"
              aide="Constaté pour un bien comparable, hors charges ; distinct du loyer plafonné."
              onChange={(v) => {
                majBien({ loyer_marche_nu: v ?? 0 })
              }}
            />
            <ChampMontant
              libelle="Loyer de marché meublé"
              valeur={b.loyer_marche_meuble}
              unite="€/mois"
              onChange={(v) => {
                majBien({ loyer_marche_meuble: v ?? 0 })
              }}
            />
            <ChampNombre
              libelle="Plafond Loc’Avantages social"
              valeur={b.plafonds_m2_loc_avantages?.social}
              min={0}
              optionnel
              unite="€/m²"
              aide="Plafond de la commune, pour la variante Jeanbrun social."
              onChange={(social) => {
                majBien({ plafonds_m2_loc_avantages: { ...b.plafonds_m2_loc_avantages, social } })
              }}
            />
            <ChampNombre
              libelle="Plafond Loc’Avantages très social"
              valeur={b.plafonds_m2_loc_avantages?.tres_social}
              min={0}
              optionnel
              unite="€/m²"
              onChange={(tres_social) => {
                majBien({ plafonds_m2_loc_avantages: { ...b.plafonds_m2_loc_avantages, tres_social } })
              }}
            />
            <ChampMontant
              libelle="Prix de l’ancien récent du quartier"
              valeur={b.prix_m2_ancien_recent}
              optionnel
              unite="€/m²"
              aide="Sert à estimer la décote du neuf à la revente."
              onChange={(prix_m2_ancien_recent) => {
                majBien({ prix_m2_ancien_recent })
              }}
            />
            <ChampMontant
              libelle="Taxe foncière"
              valeur={b.taxe_fonciere}
              unite="€/an"
              aide="Estimation hors taxe d’enlèvement des ordures ménagères."
              onChange={(v) => {
                majBien({ taxe_fonciere: v ?? 0 })
              }}
            />
            <ChampMontant libelle="Taxe d’enlèvement des ordures ménagères" valeur={b.teom} optionnel unite="€/an" onChange={(teom) => { majBien({ teom }) }} />
            <ChampMontant
              libelle="Charges de copropriété non récupérables"
              valeur={b.charges_copropriete_non_recuperables}
              unite="€/an"
              onChange={(v) => {
                majBien({ charges_copropriete_non_recuperables: v ?? 0 })
              }}
            />
          </Groupe>

          <Groupe titre="Financement">
            <ChampMontant libelle="Montant emprunté" valeur={f.emprunt} onChange={(v) => { majFinancement({ emprunt: v ?? 0 }) }} />
            <ChampTaux libelle="Taux nominal annuel" valeur={f.taux_annuel} onChange={(v) => { majFinancement({ taux_annuel: v ?? 0 }) }} />
            <ChampNombre
              libelle="Durée du prêt"
              valeur={f.duree_mois}
              min={0}
              entier
              unite="mois"
              aide={`Soit ${formaterNombre(f.duree_mois / 12)} ans.`}
              onChange={(v) => {
                majFinancement({ duree_mois: v ?? 0 })
              }}
            />
            <ChampNombre
              libelle="Différé pendant la construction"
              valeur={f.differe_mois}
              min={0}
              entier
              optionnel
              unite="mois"
              aide="VEFA : intérêts intercalaires seuls pendant le différé."
              onChange={(differe_mois) => {
                majFinancement({ differe_mois })
              }}
            />
            <ChampTaux
              libelle="Assurance emprunteur"
              valeur={f.taux_assurance_annuel}
              aide="Taux annuel sur le capital initial."
              onChange={(v) => {
                majFinancement({ taux_assurance_annuel: v ?? 0 })
              }}
            />
            <ChampMontant libelle="Frais de dossier" valeur={f.frais_dossier} onChange={(v) => { majFinancement({ frais_dossier: v ?? 0 }) }} />
            <ChampMontant libelle="Frais de garantie" valeur={f.frais_garantie} onChange={(v) => { majFinancement({ frais_garantie: v ?? 0 }) }} />
          </Groupe>

          <Groupe titre="Exploitation" aide="Vacance, entretien et revalorisations : écran Hypothèses.">
            <ChampTaux
              libelle="Frais de gestion"
              valeur={ex.frais_gestion_part_loyers}
              aide="Part des loyers encaissés ; 0 en gestion directe."
              onChange={(v) => {
                majExploitation((x) => ({ ...x, frais_gestion_part_loyers: v ?? 0 }))
              }}
            />
            <ChampTaux
              libelle="Assurance loyers impayés"
              valeur={ex.assurance_loyers_impayes_part_loyers}
              onChange={(v) => {
                majExploitation((x) => ({ ...x, assurance_loyers_impayes_part_loyers: v ?? 0 }))
              }}
            />
            <ChampMontant
              libelle="Assurance propriétaire non occupant"
              valeur={ex.assurance_pno_annuelle}
              unite="€/an"
              onChange={(v) => {
                majExploitation((x) => ({ ...x, assurance_pno_annuelle: v ?? 0 }))
              }}
            />
            <ChampMontant
              libelle="LMNP : mobilier"
              valeur={ex.lmnp.mobilier}
              onChange={(v) => {
                majExploitation((x) => ({ ...x, lmnp: { ...x.lmnp, mobilier: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="LMNP : comptable"
              valeur={ex.lmnp.comptable_annuel}
              unite="€/an"
              onChange={(v) => {
                majExploitation((x) => ({ ...x, lmnp: { ...x.lmnp, comptable_annuel: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="LMNP : CFE"
              valeur={ex.lmnp.cfe_annuelle}
              unite="€/an"
              onChange={(v) => {
                majExploitation((x) => ({ ...x, lmnp: { ...x.lmnp, cfe_annuelle: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="SCI : constitution"
              valeur={ex.sci.constitution}
              onChange={(v) => {
                majExploitation((x) => ({ ...x, sci: { ...x.sci, constitution: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="SCI : comptabilité"
              valeur={ex.sci.comptabilite_annuelle}
              unite="€/an"
              onChange={(v) => {
                majExploitation((x) => ({ ...x, sci: { ...x.sci, comptabilite_annuelle: v ?? 0 } }))
              }}
            />
            <ChampMontant
              libelle="SCI : frais bancaires"
              valeur={ex.sci.frais_bancaires_annuels}
              unite="€/an"
              onChange={(v) => {
                majExploitation((x) => ({ ...x, sci: { ...x.sci, frais_bancaires_annuels: v ?? 0 } }))
              }}
            />
          </Groupe>
        </div>
        <ApercuBien />
      </div>
    </Ecran>
  )
}
