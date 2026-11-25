import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '@/app/providers/ToastProvider'
import { Panel } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/indicators'
import { Alert } from '@/components/feedback/Alert'
import { ConfirmDialog } from '@/components/feedback/Modal'
import { ErrorState, LoadingState } from '@/components/feedback/states'
import { Button } from '@/components/ui/button'
import { AttachmentsPanel } from '@/features/contracts/AttachmentsPanel'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateOrDash } from '@/utils/format'
import { ActionDialog } from './ActionDialog'
import { actionMeta, priorityMeta, statusMeta, suppliesApi, type RequestAction } from './api'
import { formatQuantity } from './form'
import { RequestFormModal } from './RequestFormModal'

const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Detalhe da solicitação: dados, itens (pedido × aprovado), anexos, histórico e as ações que a API permite. */
export function RequestDetailPage() {
  const { uuid = '' } = useParams()
  const { notify } = useToast()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [action, setAction] = useState<RequestAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const query = useQuery({ queryKey: ['purchase-requests', 'detail', uuid], queryFn: () => suppliesApi.get(uuid) })
  const refresh = () => client.invalidateQueries({ queryKey: ['purchase-requests'] })

  const remove = useMutation({
    mutationFn: () => suppliesApi.remove(uuid),
    onSuccess: () => {
      notify('success', 'Rascunho excluído.')
      // a lista guardada ainda tem o rascunho: descartar, para ele não reaparecer enquanto a nova é buscada
      // não invalidar o detalhe: ele ainda está na tela e seria buscado de novo (404)
      client.removeQueries({ queryKey: ['purchase-requests', 'list'] })
      client.invalidateQueries({ queryKey: ['purchase-requests', 'summary'] })
      navigate('/suprimentos', { replace: true })
    },
    onError: (e) => notify('error', 'Não foi possível excluir', getErrorMessage(e)),
  })

  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  const request = query.data
  const items = request.items ?? []
  const history = request.history ?? []
  const abilities = request.abilities ?? { edit: false, delete: false, attach: false, actions: [] }
  const decided = items.some((i) => i.approved_quantity !== null)
  // devolvida para ajuste: mostra o motivo no topo até ser reenviada
  const last = history.at(-1)
  const returned = request.status === 'draft' && last?.action === 'send_back' ? last : null

  return (
    <div>
      <Link to="/suprimentos" className="text-muted-foreground hover:text-primary mb-2 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Suprimentos
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{request.code}</h1>
          {request.project && (
            <Link to={`/obras/${request.project.uuid}?aba=requisicoes`} className="text-muted-foreground hover:text-primary text-sm">
              {request.project.code} — {request.project.name}
            </Link>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge tone={statusMeta[request.status].tone}>{statusMeta[request.status].label}</StatusBadge>
            <StatusBadge tone={priorityMeta[request.priority].tone}>Prioridade {priorityMeta[request.priority].label.toLowerCase()}</StatusBadge>
            {request.late && <StatusBadge tone="danger">Atrasada</StatusBadge>}
            {request.approved_by_requester && <StatusBadge tone="warning">Aprovada por quem solicitou</StatusBadge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {abilities.actions.map((a) => (
            <Button key={a} size="lg" variant={a === 'approve' || a === 'submit' || a === 'fulfill' ? 'default' : 'outline'} onClick={() => setAction(a)}>
              {actionMeta[a].label}
            </Button>
          ))}
          {abilities.edit && (
            <Button size="lg" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
          {abilities.delete && (
            <Button size="lg" variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {returned && (
        <Alert tone="warning" title={`Devolvida para ajuste por ${returned.by?.name ?? 'quem aprova'}`} className="mb-4">
          {returned.reason}
        </Alert>
      )}

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Solicitante" value={request.requester?.name ?? '—'} hint={`criada em ${dateTime(request.created_at)}`} />
        <Info label="Necessário até" value={formatDateOrDash(request.needed_by)} />
        <Info
          label={request.status === 'rejected' ? 'Recusada por' : 'Aprovada por'}
          value={request.decided_by?.name ?? '—'}
          hint={request.decided_at ? dateTime(request.decided_at) : undefined}
        />
        <Info label="Atendida em" value={formatDateOrDash(request.fulfilled_on)} />
      </dl>

      {request.notes && (
        <Panel title="Observações" className="mb-4">
          <p className="p-4 text-sm whitespace-pre-line">{request.notes}</p>
        </Panel>
      )}

      <Panel title={`Itens (${items.length})`} className="mb-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Nenhum item. Edite o rascunho para incluir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <caption className="sr-only">Itens da solicitação</caption>
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b text-left text-xs uppercase">
                  <th scope="col" className="px-3 py-2.5 font-medium">Material</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Un.</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Pedido</th>
                  {decided && <th scope="col" className="px-3 py-2.5 text-right font-medium">Aprovado</th>}
                  <th scope="col" className="px-3 py-2.5 font-medium">Atividade</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const reduced = i.approved_quantity !== null && Number(i.approved_quantity) < Number(i.quantity)
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="max-w-96 px-3 py-2.5 whitespace-normal">
                        <span className="font-medium">{i.description}</span>
                        <span className="text-muted-foreground block text-xs">
                          {i.resource_uuid ? 'Catálogo' : 'Digitado'}{i.notes ? ` · ${i.notes}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{i.unit_code}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatQuantity(i.quantity)}</td>
                      {decided && (
                        <td className={`px-3 py-2.5 text-right tabular-nums ${reduced ? 'text-destructive font-semibold' : ''}`}>
                          {i.approved_quantity === null ? '—' : formatQuantity(i.approved_quantity)}
                        </td>
                      )}
                      <td className="text-muted-foreground max-w-72 truncate px-3 py-2.5">{i.task ? `${i.task.wbs} · ${i.task.name}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Anexos e fotos">
          <div className="p-4">
            <AttachmentsPanel type="purchase_request" linkKey={request.uuid} canEdit={abilities.attach} suggestedTitle={`Anexo ${request.code}`} />
          </div>
        </Panel>
        <Panel title="Histórico">
          {history.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">Rascunho: o histórico começa no envio.</p>
          ) : (
            <ol className="divide-y">
              {history.map((h, index) => (
                <li key={`${h.at}-${index}`} className="px-4 py-2.5 text-sm">
                  <p className="font-medium">{actionMeta[h.action].past}</p>
                  <p className="text-muted-foreground text-xs">{h.by?.name ?? '—'} · {dateTime(h.at)}</p>
                  {h.reason && <p className="mt-1 whitespace-pre-line">{h.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {action && (
        <ActionDialog
          request={request}
          action={action}
          onClose={() => setAction(null)}
          onDone={(message) => {
            notify('success', message)
            setAction(null)
            refresh()
          }}
        />
      )}
      {editing && (
        <RequestFormModal
          request={request}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title={`Excluir o rascunho ${request.code}?`}
        description="O rascunho sai da lista. O número não é reaproveitado."
        confirmLabel="Excluir"
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false)
          remove.mutate()
        }}
      />
    </div>
  )
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  )
}
