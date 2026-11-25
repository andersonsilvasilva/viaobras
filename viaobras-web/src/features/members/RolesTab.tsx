import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { DataTable, Panel, type Column } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/indicators'
import { Alert } from '@/components/feedback/Alert'
import { ConfirmDialog, Modal } from '@/components/feedback/Modal'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { FormField, SelectInput, TextInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { roleHelp, roleLabel, rolesApi, type Role } from './api'
import { ROLES_KEY } from './keys'
import { describePermissions, PERMISSION_GROUPS, ROLE_TEMPLATES, togglePermission } from './permissions'

type Dialog = { mode: 'create' } | { mode: 'duplicate' | 'edit' | 'view'; role: Role }

export function RolesTab() {
  const { can } = useAuth()
  const { notify } = useToast()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ROLES_KEY, queryFn: rolesApi.list })
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [removing, setRemoving] = useState<Role | null>(null)
  const manages = can('roles.manage')
  const refresh = () => client.invalidateQueries({ queryKey: ['roles'] })

  const remove = useMutation({
    mutationFn: (role: Role) => rolesApi.remove(role.id),
    onSuccess: () => notify('success', 'Papel excluído.'),
    onError: (e) => notify('error', 'Não foi possível excluir', getErrorMessage(e)),
    onSettled: refresh,
  })

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Papel',
      sortValue: (r) => roleLabel(r.name).toLocaleLowerCase('pt-BR'),
      cell: (r) => (
        <span className="block">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {roleLabel(r.name)}
            {r.is_system && <StatusBadge tone="neutral">Do sistema</StatusBadge>}
          </span>
          <span className="text-muted-foreground block text-xs">{roleHelp(r.name)}</span>
        </span>
      ),
    },
    { key: 'members', header: 'Pessoas', align: 'right', cell: (r) => r.members_count ?? 0, sortValue: (r) => r.members_count ?? 0 },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (r) => {
        const button = (label: string, onClick: () => void, disabled = false, title?: string) => (
          <Button variant="ghost" size="sm" disabled={disabled} title={title} onClick={onClick} aria-label={`${label}: ${roleLabel(r.name)}`}>
            {label}
          </Button>
        )
        const used = (r.members_count ?? 0) > 0
        return (
          <span className="inline-flex flex-wrap justify-end gap-1">
            {button('Ver permissões', () => setDialog({ mode: 'view', role: r }))}
            {manages && !r.is_system && button('Editar', () => setDialog({ mode: 'edit', role: r }))}
            {manages && button('Duplicar', () => setDialog({ mode: 'duplicate', role: r }))}
            {manages && !r.is_system && button('Excluir', () => setRemoving(r), used || remove.isPending, used ? 'Há pessoas com este papel' : undefined)}
          </span>
        )
      },
    },
  ]

  return (
    <>
      {manages && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus className="size-4" /> Novo papel
          </Button>
        </div>
      )}
      <QueryBoundary query={query}>
        {(rows) => (
          <Panel>
            <DataTable caption="Papéis da organização" columns={columns} rows={rows} rowKey={(r) => String(r.id)} pageSize={20} />
          </Panel>
        )}
      </QueryBoundary>

      {dialog && (
        <RoleDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null)
            notify('success', message)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Excluir o papel ${removing ? roleLabel(removing.name) : ''}?`}
        description="Só é possível excluir um papel que ninguém usa, nem em convites."
        confirmLabel="Excluir"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove.mutate(removing)
          setRemoving(null)
        }}
      />
    </>
  )
}

const nameError = (name: string) => {
  const value = name.trim()
  if (!value) return 'Informe o nome do papel.'
  if (value.length > 100) return 'Use até 100 caracteres.'
  return /^[\p{L}\p{N} _.-]+$/u.test(value) ? null : 'Use letras, números, espaço, ponto, hífen ou sublinhado.'
}

function RoleDialog({ dialog, onClose, onDone }: { dialog: Dialog; onClose: () => void; onDone: (message: string) => void }) {
  const { can } = useAuth()
  const source = dialog.mode === 'create' ? null : dialog.role
  const readOnly = dialog.mode === 'view'
  const [name, setName] = useState(dialog.mode === 'edit' ? dialog.role.name : dialog.mode === 'duplicate' ? `${roleLabel(dialog.role.name).replace(/[()]/g, '')} cópia` : '')
  const [selected, setSelected] = useState<string[]>(source?.permissions ?? [])
  const [touched, setTouched] = useState(false)
  // ninguém concede o que não tem: ao salvar, o servidor exige todas as permissões marcadas
  const missing = selected.filter((p) => !can(p))
  const invalid = nameError(name)

  const save = useMutation({
    mutationFn: () => (dialog.mode === 'edit' ? rolesApi.update(dialog.role.id, name.trim(), selected) : rolesApi.create(name.trim(), selected)),
    onSuccess: () => onDone(dialog.mode === 'edit' ? 'Papel atualizado.' : 'Papel criado. Agora atribua-o na aba Pessoas.'),
  })
  const apiMessage = save.error instanceof ApiError ? Object.values(save.error.details ?? {}).flat()[0] : undefined

  const applyTemplate = (id: string) => {
    const template = ROLE_TEMPLATES.find((t) => t.id === id)
    if (!template) return
    setName(template.name)
    setSelected(template.permissions.filter(can))
  }

  if (readOnly) {
    return (
      <Modal open onClose={onClose} title={`Permissões: ${roleLabel(source!.name)}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {describePermissions(selected).map((g) => (
            <div key={g.title}>
              <dt className="font-medium">{g.title}</dt>
              <dd className="text-muted-foreground">{g.labels.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={dialog.mode === 'edit' ? 'Editar papel' : 'Novo papel'}
      description="Marque o que quem tiver este papel poderá fazer."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={save.isPending || missing.length > 0 || selected.length === 0}
            onClick={() => {
              setTouched(true)
              if (!invalid) save.mutate()
            }}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />} {dialog.mode === 'edit' ? 'Salvar papel' : 'Criar papel'}
          </Button>
        </>
      }
    >
      {save.isError && <Alert tone="danger" title="O papel não foi salvo" className="mb-3">{apiMessage ?? getErrorMessage(save.error)}</Alert>}
      {missing.length > 0 && (
        <Alert tone="warning" className="mb-3">Este papel tem permissões que você não possui. Só quem as possui pode alterá-lo.</Alert>
      )}
      {dialog.mode === 'edit' && (dialog.role.members_count ?? 0) > 0 && (
        <Alert tone="info" className="mb-3">A mudança vale para as {dialog.role.members_count} pessoa(s) com este papel.</Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {dialog.mode === 'create' && (
          <FormField label="Começar de um modelo" hint="Opcional. Confira as permissões antes de salvar.">
            <SelectInput defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Em branco</option>
              {ROLE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}: {t.description}</option>
              ))}
            </SelectInput>
          </FormField>
        )}
        <FormField label="Nome do papel" required error={touched ? (invalid ?? undefined) : undefined}>
          <TextInput value={name} maxLength={100} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.title} className="rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">{group.title}</legend>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <label key={item.name} className="flex items-start gap-2 text-sm has-disabled:opacity-60">
                  <input
                    type="checkbox"
                    className="accent-primary mt-0.5 size-4 shrink-0"
                    checked={selected.includes(item.name)}
                    disabled={!can(item.name) && !selected.includes(item.name)}
                    onChange={(e) => setSelected((s) => togglePermission(s, item.name, e.target.checked))}
                  />
                  <span>
                    {item.label}
                    {item.hint && <span className="text-muted-foreground block text-xs">{item.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  )
}
