import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Icon } from './Icon'

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export type Tone = 'white' | 'paper' | 'soft' | 'deep' | 'brand'

const TONE: Record<Tone, string> = {
  white: 'bg-white text-ink',
  paper: 'bg-paper text-ink',
  soft: 'bg-brand-soft text-ink',
  deep: 'bg-brand-deep text-white',
  brand: 'bg-brand text-white',
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

/** Faixa de seção com fundo alternado. `overflow-hidden` evita rolagem horizontal e contém elementos decorativos. */
export function Section({
  id,
  tone = 'white',
  labelledBy,
  className,
  children,
}: {
  id?: string
  tone?: Tone
  labelledBy?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx('overflow-hidden py-16 sm:py-20 lg:py-24', TONE[tone], className)}>
      <Container>{children}</Container>
    </section>
  )
}

/** Revela o conteúdo ao entrar na viewport (CSS + IntersectionObserver em `useReveal`). */
export function Reveal({
  as: Tag = 'div',
  index = 0,
  className,
  children,
}: {
  as?: ElementType
  index?: number
  className?: string
  children: ReactNode
}) {
  const style = { '--reveal-delay': `${Math.min(index, 8) * 70}ms` } as CSSProperties
  return (
    <Tag className={cx('reveal', className)} style={style}>
      {children}
    </Tag>
  )
}

export function Eyebrow({ children, onDark }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p className={cx('text-xs font-semibold uppercase tracking-[0.14em]', onDark ? 'text-on-deep' : 'text-brand')}>{children}</p>
  )
}

export function SectionTitle({
  id,
  children,
  onDark,
  className,
}: {
  id: string
  children: ReactNode
  onDark?: boolean
  className?: string
}) {
  return (
    <h2
      id={id}
      className={cx(
        'text-balance text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl',
        onDark ? 'text-white' : 'text-brand-deep',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Lead({ children, onDark, className }: { children: ReactNode; onDark?: boolean; className?: string }) {
  return (
    <p className={cx('text-pretty text-base leading-relaxed sm:text-lg', onDark ? 'text-on-deep' : 'text-muted-ink', className)}>
      {children}
    </p>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'light' | 'ghostLight'

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-lp-sm hover:bg-brand-hover focus-visible:outline-brand',
  secondary: 'border border-brand/30 bg-white text-brand hover:border-brand hover:bg-brand-soft focus-visible:outline-brand',
  light: 'bg-white text-brand-deep shadow-lp-sm hover:bg-brand-soft focus-visible:outline-white',
  ghostLight: 'border border-white/40 text-white hover:border-white hover:bg-white/10 focus-visible:outline-white',
}

export function ButtonLink({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        BUTTON[variant],
        className,
      )}
    >
      {children}
    </a>
  )
}

/** Cartão de recurso: ícone + título + frase curta. Borda discreta, hover sutil. */
export function FeatureCard({
  icon,
  title,
  text,
  index = 0,
  onDark,
}: {
  icon: string
  title: string
  text: string
  index?: number
  onDark?: boolean
}) {
  return (
    <Reveal
      as="li"
      index={index}
      className={cx(
        'group rounded-xl border p-5 transition duration-200 hover:-translate-y-0.5',
        onDark
          ? 'border-white/10 bg-white/[0.06] hover:border-white/25 hover:bg-white/10'
          : 'border-line bg-white shadow-lp-sm hover:shadow-lp-md',
      )}
    >
      <span
        className={cx(
          'mb-3 inline-flex size-10 items-center justify-center rounded-lg',
          onDark ? 'bg-white/10 text-brand-soft' : 'bg-brand-soft text-brand',
        )}
        aria-hidden="true"
      >
        <Icon name={icon} className="size-5" strokeWidth={1.75} />
      </span>
      <h3 className={cx('text-base font-semibold', onDark ? 'text-white' : 'text-brand-deep')}>{title}</h3>
      <p className={cx('mt-1 text-sm leading-relaxed', onDark ? 'text-on-deep' : 'text-muted-ink')}>{text}</p>
    </Reveal>
  )
}
