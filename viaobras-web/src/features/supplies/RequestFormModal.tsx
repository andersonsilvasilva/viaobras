import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, PackageSearch, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useToast } from '@/app/providers/ToastProvider'
import { Alert } from '@/components/feedback/Alert'
import { Modal } from '@/components/feedback/Modal'
import { FormField, SelectInput, TextArea, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { atLeast, projectsApi } from '@/features/projects/api'
import { api } from '@/features/registry/api'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { priorityMeta, suppliesApi, type PurchaseRequest } from './api'
import { CatalogPicker } from './CatalogPicker'
import { emptyItem, planningHint, requestSchema, toBody, toForm, type RequestForm } from './form'

interface Props {
  /** Ausente = nova solicitação. */
  request?: PurchaseRequest
  /** Obra já escolhida (aba Requisições da obra). */
  projectUuid?: string
  onClose: () => void
  /** Chamado depois de gravar (mesmo que o envio falhe: o rascunho já existe). */
  onSaved: (saved: PurchaseRequest) => void
}

/** Nova solicitação ou edição do rascunho. "Salvar e enviar" grava e, em seguida, envia para aprovação. */
export function RequestFormModal({ request, projectUuid, onClose, onSaved }: Props) {
  const creating = !request
  const { can } = useAuth()
  const { notify } = useToast()
  const [picking, setPicking] = useState(false)

  const form = useForm<RequestForm>({ resolver: zodResolver(requestSchema), defaultValues: toForm(request, projectUuid) })
  const items = useFieldArray({ control: form.control, name: 'items' })
  const watched = useWatch({ control: form.control, name: 'items' })
  const project = useWatch({ control: form.control, name: 'project_uuid' })
  const errors = form.formState.errors

  const projects = useQuery({
    queryKey: ['projects', 'options', 'supplies'],
    queryFn: () => projectsApi.list({ per_page: 100 }),
    enabled: creating && !projectUuid,
  })
  const editable = (projects.data?.data ?? []).filter((p) => atLeast(p.access_level, 'edit'))
  const planning = useQuery({
    queryKey: ['purchase-requests', 'planning', project],
    queryFn: () => suppliesApi.planning(project),
    enabled: !!project && can('schedules.view'),
  })
  const tasks = planning.data ?? []
  const units = useQuery({ queryKey: ['units', 'codes'], queryFn: () => api.units.all({ status: 'active' }), enabled: can('units.view') })

  const save = useMutation({
    mutationFn: async ({ values, send }: { values: RequestForm; send: boolean }) => {
      const saved = creating ? await suppliesApi.create(toBody(values, true)) : await suppliesApi.update(request.uuid, toBody(values, false))
      if (!send) return { saved, sendError: null }
      try {
        return { saved: await suppliesApi.workflow(saved.uuid, 'submit'), sendError: null }
      } catch (e) {
        // o rascunho já foi gravado: não repetir a criação
        return { saved, sendError: getErrorMessage(e) }
      }
    },
    onSuccess: ({ saved, sendError }, { send }) => {
      if (sendError) notify('error', `${saved.code} salva como rascunho, mas não foi enviada`, sendError)
      else notify('success', send ? `${saved.code} enviada para aprovação.` : `${saved.code} salva como rascunho.`)
      onSaved(saved)
    },
  })

  const submit = (send: boolean) =>
    form.handleSubmit((values) => {
      if (send && values.items.length === 0) {
        form.setError('items', { message: 'Inclua ao menos um item antes de enviar.' })
        return
      }
      save.mutate({ values, send })
    })()

  const details = save.error instanceof ApiError ? Object.values(save.error.details ?? {}).flat() : []
  const chosen = new Set((watched ?? []).map((i) => i.resource_uuid).filter((u): u is string => !!u))

  return (
    <Modal
      open
      onClose={onClose}
      title={creating ? 'Nova solicitação de materiais' : `Editar ${request.code}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" disabled={save.isPending} onClick={() => submit(false)}>Salvar rascunho</Button>
          <Button disabled={save.isPending} onClick={() => submit(true)}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar e enviar
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-4">
        {save.isError && (
          <Alert tone="danger" title={getErrorMessage(save.error)}>
            {details.length > 0 ? <ul className="list-disc pl-4">{details.map((d) => <li key={d}>{d}</li>)}</ul> : 'Revise os dados e tente novamente.'}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Obra" required error={errors.project_uuid?.message} hint={creating && projects.isSuccess && editable.length === 0 ? 'Você não tem nível de edição em nenhuma obra.' : undefined}>
            {creating && !projectUuid ? (
              <SelectInput {...form.register('project_uuid')} disabled={projects.isPending}>
                <option value="">{projects.isPending ? 'Carregando…' : 'Selecione…'}</option>
                {editable.map((p) => <option key={p.uuid} value={p.uuid}>{p.code} — {p.name}</option>)}
              </SelectInput>
            ) : (
              <TextInput readOnly value={request?.project ? `${request.project.code} — ${request.project.name}` : 'Esta obra'} />
            )}
          </FormField>
          <FormField label="Prioridade">
            <SelectInput {...form.register('priority')}>
              {Object.entries(priorityMeta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Necessário até" hint="Opcional">
            <TextInput type="date" {...form.register('needed_by')} />
          </FormField>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Itens ({items.fields.length})</legend>

          {items.fields.length === 0 && <p className="text-muted-foreground text-sm">Nenhum item. Busque no catálogo ou inclua um item digitado.</p>}

          {items.fields.map((field, i) => {
            const item = watched?.[i] ?? field
            const fromCatalog = !!item.resource_uuid
            const hint = planningHint(tasks, item)
            const itemErrors = errors.items?.[i]
            return (
              <div key={field.id} className="rounded-lg border p-3">
                <div className="grid items-start gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
                  <FormField label={fromCatalog ? 'Material do catálogo' : 'Descrição'} error={itemErrors?.description?.message}>
                    <TextInput {...form.register(`items.${i}.description`)} readOnly={fromCatalog} />
                  </FormField>
                  <FormField label="Unidade" error={itemErrors?.unit_code?.message}>
                    <TextInput {...form.register(`items.${i}.unit_code`)} readOnly={fromCatalog} list="supply-units" />
                  </FormField>
                  <FormField label="Quantidade" error={itemErrors?.quantity?.message}>
                    <TextInput inputMode="decimal" className="text-right" {...form.register(`items.${i}.quantity`)} />
                  </FormField>
                  <Button type="button" variant="ghost" size="icon" className="mt-6" onClick={() => items.remove(i)} aria-label={`Remover item ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {tasks.length > 0 && (
                    <FormField label="Atividade do planejamento" hint={hint ?? 'Opcional'}>
                      <SelectInput {...form.register(`items.${i}.task_id`)}>
                        <option value="">Sem ligação</option>
                        {tasks.map((t) => <option key={t.id} value={String(t.id)}>{t.wbs} · {t.name}</option>)}
                      </SelectInput>
                    </FormField>
                  )}
                  <FormField label="Observação do item" hint="Opcional">
                    <TextInput {...form.register(`items.${i}.notes`)} maxLength={500} />
                  </FormField>
                </div>
              </div>
            )
          })}

          <datalist id="supply-units">
            {(units.data ?? []).map((u) => <option key={u.id} value={u.code}>{u.name}</option>)}
          </datalist>

          {(errors.items?.message || errors.items?.root?.message) && (
            <p role="alert" className="text-destructive text-xs">{errors.items.message ?? errors.items.root?.message}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {can('resources.view') && (
              <Button type="button" variant="outline" size="sm" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
                <PackageSearch className="size-4" /> {picking ? 'Fechar catálogo' : 'Buscar no catálogo'}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => { form.clearErrors('items'); items.append({ ...emptyItem }) }}>
              <Plus className="size-4" /> Item digitado
            </Button>
          </div>

          {picking && (
            <CatalogPicker
              chosen={chosen}
              onPick={(m) => {
                form.clearErrors('items')
                items.append({ ...emptyItem, resource_uuid: m.uuid, description: m.name, unit_code: m.unit?.code ?? 'UN' }, { shouldFocus: false })
              }}
            />
          )}
        </fieldset>

        <FormField label="Observações" hint="Opcional">
          <TextArea {...form.register('notes')} />
        </FormField>
      </form>
    </Modal>
  )
}
