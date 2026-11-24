import type { ReactNode } from 'react'
import { ProductShot } from './ProductShot'
import type { Shot, ShotCrop } from '../content'
import { Eyebrow, FeatureCard, Lead, Reveal, Section, SectionTitle, type Tone } from './primitives'

interface FeatureSplitProps {
  id: string
  tone: Tone
  eyebrow: string
  title: string
  text: ReadonlyArray<string> | string
  features: ReadonlyArray<{ icon: string; title: string; text: string }>
  shot: Shot
  crop?: ShotCrop
  /** Inverte as colunas (screenshot à esquerda) para alternar o ritmo entre seções. */
  reverse?: boolean
  /** Conteúdo extra abaixo dos cartões (ex.: lista de destaques). */
  extra?: ReactNode
}

/**
 * Layout padrão texto + screenshot grande + cartões de recursos, alternando o lado.
 * Usado por Obras e Suprimentos.
 */
export function FeatureSplit({ id, tone, eyebrow, title, text, features, shot, crop, reverse, extra }: FeatureSplitProps) {
  const titleId = `${id}-title`
  const paragraphs = typeof text === 'string' ? [text] : text
  return (
    <Section id={id} tone={tone} labelledBy={titleId}>
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-12">
        <div className={`lg:col-span-4 ${reverse ? 'lg:order-2' : ''}`}>
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
            <SectionTitle id={titleId} className="mt-3 lg:text-3xl">
              {title}
            </SectionTitle>
            <div className="mt-5 space-y-4">
              {paragraphs.map((p) => (
                <Lead key={p}>{p}</Lead>
              ))}
            </div>
          </Reveal>
          {extra}
        </div>

        <Reveal className={`lg:col-span-8 ${reverse ? 'lg:order-1' : ''}`} index={1}>
          <ProductShot shot={shot} crop={crop} />
        </Reveal>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} text={feature.text} index={index} />
        ))}
      </ul>
    </Section>
  )
}
