import { z } from 'zod'
import { http } from '@/lib/http'

/** Plataforma → E-mail: só o administrador da plataforma (a API confere). A senha da caixa nunca é devolvida. */

export interface MailboxStatus {
  source: 'panel' | 'server'
  /** A configuração do servidor envia de verdade (ou só registra)? */
  server_sends: boolean
  settings: {
    host: string
    port: 465 | 587
    encryption: 'ssl' | 'tls'
    username: string
    from_address: string
    from_name: string
    password_set: boolean
    active: boolean
    last_tested_at: string | null
  } | null
}

export interface MailTemplate {
  key: 'invitation' | 'password_reset'
  label: string
  customized: boolean
  variables: { name: string; description: string }[]
  default: { subject: string; body: string }
  subject: string
  body: string
}

export interface EmailSettings {
  mailbox: MailboxStatus
  templates: MailTemplate[]
}

type Text = { subject: string; body: string }
const data = <T,>(r: { data: T }) => r.data
const base = '/platform/mail'

export const platformMailApi = {
  get: () => http<{ data: EmailSettings }>(base).then(data),
  saveMailbox: (body: Record<string, unknown>) => http<{ data: EmailSettings }>(`${base}/mailbox`, { method: 'PUT', body }).then(data),
  useServer: (current_password: string) => http<{ data: EmailSettings }>(`${base}/mailbox`, { method: 'DELETE', body: { current_password } }).then(data),
  test: () => http<{ message: string }>(`${base}/test`, { method: 'POST' }),
  saveTemplate: (key: string, body: Text) => http<{ data: MailTemplate }>(`${base}/templates/${key}`, { method: 'PUT', body }).then(data),
  restoreTemplate: (key: string) => http<{ data: MailTemplate }>(`${base}/templates/${key}`, { method: 'DELETE' }).then(data),
  preview: (key: string, body: Text) => http<{ data: Text }>(`${base}/templates/${key}/preview`, { method: 'POST', body }).then(data),
  testTemplate: (key: string, body: Text) => http<{ message: string }>(`${base}/templates/${key}/test`, { method: 'POST', body }),
}

export const mailboxSchema = z.object({
  host: z.string().trim().min(1, 'Informe o servidor de envio.'),
  port: z.enum(['465', '587']),
  username: z.string().trim().min(1, 'Informe o usuário.'),
  password: z.string(),
  from_address: z.string().trim().email('E-mail inválido.'),
  from_name: z.string().trim().min(1, 'Informe o nome do remetente.').max(100),
  current_password: z.string().min(1, 'Informe a sua senha para confirmar.'),
})

export type MailboxForm = z.infer<typeof mailboxSchema>

export const mailboxForm = (status: MailboxStatus): MailboxForm => ({
  host: status.settings?.host ?? '',
  port: status.settings?.port === 587 ? '587' : '465',
  username: status.settings?.username ?? '',
  password: '',
  from_address: status.settings?.from_address ?? '',
  from_name: status.settings?.from_name ?? 'ViaObras',
  current_password: '',
})

/** A senha guardada só é reaproveitada se servidor, porta e usuário não mudarem (espelho da API). */
export function needsMailboxPassword(status: MailboxStatus, form: Pick<MailboxForm, 'host' | 'port' | 'username'>): boolean {
  const saved = status.settings
  return !saved || saved.host !== form.host.trim().toLowerCase() || String(saved.port) !== form.port || saved.username !== form.username.trim()
}

/** Formulário com a regra da senha junto das demais, para todos os erros aparecerem de uma vez. */
export const mailboxSchemaFor = (status: MailboxStatus) =>
  mailboxSchema.superRefine((form, ctx) => {
    if (!form.password && needsMailboxPassword(status, form)) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Informe a senha da caixa postal.' })
  }, { when: () => true })

export const mailboxBody = (form: MailboxForm) => ({ ...form, port: Number(form.port), password: form.password || null })
