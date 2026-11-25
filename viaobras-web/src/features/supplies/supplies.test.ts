import { describe, expect, it } from 'vitest'
import { filterNavigation, navigation } from '@/app/navigation'
import { reasonRequired, type PlanningTask } from './api'
import { parseQuantity, planningHint, requestSchema, toBody, toForm, type RequestForm } from './form'

const form: RequestForm = {
  project_uuid: 'obra-1',
  priority: 'high',
  needed_by: '',
  notes: '  ',
  items: [
    { resource_uuid: 'mat-1', description: 'DEMO Cimento', unit_code: 'SC', quantity: '1.500', task_id: '7', notes: '' },
    { resource_uuid: null, description: ' DEMO Areia ', unit_code: 'M3', quantity: '2,5', task_id: '', notes: 'DEMO lavada' },
  ],
}

describe('quantidade digitada em português', () => {
  it('aceita vírgula decimal e ponto de milhar', () => {
    expect(parseQuantity('2,5')).toBe('2.5')
    expect(parseQuantity('1.500')).toBe('1500')
    expect(parseQuantity('1.234,5')).toBe('1234.5')
    expect(parseQuantity('0.25')).toBe('0.25')
  })

  it('recusa vazio, zero, negativo, texto e mais de 4 casas', () => {
    for (const value of ['', '0', '0,0', '-1', 'abc', '1,00001', '1,2,3']) expect(parseQuantity(value), value).toBeNull()
    expect(parseQuantity('0', true)).toBe('0') // aprovação pode zerar um item
  })
})

describe('formulário da solicitação', () => {
  it('manda só o material no item do catálogo e descrição e unidade no digitado', () => {
    expect(toBody(form, true)).toEqual({
      project_uuid: 'obra-1', priority: 'high', needed_by: null, notes: null,
      items: [
        { resource_uuid: 'mat-1', quantity: '1500', task_id: 7, notes: null },
        { description: 'DEMO Areia', unit_code: 'M3', quantity: '2.5', task_id: null, notes: 'DEMO lavada' },
      ],
    })
    expect(toBody(form, false)).not.toHaveProperty('project_uuid')
  })

  it('ao editar, mostra as quantidades em português e mantém a atividade ligada', () => {
    const values = toForm({
      uuid: 'r', code: 'SOL-001/2026', status: 'draft', priority: 'low', needed_by: null, late: false, notes: null, created_at: '', submitted_at: null,
      decided_at: null, fulfilled_on: null, approved_by_requester: false, project: { uuid: 'obra-1', code: 'OB-001', name: 'DEMO' },
      items: [{ id: 1, resource_uuid: null, description: 'DEMO', unit_code: 'UN', quantity: '1500.0000', approved_quantity: null, notes: null, task: { id: 7, wbs: '1', name: 'x' } }],
    })

    expect(values.items[0]).toMatchObject({ quantity: '1.500', task_id: '7' })
    expect(parseQuantity(values.items[0].quantity)).toBe('1500')
  })

  it('exige obra, descrição, unidade e quantidade válida', () => {
    const result = requestSchema.safeParse({ ...form, project_uuid: '', items: [{ ...form.items[1], description: ' ', unit_code: '', quantity: '0' }] })

    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['project_uuid', 'items.0.description', 'items.0.unit_code', 'items.0.quantity'])
  })
})

describe('comparação com o planejamento (informativa)', () => {
  const tasks: PlanningTask[] = [{ id: 7, wbs: '1.1', name: 'DEMO', kind: 'task', materials: [{ resource_uuid: 'mat-1', description: 'DEMO Cimento', unit_code: 'SC', planned: '5.0000', requested: '3.0000' }] }]

  it('mostra o previsto e o já pedido só para o material do catálogo na mesma unidade', () => {
    expect(planningHint(tasks, form.items[0])).toBe('Previsto na atividade: 5 SC · já pedido: 3 SC')
    expect(planningHint(tasks, { ...form.items[0], unit_code: 'KG' })).toContain('não prevê')
    expect(planningHint(tasks, { ...form.items[1], task_id: '7' })).toContain('não é comparado')
    expect(planningHint(tasks, form.items[1])).toBeNull()
  })
})

describe('regras de tela', () => {
  it('pede motivo para cancelar o que já foi enviado, mas não o rascunho', () => {
    expect(reasonRequired('cancel', 'draft')).toBe(false)
    expect(reasonRequired('cancel', 'pending')).toBe(true)
    expect(reasonRequired('reject', 'pending')).toBe(true)
    expect(reasonRequired('approve', 'pending')).toBe(false)
  })

  it('Suprimentos aparece no menu só com supplies.view e sem a marca de demonstração', () => {
    const find = (can: (p: string) => boolean) => filterNavigation(navigation, can).find((n) => n.label === 'Suprimentos')

    expect(find(() => false)).toBeUndefined()
    expect(find((p) => p === 'supplies.view')).toMatchObject({ path: '/suprimentos' })
    expect(find(() => true)?.demo).toBeUndefined()
  })
})
