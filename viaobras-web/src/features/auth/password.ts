import { z } from 'zod'
import { ApiError } from '@/lib/api-error'

/** Espelho de PasswordRules::strong() da API (a API confere de novo). */
export const PASSWORD_HINT = 'Ao menos 12 caracteres, com letra maiúscula, letra minúscula e número.'

export const strongPassword = z
  .string()
  .min(12, 'Use ao menos 12 caracteres.')
  .refine((v) => /\p{Ll}/u.test(v) && /\p{Lu}/u.test(v), 'Use letras maiúsculas e minúsculas.')
  .refine((v) => /\p{N}/u.test(v), 'Inclua ao menos um número.')

const confirmed = <T extends { password: string; password_confirmation: string }>(v: T) => v.password === v.password_confirmation
const mismatch = { message: 'As senhas não conferem.', path: ['password_confirmation'] }

export const newPasswordSchema = z.object({ password: strongPassword, password_confirmation: z.string() }).refine(confirmed, mismatch)

export const newAccountSchema = z
  .object({ name: z.string().trim().min(1, 'Informe o seu nome.').max(150), password: strongPassword, password_confirmation: z.string() })
  .refine(confirmed, mismatch)

/** No convite, a API só pede nome e senha quando o e-mail convidado ainda não tem conta. */
export const needsAccount = (error: unknown) => error instanceof ApiError && error.status === 422 && ['name', 'password'].some((f) => error.details?.[f])
