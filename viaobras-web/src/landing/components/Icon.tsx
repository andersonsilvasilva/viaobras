import { createElement } from 'react'
import type { LucideProps } from 'lucide-react'
import { iconFor } from './icons'

/** Ícone Lucide a partir da chave usada em `content.ts` (decorativo: aria-hidden). */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(iconFor(name), { 'aria-hidden': true, ...props })
}
