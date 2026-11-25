import { ChevronDown } from 'lucide-react'
import { Reveal, Section, SectionTitle } from '../../landing/components/primitives'
import { LEGAL } from '../config'
import { FAQ, IDS } from '../content'

/** Perguntas em `<details>` nativo: abre com Enter/Espaço e é anunciado por leitores de tela. */
export function FAQSection() {
  return (
    <Section id={IDS.faq} tone="paper" labelledBy="faq-title">
      <Reveal className="text-center">
        <SectionTitle id="faq-title">Perguntas frequentes</SectionTitle>
      </Reveal>
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQ.map((item) => (
          <details key={item.question} className="group rounded-xl border border-line bg-white shadow-lp-sm open:shadow-lp-md">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-base font-semibold text-brand-deep transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="size-5 shrink-0 text-brand transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-ink">
              {item.answer}
              {item.privacyAnswer && LEGAL.privacyUrl && (
                <>
                  {' '}
                  <a href={LEGAL.privacyUrl} className="font-semibold text-brand underline underline-offset-2">
                    {item.privacyAnswer}
                  </a>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </Section>
  )
}
