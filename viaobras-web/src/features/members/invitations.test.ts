import { describe, expect, it } from 'vitest'
import { filterNavigation, navigation } from '@/app/navigation'
import { canGrant, effectiveStatus, roleLabel } from './api'

describe('convites', () => {
  const now = new Date('2026-11-25T12:00:00Z')

  it('mostra como expirado o pendente com a validade vencida', () => {
    expect(effectiveStatus({ status: 'pending', expires_at: '2026-11-25T11:59:00Z' }, now)).toBe('expired')
    expect(effectiveStatus({ status: 'pending', expires_at: '2026-12-02T12:00:00Z' }, now)).toBe('pending')
    expect(effectiveStatus({ status: 'accepted', expires_at: '2026-01-01T00:00:00Z' }, now)).toBe('accepted')
  })

  it('só oferece papéis cujas permissões quem convida possui', () => {
    const mine = new Set(['members.invite', 'projects.view'])

    expect(canGrant({ permissions: ['projects.view'] }, (p) => mine.has(p))).toBe(true)
    expect(canGrant({ permissions: ['projects.view', 'roles.manage'] }, (p) => mine.has(p))).toBe(false)
  })

  it('traduz os papéis do sistema e mantém o nome dos papéis da organização', () => {
    expect([roleLabel('admin'), roleLabel('member'), roleLabel('DEMO Encarregado'), roleLabel(null)]).toEqual(['Administrador', 'Membro (consulta)', 'DEMO Encarregado', '—'])
  })

  it('o menu Convites aparece só para quem pode ver os membros', () => {
    const find = (permission: string) => filterNavigation(navigation, (p) => p === permission).find((n) => n.label === 'Convites')

    expect(find('members.view')).toMatchObject({ path: '/convites' })
    expect(find('projects.view')).toBeUndefined()
  })
})
