import type { Indicateurs } from '../../engine/indicateurs'
import { useApplication } from '../etat/application'
import { eurosParMois, formaterDate, formaterEuros, formaterNombre, formaterPoints, formaterTaux, formaterTauxCalcule } from '../format'
import { Jauge, Tuile } from './Tuiles'

/** Échelle des jauges : la valeur la plus haute, ou une fois et demie le seuil. */
const MARGE_JAUGE = 1.5

const signe = (x: number): string => (x > 0 ? '+' : '')

/** Six indicateurs clés d'un scénario, avec leur état face à la capacité d'épargne, au placement et à la limite d'endettement. */
export function IndicateursCles({ i, capacite }: { readonly i: Indicateurs; readonly capacite: number }) {
  const { p } = useApplication()
  const seuilEndettement = p.financement.taux_endettement_max.valeur
  const endettementConnu = Number.isFinite(i.taux_endettement_apres)
  const statutEffort = i.effort_mensuel_moyen > capacite ? 'critique' : i.effort_mensuel_pire > capacite ? 'attention' : 'bon'
  return (
    <div className="tuiles">
      <Tuile
        libelle="Effort d’épargne mensuel moyen"
        valeur={eurosParMois(i.effort_mensuel_moyen)}
        statut={statutEffort}
        libelleStatut={
          statutEffort === 'bon'
            ? 'Dans la capacité d’épargne'
            : statutEffort === 'attention'
              ? 'Pire année au-delà de la capacité'
              : 'Au-delà de la capacité d’épargne'
        }
        jauge={
          <Jauge
            libelle="Effort de la pire année face à la capacité d’épargne"
            valeur={Math.max(i.effort_mensuel_pire, 0)}
            seuil={capacite}
            maximum={Math.max(capacite * MARGE_JAUGE, i.effort_mensuel_pire)}
            texte={`${eurosParMois(i.effort_mensuel_pire)} pour une capacité de ${eurosParMois(capacite)}`}
          />
        }
        detail={`Pire année (${String(i.pire_annee)}) : ${eurosParMois(i.effort_mensuel_pire)} · capacité : ${eurosParMois(capacite)}`}
      />
      <Tuile
        libelle="Capital net à la sortie"
        valeur={formaterEuros(i.capital_net_sortie)}
        statut={i.ecart_capital_placement >= 0 ? 'bon' : 'attention'}
        libelleStatut={`${signe(i.ecart_capital_placement)}${formaterEuros(i.ecart_capital_placement)} face au placement`}
        detail={`Placement équivalent : ${formaterEuros(i.capital_net_placement)}`}
      />
      <Tuile
        libelle="Rendement (TRI après impôt)"
        valeur={formaterTauxCalcule(i.tri)}
        statut={i.ecart_tri_placement === null ? undefined : i.ecart_tri_placement >= 0 ? 'bon' : 'attention'}
        libelleStatut={i.ecart_tri_placement === null ? undefined : `${signe(i.ecart_tri_placement)}${formaterPoints(i.ecart_tri_placement)} face au placement`}
        detail={`Placement de référence : ${formaterTauxCalcule(i.tri_placement)}`}
      />
      <Tuile
        libelle="Économie d’impôt nette"
        valeur={formaterEuros(i.economie_impot_nette)}
        detail={`Économie sur la détention : ${formaterEuros(i.economie_impot_cumulee)} · reprise à la revente : ${formaterEuros(i.reprise_a_la_revente)}`}
      />
      <Tuile
        libelle="Taux d’endettement après l’opération"
        valeur={endettementConnu ? formaterTaux(i.taux_endettement_apres) : 'non calculable'}
        statut={endettementConnu ? (i.taux_endettement_apres <= seuilEndettement ? 'bon' : 'critique') : undefined}
        libelleStatut={
          endettementConnu
            ? `${i.taux_endettement_apres <= seuilEndettement ? 'Sous' : 'Au-delà de'} la limite de ${formaterTaux(seuilEndettement)}`
            : undefined
        }
        jauge={
          endettementConnu ? (
            <Jauge
              libelle="Taux d’endettement face à la limite"
              valeur={i.taux_endettement_apres}
              seuil={seuilEndettement}
              maximum={Math.max(seuilEndettement * MARGE_JAUGE, i.taux_endettement_apres)}
              texte={`${formaterTaux(i.taux_endettement_apres)} pour une limite de ${formaterTaux(seuilEndettement)}`}
            />
          ) : undefined
        }
      />
      <Tuile
        libelle="Durée de blocage"
        valeur={i.duree_blocage_ans > 0 ? `${formaterNombre(i.duree_blocage_ans)} ans` : 'aucune'}
        detail={
          i.date_sortie_sans_penalite === null
            ? 'Revente possible à tout moment, sans reprise d’avantage fiscal'
            : `Revente sans pénalité à partir du ${formaterDate(i.date_sortie_sans_penalite)}`
        }
      />
    </div>
  )
}
