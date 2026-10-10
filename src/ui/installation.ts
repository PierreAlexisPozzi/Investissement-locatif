/*
 * Application installable sur l'écran d'accueil d'un téléphone ou d'un ordinateur : service worker pour
 * l'ouverture sans connexion, stockage persistant pour que le navigateur n'efface pas les dossiers.
 */

/** Ce que l'application utilise du navigateur ; absent hors HTTPS (adresse IP du réseau local, par exemple). */
export interface ServiceWorkers {
  register(url: string, options: { readonly scope: string }): Promise<unknown>
}

export interface StockageNavigateur {
  persisted(): Promise<boolean>
  persist(): Promise<boolean>
}

/** Enregistre le service worker publié à la racine du site ; sans service worker, l'application reste utilisable en ligne. */
export async function enregistrerServiceWorker(serviceWorker: ServiceWorkers | undefined, base: string): Promise<boolean> {
  if (serviceWorker === undefined) return false
  await serviceWorker.register(`${base}sw.js`, { scope: base })
  return true
}

/**
 * Demande au navigateur de ne pas effacer les données du site quand l'espace manque, une fois l'application
 * installée : c'est là que les navigateurs l'accordent. Hors installation, la demande afficherait une
 * autorisation dans certains navigateurs (Firefox) pour un bénéfice incertain.
 */
export async function demanderStockagePersistant(stockage: StockageNavigateur | undefined, installee: boolean): Promise<boolean> {
  if (stockage === undefined || !installee) return false
  return (await stockage.persisted()) || stockage.persist()
}
