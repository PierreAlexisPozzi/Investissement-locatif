import { useCallback, useEffect, useRef, type ReactNode } from 'react'

/**
 * Menu déroulant accessible au clavier (élément details) : il se referme après un choix, sur Échap ou sur un
 * clic ailleurs dans la page.
 */
export function Menu({ libelle, children }: { readonly libelle: string; readonly children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const fermer = useCallback(() => {
    if (menu.current !== null) menu.current.open = false
  }, [])
  useEffect(() => {
    const surClic = (e: MouseEvent): void => {
      if (menu.current?.open === true && e.target instanceof Node && !menu.current.contains(e.target)) fermer()
    }
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || menu.current?.open !== true) return
      fermer()
      menu.current.querySelector('summary')?.focus()
    }
    document.addEventListener('click', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('click', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [fermer])
  return (
    <details ref={menu} className="menu">
      <summary>{libelle}</summary>
      {/* Un choix referme le menu, après l'action du bouton (l'événement remonte du bouton au conteneur). */}
      <div
        className="menu-contenu"
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest('button') !== null) fermer()
        }}
      >
        {children}
      </div>
    </details>
  )
}
