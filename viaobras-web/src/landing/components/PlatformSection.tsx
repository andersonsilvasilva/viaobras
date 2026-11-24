import { PLATFORM, SECTION_IDS, SHOTS } from '../content'
import { Icon } from './Icon'
import { ProductShot } from './ProductShot'
import { Eyebrow, Lead, Reveal, Section, SectionTitle } from './primitives'

/** Visão geral: título e texto centralizados, screenshot do dashboard em largura ampla e os indicadores que ela mostra. */
export function PlatformSection() {
  return (
    <Section id={SECTION_IDS.platform} tone="paper" labelledBy="plataforma-title">
      <Reveal className="mx-auto max-w-3xl text-center">
        <Eyebrow>{PLATFORM.eyebrow}</Eyebrow>
        <SectionTitle id="plataforma-title" className="mt-3">
          {PLATFORM.title}
        </SectionTitle>
        <Lead className="mt-5">{PLATFORM.text}</Lead>
      </Reveal>

      <Reveal className="mx-auto mt-12 max-w-6xl" index={1}>
        <ProductShot shot={SHOTS.dashboard} sizes="(min-width: 1280px) 72rem, 100vw" />
      </Reveal>

      <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PLATFORM.highlights.map((item, index) => {
          return (
            <Reveal
              as="li"
              key={item.label}
              index={index}
              className="flex items-center gap-3 rounded-lg border border-line bg-white px-3.5 py-3 shadow-lp-sm"
            >
              <Icon name={item.icon} className="size-4 shrink-0 text-brand" strokeWidth={1.75} />
              <span className="text-sm font-medium text-brand-deep">{item.label}</span>
            </Reveal>
          )
        })}
      </ul>
    </Section>
  )
}
