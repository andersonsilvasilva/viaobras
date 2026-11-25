import { describe, expect, it } from 'vitest'
import catalog from '../../../../viaobras-api/app/Modules/Access/Services/PermissionCatalog.php?raw'
import { filterNavigation, navigation } from '@/app/navigation'
import type { Member, Role } from './api'
import { ALL_PERMISSIONS, describePermissions, requiredBy, ROLE_TEMPLATES, togglePermission } from './permissions'
import { canHandleRole, effectivePermissions, isActiveAdmin, memberActions, roleChanges, type Actor } from './rules'

/** Permissões declaradas no servidor: o bloco PERMISSIONS do catálogo. */
const serverPermissions = [...catalog.slice(catalog.indexOf('PERMISSIONS = ['), catalog.indexOf('];', catalog.indexOf('PERMISSIONS = ['))).matchAll(/'([a-z]+\.[a-z]+)' =>/g)].map((m) => m[1]!)
const memberRole = [...catalog.slice(catalog.indexOf("'member' => ["), catalog.indexOf("'viewer' =>")).matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]!)

describe('membros — permissões em português', () => {
  it('a tela cobre exatamente o catálogo do servidor, sem repetir', () => {
    expect(serverPermissions.length).toBeGreaterThan(30)
    expect([...ALL_PERMISSIONS].sort()).toEqual([...serverPermissions].sort())
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })

  it('marcar editar ou aprovar marca também consultar', () => {
    expect(togglePermission([], 'budgets.manage', true).sort()).toEqual(['budgets.manage', 'budgets.view'])
    expect(togglePermission([], 'budgets.approve', true).sort()).toEqual(['budgets.approve', 'budgets.view'])
    expect(togglePermission([], 'roles.manage', true).sort()).toEqual(['members.view', 'roles.manage', 'roles.view'])
    expect(requiredBy('budgets.view')).toEqual([])
  })

  it('desmarcar consultar tira o que dependia', () => {
    expect(togglePermission(['budgets.view', 'budgets.manage', 'budgets.approve', 'units.view'], 'budgets.view', false)).toEqual(['units.view'])
    expect(togglePermission(['members.view', 'roles.view', 'roles.manage'], 'members.view', false)).toEqual(['roles.view'])
  })

  it('o resumo mostra nomes legíveis, agrupados', () => {
    expect(describePermissions(['budgets.manage', 'budgets.view'])).toEqual([{ title: 'Orçamentos', labels: ['Consultar', 'Criar e editar'] }])
  })

  it('os modelos partem do papel Membro, são coerentes e o de orçamentista não aprova', () => {
    for (const template of ROLE_TEMPLATES) {
      expect(template.permissions, template.name).toEqual(expect.arrayContaining(memberRole))
      for (const p of template.permissions) {
        expect(ALL_PERMISSIONS).toContain(p)
        expect(template.permissions, `${template.name}: ${p}`).toEqual(expect.arrayContaining(requiredBy(p)))
      }
    }
    const budgeting = ROLE_TEMPLATES.find((t) => t.id === 'budgeting')!.permissions
    expect(budgeting.filter((p) => !memberRole.includes(p))).toEqual(['budgets.manage'])
    expect(budgeting).not.toContain('budgets.approve')
  })
})

const person = (uuid: string, roles: string[], status: Member['status'] = 'active'): Member => ({
  id: 1,
  user: { uuid, name: uuid, email: `${uuid}@demo.test` },
  status,
  joined_at: null,
  roles: roles.map((name, i) => ({ id: i + 1, name })),
})
const actor = (permissions: string[], isAdmin = false): Actor => ({ uuid: 'eu', can: (p) => permissions.includes(p), isAdmin })
const manager = actor(['members.view', 'members.manage', 'roles.view', 'roles.manage'])

describe('membros — o que a tela oferece', () => {
  it('não há ações sobre a própria conta, com explicação', () => {
    const result = memberActions(person('eu', ['admin']), actor(['members.manage', 'roles.manage', 'roles.view'], true))
    expect([result.changeRoles, result.suspend, result.remove]).toEqual([false, false, false])
    expect(result.blocked).toContain('sua conta')
  })

  it('quem não é administrador não age sobre administrador, nem suspenso', () => {
    for (const state of ['active', 'suspended'] as const) {
      const result = memberActions(person('ana', ['admin'], state), manager)
      expect([result.changeRoles, result.suspend, result.reactivate, result.remove]).toEqual([false, false, false, false])
      expect(result.blocked).toContain('administrador')
    }
    expect(memberActions(person('ana', ['admin']), actor(['members.manage'], true)).suspend).toBe(true)
  })

  it('as ações seguem a situação e a permissão', () => {
    expect(memberActions(person('ana', ['member']), manager)).toMatchObject({ changeRoles: true, suspend: true, reactivate: false, remove: true })
    expect(memberActions(person('ana', ['member'], 'suspended'), manager)).toMatchObject({ changeRoles: false, suspend: false, reactivate: true })
    expect(memberActions(person('ana', [], 'removed'), manager).blocked).toContain('novo convite')
    expect(memberActions(person('ana', ['member']), actor(['members.view']))).toEqual({ changeRoles: false, suspend: false, reactivate: false, remove: false, blocked: null })
  })

  it('só é administrador quem tem o papel e o vínculo ativo', () => {
    expect(isActiveAdmin([person('eu', ['admin'])], 'eu')).toBe(true)
    expect(isActiveAdmin([person('eu', ['admin'], 'suspended')], 'eu')).toBe(false)
    expect(isActiveAdmin([person('eu', ['member'])], 'eu')).toBe(false)
  })

  it('soma as permissões dos papéis e exige possuí-las para dar ou retirar', () => {
    const roles: Role[] = [
      { id: 1, name: 'member', is_system: true, permissions: ['budgets.view'] },
      { id: 2, name: 'Orçamentista', is_system: false, permissions: ['budgets.view', 'budgets.manage'] },
    ]
    expect(effectivePermissions(person('ana', ['member', 'Orçamentista']), roles).sort()).toEqual(['budgets.manage', 'budgets.view'])
    expect(canHandleRole(roles[1]!, actor(['budgets.view']))).toBe(false)
    expect(canHandleRole(roles[1]!, actor(['budgets.view', 'budgets.manage']))).toBe(true)
  })

  it('calcula o que atribuir e o que retirar', () => {
    expect(roleChanges([1, 2], [2, 3])).toEqual({ assign: [3], revoke: [1] })
    expect(roleChanges([1], [1])).toEqual({ assign: [], revoke: [] })
  })

  it('o menu Membros aparece só para quem pode ver os membros', () => {
    const find = (permission: string) => filterNavigation(navigation, (p) => p === permission).find((n) => n.label === 'Membros')
    expect(find('members.view')).toMatchObject({ path: '/membros' })
    expect(find('projects.view')).toBeUndefined()
  })
})
