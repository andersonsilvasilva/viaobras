import { CircleCheck } from 'lucide-react'
import { CROPS, INDICATORS, SECTION_IDS, SHOTS } from '../content'
import { ProductShot } from './ProductShot'
import { Eyebrow, Lead, Reveal, Section, SectionTitle } from './primitives'

/**
 * Recorte da Visão geral focado na área de indicadores e gráficos. É a MESMA captura real do dashboard,
 * apenas enquadrada (`CROPS.indicators` em content.ts); nada é redesenhado nem inventado.
 */
const SHOT = { ...SHOTS.dashboard, alt: 'Recorte da Visão geral da ViaObras com os indicadores financeiros e gráficos' }

export function FinancialSection() {
  return (
    <Section id={SECTION_IDS.indicators} tone="white" labelledBy="indicadores-title">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <Reveal>
            <Eyebrow>{INDICATORS.eyebrow}</Eyebrow>
            <SectionTitle id="indicadores-title" className="mt-3">
              {INDICATORS.title}
            </SectionTitle>
            <div className="mt-5 space-y-4">
              {INDICATORS.text.map((paragraph) => (
                <Lead key={paragraph}>{paragraph}</Lead>
              ))}
            </div>
          </Reveal>

          <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {INDICATORS.highlights.map((item, index) => (
              <Reveal as="li" key={item} index={index} className="flex items-center gap-2.5">
                <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-sm font-medium text-brand-deep">{item}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal className="lg:col-span-7" index={1}>
          <ProductShot shot={SHOT} crop={CROPS.indicators} />
        </Reveal>
      </div>
    </Section>
  )
}
