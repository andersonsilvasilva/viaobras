import { BENEFITS, SECTION_IDS } from '../content'
import { Icon } from './Icon'
import { Container, Reveal } from './primitives'

/** Faixa de três pilares logo abaixo do Hero. */
export function BenefitsBar() {
  return (
    <section id={SECTION_IDS.benefits} aria-label="Benefícios" className="border-y border-line bg-white py-10 sm:py-12">
      <Container>
        <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
          {BENEFITS.map((benefit, index) => {
            return (
              <Reveal as="li" key={benefit.title} index={index} className="flex items-start gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand" aria-hidden="true">
                  <Icon name={benefit.icon} className="size-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-base font-semibold text-brand-deep">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-ink">{benefit.text}</p>
                </div>
              </Reveal>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
