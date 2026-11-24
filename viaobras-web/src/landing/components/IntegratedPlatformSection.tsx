import { INTEGRATED, SECTION_IDS } from '../content'
import { FeatureCard, Lead, Reveal, Section, SectionTitle } from './primitives'

/** Plataforma integrada: fundo azul profundo, quatro módulos em cartões levemente translúcidos. */
export function IntegratedPlatformSection() {
  return (
    <Section id={SECTION_IDS.integrated} tone="deep" labelledBy="integrada-title">
      <Reveal className="mx-auto max-w-3xl text-center">
        <SectionTitle id="integrada-title" onDark>
          {INTEGRATED.title}
        </SectionTitle>
        <Lead onDark className="mt-5">
          {INTEGRATED.text}
        </Lead>
      </Reveal>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INTEGRATED.items.map((item, index) => (
          <FeatureCard key={item.title} icon={item.icon} title={item.title} text={item.text} index={index} onDark />
        ))}
      </ul>
    </Section>
  )
}
