import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { needsAccount, newAccountSchema, newPasswordSchema } from './password'

const errors = (result: { error?: { issues: { path: PropertyKey[] }[] } }) => result.error?.issues.map((i) => i.path.join('.'))

describe('nova senha (espelho da regra da API)', () => {
  const check = (password: string) => newPasswordSchema.safeParse({ password, password_confirmation: password }).success

  it('exige 12 caracteres, maiúscula, minúscula e número', () => {
    expect(check('Senha-Segura-1')).toBe(true)
    for (const weak of ['Curta-1a', 'tudominusculo-123', 'TUDOMAIUSCULO-123', 'SemNumeroAlgum']) expect(check(weak), weak).toBe(false)
  })

  it('exige a repetição igual', () => {
    expect(errors(newPasswordSchema.safeParse({ password: 'Senha-Segura-1', password_confirmation: 'Senha-Segura-2' }))).toEqual(['password_confirmation'])
  })

  it('o cadastro pelo convite exige também o nome', () => {
    expect(errors(newAccountSchema.safeParse({ name: '  ', password: 'Senha-Segura-1', password_confirmation: 'Senha-Segura-1' }))).toEqual(['name'])
  })
})

describe('convite', () => {
  it('só pede o cadastro quando a API pede nome ou senha', () => {
    expect(needsAccount(new ApiError({ status: 422, code: 'validation', message: 'x', details: { name: ['x'] } }))).toBe(true)
    expect(needsAccount(new ApiError({ status: 410, code: 'invitation_expired', message: 'x' }))).toBe(false)
    expect(needsAccount(new ApiError({ status: 422, code: 'validation', message: 'x', details: { token: ['x'] } }))).toBe(false)
  })
})
