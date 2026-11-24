import { ArrowRight } from 'lucide-react'
import { APP_URL, FINAL_CTA, SECTION_IDS } from '../content'
import { ButtonLink, Lead, Reveal, Section } from './primitives'

/** CTA final em azul-safira, com anéis gráficos discretos ao fundo. */
export function FinalCTA() {
  return (
    <Section tone="brand" labelledBy="cta-title" className="relative">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 -top-8 size-48 rounded-full border border-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full border border-white/10" aria-hidden="true" />

      <Reveal className="relative mx-auto max-w-3xl text-center">
        <h2 id="cta-title" className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
          {FINAL_CTA.title}
        </h2>
        <Lead className="mt-5 !text-on-brand">{FINAL_CTA.text}</Lead>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={APP_URL} variant="light">
            {FINAL_CTA.primary}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href={`#${SECTION_IDS.top}`} variant="ghostLight">
            {FINAL_CTA.secondary}
          </ButtonLink>
        </div>
      </Reveal>
    </Section>
  )
}
