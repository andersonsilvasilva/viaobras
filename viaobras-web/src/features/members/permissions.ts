/**
 * As permissões em português, agrupadas por módulo (nunca mostrar os códigos). A lista precisa cobrir todo o
 * catálogo do servidor (PermissionCatalog.php): members.test.ts confere.
 */
export interface PermissionItem {
  name: string
  label: string
  /** Explicação para o que não é óbvio. */
  hint?: string
}

export interface PermissionGroup {
  title: string
  items: PermissionItem[]
}

const pair = (module: string, view = 'Consultar', manage = 'Criar e editar'): PermissionItem[] => [
  { name: `${module}.view`, label: view },
  { name: `${module}.manage`, label: manage },
]

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Obras',
    items: [
      { name: 'projects.view', label: 'Consultar', hint: 'Só as obras em que a pessoa receber acesso.' },
      { name: 'projects.manage', label: 'Criar e editar', hint: 'Vale para TODAS as obras, mesmo sem acesso liberado em cada uma.' },
    ],
  },
  {
    title: 'Orçamentos',
    items: [...pair('budgets'), { name: 'budgets.approve', label: 'Aprovar', hint: 'Não depende de poder editar.' }],
  },
  { title: 'Planejamento da obra', items: pair('schedules') },
  { title: 'Contratos', items: pair('contracts') },
  {
    title: 'Suprimentos',
    items: [
      { name: 'supplies.view', label: 'Consultar' },
      { name: 'supplies.request', label: 'Solicitar materiais' },
      { name: 'supplies.approve', label: 'Aprovar e atender solicitações' },
    ],
  },
  { title: 'Insumos e composições próprias', items: pair('resources') },
  { title: 'Bases de referência (SINAPI)', items: [{ name: 'references.view', label: 'Consultar' }] },
  { title: 'Empresas', items: pair('companies') },
  { title: 'Clientes', items: pair('customers') },
  { title: 'Fornecedores', items: pair('suppliers') },
  { title: 'Unidades de medida', items: pair('units') },
  { title: 'Documentos', items: pair('documents') },
  { title: 'Funcionários, cargos e setores', items: pair('employees', 'Consultar (dados pessoais)') },
  { title: 'Equipamentos', items: pair('equipment') },
  {
    title: 'Pessoas e acesso',
    items: [
      { name: 'members.view', label: 'Ver os membros' },
      { name: 'members.invite', label: 'Convidar pessoas' },
      { name: 'members.manage', label: 'Suspender, reativar e remover membros' },
      { name: 'roles.view', label: 'Ver os papéis' },
      { name: 'roles.manage', label: 'Criar papéis e mudar os papéis das pessoas', hint: 'Dá poder sobre o acesso dos outros.' },
    ],
  },
  {
    title: 'Organização',
    items: [
      { name: 'tenant.view', label: 'Ver os dados da organização' },
      { name: 'tenant.update', label: 'Alterar os dados da organização' },
      { name: 'settings.view', label: 'Ver as configurações' },
      { name: 'settings.manage', label: 'Alterar as configurações' },
      { name: 'audit.view', label: 'Ver o histórico de auditoria' },
      { name: 'tokens.manage', label: 'Gerenciar chaves de integração' },
    ],
  },
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.name))

/** O que uma permissão precisa ter junto para fazer sentido (marcar uma marca as outras). */
export function requiredBy(name: string): string[] {
  const [module = '', action = ''] = name.split('.')
  const required: string[] = []
  const view = `${module}.view`
  if (action !== 'view' && ALL_PERMISSIONS.includes(view)) required.push(view)
  if (name === 'tenant.update') required.push('tenant.view')
  if (name === 'members.invite' || name === 'roles.manage') required.push('members.view', 'roles.view') // as telas precisam das duas listas
  return [...new Set(required)]
}

/** Marca ou desmarca mantendo a coerência: marcar leva o que é exigido; desmarcar tira o que dependia. */
export function togglePermission(selected: readonly string[], name: string, checked: boolean): string[] {
  const set = new Set(selected)
  if (checked) {
    set.add(name)
    requiredBy(name).forEach((p) => set.add(p))
  } else {
    set.delete(name)
    for (const other of [...set]) if (requiredBy(other).includes(name)) set.delete(other)
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p))
}

/** Resumo legível: só os grupos em que há alguma permissão. */
export function describePermissions(permissions: readonly string[]): { title: string; labels: string[] }[] {
  const set = new Set(permissions)
  return PERMISSION_GROUPS.map((g) => ({ title: g.title, labels: g.items.filter((i) => set.has(i.name)).map((i) => i.label) })).filter(
    (g) => g.labels.length > 0,
  )
}

/** Consulta do dia a dia: igual ao papel "Membro" do servidor. */
const CONSULTATION = [
  'tenant.view', 'members.view', 'roles.view', 'settings.view', 'units.view', 'companies.view', 'customers.view', 'suppliers.view',
  'documents.view', 'equipment.view', 'projects.view', 'references.view', 'budgets.view', 'resources.view', 'contracts.view',
  'schedules.view', 'supplies.view',
]

/** Pontos de partida (D-P136): nada é criado sozinho; a lista é conferida na tela antes de salvar. */
export const ROLE_TEMPLATES: { id: string; name: string; description: string; permissions: string[] }[] = [
  { id: 'budgeting', name: 'Orçamentista', description: 'Consulta, mais criar e editar orçamentos.', permissions: [...CONSULTATION, 'budgets.manage'] },
  {
    id: 'engineering',
    name: 'Engenharia de obra',
    description: 'Consulta, mais orçamentos, planejamento e solicitação de materiais.',
    permissions: [...CONSULTATION, 'budgets.manage', 'schedules.manage', 'supplies.request'],
  },
  { id: 'purchasing', name: 'Compras', description: 'Consulta, mais aprovar e atender solicitações.', permissions: [...CONSULTATION, 'supplies.approve'] },
]
