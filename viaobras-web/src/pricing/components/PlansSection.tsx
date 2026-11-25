import { useState } from 'react'
import { Section, SectionTitle } from '../../landing/components/primitives'
import { salesLink } from '../config'
import { ANNUAL_NOTE, IDS, PLANS, SOON_NOTE, type Billing } from '../content'
import { BillingToggle } from './BillingToggle'
import { PricingCard } from './PricingCard'
import { SALES_PENDING_ID } from './SalesButton'

export function PlansSection() {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <Section id={IDS.plans} tone="paper" labelledBy="plans-title">
      <div className="flex flex-col items-center text-center">
        <SectionTitle id="plans-title">Escolha o seu plano</SectionTitle>
        <div className="mt-6">
          <BillingToggle value={billing} onChange={setBilling} />
        </div>
        <p className={`mt-3 text-sm font-medium ${billing === 'annual' ? 'text-brand' : 'text-muted-ink'}`}>{ANNUAL_NOTE}</p>
      </div>

      <ul className="mt-12 grid gap-8 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan, index) => (
          <PricingCard key={plan.id} plan={plan} billing={billing} index={index} />
        ))}
      </ul>

      <p className="mt-8 text-center text-xs text-muted-ink">{SOON_NOTE}</p>
      {!salesLink('') && (
        <p id={SALES_PENDING_ID} className="mt-2 text-center text-xs text-muted-ink">
          Os botões de contratação serão ativados quando o canal comercial estiver configurado.
        </p>
      )}
    </Section>
  )
}
