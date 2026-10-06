/**
 * Domaines admis comme sources officielles (cahier des charges §3, principe 2).
 * Un sous-domaine est accepté : `bofip.impots.gouv.fr`, `entreprendre.service-public.gouv.fr`.
 */
export const DOMAINES_OFFICIELS = [
  'legifrance.gouv.fr',
  'bofip.impots.gouv.fr',
  'service-public.gouv.fr',
  'impots.gouv.fr',
  'economie.gouv.fr',
  'info.gouv.fr',
  'senat.fr',
  'assemblee-nationale.fr',
] as const

export function estUrlOfficielle(url: string): boolean {
  let hote: string
  try {
    const analyse = new URL(url)
    if (analyse.protocol !== 'https:') return false
    hote = analyse.hostname
  } catch {
    return false
  }
  return DOMAINES_OFFICIELS.some((domaine) => hote === domaine || hote.endsWith(`.${domaine}`))
}
