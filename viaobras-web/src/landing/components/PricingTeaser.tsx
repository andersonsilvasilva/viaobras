import { ArrowRight } from 'lucide-react'
import { PLANS, priceLabel } from '../../pricing/content'
import { PRICING_SECTION, SECTION_IDS } from '../content'
import { ButtonLink, Eyebrow, Lead, Reveal, Section } from './primitives'

/** Chamada para a página de planos. O "a partir de" vem da mesma configuração de preços da página. */
export function PricingTeaser() {
  const starting = priceLabel(PLANS[0], 'monthly')

  return (
    <Section id={SECTION_IDS.pricing} tone="soft" labelledBy="pricing-teaser-title">
      <Reveal className="mx-auto max-w-3xl text-center">
        <Eyebrow>{PRICING_SECTION.eyebrow}</Eyebrow>
        <h2 id="pricing-teaser-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-brand-deep sm:text-4xl">
          {PRICING_SECTION.title}
        </h2>
        <Lead className="mt-5">{PRICING_SECTION.text}</Lead>
        <p className="mt-6 text-brand-deep">
          <span className="text-sm text-muted-ink">A partir de </span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{starting.value}</span>
          <span className="text-sm text-muted-ink">{starting.period}</span>
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href={PRICING_SECTION.href}>
            {PRICING_SECTION.cta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Reveal>
    </Section>
  )
}
