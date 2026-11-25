import { BenefitsBar } from './components/BenefitsBar'
import { BudgetSection } from './components/BudgetSection'
import { DemoSection } from './components/DemoSection'
import { FinalCTA } from './components/FinalCTA'
import { FinancialSection } from './components/FinancialSection'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { IntegratedPlatformSection } from './components/IntegratedPlatformSection'
import { Navbar } from './components/Navbar'
import { PlatformSection } from './components/PlatformSection'
import { ProjectsSection } from './components/ProjectsSection'
import { SuppliesSection } from './components/SuppliesSection'
import { SECTION_IDS } from './content'
import { useReveal } from './hooks/useReveal'

/** Landing institucional (viaobras.com.br). Página única com âncoras; sem rotas e sem sessão. */
export function LandingPage() {
  useReveal()

  return (
    <div id={SECTION_IDS.top}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-lp-md"
      >
        Ir para o conteúdo
      </a>
      <Navbar />
      <main id="conteudo">
        <Hero />
        <BenefitsBar />
        <DemoSection />
        <PlatformSection />
        <div id={SECTION_IDS.features}>
          <ProjectsSection />
          <BudgetSection />
          <SuppliesSection />
        </div>
        <FinancialSection />
        <IntegratedPlatformSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
