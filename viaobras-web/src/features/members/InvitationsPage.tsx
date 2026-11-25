import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useToast } from '@/app/providers/ToastProvider'
import { DataTable, Panel, type Column } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/indicators'
import { Alert } from '@/components/feedback/Alert'
import { ConfirmDialog, Modal } from '@/components/feedback/Modal'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { FormField, SelectInput, TextInput } from '@/components/forms/fields'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { canGrant, effectiveStatus, invitationsApi, roleHelp, roleLabel, statusMeta, type Invitation } from './api'

const KEY = ['invitations']
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const firstError = (e: unknown) => (e instanceof ApiError && e.status === 422 && Object.values(e.details ?? {}).flat()[0]) || getErrorMessage(e)

type Pending = { kind: 'revoke' | 'resend'; invitation: Invitation }

/** Convites da organização: enviar, acompanhar, reenviar e revogar. */
export function InvitationsPage() {
  const { can } = useAuth()
  const { notify } = useToast()
  const client = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: invitationsApi.list })
  const [inviting, setInviting] = useState(false)
  const [confirm, setConfirm] = useState<Pending | null>(null)
  const canInvite = can('members.invite') && can('roles.view')

  const report = (email: string, sent: boolean) =>
    sent
      ? notify('success', `Convite enviado para ${email}.`)
      : notify('error', 'Convite criado, mas o e-mail não saiu', 'Confira o envio de e-mail da plataforma e use “Reenviar”.')

  const act = useMutation({
    mutationFn: async ({ kind, invitation }: Pending) => {
      // reenviar = revogar e criar outro: o link antigo deixa de valer (só ao reenviar existe um novo token)
      if (invitation.status === 'pending') await invitationsApi.revoke(invitation.id)
      if (kind === 'revoke') return null
      return invitationsApi.create(invitation.email, invitation.role.id as number)
    },
    onSuccess: (result, { invitation }) => {
      if (result) report(invitation.email, result.email_sent)
      else notify('success', 'Convite revogado.')
    },
    onError: (e) => notify('error', 'Não foi possível concluir', getErrorMessage(e)),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  })

  const columns: Column<Invitation>[] = [
    { key: 'email', header: 'E-mail', cell: (i) => <span className="font-medium">{i.email}</span>, sortValue: (i) => i.email },
    { key: 'role', header: 'Papel', cell: (i) => roleLabel(i.role.name) },
    {
      key: 'status',
      header: 'Situação',
      cell: (i) => {
        const meta = statusMeta[effectiveStatus(i)]
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      },
    },
    {
      key: 'when',
      header: 'Validade / aceite',
      cell: (i) => (i.accepted_at ? `aceito em ${dateTime(i.accepted_at)}` : effectiveStatus(i) === 'revoked' ? '—' : `até ${dateTime(i.expires_at)}`),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (i) => {
        const status = effectiveStatus(i)
        if (!canInvite || status === 'accepted') return '—'
        return (
          <span className="inline-flex gap-1">
            {i.role.id !== null && (
              <Button variant="outline" size="sm" disabled={act.isPending} onClick={() => setConfirm({ kind: 'resend', invitation: i })} aria-label={`Reenviar convite para ${i.email}`}>
                Reenviar
              </Button>
            )}
            {i.status === 'pending' && (
              <Button variant="ghost" size="sm" disabled={act.isPending} onClick={() => setConfirm({ kind: 'revoke', invitation: i })} aria-label={`Revogar convite de ${i.email}`}>
                Revogar
              </Button>
            )}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Convites"
        description="Convide pessoas por e-mail para a sua organização."
        actions={canInvite ? <Button onClick={() => setInviting(true)}><UserPlus className="size-4" /> Convidar pessoa</Button> : undefined}
      />
      <Alert tone="info" className="mb-4">
        Quem aceita um convite entra na organização com o papel escolhido. Para ver ou trabalhar em uma obra, a pessoa também precisa
        receber acesso na aba <strong>Acesso</strong> da obra (administradores já veem todas).
      </Alert>
      <QueryBoundary query={query}>
        {(rows) => (
          <Panel>
            <DataTable caption="Convites enviados" columns={columns} rows={rows} rowKey={(i) => String(i.id)} pageSize={15}
              emptyTitle="Nenhum convite ainda" emptyDescription="Use “Convidar pessoa” para enviar o primeiro." />
          </Panel>
        )}
      </QueryBoundary>

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onDone={(email, sent) => {
            setInviting(false)
            report(email, sent)
            client.invalidateQueries({ queryKey: KEY })
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'resend' ? `Reenviar o convite para ${confirm.invitation.email}?` : `Revogar o convite de ${confirm?.invitation.email}?`}
        description={confirm?.kind === 'resend' ? 'Um novo e-mail é enviado, com um novo link. O link anterior deixa de valer.' : 'O link enviado deixa de valer.'}
        confirmLabel={confirm?.kind === 'resend' ? 'Reenviar' : 'Revogar'}
        destructive={confirm?.kind === 'revoke'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) act.mutate(confirm)
          setConfirm(null)
        }}
      />
    </>
  )
}

const schema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.').max(190),
  role_id: z.string().min(1, 'Escolha o papel.'),
})
type Form = z.infer<typeof schema>

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (email: string, sent: boolean) => void }) {
  const { can } = useAuth()
  const roles = useQuery({ queryKey: ['roles', 'invite'], queryFn: invitationsApi.roles })
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', role_id: '' } })
  const roleId = useWatch({ control: form.control, name: 'role_id' })
  const chosen = roles.data?.find((r) => String(r.id) === roleId)

  const send = useMutation({
    mutationFn: (v: Form) => invitationsApi.create(v.email.trim(), Number(v.role_id)),
    onSuccess: (r) => onDone(r.data.email, r.email_sent),
  })
  const submit = form.handleSubmit((v) => send.mutate(v))

  return (
    <Modal
      open
      onClose={onClose}
      title="Convidar pessoa"
      description="Ela recebe um e-mail com o link para aceitar."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={send.isPending} onClick={() => submit()}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar convite
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {send.isError && <Alert tone="danger" title="O convite não foi enviado">{firstError(send.error)}</Alert>}
        {roles.isError && <Alert tone="danger">{getErrorMessage(roles.error)}</Alert>}
        <FormField label="E-mail" required error={form.formState.errors.email?.message}>
          <TextInput type="email" autoComplete="off" autoFocus {...form.register('email')} />
        </FormField>
        <FormField label="Papel" required error={form.formState.errors.role_id?.message} hint={chosen ? roleHelp(chosen.name) : undefined}>
          <SelectInput {...form.register('role_id')} disabled={roles.isPending}>
            <option value="">{roles.isPending ? 'Carregando…' : 'Escolha…'}</option>
            {(roles.data ?? []).map((r) => (
              <option key={r.id} value={String(r.id)} disabled={!canGrant(r, can)}>
                {roleLabel(r.name)}{canGrant(r, can) ? '' : ' (exige permissões que você não tem)'}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
