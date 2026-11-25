import type { StatusTone } from '@/components/data-display/indicators'
import type { Page } from '@/features/registry/api'
import { http, type Query } from '@/lib/http'

/** Solicitações de materiais (Fase 7A). Quantidades chegam como TEXTO exato; a API decide o que cada um pode fazer. */

export type RequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'received' | 'canceled'
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent'
export type RequestAction = 'submit' | 'approve' | 'send_back' | 'reject' | 'revoke_approval' | 'fulfill' | 'revert_fulfillment' | 'cancel'

type Person = { uuid: string; name: string }

export interface RequestItem {
  id: number
  resource_uuid: string | null
  description: string
  unit_code: string
  quantity: string
  approved_quantity: string | null
  notes: string | null
  task: { id: number; wbs: string; name: string } | null
}

export interface HistoryEntry {
  action: RequestAction
  from: RequestStatus
  to: RequestStatus
  reason: string | null
  at: string
  by: Person | null
}

export interface PurchaseRequest {
  uuid: string
  code: string
  status: RequestStatus
  priority: RequestPriority
  needed_by: string | null
  late: boolean
  notes: string | null
  created_at: string
  submitted_at: string | null
  decided_at: string | null
  fulfilled_on: string | null
  approved_by_requester: boolean
  project?: { uuid: string; code: string; name: string }
  requester?: Person
  decided_by?: Person | null
  items_count?: number
  documents_count?: number
  items?: RequestItem[]
  history?: HistoryEntry[]
  abilities?: { edit: boolean; delete: boolean; attach: boolean; actions: RequestAction[] }
}

export interface RequestSummary {
  pending: number
  approved: number
  late: number
  urgent: number
  awaiting_my_approval: number
  requesters: Person[]
}

export interface PlanningTask {
  id: number
  wbs: string
  name: string
  kind: 'summary' | 'task' | 'milestone'
  materials: { resource_uuid: string; description: string; unit_code: string; planned: string; requested: string }[]
}

type Body = Record<string, unknown>
const one = (uuid: string) => `/purchase-requests/${uuid}`
const data = <T,>(r: { data: T }) => r.data

export const suppliesApi = {
  list: (query?: Query) => http<Page<PurchaseRequest>>('/purchase-requests', { query }),
  summary: (project_uuid?: string) => http<{ data: RequestSummary }>('/purchase-requests/summary', { query: { project_uuid } }).then(data),
  planning: (project_uuid: string) => http<{ data: PlanningTask[] }>('/purchase-requests/planning', { query: { project_uuid } }).then(data),
  get: (uuid: string) => http<{ data: PurchaseRequest }>(one(uuid)).then(data),
  create: (body: Body) => http<{ data: PurchaseRequest }>('/purchase-requests', { method: 'POST', body }).then(data),
  update: (uuid: string, body: Body) => http<{ data: PurchaseRequest }>(one(uuid), { method: 'PUT', body }).then(data),
  remove: (uuid: string) => http<void>(one(uuid), { method: 'DELETE' }),
  workflow: (uuid: string, action: RequestAction, body: Body = {}) => http<{ data: PurchaseRequest }>(`${one(uuid)}/workflow/${action}`, { method: 'POST', body }).then(data),
}

export const statusMeta: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  pending: { label: 'Aguardando aprovação', tone: 'warning' },
  approved: { label: 'Aprovada', tone: 'success' },
  rejected: { label: 'Recusada', tone: 'danger' },
  received: { label: 'Atendida', tone: 'primary' },
  canceled: { label: 'Cancelada', tone: 'neutral' },
}

export const priorityMeta: Record<RequestPriority, { label: string; tone: StatusTone }> = {
  low: { label: 'Baixa', tone: 'neutral' },
  medium: { label: 'Média', tone: 'primary' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'danger' },
}

/** Botão e texto de confirmação de cada ação; `reason` = o motivo é obrigatório. */
export const actionMeta: Record<RequestAction, { label: string; past: string; help: string; reason: boolean; destructive?: boolean }> = {
  submit: { label: 'Enviar para aprovação', past: 'Enviada', help: 'Depois de enviada, os itens só mudam se a solicitação for devolvida.', reason: false },
  approve: { label: 'Aprovar', past: 'Aprovada', help: 'Reduza ou zere a quantidade de um item para aprovar em parte (informe o motivo).', reason: false },
  send_back: { label: 'Devolver para ajuste', past: 'Devolvida para ajuste', help: 'Volta a rascunho para quem pediu corrigir.', reason: true },
  reject: { label: 'Recusar', past: 'Recusada', help: 'A recusa é definitiva.', reason: true, destructive: true },
  revoke_approval: { label: 'Desfazer aprovação', past: 'Aprovação desfeita', help: 'Volta a aguardar aprovação e as quantidades aprovadas são limpas.', reason: true },
  fulfill: { label: 'Marcar como atendida', past: 'Marcada como atendida', help: 'Use quando o material tiver sido entregue.', reason: false },
  revert_fulfillment: { label: 'Desfazer atendimento', past: 'Atendimento desfeito', help: 'Volta a aprovada, aguardando atendimento.', reason: true },
  cancel: { label: 'Cancelar solicitação', past: 'Cancelada', help: 'A solicitação não é excluída: fica no histórico como cancelada.', reason: true, destructive: true },
}

/** Cancelar um rascunho não pede motivo (espelho de PurchaseRequestWorkflow). */
export const reasonRequired = (action: RequestAction, status: RequestStatus) => actionMeta[action].reason && !(action === 'cancel' && status === 'draft')
