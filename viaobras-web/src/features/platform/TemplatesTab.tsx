import { useMutation } from '@tanstack/react-query'
import { Eye, Loader2, RotateCcw, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { StatusBadge } from '@/components/data-display/indicators'
import { Alert } from '@/components/feedback/Alert'
import { ConfirmDialog } from '@/components/feedback/Modal'
import { FormField, SelectInput, TextArea, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api-error'
import { platformMailApi, type MailTemplate } from './api'

/** Mensagens padrão: assunto e texto simples com variáveis de lista fechada, prévia e restauração. */
export function TemplatesTab({ templates, onChanged }: { templates: MailTemplate[]; onChanged: () => void }) {
  const [key, setKey] = useState(templates[0]?.key)
  const template = templates.find((t) => t.key === key)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <FormField label="Mensagem" className="sm:max-w-sm">
        <SelectInput value={key} onChange={(e) => setKey(e.target.value as MailTemplate['key'])}>
          {templates.map((t) => <option key={t.key} value={t.key}>{t.label}{t.customized ? ' (alterada)' : ''}</option>)}
        </SelectInput>
      </FormField>
      {/* a chave recria o editor ao trocar de mensagem ou depois de salvar/restaurar */}
      {template && <Editor key={`${template.key}:${template.subject}:${template.body}`} template={template} onChanged={onChanged} />}
    </div>
  )
}

function Editor({ template, onChanged }: { template: MailTemplate; onChanged: () => void }) {
  const { notify } = useToast()
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [restoring, setRestoring] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = subject !== template.subject || body !== template.body

  const preview = useMutation({ mutationFn: () => platformMailApi.preview(template.key, { subject, body }) })
  const test = useMutation({
    mutationFn: () => platformMailApi.testTemplate(template.key, { subject, body }),
    onSuccess: (r) => notify('success', r.message),
    onError: (e) => notify('error', 'O teste não foi enviado', getErrorMessage(e)),
  })
  const save = useMutation({
    mutationFn: () => platformMailApi.saveTemplate(template.key, { subject, body }),
    onSuccess: () => {
      notify('success', 'Mensagem salva.')
      onChanged()
    },
  })
  const restore = useMutation({
    mutationFn: () => platformMailApi.restoreTemplate(template.key),
    onSuccess: () => {
      notify('success', 'Texto padrão restaurado.')
      onChanged()
    },
    onError: (e) => notify('error', getErrorMessage(e)),
  })

  const insert = (name: string) => {
    const field = area.current
    const at = field?.selectionStart ?? body.length
    const end = field?.selectionEnd ?? at
    setBody(`${body.slice(0, at)}{{${name}}}${body.slice(end)}`)
    field?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <StatusBadge tone={template.customized ? 'primary' : 'neutral'}>{template.customized ? 'Texto alterado' : 'Texto padrão'}</StatusBadge>
        {dirty && <span className="text-muted-foreground text-xs">Há alterações não salvas.</span>}
      </div>

      {save.isError && <Alert tone="danger" title="A mensagem não foi salva">{getErrorMessage(save.error)}</Alert>}

      <FormField label="Assunto" required>
        <TextInput value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
      </FormField>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="template-body" className="text-sm font-medium">Texto da mensagem</label>
        <TextArea id="template-body" ref={area} className="min-h-64 font-mono text-[13px]" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
      </div>

      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Variáveis (clique para inserir no texto)</legend>
        <ul className="flex flex-col gap-1.5">
          {template.variables.map((v) => (
            <li key={v.name} className="flex flex-wrap items-center gap-2 text-sm">
              <Button type="button" variant="outline" size="sm" className="font-mono" onClick={() => insert(v.name)}>{`{{${v.name}}}`}</Button>
              <span className="text-muted-foreground">{v.description}</span>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar mensagem
        </Button>
        <Button size="lg" variant="outline" disabled={preview.isPending} onClick={() => preview.mutate()}>
          <Eye className="size-4" /> Prévia
        </Button>
        <Button size="lg" variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar teste para mim
        </Button>
        {template.customized && (
          <Button size="lg" variant="ghost" onClick={() => setRestoring(true)}>
            <RotateCcw className="size-4" /> Restaurar padrão
          </Button>
        )}
      </div>

      {preview.isError && <Alert tone="danger">{getErrorMessage(preview.error)}</Alert>}
      {preview.data && !preview.isError && (
        <section aria-label="Prévia da mensagem" className="bg-muted/40 rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs">Prévia com dados de exemplo</p>
          <p className="text-sm font-semibold">{preview.data.subject}</p>
          <p className="mt-2 text-sm break-words whitespace-pre-wrap">{preview.data.body}</p>
        </section>
      )}

      <ConfirmDialog
        open={restoring}
        title="Restaurar o texto padrão?"
        description="O texto alterado desta mensagem é descartado."
        confirmLabel="Restaurar padrão"
        onCancel={() => setRestoring(false)}
        onConfirm={() => {
          setRestoring(false)
          restore.mutate()
        }}
      />
    </div>
  )
}
