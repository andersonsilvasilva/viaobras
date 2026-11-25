import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '@/app/providers/ToastProvider'
import { DataTable, Panel, type Column } from '@/components/data-display/DataTable'
import { StatusBadge, type StatusTone } from '@/components/data-display/indicators'
import { Alert } from '@/components/feedback/Alert'
import { ConfirmDialog, Modal } from '@/components/feedback/Modal'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-error'
import { membersApi, roleHelp, roleLabel, rolesApi, type Member, type MemberStatus, type Role } from './api'
import { MEMBERS_KEY, ROLES_KEY } from './keys'
import { describePermissions } from './permissions'
import { canHandleRole, effectivePermissions, isActiveAdmin, memberActions, roleChanges, type Actor } from './rules'

const status: Record<MemberStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Ativo', tone: 'success' },
  suspended: { label: 'Suspenso', tone: 'warning' },
  invited: { label: 'Convidado', tone: 'neutral' },
  removed: { label: 'Removido', tone: 'neutral' },
}

type Action = 'suspend' | 'reactivate' | 'remove'

const actionText: Record<Action, { title: (n: string) => string; description: string; confirm: string; done: string; destructive?: boolean }> = {
  suspend: {
    title: (n) => `Suspender ${n}?`,
    description: 'A pessoa perde o acesso à organização até ser reativada. Os papéis são mantidos.',
    confirm: 'Suspender',
    done: 'Acesso suspenso.',
    destructive: true,
  },
  reactivate: {
    title: (n) => `Reativar ${n}?`,
    description: 'A pessoa volta a acessar a organização com os papéis que tinha.',
    confirm: 'Reativar',
    done: 'Acesso reativado.',
  },
  remove: {
    title: (n) => `Remover ${n} da organização?`,
    description: 'O vínculo é encerrado e todos os papéis são retirados. Para a pessoa voltar, será preciso um novo convite.',
    confirm: 'Remover',
    done: 'Pessoa removida.',
    destructive: true,
  },
}

export function PeopleTab() {
  const { me, can } = useAuth()
  const { notify } = useToast()
  const client = useQueryClient()
  const members = useQuery({ queryKey: MEMBERS_KEY, queryFn: membersApi.list })
  const roles = useQuery({ queryKey: ROLES_KEY, queryFn: rolesApi.list, enabled: can('roles.view') })
  const [details, setDetails] = useState<Member | null>(null)
  const [editing, setEditing] = useState<Member | null>(null)
  const [confirm, setConfirm] = useState<{ action: Action; member: Member } | null>(null)

  const actor: Actor = { uuid: me?.user.uuid ?? '', can, isAdmin: isActiveAdmin(members.data ?? [], me?.user.uuid ?? '') }

  const act = useMutation({
    mutationFn: ({ action, member }: { action: Action; member: Member }) => membersApi[action](member.id),
    onSuccess: (_, { action }) => notify('success', actionText[action].done),
    onError: (e) => notify('error', 'Não foi possível concluir', getErrorMessage(e)),
    onSettled: () => client.invalidateQueries({ queryKey: ['members'] }),
  })

  const columns: Column<Member>[] = [
    {
      key: 'person',
      header: 'Pessoa',
      sortValue: (m) => m.user.name.toLocaleLowerCase('pt-BR'),
      cell: (m) => (
        <span className="block">
          <span className="block font-medium">
            {m.user.name}
            {m.user.uuid === actor.uuid && <span className="text-muted-foreground font-normal"> (você)</span>}
          </span>
          <span className="text-muted-foreground block text-xs">{m.user.email}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Situação', cell: (m) => <StatusBadge tone={status[m.status].tone}>{status[m.status].label}</StatusBadge> },
    {
      key: 'roles',
      header: 'Papéis',
      cell: (m) =>
        m.roles.length ? (
          <span className="flex flex-wrap gap-1">
            {m.roles.map((r) => (
              <StatusBadge key={r.id} tone="primary">{roleLabel(r.name)}</StatusBadge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">Nenhum</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (m) => {
        const allowed = memberActions(m, actor)
        const button = (label: string, onClick: () => void, variant: 'outline' | 'ghost' = 'ghost') => (
          <Button variant={variant} size="sm" disabled={act.isPending} onClick={onClick} aria-label={`${label}: ${m.user.name}`}>
            {label}
          </Button>
        )
        return (
          <span className="inline-flex flex-wrap justify-end gap-1">
            {button('Ver acesso', () => setDetails(m))}
            {allowed.changeRoles && button('Alterar papéis', () => setEditing(m), 'outline')}
            {allowed.suspend && button('Suspender', () => setConfirm({ action: 'suspend', member: m }))}
            {allowed.reactivate && button('Reativar', () => setConfirm({ action: 'reactivate', member: m }), 'outline')}
            {allowed.remove && button('Remover', () => setConfirm({ action: 'remove', member: m }))}
            {allowed.blocked && <span className="text-muted-foreground block w-full text-xs">{allowed.blocked}</span>}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <QueryBoundary query={members}>
        {(rows) => (
          <Panel>
            <DataTable caption="Pessoas da organização" columns={columns} rows={rows} rowKey={(m) => String(m.id)} pageSize={15}
              emptyTitle="Ninguém ainda" emptyDescription="Convide pessoas na tela Convites." />
          </Panel>
        )}
      </QueryBoundary>

      {details && <AccessDialog member={details} roles={roles.data ?? []} showPermissions={can('roles.view')} onClose={() => setDetails(null)} />}
      {editing && roles.data && (
        <RolesDialog
          member={editing}
          roles={roles.data}
          actor={actor}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            client.invalidateQueries({ queryKey: ['members'] })
            client.invalidateQueries({ queryKey: ['roles'] })
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? actionText[confirm.action].title(confirm.member.user.name) : ''}
        description={confirm ? actionText[confirm.action].description : ''}
        confirmLabel={confirm ? actionText[confirm.action].confirm : 'Confirmar'}
        destructive={confirm ? actionText[confirm.action].destructive : false}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) act.mutate(confirm)
          setConfirm(null)
        }}
      />
    </>
  )
}

const levels = { view: 'Consulta', edit: 'Edição', manage: 'Gerência' } as const

/** O que a pessoa pode fazer (soma dos papéis) e em quais obras (D-P131 e D-P137), só para leitura. */
function AccessDialog({ member, roles, showPermissions, onClose }: { member: Member; roles: Role[]; showPermissions: boolean; onClose: () => void }) {
  const projects = useQuery({ queryKey: ['members', 'projects', member.id], queryFn: () => membersApi.projects(member.id) })
  const summary = describePermissions(effectivePermissions(member, roles))

  return (
    <Modal open onClose={onClose} title={`Acesso de ${member.user.name}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}>
      {showPermissions && (
        <section aria-label="O que pode fazer" className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">O que pode fazer</h3>
          {summary.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nada: a pessoa não tem nenhum papel.</p>
          ) : (
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {summary.map((g) => (
                <div key={g.title}>
                  <dt className="font-medium">{g.title}</dt>
                  <dd className="text-muted-foreground">{g.labels.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          )}
          {member.status !== 'active' && <Alert tone="warning" className="mt-3">Com o vínculo {status[member.status].label.toLowerCase()}, nada disso está valendo.</Alert>}
        </section>
      )}
      <section aria-label="Obras">
        <h3 className="mb-2 text-sm font-semibold">Em quais obras</h3>
        <QueryBoundary query={projects}>
          {(data) => (
            <>
              {data.all && <p className="text-sm">Todas as obras, porque o papel permite criar e editar obras.</p>}
              {!data.all && data.projects.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma obra liberada entre as que você pode ver.</p>
              )}
              {!data.all && data.projects.length > 0 && (
                <ul className="divide-y rounded-lg border">
                  {data.projects.map((p) => (
                    <li key={p.uuid} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <Link to={`/obras/${p.uuid}`} className="text-primary hover:underline">{p.code} · {p.name}</Link>
                      <StatusBadge tone="primary">{levels[p.access_level]}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground mt-2 text-xs">Para liberar ou retirar uma obra, abra a obra e use a aba Acesso.</p>
            </>
          )}
        </QueryBoundary>
      </section>
    </Modal>
  )
}

function RolesDialog({ member, roles, actor, onClose, onDone }: { member: Member; roles: Role[]; actor: Actor; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast()
  const current = member.roles.map((r) => r.id)
  const [selected, setSelected] = useState<number[]>(current)
  const changes = roleChanges(current, selected)
  const unchanged = changes.assign.length === 0 && changes.revoke.length === 0

  const save = useMutation({
    mutationFn: async () => {
      for (const id of changes.assign) await membersApi.assignRole(member.id, id)
      for (const id of changes.revoke) await membersApi.revokeRole(member.id, id)
    },
    onSuccess: () => {
      notify('success', 'Papéis atualizados.', 'A pessoa vê a mudança ao recarregar a página.')
      onDone()
    },
  })

  return (
    <Modal
      open
      onClose={() => (save.isError ? onDone() : onClose())}
      title={`Papéis de ${member.user.name}`}
      description="Valem somadas as permissões de todos os papéis marcados."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => (save.isError ? onDone() : onClose())}>Cancelar</Button>
          <Button disabled={unchanged || selected.length === 0 || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar papéis
          </Button>
        </>
      }
    >
      {save.isError && (
        <Alert tone="danger" title="Nem tudo foi salvo" className="mb-3">
          {getErrorMessage(save.error)} Feche e confira os papéis atuais.
        </Alert>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Papéis</legend>
        {roles.map((role) => {
          const allowed = canHandleRole(role, actor)
          return (
            <label key={role.id} className="has-checked:border-primary flex items-start gap-3 rounded-lg border p-3 text-sm has-disabled:opacity-60">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={selected.includes(role.id)}
                disabled={!allowed || save.isPending}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, role.id] : s.filter((id) => id !== role.id)))}
              />
              <span>
                <span className="block font-medium">{roleLabel(role.name)}</span>
                <span className="text-muted-foreground block">{allowed ? roleHelp(role.name) : 'Tem permissões que você não possui.'}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      {selected.length === 0 && <p className="text-destructive mt-2 text-sm">Deixe pelo menos um papel. Para tirar todo o acesso, use Suspender ou Remover.</p>}
    </Modal>
  )
}
