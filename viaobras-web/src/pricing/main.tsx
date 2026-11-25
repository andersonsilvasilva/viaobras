import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PricingPage } from './PricingPage'
import './pricing.css'

// Habilita o estado inicial de "revelação" (sem JS, o conteúdo permanece visível).
document.documentElement.classList.add('js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PricingPage />
  </StrictMode>,
)
