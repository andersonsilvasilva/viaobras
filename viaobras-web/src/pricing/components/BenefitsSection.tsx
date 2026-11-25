import { Icon } from '../../landing/components/Icon'
import { Lead, Reveal, Section, SectionTitle } from '../../landing/components/primitives'
import { IDS, WHY } from '../content'

export function BenefitsSection() {
  return (
    <Section id={IDS.why} labelledBy="why-title">
      <Reveal className="mx-auto max-w-3xl text-center">
        <SectionTitle id="why-title">{WHY.title}</SectionTitle>
        <Lead className="mt-5">{WHY.subtitle}</Lead>
      </Reveal>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.cards.map((card, index) => (
          <Reveal
            key={card.title}
            as="li"
            index={index}
            className="rounded-xl border border-line bg-white p-5 shadow-lp-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lp-md"
          >
            <span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand" aria-hidden="true">
              <Icon name={card.icon} className="size-5" strokeWidth={1.75} />
            </span>
            <h3 className="text-base font-semibold text-brand-deep">{card.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-ink">{card.text}</p>
            {'note' in card && <p className="mt-2 text-xs font-medium text-muted-ink">{card.note}</p>}
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
