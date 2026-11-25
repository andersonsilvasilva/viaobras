import { DEMO, SECTION_IDS } from '../content'
import { Eyebrow, Lead, Reveal, Section } from './primitives'

/** Vídeo de demonstração (sem narração, com legendas). Só baixa ao clicar em reproduzir (preload="none"). */
export function DemoSection() {
  const base = import.meta.env.BASE_URL
  return (
    <Section id={SECTION_IDS.demo} tone="paper" labelledBy="demo-title">
      <Reveal className="mx-auto max-w-3xl text-center">
        <Eyebrow>{DEMO.eyebrow}</Eyebrow>
        <h2 id="demo-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-brand-deep sm:text-4xl">
          {DEMO.title}
        </h2>
        <Lead className="mt-5">{DEMO.text}</Lead>
      </Reveal>
      <Reveal className="mx-auto mt-10 max-w-5xl">
        <video
          className="aspect-video w-full rounded-xl border border-line bg-brand-deep shadow-lp-md"
          controls
          playsInline
          preload="none"
          poster={`${base}${DEMO.poster}`}
          aria-label={DEMO.label}
        >
          <source src={`${base}${DEMO.video}`} type="video/mp4" />
          Seu navegador não reproduz este vídeo.
        </video>
      </Reveal>
    </Section>
  )
}
