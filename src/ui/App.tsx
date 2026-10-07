import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BarreDossiers } from './BarreDossiers'
import { EcranBien } from './ecrans/EcranBien'
import { EcranFoyer } from './ecrans/EcranFoyer'
import { EcranHypotheses } from './ecrans/EcranHypotheses'
import { Synthese } from './ecrans/Synthese'
import { useApplication } from './etat/application'
import { ECRANS, type IdEcran } from './etat/etat'
import { useEcran } from './etat/navigation'
import { dateDuJour, formaterDate } from './format'

// Écrans de résultats et de paramètres chargés à la demande : la page de saisie s'ouvre plus vite.
const EcranComparaison = lazy(() => import('./ecrans/EcranComparaison').then((m) => ({ default: m.EcranComparaison })))
const EcranRecommandation = lazy(() => import('./ecrans/EcranRecommandation').then((m) => ({ default: m.EcranRecommandation })))
const EcranDetail = lazy(() => import('./ecrans/EcranDetail').then((m) => ({ default: m.EcranDetail })))
const EcranContreExpertise = lazy(() => import('./ecrans/EcranContreExpertise').then((m) => ({ default: m.EcranContreExpertise })))
const EcranParametres = lazy(() => import('./ecrans/EcranParametres').then((m) => ({ default: m.EcranParametres })))
const EcranQuestions = lazy(() => import('./ecrans/EcranQuestions').then((m) => ({ default: m.EcranQuestions })))

/** Écrans de résultats : ils attendent un dossier complet. */
const ECRANS_DE_RESULTATS: readonly IdEcran[] = ['comparaison', 'recommandation', 'detail', 'contre_expertise', 'questions']

function EcranCourant({ ecran }: { readonly ecran: IdEcran }) {
  switch (ecran) {
    case 'foyer':
      return <EcranFoyer />
    case 'bien':
      return <EcranBien />
    case 'hypotheses':
      return <EcranHypotheses />
    case 'comparaison':
      return <EcranComparaison />
    case 'recommandation':
      return <EcranRecommandation />
    case 'detail':
      return <EcranDetail />
    case 'contre_expertise':
      return <EcranContreExpertise />
    case 'parametres':
      return <EcranParametres />
    case 'questions':
      return <EcranQuestions />
  }
}

function Messages() {
  const { etat, actions } = useApplication()
  if (etat.messages.length === 0) return null
  return (
    <div className="messages ne-pas-imprimer" role="status">
      <ul>
        {etat.messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <button type="button" className="bouton-discret" onClick={actions.effacerMessages}>
        Fermer
      </button>
    </div>
  )
}

export function App() {
  const [ecran] = useEcran()
  const { p, complet, parametres } = useApplication()
  // Date d'édition de la synthèse en cours d'impression ; null hors impression.
  const [impression, setImpression] = useState<string | null>(null)
  const contenu = useRef<HTMLElement>(null)
  const ecranPrecedent = useRef(ecran)

  // Au changement d'écran (pas à l'ouverture), le focus passe au contenu : le clavier et les lecteurs d'écran suivent.
  useEffect(() => {
    if (ecranPrecedent.current === ecran) return
    ecranPrecedent.current = ecran
    contenu.current?.focus()
  }, [ecran])

  // La synthèse est rendue avant cet effet (effets des enfants d'abord) : l'impression la contient dès le premier clic.
  useEffect(() => {
    if (impression === null) return
    const terminer = (): void => {
      setImpression(null)
    }
    window.addEventListener('afterprint', terminer)
    window.print()
    return () => {
      window.removeEventListener('afterprint', terminer)
    }
  }, [impression])

  return (
    <div className={impression === null ? 'page' : 'page impression-synthese'}>
      <a
        className="lien-evitement"
        href="#contenu"
        onClick={(e) => {
          // L'ancre de l'adresse désigne l'écran affiché : le lien déplace seulement le focus.
          e.preventDefault()
          contenu.current?.focus()
        }}
      >
        Aller au contenu
      </a>
      <header className="entete ne-pas-imprimer">
        <h1>Investissement locatif — aide à la décision</h1>
        <BarreDossiers
          onImprimer={() => {
            setImpression(dateDuJour(new Date()))
          }}
        />
      </header>
      <Messages />
      <div className="corps">
        <nav className="navigation ne-pas-imprimer" aria-label="Écrans">
          <ol>
            {ECRANS.map((e) => (
              <li key={e.id}>
                <a href={`#/${e.id}`} aria-current={ecran === e.id ? 'page' : undefined}>
                  {e.titre}
                  {!complet && ECRANS_DE_RESULTATS.includes(e.id) ? <span className="attenue"> (dossier à compléter)</span> : null}
                </a>
              </li>
            ))}
          </ol>
          {parametres.modifies.length > 0 ? (
            <p className="badge badge-modifie">{parametres.modifies.length} paramètre(s) modifié(s)</p>
          ) : null}
        </nav>
        <main id="contenu" className="contenu" tabIndex={-1} ref={contenu}>
          <Suspense fallback={<p className="calcul-en-cours">Chargement…</p>}>
            <div className="ecran-imprimable">
              <EcranCourant ecran={ecran} />
            </div>
          </Suspense>
          {impression === null ? null : <Synthese editeeLe={impression} />}
        </main>
      </div>
      <footer className="pied">
        Outil d’aide à la décision personnelle : il ne remplace ni un notaire ni un expert-comptable. Paramètres fiscaux arrêtés au{' '}
        {formaterDate(p.meta.date_arret)}.
      </footer>
    </div>
  )
}
