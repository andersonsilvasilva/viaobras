import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/feedback/Alert'
import { Modal } from '@/components/feedback/Modal'
import { FormField, TextArea, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api-error'
import { actionMeta, reasonRequired, suppliesApi, type PurchaseRequest, type RequestAction } from './api'
import { formatQuantity, parseQuantity } from './form'

interface Props {
  request: PurchaseRequest
  action: RequestAction
  onClose: () => void
  onDone: (message: string) => void
}

/** Confirmação de cada passo do fluxo: motivo, quantidades aprovadas (aprovação) e data (atendimento). */
export function ActionDialog({ request, action, onClose, onDone }: Props) {
  const meta = actionMeta[action]
  const items = request.items ?? []
  const [reason, setReason] = useState('')
  const [fulfilledOn, setFulfilledOn] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>(() => Object.fromEntries(items.map((i) => [i.id, formatQuantity(i.quantity)])))

  const parsed = items.map((item) => ({ item, value: parseQuantity(quantities[item.id] ?? '', true) }))
  const invalid = action === 'approve' ? parsed.filter(({ item, value }) => value === null || Number(value) > Number(item.quantity)) : []
  const partial = action === 'approve' && parsed.some(({ item, value }) => value !== null && Number(value) !== Number(item.quantity))
  const nothing = action === 'approve' && parsed.every(({ value }) => value !== null && Number(value) === 0)
  const mustExplain = partial || reasonRequired(action, request.status)
  const blocked = invalid.length > 0 || nothing || (mustExplain && reason.trim() === '')

  const run = useMutation({
    mutationFn: () =>
      suppliesApi.workflow(request.uuid, action, {
        reason: reason.trim() || null,
        ...(action === 'approve' && partial ? { items: parsed.map(({ item, value }) => ({ id: item.id, approved_quantity: value })) } : {}),
        ...(action === 'fulfill' && fulfilledOn ? { fulfilled_on: fulfilledOn } : {}),
      }),
    onSuccess: () => onDone(`${request.code}: ${meta.past.toLowerCase()}.`),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`${meta.label} — ${request.code}`}
      description={meta.help}
      size={action === 'approve' ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button variant={meta.destructive ? 'destructive' : 'default'} disabled={blocked || run.isPending} onClick={() => run.mutate()}>
            {run.isPending && <Loader2 className="size-4 animate-spin" />} {meta.label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {run.isError && <Alert tone="danger" title="Não foi possível concluir">{getErrorMessage(run.error)}</Alert>}

        {action === 'approve' && (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-40 flex-1">
                  <span className="font-medium">{item.description}</span>
                  <span className="text-muted-foreground block text-xs">pedido: {formatQuantity(item.quantity)} {item.unit_code}</span>
                </span>
                <TextInput
                  inputMode="decimal"
                  className="w-28 text-right"
                  aria-label={`Quantidade aprovada de ${item.description}`}
                  aria-invalid={invalid.some((i) => i.item.id === item.id) || undefined}
                  value={quantities[item.id] ?? ''}
                  onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                />
                <span className="text-muted-foreground w-10 text-xs">{item.unit_code}</span>
              </li>
            ))}
          </ul>
        )}
        {invalid.length > 0 && <p role="alert" className="text-destructive text-xs">A quantidade aprovada deve ficar entre zero e a quantidade pedida.</p>}
        {nothing && <p role="alert" className="text-destructive text-xs">Nenhum item aprovado: use “Recusar”.</p>}

        {action === 'fulfill' && (
          <FormField label="Data do atendimento" hint="Em branco = hoje. Não pode ser antes do envio nem no futuro.">
            <TextInput type="date" value={fulfilledOn} onChange={(e) => setFulfilledOn(e.target.value)} />
          </FormField>
        )}

        {action !== 'submit' && (
          <FormField label={mustExplain ? 'Motivo' : 'Observação'} required={mustExplain} hint={mustExplain ? undefined : 'Opcional'}>
            <TextArea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        )}
      </div>
    </Modal>
  )
}
