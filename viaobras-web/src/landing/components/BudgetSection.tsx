import { BUDGET, CROPS, SECTION_IDS, SHOTS } from '../content'
import { ProductShot } from './ProductShot'
import { Eyebrow, FeatureCard, Lead, Reveal, Section, SectionTitle } from './primitives'

/**
 * Orçamentos: seção de maior peso visual depois do Hero. A screenshot ocupa a largura total do contêiner
 * e é recortada só para começar nos indicadores de custo, preservando a legibilidade da planilha.
 */
export function BudgetSection() {
  return (
    <Section id={SECTION_IDS.budget} tone="paper" labelledBy="orcamentos-title">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-14">
        <Reveal className="lg:col-span-7">
          <Eyebrow>{BUDGET.eyebrow}</Eyebrow>
          <SectionTitle id="orcamentos-title" className="mt-3">
            {BUDGET.title}
          </SectionTitle>
        </Reveal>
        <Reveal className="lg:col-span-5" index={1}>
          <Lead>{BUDGET.text}</Lead>
        </Reveal>
      </div>

      <Reveal className="mt-12" index={1}>
        <ProductShot shot={SHOTS.budget} crop={CROPS.budget} sizes="(min-width: 1280px) 80rem, 100vw" />
      </Reveal>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {BUDGET.cards.map((card, index) => (
          <FeatureCard key={card.title} icon={card.icon} title={card.title} text={card.text} index={index} />
        ))}
      </ul>

      <Reveal className="mt-10">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-ink">O que você estrutura no orçamento</h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {BUDGET.resources.map((resource) => (
            <li
              key={resource}
              className="rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1.5 text-sm font-medium text-brand-deep"
            >
              {resource}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
