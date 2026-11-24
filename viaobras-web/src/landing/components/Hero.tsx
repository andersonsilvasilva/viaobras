import { ArrowRight, CheckCircle2, History } from 'lucide-react'
import type { CSSProperties } from 'react'
import { APP_URL, HERO, SECTION_IDS, SHOTS } from '../content'
import { ProductShot } from './ProductShot'
import { ButtonLink, Container, Eyebrow, Lead } from './primitives'

/**
 * Hero: texto à esquerda, screenshot real à direita (no mobile, texto primeiro).
 * Os cartões flutuantes são decorativos: indicam recursos, sem números nem dados de clientes.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip bg-white pb-16 pt-10 sm:pt-14 lg:pb-24 lg:pt-20">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-brand-soft lg:block" aria-hidden="true" />
      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <div className="reveal">
              <Eyebrow>{HERO.eyebrow}</Eyebrow>
              <h1
                id="hero-title"
                className="mt-4 text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-5xl lg:text-[3.5rem]"
              >
                {HERO.title}
              </h1>
              <div className="mt-6 space-y-4">
                {HERO.text.map((paragraph) => (
                  <Lead key={paragraph}>{paragraph}</Lead>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`#${SECTION_IDS.features}`}>
                  {HERO.primaryCta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href={APP_URL} variant="secondary">
                  {HERO.secondaryCta}
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-7">
            <div className="reveal relative lg:w-[112%]" style={{ '--reveal-delay': '120ms' } as CSSProperties}>
              <ProductShot shot={SHOTS.dashboard} priority sizes="(min-width: 1024px) 58vw, 100vw" />

              <div className="absolute -left-3 top-10 hidden items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 shadow-lp-md sm:flex lg:-left-8">
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                <span className="text-xs font-semibold text-brand-deep">Obras acompanhadas</span>
              </div>

              <div className="absolute -bottom-5 right-3 hidden w-52 rounded-lg border border-line bg-white p-3 shadow-lp-md sm:block lg:-right-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-deep">
                  <History className="size-4 text-brand" aria-hidden="true" />
                  Orçamento versionado
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft" aria-hidden="true">
                  <div className="lp-bar h-full w-2/3 rounded-full bg-brand" />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-ink">Exemplo ilustrativo</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
