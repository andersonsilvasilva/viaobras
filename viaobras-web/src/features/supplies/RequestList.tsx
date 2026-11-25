import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Clock, Paperclip, PackageCheck, Plus, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Panel, TablePagination, TableToolbar } from '@/components/data-display/DataTable'
import { StatCard, StatusBadge } from '@/components/data-display/indicators'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/states'
import { FormField, SearchInput, SelectInput, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { projectsApi } from '@/features/projects/api'
import { formatDateOrDash } from '@/utils/format'
import { priorityMeta, statusMeta, suppliesApi } from './api'
import { RequestFormModal } from './RequestFormModal'

const PER_PAGE = 25
const noFilters = { q: '', status: '', priority: '', project_uuid: '', requester_uuid: '', from: '', to: '', late: false }

/** Lista de solicitações com indicadores e filtros: no menu Suprimentos (todas as obras) e na aba Requisições da obra. */
export function RequestList({ projectUuid, canCreate }: { projectUuid?: string; canCreate: boolean }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [filters, setFilters] = useState(noFilters)
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const change = (patch: Partial<typeof noFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.q === term.trim() ? f : { ...f, q: term.trim() }))
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [term])

  const project = projectUuid ?? filters.project_uuid
  const query = useQuery({
    queryKey: ['purchase-requests', 'list', projectUuid ?? null, filters, page],
    queryFn: () => suppliesApi.list({ ...filters, late: filters.late ? 1 : undefined, project_uuid: project, page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({ queryKey: ['purchase-requests', 'summary', project], queryFn: () => suppliesApi.summary(project || undefined) })
  const projects = useQuery({ queryKey: ['projects', 'options', 'supplies'], queryFn: () => projectsApi.list({ per_page: 100 }), enabled: !projectUuid })

  const rows = query.data?.data ?? []
  const filtered = term !== '' || JSON.stringify({ ...filters, q: '' }) !== JSON.stringify(noFilters)
  const open = (uuid: string) => navigate(`/suprimentos/${uuid}`)
  const count = (n: number | undefined) => (n === undefined ? '—' : String(n))

  return (
    <div className="flex flex-col gap-4">
      {canCreate && can('supplies.request') && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nova solicitação
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aguardando aprovação" value={count(summary.data?.pending)} icon={Clock} />
        <StatCard label="Aprovadas, a atender" value={count(summary.data?.approved)} icon={PackageCheck} />
        <StatCard label="Atrasadas" value={count(summary.data?.late)} icon={AlarmClock} />
        <StatCard label="Urgentes em aberto" value={count(summary.data?.urgent)} icon={TriangleAlert} />
      </div>

      <Panel>
        <TableToolbar>
          <SearchInput className="w-full sm:w-64" placeholder="Número ou material…" aria-label="Pesquisar por número ou material" value={term} onChange={(e) => setTerm(e.target.value)} />
          {!projectUuid && (
            <FormField label="Obra" className="w-full sm:w-52">
              <SelectInput value={filters.project_uuid} onChange={(e) => change({ project_uuid: e.target.value, requester_uuid: '' })}>
                <option value="">Todas</option>
                {(projects.data?.data ?? []).map((p) => <option key={p.uuid} value={p.uuid}>{p.code} — {p.name}</option>)}
              </SelectInput>
            </FormField>
          )}
          <FormField label="Situação" className="w-full sm:w-48">
            <SelectInput value={filters.status} onChange={(e) => change({ status: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(statusMeta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Prioridade" className="w-full sm:w-32">
            <SelectInput value={filters.priority} onChange={(e) => change({ priority: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(priorityMeta).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Solicitante" className="w-full sm:w-44">
            <SelectInput value={filters.requester_uuid} onChange={(e) => change({ requester_uuid: e.target.value })}>
              <option value="">Todos</option>
              {(summary.data?.requesters ?? []).map((r) => <option key={r.uuid} value={r.uuid}>{r.name}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Criada de" className="w-36">
            <TextInput type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => change({ from: e.target.value })} />
          </FormField>
          <FormField label="até" className="w-36">
            <TextInput type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => change({ to: e.target.value })} />
          </FormField>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary size-4" checked={filters.late} onChange={(e) => change({ late: e.target.checked })} />
            Só atrasadas
          </label>
          {filtered && (
            <Button variant="ghost" onClick={() => { setTerm(''); setFilters(noFilters); setPage(1) }}>Limpar filtros</Button>
          )}
        </TableToolbar>

        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? 'Nenhuma solicitação com estes filtros' : 'Nenhuma solicitação ainda'}
            description={filtered ? 'Ajuste ou limpe os filtros.' : 'Crie a primeira solicitação de materiais da obra.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Solicitações de materiais</caption>
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground border-b text-left text-xs uppercase">
                    <th scope="col" className="px-3 py-2.5 font-medium">Número</th>
                    {!projectUuid && <th scope="col" className="px-3 py-2.5 font-medium">Obra</th>}
                    <th scope="col" className="px-3 py-2.5 font-medium">Solicitante</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Criada em</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Necessário até</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Itens</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Prioridade</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.uuid} className="hover:bg-primary-soft/50 cursor-pointer border-b last:border-0" onClick={() => open(r.uuid)}>
                      <td className="px-3 py-2.5 font-medium">
                        <Link to={`/suprimentos/${r.uuid}`} className="hover:text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>{r.code}</Link>
                        {!!r.documents_count && (
                          <span className="text-muted-foreground ml-2 inline-flex items-center gap-0.5 text-xs font-normal" title={`${r.documents_count} anexo(s)`}>
                            <Paperclip className="size-3" aria-hidden /> {r.documents_count}
                          </span>
                        )}
                      </td>
                      {!projectUuid && <td className="max-w-64 truncate px-3 py-2.5">{r.project?.name}</td>}
                      <td className="px-3 py-2.5">{r.requester?.name}</td>
                      <td className="px-3 py-2.5 tabular-nums">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDateOrDash(r.needed_by)}
                        {r.late && <span className="ml-2"><StatusBadge tone="danger">Atrasada</StatusBadge></span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.items_count}</td>
                      <td className="px-3 py-2.5"><StatusBadge tone={priorityMeta[r.priority].tone}>{priorityMeta[r.priority].label}</StatusBadge></td>
                      <td className="px-3 py-2.5"><StatusBadge tone={statusMeta[r.status].tone}>{statusMeta[r.status].label}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination page={query.data.meta.current_page} totalPages={query.data.meta.last_page} total={query.data.meta.total} pageSize={PER_PAGE} onPageChange={setPage} />
          </>
        )}
      </Panel>

      {creating && (
        <RequestFormModal
          projectUuid={projectUuid}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false)
            client.invalidateQueries({ queryKey: ['purchase-requests'] })
            open(saved.uuid)
          }}
        />
      )}
    </div>
  )
}
