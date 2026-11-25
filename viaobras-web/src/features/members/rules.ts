import type { Member, Role } from './api'

/**
 * O que a tela oferece para cada pessoa. É o espelho das regras do servidor (D-P132…D-P134), que confere tudo de
 * novo: aqui serve para explicar o bloqueio antes do clique.
 */
export interface Actor {
  uuid: string
  can: (permission: string) => boolean
  /** Administrador ativo da organização. */
  isAdmin: boolean
}

export const holdsAdmin = (member: Pick<Member, 'roles'>) => member.roles.some((r) => r.name === 'admin')

export const isActiveAdmin = (members: Member[], userUuid: string) =>
  members.some((m) => m.user.uuid === userUuid && m.status === 'active' && holdsAdmin(m))

export interface MemberActions {
  changeRoles: boolean
  suspend: boolean
  reactivate: boolean
  remove: boolean
  /** Por que não há ações, quando a pessoa teria permissão para elas. */
  blocked: string | null
}

export function memberActions(member: Member, actor: Actor): MemberActions {
  const none = { changeRoles: false, suspend: false, reactivate: false, remove: false }
  const manages = actor.can('members.manage')
  const assigns = actor.can('roles.manage') && actor.can('roles.view')

  if (!manages && !assigns) return { ...none, blocked: null }
  if (member.status === 'removed') return { ...none, blocked: 'Vínculo removido. Para a pessoa voltar, envie um novo convite.' }
  if (member.user.uuid === actor.uuid) return { ...none, blocked: 'É a sua conta: outro administrador precisa fazer a alteração.' }
  if (holdsAdmin(member) && !actor.isAdmin) return { ...none, blocked: 'Só um administrador altera o acesso de outro administrador.' }

  return {
    changeRoles: assigns && member.status === 'active',
    suspend: manages && member.status === 'active',
    reactivate: manages && member.status === 'suspended',
    remove: manages,
    blocked: null,
  }
}

/** Soma das permissões de todos os papéis da pessoa (D-P131). */
export function effectivePermissions(member: Pick<Member, 'roles'>, roles: Role[]): string[] {
  const ids = new Set(member.roles.map((r) => r.id))
  return [...new Set(roles.filter((r) => ids.has(r.id)).flatMap((r) => r.permissions))]
}

/** Dar ou retirar um papel exige possuir todas as permissões dele (PrivilegeGuard). */
export const canHandleRole = (role: Pick<Role, 'permissions'>, actor: Actor) => role.permissions.every(actor.can)

/** Mudanças a enviar: primeiro as que dão, depois as que retiram, para a pessoa não ficar sem acesso no meio. */
export function roleChanges(current: number[], wanted: number[]): { assign: number[]; revoke: number[] } {
  return { assign: wanted.filter((id) => !current.includes(id)), revoke: current.filter((id) => !wanted.includes(id)) }
}
