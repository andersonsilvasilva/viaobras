import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import type { z } from 'zod'
import { Alert } from '@/components/feedback/Alert'
import { FormField, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { AuthCard } from './AuthCard'
import { authService } from './auth-service'
import { newPasswordSchema, PASSWORD_HINT } from './password'

type Form = z.infer<typeof newPasswordSchema>

/** Destino do link do e-mail de recuperação de senha (`/reset-password?token=…&email=…`). */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      setDone((await authService.resetPassword({ token, email, ...values })).message)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.')
      else setError((e instanceof ApiError && Object.values(e.details ?? {}).flat()[0]) || getErrorMessage(e))
    }
  })

  const loginLink = (
    <Link to="/login" className="text-primary mt-4 inline-block text-sm hover:underline">
      Ir para o login
    </Link>
  )

  if (!token || !email) {
    return (
      <AuthCard title="Redefinir senha">
        <Alert tone="danger" className="mt-4">Este link está incompleto. Abra o link do e-mail novamente ou peça um novo em “Esqueci minha senha”.</Alert>
        {loginLink}
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard title="Senha redefinida">
        <Alert tone="success" className="mt-4">{done}</Alert>
        {loginLink}
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Redefinir senha" description={`Crie uma nova senha para ${email}.`}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {/* ajuda o gerenciador de senhas a ligar a nova senha à conta */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <FormField label="Nova senha" required hint={PASSWORD_HINT} error={formState.errors.password?.message}>
          <TextInput type="password" autoComplete="new-password" autoFocus {...register('password')} />
        </FormField>
        <FormField label="Repita a nova senha" required error={formState.errors.password_confirmation?.message}>
          <TextInput type="password" autoComplete="new-password" {...register('password_confirmation')} />
        </FormField>
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Salvar nova senha
        </Button>
      </form>
      {loginLink}
    </AuthCard>
  )
}
