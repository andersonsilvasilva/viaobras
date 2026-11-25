import { Check } from 'lucide-react'
import { Lead, Reveal, Section, SectionTitle } from '../../landing/components/primitives'
import { DEPLOYMENT, IDS } from '../content'
import { SalesButton } from './SalesButton'

export function DeploymentSection() {
  return (
    <Section id={IDS.deployment} labelledBy="deployment-title">
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <Reveal>
          <SectionTitle id="deployment-title">{DEPLOYMENT.title}</SectionTitle>
          <Lead className="mt-5">{DEPLOYMENT.text}</Lead>
          <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-brand-deep">{DEPLOYMENT.note}</p>
        </Reveal>

        <Reveal index={1} className="rounded-2xl border border-line bg-white p-6 shadow-lp-md sm:p-8">
          <p className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{DEPLOYMENT.badge}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand">{DEPLOYMENT.priceLabel}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-brand-deep tabular-nums">{DEPLOYMENT.price}</p>
          <p className="mt-2 text-sm font-medium text-ink">{DEPLOYMENT.priceDetail}</p>
          <ul className="mt-6 space-y-3">
            {DEPLOYMENT.items.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-ink">{DEPLOYMENT.disclaimer}</p>
          <SalesButton label={DEPLOYMENT.cta} message="Olá! Quero saber sobre a implantação da ViaObras." variant="secondary" className="mt-6 w-full" />
        </Reveal>
      </div>
    </Section>
  )
}
