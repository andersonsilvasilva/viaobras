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
import { authService, type AcceptedInvitation } from './auth-service'
import { needsAccount, newAccountSchema, PASSWORD_HINT } from './password'

type Form = z.infer<typeof newAccountSchema>

/**
 * Destino do link do convite (`/accept-invitation?token=…`). Primeiro tenta aceitar só com o convite (quem já tem
 * conta); se a API pedir nome e senha, mostra o cadastro. Nada acontece sem o clique da pessoa.
 */
export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<AcceptedInvitation | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(newAccountSchema) })

  const send = async (values?: Form) => {
    setError(null)
    setBusy(true)
    try {
      setAccepted(await authService.acceptInvitation({ token, ...values }))
    } catch (e) {
      if (!values && needsAccount(e)) setCreating(true)
      else if (e instanceof ApiError && e.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.')
      else setError((e instanceof ApiError && Object.values(e.details ?? {}).flat()[0]) || getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthCard title="Convite">
        <Alert tone="danger" className="mt-4">Este link está incompleto. Abra o link do e-mail novamente.</Alert>
      </AuthCard>
    )
  }

  if (accepted) {
    return (
      <AuthCard title="Convite aceito">
        <Alert tone="success" className="mt-4">
          Você agora faz parte de “{accepted.tenant.name}”.{' '}
          {accepted.account_existed ? 'Entre com a senha que você já usa.' : 'Entre com o seu e-mail e a senha que acabou de criar.'}
        </Alert>
        <Link to="/login" className="text-primary mt-4 inline-block text-sm hover:underline">Ir para o login</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Aceitar convite" description={creating ? 'Crie o seu acesso para entrar na organização.' : 'Você foi convidado para uma organização no ViaObras.'}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {creating ? (
        <form onSubmit={handleSubmit(send)} noValidate className="flex flex-col gap-4">
          <FormField label="Seu nome" required error={formState.errors.name?.message}>
            <TextInput autoComplete="name" autoFocus {...register('name')} />
          </FormField>
          <FormField label="Crie uma senha" required hint={PASSWORD_HINT} error={formState.errors.password?.message}>
            <TextInput type="password" autoComplete="new-password" {...register('password')} />
          </FormField>
          <FormField label="Repita a senha" required error={formState.errors.password_confirmation?.message}>
            <TextInput type="password" autoComplete="new-password" {...register('password_confirmation')} />
          </FormField>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Criar acesso e aceitar
          </Button>
        </form>
      ) : (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => send()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Aceitar convite
        </Button>
      )}
    </AuthCard>
  )
}
