import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { parametresFiscaux2026 } from './params'
import { App } from './ui/App'
import { FournisseurApplication } from './ui/etat/FournisseurApplication'
import { etatInitial } from './ui/etat/initialisation'
import { stockageNavigateur } from './ui/etat/stockage'
import './ui/styles.css'

const racine = document.getElementById('racine')
if (!racine) {
  throw new Error('Élément #racine introuvable dans index.html')
}

// L'état est lu dans le navigateur avant le premier rendu : les composants restent purs.
const stockage = stockageNavigateur()

createRoot(racine).render(
  <StrictMode>
    <FournisseurApplication etatInitial={etatInitial(stockage, new Date())} stockage={stockage} parametresDeBase={parametresFiscaux2026}>
      <App />
    </FournisseurApplication>
  </StrictMode>,
)
