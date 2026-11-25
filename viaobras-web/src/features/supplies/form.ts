import { z } from 'zod'
import type { PlanningTask, PurchaseRequest } from './api'

/**
 * Quantidade digitada em português → texto que a API aceita. "2,5" → "2.5"; "1.500" é mil e quinhentos (ponto de
 * milhar). Devolve null se não for um número maior que zero (ou zero, com `allowZero`) com até 4 casas.
 */
export function parseQuantity(input: string, allowZero = false): string | null {
  let value = input.trim().replace(/\s/g, '')
  if (value.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '').replace(',', '.')
  if (!/^\d{1,11}(\.\d{1,4})?$/.test(value)) return null
  return allowZero || Number(value) > 0 ? value : null
}

/** "40.0000" → "40"; "2.5000" → "2,5"; "1500.0000" → "1.500". */
export const formatQuantity = (value: string) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 4 })

const itemSchema = z.object({
  resource_uuid: z.string().nullable(),
  description: z.string().trim().min(1, 'Descreva o item').max(500),
  unit_code: z.string().trim().min(1, 'Informe a unidade').max(20),
  quantity: z.string().refine((v) => parseQuantity(v) !== null, 'Quantidade maior que zero, com até 4 casas'),
  task_id: z.string(),
  notes: z.string().max(500),
})

export const requestSchema = z.object({
  project_uuid: z.string().min(1, 'Selecione a obra'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  needed_by: z.string(),
  notes: z.string().max(5000),
  items: z.array(itemSchema).max(200, 'No máximo 200 itens'),
})

export type RequestForm = z.infer<typeof requestSchema>
export type ItemForm = RequestForm['items'][number]

export const emptyItem: ItemForm = { resource_uuid: null, description: '', unit_code: '', quantity: '', task_id: '', notes: '' }

export function toForm(request: PurchaseRequest | undefined, projectUuid = ''): RequestForm {
  return {
    project_uuid: request?.project?.uuid ?? projectUuid,
    priority: request?.priority ?? 'medium',
    needed_by: request?.needed_by ?? '',
    notes: request?.notes ?? '',
    items: (request?.items ?? []).map((i) => ({
      resource_uuid: i.resource_uuid,
      description: i.description,
      unit_code: i.unit_code,
      quantity: formatQuantity(i.quantity),
      task_id: i.task ? String(i.task.id) : '',
      notes: i.notes ?? '',
    })),
  }
}

/** Corpo da API. A obra só vai na criação; item do catálogo manda só o material (a API copia nome e unidade). */
export function toBody(form: RequestForm, creating: boolean): Record<string, unknown> {
  return {
    ...(creating ? { project_uuid: form.project_uuid } : {}),
    priority: form.priority,
    needed_by: form.needed_by || null,
    notes: form.notes.trim() || null,
    items: form.items.map((i) => ({
      ...(i.resource_uuid ? { resource_uuid: i.resource_uuid } : { description: i.description.trim(), unit_code: i.unit_code.trim() }),
      quantity: parseQuantity(i.quantity),
      task_id: i.task_id ? Number(i.task_id) : null,
      notes: i.notes.trim() || null,
    })),
  }
}

/** Previsto × já pedido do material do catálogo na atividade escolhida (informativo, D-P102). */
export function planningHint(tasks: PlanningTask[], item: Pick<ItemForm, 'resource_uuid' | 'unit_code' | 'task_id'>): string | null {
  const task = tasks.find((t) => String(t.id) === item.task_id)
  if (!task) return null
  if (!item.resource_uuid) return 'Item digitado não é comparado com o planejamento.'
  const material = task.materials.find((m) => m.resource_uuid === item.resource_uuid && m.unit_code === item.unit_code)
  if (!material) return 'O planejamento não prevê este material (nesta unidade) para a atividade.'
  return `Previsto na atividade: ${formatQuantity(material.planned)} ${material.unit_code} · já pedido: ${formatQuantity(material.requested)} ${material.unit_code}`
}
