import { useId, useRef, useState } from 'react'
import { fichierDossier, lireFichierDossier } from '../engine/dossier-json'
import { nomDeFichier } from '../export/exports-scenario'
import { useApplication } from './etat/application'
import { dateDuJour, formaterDate } from './format'
import { lireFichierTexte, telecharger, TYPE_JSON } from './telechargement'

/** Gestion des dossiers : choix, création, copie, renommage, suppression, export et import JSON, impression. */
export function BarreDossiers({ onImprimer }: { readonly onImprimer: () => void }) {
  const { etat, enregistre, complet, actions } = useApplication()
  const idListe = useId()
  const idNom = useId()
  const fichier = useRef<HTMLInputElement>(null)
  const [nom, setNom] = useState<string | null>(null)

  const exporter = (): void => {
    const contenu = fichierDossier(enregistre.nom, enregistre.dossier, new Date().toISOString(), enregistre.simulation_vendeur, enregistre.parametres_modifies)
    telecharger(`${nomDeFichier(enregistre.nom) || 'dossier'}.dossier.json`, `${JSON.stringify(contenu, null, 2)}\n`, TYPE_JSON)
  }

  const importer = async (choisi: File): Promise<void> => {
    let contenu: unknown
    try {
      contenu = JSON.parse(await lireFichierTexte(choisi)) as unknown
    } catch {
      actions.signaler(`Import de « ${choisi.name} » impossible : le fichier n’est pas du JSON`)
      return
    }
    const lu = lireFichierDossier(contenu)
    if (!lu.ok) {
      actions.signaler(`Import de « ${choisi.name} » refusé : ${lu.erreurs.slice(0, 5).join(' ; ')}`)
      return
    }
    actions.importerDossier(lu.nom, lu.dossier, lu.simulation_vendeur, lu.parametres_modifies)
    const modifies = Object.keys(lu.parametres_modifies ?? {}).length
    const importe = `Dossier « ${lu.nom} » importé${modifies === 0 ? '' : `, avec ${String(modifies)} paramètre(s) modifié(s)`}`
    actions.signaler(lu.anomalies.length === 0 ? importe : `${importe}, à corriger : ${lu.anomalies.join(' ; ')}`)
  }

  return (
    <div className="barre-dossiers">
      <label htmlFor={idListe}>Dossier</label>
      <select
        id={idListe}
        value={etat.courant}
        onChange={(e) => {
          actions.selectionnerDossier(e.target.value)
        }}
      >
        {etat.dossiers.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nom}
          </option>
        ))}
      </select>
      <span className="attenue">modifié le {formaterDate(dateDuJour(new Date(enregistre.modifie_le)))}</span>
      {nom === null ? (
        <>
          <button type="button" onClick={actions.nouveauDossier}>
            Nouveau
          </button>
          <button type="button" onClick={actions.dupliquerDossier}>
            Dupliquer
          </button>
          <button
            type="button"
            onClick={() => {
              setNom(enregistre.nom)
            }}
          >
            Renommer
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Supprimer le dossier « ${enregistre.nom} » de ce navigateur ? Exportez-le avant pour le conserver.`)) actions.supprimerDossier()
            }}
          >
            Supprimer
          </button>
          <button type="button" onClick={exporter}>
            Exporter (JSON)
          </button>
          <button
            type="button"
            onClick={() => {
              fichier.current?.click()
            }}
          >
            Importer (JSON)
          </button>
          <input
            ref={fichier}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Fichier de dossier à importer"
            onChange={(e) => {
              const choisi = e.target.files?.[0]
              e.target.value = ''
              if (choisi !== undefined) void importer(choisi)
            }}
          />
          <button type="button" disabled={!complet} title={complet ? undefined : 'Dossier à compléter'} onClick={onImprimer}>
            Imprimer la synthèse
          </button>
        </>
      ) : (
        <form
          className="actions-en-ligne"
          onSubmit={(e) => {
            e.preventDefault()
            actions.renommerDossier(nom)
            setNom(null)
          }}
        >
          <label htmlFor={idNom} className="visuellement-masque">
            Nouveau nom
          </label>
          <input
            id={idNom}
            type="text"
            value={nom}
            // L'utilisateur vient de demander le renommage : le champ prend le focus.
            autoFocus
            onChange={(e) => {
              setNom(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNom(null)
            }}
          />
          <button type="submit">Valider</button>
          <button
            type="button"
            className="bouton-discret"
            onClick={() => {
              setNom(null)
            }}
          >
            Annuler
          </button>
        </form>
      )}
    </div>
  )
}
