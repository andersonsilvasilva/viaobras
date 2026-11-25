import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useToast } from '@/app/providers/ToastProvider'
import { Alert } from '@/components/feedback/Alert'
import { Modal } from '@/components/feedback/Modal'
import { FormField, SelectInput, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { mailboxBody, mailboxForm, mailboxSchemaFor, needsMailboxPassword, platformMailApi, type EmailSettings, type MailboxForm, type MailboxStatus } from './api'

const firstError = (e: unknown) => (e instanceof ApiError && Object.values(e.details ?? {}).flat()[0]) || getErrorMessage(e)

/** Caixa postal de envio: a configuração nova só vale depois que o teste para quem está alterando for aceito. */
export function MailboxTab({ status, onChanged }: { status: MailboxStatus; onChanged: (settings: EmailSettings) => void }) {
  const { notify } = useToast()
  const [reverting, setReverting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<MailboxForm>({ resolver: zodResolver(mailboxSchemaFor(status)), defaultValues: mailboxForm(status) })
  const [host, port, username] = useWatch({ control: form.control, name: ['host', 'port', 'username'] })
  const passwordNeeded = needsMailboxPassword(status, { host, port, username })
  const errors = form.formState.errors

  const save = useMutation({
    mutationFn: (values: MailboxForm) => platformMailApi.saveMailbox(mailboxBody(values)),
    onSuccess: (settings) => {
      notify('success', 'Caixa postal salva', 'O teste foi aceito. Confira a sua caixa de entrada.')
      form.reset(mailboxForm(settings.mailbox))
      onChanged(settings)
    },
  })
  const test = useMutation({
    mutationFn: platformMailApi.test,
    onSuccess: (r) => notify('success', r.message),
    onError: (e) => notify('error', 'O teste falhou', getErrorMessage(e)),
  })

  const submit = form.handleSubmit((values) => save.mutate(values))

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {status.source === 'panel' ? (
        <Alert tone="success" title="Em uso: configuração desta tela">
          {status.settings?.last_tested_at && `Último teste aceito em ${new Date(status.settings.last_tested_at).toLocaleString('pt-BR')}.`}
        </Alert>
      ) : (
        <Alert tone={status.server_sends ? 'info' : 'warning'} title="Em uso: configuração do servidor">
          {status.server_sends
            ? 'O envio usa a configuração feita no servidor. Ao salvar aqui, a configuração desta tela passa a valer.'
            : 'O servidor não está enviando e-mails: as mensagens só são registradas. Configure a caixa postal abaixo.'}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar teste da configuração em uso
        </Button>
        {status.source === 'panel' && <Button variant="ghost" onClick={() => setReverting(true)}>Voltar à configuração do servidor</Button>}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {save.isError && <Alert tone="danger" title="A configuração não foi salva">{firstError(save.error)}</Alert>}

        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <FormField label="Servidor de envio (SMTP)" required error={errors.host?.message} hint="Ex.: smtp.hostinger.com">
            <TextInput autoComplete="off" spellCheck={false} {...form.register('host')} />
          </FormField>
          <FormField label="Porta e criptografia" required>
            <SelectInput {...form.register('port')}>
              <option value="465">465 — SSL/TLS</option>
              <option value="587">587 — STARTTLS</option>
            </SelectInput>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Usuário" required error={errors.username?.message} hint="Normalmente o endereço da caixa postal">
            <TextInput autoComplete="off" spellCheck={false} {...form.register('username')} />
          </FormField>
          <FormField
            label="Senha da caixa postal"
            required={passwordNeeded}
            error={errors.password?.message}
            hint={passwordNeeded ? 'Obrigatória ao configurar ou ao mudar servidor, porta ou usuário' : 'Definida. Deixe em branco para manter'}
          >
            <TextInput type={showPassword ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} {...form.register('password')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm sm:col-start-2 sm:-mt-2">
            <input type="checkbox" className="accent-primary size-4" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Mostrar a senha digitada (confira se o navegador não preencheu outra)
          </label>
          <FormField label="E-mail do remetente" required error={errors.from_address?.message}>
            <TextInput type="email" autoComplete="off" {...form.register('from_address')} />
          </FormField>
          <FormField label="Nome do remetente" required error={errors.from_name?.message}>
            <TextInput autoComplete="off" {...form.register('from_name')} />
          </FormField>
        </div>

        <div className="border-t pt-4">
          <FormField label="Sua senha de acesso" required error={errors.current_password?.message} hint="Confirma que é você. Um teste será enviado para o seu e-mail." className="sm:max-w-sm">
            <TextInput type="password" autoComplete="current-password" {...form.register('current_password')} />
          </FormField>
        </div>

        <div>
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Testar e salvar
          </Button>
        </div>
      </form>

      {reverting && (
        <RevertDialog
          onClose={() => setReverting(false)}
          onDone={(settings) => {
            setReverting(false)
            notify('success', 'Voltou a valer a configuração do servidor.')
            onChanged(settings)
          }}
        />
      )}
    </div>
  )
}

function RevertDialog({ onClose, onDone }: { onClose: () => void; onDone: (settings: EmailSettings) => void }) {
  const [password, setPassword] = useState('')
  const revert = useMutation({ mutationFn: () => platformMailApi.useServer(password), onSuccess: onDone })

  return (
    <Modal
      open
      onClose={onClose}
      title="Voltar à configuração do servidor"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!password || revert.isPending} onClick={() => revert.mutate()}>Voltar à configuração do servidor</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {revert.isError && <Alert tone="danger">{firstError(revert.error)}</Alert>}
        <p className="text-sm">A configuração desta tela deixa de ser usada, mas continua guardada.</p>
        <FormField label="Sua senha de acesso" required>
          <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
