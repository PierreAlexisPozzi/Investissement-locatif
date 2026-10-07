import { useId, useMemo, useState } from 'react'
import { appliquerSurcharges, listerParametres, STATUTS_PARAMETRE, type EntreeParametre, type StatutParametre, type SurchargeParametre } from '../../params'
import { ChampDate, ChampListe } from '../composants/Champs'
import { Ecran } from '../composants/Ecran'
import { BadgeStatut, Encart, ListeMotifs } from '../composants/Elements'
import { useApplication } from '../etat/application'
import { apercuValeur, lireEdition, texteEdition } from '../edition-parametre'
import { formaterDate } from '../format'
import { LIBELLES_STATUTS } from '../libelles'
import { telecharger, TYPE_JSON } from '../telechargement'

type Filtre = 'tous' | StatutParametre | 'non_verifies' | 'modifies'

const LIBELLES_FILTRES: Readonly<Record<Filtre, string>> = {
  tous: 'Tous les paramètres',
  non_verifies: 'Non vérifiés',
  a_confirmer: 'À confirmer',
  texte_non_consulte: 'Texte non consulté',
  verifie: 'Vérifiés',
  modifies: 'Modifiés localement',
}

function Editeur({ entree, base, onFermer }: { readonly entree: EntreeParametre; readonly base: EntreeParametre; readonly onFermer: () => void }) {
  const { etat, parametresDeBase, actions } = useApplication()
  const id = useId()
  const { chemin, parametre } = entree
  const [texte, setTexte] = useState(texteEdition(parametre.valeur))
  const [statut, setStatut] = useState<StatutParametre>(parametre.statut)
  const [date, setDate] = useState<string>(parametre.date_verification ?? '')
  const [erreurs, setErreurs] = useState<readonly string[]>([])
  const structure = typeof base.parametre.valeur === 'object' && base.parametre.valeur !== null
  const valider = (): void => {
    const lu = lireEdition(texte, base.parametre.valeur)
    if (!lu.ok) {
      setErreurs([lu.erreur])
      return
    }
    const surcharge: SurchargeParametre = { valeur: lu.valeur, statut, date_verification: date === '' ? null : date }
    const essai = appliquerSurcharges(parametresDeBase, { ...etat.surcharges, [chemin]: surcharge })
    if (essai.erreurs.length > 0) {
      setErreurs(essai.erreurs)
      return
    }
    const inchange =
      JSON.stringify(lu.valeur) === JSON.stringify(base.parametre.valeur) &&
      statut === base.parametre.statut &&
      (date === '' ? null : date) === base.parametre.date_verification
    actions.surchargerParametre(chemin, inchange ? null : surcharge)
    onFermer()
  }
  return (
    <div className="editeur-parametre">
      <label htmlFor={id}>Valeur ({parametre.unite})</label>
      {structure ? (
        <textarea
          id={id}
          rows={Math.min(16, texte.split('\n').length + 1)}
          value={texte}
          spellCheck={false}
          onChange={(e) => {
            setTexte(e.target.value)
          }}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value)
          }}
        />
      )}
      <div className="grille-champs">
        <ChampListe<StatutParametre>
          libelle="Statut"
          valeur={statut}
          options={STATUTS_PARAMETRE.map((s) => ({ valeur: s, libelle: LIBELLES_STATUTS[s] }))}
          onChange={setStatut}
        />
        <ChampDate libelle="Date de vérification" valeur={date} onChange={setDate} />
      </div>
      {erreurs.length > 0 ? (
        <Encart genre="erreur">
          <ListeMotifs motifs={erreurs} />
        </Encart>
      ) : null}
      <p className="actions-en-ligne">
        <button type="button" onClick={valider}>
          Valider
        </button>
        <button type="button" className="bouton-discret" onClick={onFermer}>
          Annuler
        </button>
      </p>
    </div>
  )
}

function LigneParametre({ entree, base }: { readonly entree: EntreeParametre; readonly base: EntreeParametre }) {
  const { etat, actions } = useApplication()
  const [edition, setEdition] = useState(false)
  const { chemin, parametre } = entree
  const modifie = Object.hasOwn(etat.surcharges, chemin)
  return (
    <li className={modifie ? 'parametre parametre-modifie' : 'parametre'}>
      <div className="parametre-entete">
        <code>{chemin}</code>
        <BadgeStatut entree={entree} />
        {modifie ? <span className="badge badge-modifie">modifié</span> : null}
      </div>
      <p className="parametre-valeur">
        <strong>{apercuValeur(parametre.valeur)}</strong> <span className="attenue">{parametre.unite}</span>
        {modifie ? <span className="attenue"> (fichier : {apercuValeur(base.parametre.valeur)})</span> : null}
      </p>
      <p className="parametre-source">
        <a href={parametre.url_officielle} target="_blank" rel="noopener noreferrer">
          {parametre.source}
        </a>
        {' — '}
        {parametre.date_verification === null ? 'source jamais lue' : `source lue le ${formaterDate(parametre.date_verification)}`}
      </p>
      {parametre.commentaire === '' ? null : (
        <details>
          <summary>Commentaire</summary>
          <p>{parametre.commentaire}</p>
          {parametre.arbitrage === undefined ? null : (
            <p>
              Arbitrage du {formaterDate(parametre.arbitrage.date)} : {parametre.arbitrage.choix} Option écartée : {parametre.arbitrage.alternative_ecartee}
            </p>
          )}
        </details>
      )}
      {edition ? (
        <Editeur
          entree={entree}
          base={base}
          onFermer={() => {
            setEdition(false)
          }}
        />
      ) : (
        <p className="actions-en-ligne ne-pas-imprimer">
          <button
            type="button"
            onClick={() => {
              setEdition(true)
            }}
          >
            Modifier
          </button>
          {modifie ? (
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                actions.surchargerParametre(chemin, null)
              }}
            >
              Rétablir la valeur du fichier
            </button>
          ) : null}
        </p>
      )}
    </li>
  )
}

export function EcranParametres() {
  const { p, parametres, parametresDeBase, etat, actions } = useApplication()
  const [filtre, setFiltre] = useState<Filtre>('non_verifies')
  const [recherche, setRecherche] = useState('')
  const idRecherche = useId()
  const entrees = useMemo(() => listerParametres(p), [p])
  const bases = useMemo(() => new Map(listerParametres(parametresDeBase).map((e) => [e.chemin, e])), [parametresDeBase])
  const comptes = STATUTS_PARAMETRE.map((s) => [s, entrees.filter((e) => e.parametre.statut === s).length] as const)
  const texte = recherche.trim().toLowerCase()
  const retenues = entrees.filter((e) => {
    const statut = e.parametre.statut
    const garde =
      filtre === 'tous' ||
      (filtre === 'non_verifies' && statut !== 'verifie') ||
      (filtre === 'modifies' && Object.hasOwn(etat.surcharges, e.chemin)) ||
      filtre === statut
    return garde && (texte === '' || `${e.chemin} ${e.parametre.source} ${e.parametre.commentaire}`.toLowerCase().includes(texte))
  })
  const sections = [...new Set(retenues.map((e) => e.chemin.split('.')[0] ?? ''))]
  const nombreModifies = Object.keys(etat.surcharges).length
  return (
    <Ecran
      id="parametres"
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              telecharger('fiscal-2026.json', `${JSON.stringify(p, null, 2)}\n`, TYPE_JSON)
            }}
          >
            Exporter fiscal-2026.json {nombreModifies > 0 ? 'modifié' : ''}
          </button>
          {nombreModifies > 0 ? (
            <button type="button" className="bouton-discret" onClick={actions.reinitialiserParametres}>
              Annuler toutes les modifications
            </button>
          ) : null}
        </>
      }
    >
      <p className="introduction">
        Paramètres arrêtés au {formaterDate(p.meta.date_arret)} : {comptes.map(([s, n]) => `${String(n)} ${LIBELLES_STATUTS[s]}`).join(', ')}.{' '}
        {nombreModifies > 0
          ? `${String(nombreModifies)} paramètre(s) modifié(s) dans ce navigateur, appliqué(s) à tous les dossiers.`
          : 'Les modifications restent dans ce navigateur ; exportez le fichier pour les reporter dans le dépôt.'}
      </p>
      {parametres.erreurs.length > 0 ? (
        <Encart genre="erreur" titre="Modifications ignorées, paramètres du fichier en vigueur :">
          <ListeMotifs motifs={parametres.erreurs} />
        </Encart>
      ) : null}
      <div className="barre-outils ne-pas-imprimer">
        <ChampListe<Filtre>
          libelle="Afficher"
          valeur={filtre}
          options={(Object.keys(LIBELLES_FILTRES) as Filtre[]).map((f) => ({ valeur: f, libelle: LIBELLES_FILTRES[f] }))}
          onChange={setFiltre}
        />
        <div className="champ">
          <label htmlFor={idRecherche}>Rechercher</label>
          <input
            id={idRecherche}
            type="search"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
        </div>
      </div>
      {retenues.length === 0 ? <p>Aucun paramètre ne correspond.</p> : null}
      {sections.map((section) => (
        <section key={section} className="section-parametres" aria-labelledby={`section-${section}`}>
          <h3 id={`section-${section}`}>{section}</h3>
          <ul className="liste-parametres">
            {retenues
              .filter((e) => e.chemin.split('.')[0] === section)
              .map((e) => (
                <LigneParametre key={e.chemin} entree={e} base={bases.get(e.chemin) ?? e} />
              ))}
          </ul>
        </section>
      ))}
    </Ecran>
  )
}
