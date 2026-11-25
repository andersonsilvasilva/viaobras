import { describe, expect, it } from 'vitest'
import { filterNavigation, navigation } from '@/app/navigation'
import { permissionsOf } from '@/features/auth/permissions'
import { mailboxBody, mailboxForm, mailboxSchemaFor, needsMailboxPassword, type MailboxStatus } from './api'

const saved: MailboxStatus = {
  source: 'panel',
  server_sends: true,
  settings: { host: 'smtp.exemplo.com', port: 465, encryption: 'ssl', username: 'envio@exemplo.com', from_address: 'envio@exemplo.com', from_name: 'DEMO', password_set: true, active: true, last_tested_at: null },
}

describe('menu da plataforma', () => {
  const find = (permissions: Set<string>) => filterNavigation(navigation, (p) => permissions.has(p)).find((n) => n.label === 'Plataforma')

  it('aparece só para o administrador da plataforma, mesmo com todas as permissões da organização', () => {
    expect(find(permissionsOf({ permissions: ['roles.manage', 'tenant.update'], is_platform_admin: false }))).toBeUndefined()
    expect(find(permissionsOf({ permissions: [], is_platform_admin: true }))?.children?.map((c) => c.path)).toEqual(['/plataforma/email'])
  })

  it('uma permissão de organização com o mesmo nome não dá acesso', () => {
    expect(find(permissionsOf({ permissions: ['platform.admin'], is_platform_admin: false }))).toBeUndefined()
  })
})

describe('caixa postal', () => {
  const form = mailboxForm(saved)

  it('abre sem senha nenhuma preenchida', () => {
    expect([form.password, form.current_password]).toEqual(['', ''])
    expect(mailboxBody(form)).toMatchObject({ port: 465, password: null })
  })

  it('mostra o pedido de senha junto dos outros erros, não só depois deles', () => {
    const result = mailboxSchemaFor({ ...saved, settings: null }).safeParse({ ...form, host: '', password: '', from_address: 'x', current_password: '' })
    const fields = result.error?.issues.map((i) => i.path.join('.')) ?? []

    expect(fields).toEqual(expect.arrayContaining(['host', 'from_address', 'current_password', 'password']))
  })

  it('pede a senha ao configurar ou ao mudar servidor, porta ou usuário', () => {
    expect(needsMailboxPassword(saved, form)).toBe(false)
    expect(needsMailboxPassword(saved, { ...form, host: ' SMTP.exemplo.com ' })).toBe(false)
    expect(needsMailboxPassword(saved, { ...form, host: 'smtp.outro.com' })).toBe(true)
    expect(needsMailboxPassword(saved, { ...form, port: '587' })).toBe(true)
    expect(needsMailboxPassword(saved, { ...form, username: 'outro@exemplo.com' })).toBe(true)
    expect(needsMailboxPassword({ ...saved, settings: null }, form)).toBe(true)
  })
})
