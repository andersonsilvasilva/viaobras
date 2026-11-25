import { ArrowRight, CircleCheck } from 'lucide-react'
import { ButtonLink, Container, Lead, Reveal } from '../../landing/components/primitives'
import { HERO, IDS, SITE_URL } from '../content'

export function PricingHero() {
  return (
    <section aria-labelledby="pricing-title" className="relative overflow-hidden bg-white pb-12 pt-12 sm:pt-16 lg:pb-16 lg:pt-20">
      <div className="pricing-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 -top-24 hidden size-80 rounded-full border border-brand/10 md:block" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 bottom-0 hidden size-64 rounded-full border border-brand/10 md:block" aria-hidden="true" />

      <Container className="relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h1 id="pricing-title" className="text-balance text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-brand-deep sm:text-5xl">
            {HERO.title}
          </h1>
          <Lead className="mx-auto mt-5 max-w-2xl">{HERO.subtitle}</Lead>

          <ul className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
            {HERO.points.map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm font-medium text-ink">
                <CircleCheck className="size-4 text-success" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={`#${IDS.plans}`}>
              {HERO.primaryCta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={SITE_URL} variant="secondary">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
