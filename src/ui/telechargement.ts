/**
 * Enregistrement d'un fichier produit dans le navigateur (export CSV, XLSX,
 * JSON) : aucun envoi réseau, le fichier est créé localement.
 */
export const TYPE_CSV = 'text/csv;charset=utf-8'
export const TYPE_JSON = 'application/json;charset=utf-8'

export function telecharger(nom: string, contenu: string | Uint8Array<ArrayBuffer>, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.append(lien)
  lien.click()
  lien.remove()
  // Le navigateur a lu l'adresse au clic : elle peut être libérée au tour suivant.
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  })
}

/** Lit un fichier choisi par l'utilisateur. */
export function lireFichierTexte(fichier: File): Promise<string> {
  return fichier.text()
}
