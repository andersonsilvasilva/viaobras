import { Navbar } from '../landing/components/Navbar'
import { useReveal } from '../landing/hooks/useReveal'
import { BenefitsSection } from './components/BenefitsSection'
import { DeploymentSection } from './components/DeploymentSection'
import { FAQSection } from './components/FAQSection'
import { PlansSection } from './components/PlansSection'
import { PricingComparison } from './components/PricingComparison'
import { PricingFinalCTA } from './components/PricingFinalCTA'
import { PricingFooter } from './components/PricingFooter'
import { PricingHero } from './components/PricingHero'
import { IDS, NAV, SITE_URL } from './content'

/** Página de planos (viaobras.com.br/planos.html). Reaproveita a identidade e os componentes da landing. */
export function PricingPage() {
  useReveal()

  return (
    <div id={IDS.top}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-lp-md"
      >
        Ir para o conteúdo
      </a>
      <Navbar links={NAV} homeHref={SITE_URL} homeLabel="ViaObras — ir para o site" />
      <main id="conteudo">
        <PricingHero />
        <PlansSection />
        <DeploymentSection />
        <PricingComparison />
        <BenefitsSection />
        <FAQSection />
        <PricingFinalCTA />
      </main>
      <PricingFooter />
    </div>
  )
}
