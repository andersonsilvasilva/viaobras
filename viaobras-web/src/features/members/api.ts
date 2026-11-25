import type { StatusTone } from '@/components/data-display/indicators'
import { http } from '@/lib/http'

/** Convites por e-mail para a organização ativa. O token do convite só existe no e-mail: a API nunca o devolve. */

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Invitation {
  id: number
  email: string
  status: InvitationStatus
  role: { id: number | null; name: string | null }
  expires_at: string
  accepted_at: string | null
}

export interface Role {
  id: number
  name: string
  is_system: boolean
  permissions: string[]
  /** Quantas pessoas têm o papel (só na listagem). */
  members_count?: number
}

export type MemberStatus = 'invited' | 'active' | 'suspended' | 'removed'

export interface Member {
  id: number
  user: { uuid: string; name: string; email: string }
  status: MemberStatus
  joined_at: string | null
  roles: { id: number; name: string }[]
}

export interface MemberProjects {
  /** Quem gerencia obras vê todas, sem acesso por obra. */
  all: boolean
  projects: { uuid: string; code: string; name: string; access_level: 'view' | 'edit' | 'manage' }[]
}

const data = <T,>(r: { data: T }) => r.data

export const invitationsApi = {
  list: () => http<{ data: Invitation[] }>('/invitations').then(data),
  roles: () => http<{ data: Role[] }>('/roles').then(data),
  /** `email_sent` falso: o convite existe, mas o e-mail não saiu. */
  create: (email: string, role_id: number) => http<{ data: Invitation; email_sent: boolean }>('/invitations', { method: 'POST', body: { email, role_id } }),
  revoke: (id: number) => http<void>(`/invitations/${id}`, { method: 'DELETE' }),
}

export const membersApi = {
  list: () => http<{ data: Member[] }>('/members').then(data),
  projects: (id: number) => http<{ data: MemberProjects }>(`/members/${id}/projects`).then(data),
  suspend: (id: number) => http<unknown>(`/members/${id}/suspend`, { method: 'POST' }),
  reactivate: (id: number) => http<unknown>(`/members/${id}/reactivate`, { method: 'POST' }),
  remove: (id: number) => http<void>(`/members/${id}`, { method: 'DELETE' }),
  assignRole: (id: number, role_id: number) => http<unknown>(`/members/${id}/roles`, { method: 'POST', body: { role_id } }),
  revokeRole: (id: number, roleId: number) => http<void>(`/members/${id}/roles/${roleId}`, { method: 'DELETE' }),
}

export const rolesApi = {
  list: () => http<{ data: Role[] }>('/roles').then(data),
  create: (name: string, permissions: string[]) => http<{ data: Role }>('/roles', { method: 'POST', body: { name, permissions } }).then(data),
  update: (id: number, name: string, permissions: string[]) => http<{ data: Role }>(`/roles/${id}`, { method: 'PUT', body: { name, permissions } }).then(data),
  remove: (id: number) => http<void>(`/roles/${id}`, { method: 'DELETE' }),
}

export const statusMeta: Record<InvitationStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Aguardando aceite', tone: 'warning' },
  accepted: { label: 'Aceito', tone: 'success' },
  expired: { label: 'Expirado', tone: 'neutral' },
  revoked: { label: 'Revogado', tone: 'neutral' },
}

/** Pendente com a validade vencida já é expirado, mesmo antes de a rotina do servidor atualizar a situação. */
export const effectiveStatus = (i: Pick<Invitation, 'status' | 'expires_at'>, now = new Date()): InvitationStatus =>
  i.status === 'pending' && new Date(i.expires_at) <= now ? 'expired' : i.status

const SYSTEM_ROLES: Record<string, { label: string; help: string }> = {
  admin: { label: 'Administrador', help: 'Acesso completo à organização, inclusive convidar pessoas e gerenciar papéis.' },
  member: { label: 'Membro (consulta)', help: 'Só consulta: não cria nem edita. Só vê as obras às quais receber acesso.' },
  viewer: { label: 'Somente organização', help: 'Vê apenas os dados da organização.' },
}

export const roleLabel = (name: string | null) => (name ? (SYSTEM_ROLES[name]?.label ?? name) : '—')
export const roleHelp = (name: string) => SYSTEM_ROLES[name]?.help ?? 'Papel criado pela organização.'

/** Ninguém convida para um papel com permissões que não tem (espelho do PrivilegeGuard; a API confere de novo). */
export const canGrant = (role: Pick<Role, 'permissions'>, can: (permission: string) => boolean) => role.permissions.every(can)
