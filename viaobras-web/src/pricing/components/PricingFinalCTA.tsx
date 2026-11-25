import { ArrowRight } from 'lucide-react'
import { ButtonLink, Lead, Reveal, Section } from '../../landing/components/primitives'
import { FINAL, IDS } from '../content'
import { SalesButton } from './SalesButton'

/** CTA final em azul profundo. */
export function PricingFinalCTA() {
  return (
    <Section tone="deep" labelledBy="final-title" className="relative">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full border border-white/10" aria-hidden="true" />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <h2 id="final-title" className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
          {FINAL.title}
        </h2>
        <Lead onDark className="mt-5">{FINAL.text}</Lead>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={`#${IDS.plans}`} variant="light">
            {FINAL.primary}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <SalesButton label={FINAL.secondary} message="Olá! Quero falar com um consultor sobre a ViaObras." variant="ghostLight" />
        </div>
      </Reveal>
    </Section>
  )
}
