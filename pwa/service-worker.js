/*
 * Service worker : une fois l'application ouverte, elle s'ouvre aussi sans connexion.
 * Modèle complété à la construction par pwa/plugin-service-worker.ts, qui remplace VERSION et FICHIERS.
 * - La page est demandée au réseau d'abord : en ligne, la dernière version mise en ligne s'affiche.
 *   Sans réponse sous quelques secondes (réseau faible), la page de la version en cache est servie.
 * - Les autres fichiers sont servis depuis le cache de la version, préchargé à l'installation : une
 *   version en cache est toujours complète, y compris les écrans chargés à la demande.
 * Aucune donnée de dossier ne passe par ici : les dossiers restent dans le localStorage du navigateur.
 */
const VERSION = 'developpement'
const FICHIERS = []

const PREFIXE = 'investissement-locatif-'
const CACHE = `${PREFIXE}${VERSION}`
const PAGE = './'
const ATTENTE_RESEAU_MS = 3000

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([PAGE, ...FICHIERS])))
})

// La nouvelle version prend la main quand plus aucun onglet n'utilise l'ancienne : les caches des
// versions précédentes sont alors supprimés.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle.startsWith(PREFIXE) && cle !== CACHE).map((cle) => caches.delete(cle)))),
  )
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return
  evenement.respondWith(requete.mode === 'navigate' ? reseauDAbord(requete) : cacheDAbord(requete))
})

async function reseauDAbord(requete) {
  const cache = await caches.open(CACHE)
  const enCache = await cache.match(PAGE)
  const reseau = fetch(requete)
  if (enCache === undefined) return reseau
  const secours = new Promise((resoudre) => {
    setTimeout(() => {
      resoudre(enCache)
    }, ATTENTE_RESEAU_MS)
  })
  return Promise.race([reseau.catch(() => enCache), secours])
}

async function cacheDAbord(requete) {
  const cache = await caches.open(CACHE)
  const enCache = await cache.match(requete)
  if (enCache !== undefined) return enCache
  const reponse = await fetch(requete)
  if (reponse.ok) await cache.put(requete, reponse.clone())
  return reponse
}
