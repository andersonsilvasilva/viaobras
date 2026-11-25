/**
 * CONFIGURAÇÃO COMERCIAL da página de planos. Preencha antes de publicar.
 * Campo vazio = a página não cria link (nada de contato ou página fictícios).
 */
export interface SalesChannel {
  /** Endereço de um formulário ou agenda comercial (tem prioridade). Ex.: 'https://…' */
  url: string
  /** WhatsApp comercial, só dígitos, com país e DDD. */
  whatsapp: string
  /** E-mail comercial. */
  email: string
}

/** Contatos comerciais publicados em https://hightechtecnologia.com.br/ (conferidos em 2026-11-25). */
export const SALES: SalesChannel = {
  url: '',
  whatsapp: '5547992073875',
  email: 'hightech.tecno@gmail.com',
}

export const LEGAL = {
  privacyUrl: '',
  termsUrl: '',
}

/** Selo do plano em destaque. Use '' para esconder (ex.: enquanto não houver base para dizer que é o mais escolhido). */
export const FEATURED_BADGE = 'MAIS ESCOLHIDO'

/**
 * Link do canal comercial com a mensagem já preenchida, ou null se nenhum canal estiver configurado.
 * Não há checkout no produto: contratar é falar com o comercial.
 */
export function salesLink(message: string, channel: SalesChannel = SALES): string | null {
  if (channel.url.trim()) return channel.url.trim()
  const digits = channel.whatsapp.replace(/\D/g, '')
  if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  if (channel.email.trim()) return `mailto:${channel.email.trim()}?subject=${encodeURIComponent(message)}`
  return null
}
