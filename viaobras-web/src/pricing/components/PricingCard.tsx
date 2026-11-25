import { Check, Clock } from 'lucide-react'
import type { CSSProperties } from 'react'
import { FEATURED_BADGE } from '../config'
import { priceLabel, salesMessage, type Billing, type Plan } from '../content'
import { SalesButton } from './SalesButton'
import { SoonBadge } from './SoonBadge'

export function PricingCard({ plan, billing, index }: { plan: Plan; billing: Billing; index: number }) {
  const price = priceLabel(plan, billing)
  const titleId = `plano-${plan.id}`

  return (
    <li
      className={`reveal relative flex flex-col rounded-2xl border p-6 transition duration-200 hover:-translate-y-0.5 ${
        plan.featured ? 'border-2 border-brand bg-brand-soft/60 shadow-lp-md' : 'border-line bg-white shadow-lp-sm hover:shadow-lp-md'
      }`}
      style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}
      aria-labelledby={titleId}
    >
      {plan.featured && FEATURED_BADGE && (
        <p className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wide text-white">
          {FEATURED_BADGE}
        </p>
      )}

      <h3 id={titleId} className="text-lg font-semibold text-brand-deep">{plan.name}</h3>
      <p className="mt-2 min-h-[4.5rem] text-sm leading-relaxed text-muted-ink">{plan.description}</p>

      <div className="mt-4" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className={`font-semibold tracking-tight text-brand-deep tabular-nums ${plan.price ? 'text-4xl' : 'text-3xl'}`}>{price.value}</span>
          {price.period && <span className="text-sm font-medium text-muted-ink">{price.period}</span>}
        </p>
        <p className="mt-1 min-h-10 text-xs text-muted-ink">{price.detail}</p>
      </div>

      <SalesButton label={plan.cta} message={salesMessage(plan, billing)} variant={plan.featured ? 'primary' : 'secondary'} className="mt-4 w-full" />

      <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
        {plan.features.map((feature) => (
          <li key={feature.label} className={`flex gap-2.5 text-sm ${feature.soon ? 'text-muted-ink' : 'text-ink'}`}>
            {feature.soon ? (
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-ink" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
            )}
            <span>
              {feature.label}
              {feature.soon && <SoonBadge />}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}
