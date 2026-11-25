import { salesLink } from '../config'
import { ButtonLink, type ButtonVariant } from '../../landing/components/primitives'

export const SALES_PENDING_ID = 'canal-comercial-pendente'

/**
 * Botão que leva ao canal comercial configurado (config.ts). Sem canal, fica desativado com explicação: a página não
 * inventa contato nem simula uma contratação.
 */
export function SalesButton({ label, message, variant = 'primary', className = '' }: { label: string; message: string; variant?: ButtonVariant; className?: string }) {
  const href = salesLink(message)

  if (href) {
    return (
      <ButtonLink href={href} variant={variant} className={className}>
        {label}
      </ButtonLink>
    )
  }

  const onDark = variant === 'ghostLight' || variant === 'light'
  return (
    <button
      type="button"
      disabled
      aria-describedby={SALES_PENDING_ID}
      title="Canal comercial em configuração"
      className={`inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-dashed px-5 text-sm font-semibold ${
        onDark ? 'border-white/40 text-on-deep' : 'border-brand/40 bg-white text-muted-ink'
      } ${className}`}
    >
      {label}
    </button>
  )
}
