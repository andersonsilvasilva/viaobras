import type { Billing } from '../content'

const OPTIONS: { value: Billing; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
]

/** Seletor Mensal/Anual com rádios nativos: funciona com Tab e setas do teclado. */
export function BillingToggle({ value, onChange }: { value: Billing; onChange: (value: Billing) => void }) {
  return (
    <fieldset className="inline-flex rounded-xl border border-line bg-white p-1 shadow-lp-sm">
      <legend className="sr-only">Forma de cobrança</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input type="radio" name="billing" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="peer sr-only" />
          <span className="flex min-h-11 min-w-28 items-center justify-center rounded-lg px-5 text-sm font-semibold text-ink transition-colors peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
