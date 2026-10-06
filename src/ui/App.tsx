import { listerParametres, parametresFiscaux2026, STATUTS_PARAMETRE, type StatutParametre } from '../params'

/** Écrans du §11, livrés à l'étape 6. */
const ECRANS = [
  'Mon foyer',
  'Le bien et le financement',
  'Hypothèses',
  'Comparaison',
  'Recommandation',
  'Détail d’un scénario',
  'Contre-expertise du vendeur',
  'Paramètres fiscaux',
  'Questions à poser',
] as const

const LIBELLES_STATUT: Record<StatutParametre, string> = {
  verifie: 'vérifiés sur une source officielle',
  texte_non_consulte: 'dont le texte n’a pas pu être consulté',
  a_confirmer: 'à confirmer par un professionnel',
}

function compterParStatut(): Record<StatutParametre, number> {
  const comptes: Record<StatutParametre, number> = { verifie: 0, texte_non_consulte: 0, a_confirmer: 0 }
  for (const { parametre } of listerParametres(parametresFiscaux2026)) {
    comptes[parametre.statut] += 1
  }
  return comptes
}

function formaterDate(dateIso: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${dateIso}T00:00:00`))
}

export function App() {
  const comptes = compterParStatut()

  return (
    <div className="page">
      <header className="entete">
        <h1>Investissement locatif — aide à la décision</h1>
      </header>
      <div className="corps">
        <nav className="navigation" aria-label="Écrans">
          <ol>
            {ECRANS.map((ecran) => (
              <li key={ecran}>
                <button type="button" disabled>
                  {ecran}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <main className="contenu">
          <h2>Squelette du projet</h2>
          <p>Les écrans seront disponibles une fois le moteur de calcul livré.</p>
          <p>Paramètres fiscaux arrêtés au {formaterDate(parametresFiscaux2026.meta.date_arret)} :</p>
          <ul>
            {STATUTS_PARAMETRE.map((statut) => (
              <li key={statut}>
                {comptes[statut]} {LIBELLES_STATUT[statut]}
              </li>
            ))}
          </ul>
        </main>
      </div>
      <footer className="pied">
        Outil d’aide à la décision personnelle : il ne remplace ni un notaire ni un expert-comptable.
      </footer>
    </div>
  )
}
