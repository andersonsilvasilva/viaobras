import { Check, Minus } from 'lucide-react'
import { Reveal, Section, SectionTitle } from '../../landing/components/primitives'
import { COMPARISON, IDS, PLANS, SOON_NOTE, type Cell } from '../content'
import { SoonMark } from './SoonMark'

function CellContent({ cell, rowSoon }: { cell: Cell; rowSoon?: boolean }) {
  if (cell.value === null) {
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-ink/60" aria-hidden="true" />
        <span className="sr-only">Não incluído</span>
      </>
    )
  }
  // linha inteira em implementação já tem o asterisco no nome; célula isolada leva o seu
  return (
    <span className="text-ink">
      {cell.value === true ? (
        <>
          <Check className="mx-auto size-5 text-success" strokeWidth={2.5} aria-hidden="true" />
          <span className="sr-only">{rowSoon ? 'Incluído no plano, em implementação' : 'Incluído'}</span>
        </>
      ) : (
        cell.value
      )}
      {cell.soon && <SoonMark />}
    </span>
  )
}

/** Comparativo. Em telas estreitas a tabela rola na horizontal, com a coluna do recurso fixa. */
export function PricingComparison() {
  const featured = PLANS.findIndex((p) => p.featured)

  return (
    <Section id={IDS.comparison} tone="paper" labelledBy="comparison-title">
      <Reveal className="text-center">
        <SectionTitle id="comparison-title">Compare os planos</SectionTitle>
      </Reveal>

      <p className="mt-4 text-center text-xs text-muted-ink md:hidden">Deslize a tabela para o lado para ver todos os planos.</p>
      <div
        // `relative`: sem ele, os textos para leitor de tela (posição absoluta) escapam da rolagem e alargam a página
        className="relative mt-6 overflow-x-auto rounded-2xl border border-line bg-white shadow-lp-sm md:mt-10"
        role="region"
        aria-labelledby="comparison-title"
        tabIndex={0}
      >
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Recursos incluídos em cada plano</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 w-40 bg-white px-4 py-4 text-left font-semibold text-brand-deep sm:w-56">
                Recurso
              </th>
              {PLANS.map((plan, i) => (
                <th key={plan.id} scope="col" className={`px-3 py-4 text-center font-semibold ${i === featured ? 'bg-brand text-white' : 'text-brand-deep'}`}>
                  {plan.name.replace('ViaObras ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-ink">
                  {row.label}
                  {row.soon && <SoonMark />}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={PLANS[i].id} className={`px-3 py-3 text-center ${i === featured ? 'bg-brand-soft' : ''}`}>
                    <CellContent cell={cell} rowSoon={row.soon} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-xs text-muted-ink">{SOON_NOTE}</p>
    </Section>
  )
}
