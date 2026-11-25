import { describe, expect, it } from 'vitest'
import html from '../../planos.html?raw'
import { salesLink } from './config'
import { COMPARISON, FAQ, FOOTER, IDS, NAV, PLANS, priceLabel, salesMessage, SOON_NOTE, WHY } from './content'

const plain = (text: string) => text.replace(/ /g, ' ')
const plan = (id: string) => PLANS.find((p) => p.id === id)!

describe('planos — preços', () => {
  it('o anual vale 10 mensalidades', () => {
    for (const p of PLANS.filter((p) => p.price)) expect(p.price!.annual, p.id).toBe(p.price!.monthly * 10)
  })

  it('o seletor troca valor, período e explicação; Enterprise continua personalizado', () => {
    expect(plain(priceLabel(plan('pro'), 'monthly').value)).toBe('R$ 299')
    expect(priceLabel(plan('pro'), 'monthly').period).toBe('/mês')
    const annual = priceLabel(plan('pro'), 'annual')
    expect([plain(annual.value), annual.period]).toEqual(['R$ 2.990', '/ano'])
    expect(plain(annual.detail)).toContain('R$ 3.588')
    expect(priceLabel(plan('enterprise'), 'annual').value).toBe('Personalizado')
  })

  it('os limites do comparativo vêm da mesma configuração dos cartões', () => {
    const values = (label: string) => COMPARISON.find((r) => r.label === label)!.cells.map((c) => c.value)

    expect(values('Obras ativas')).toEqual(['2', '5', '15', 'Personalizado'])
    expect(values('Usuários')).toEqual(['2', '5', '15', 'Personalizado'])
    expect(plan('start').features[0].label).toContain(`Até ${plan('start').activeProjects} obras`)
  })
})

describe('planos — o que ainda não existe é marcado e explicado na nota', () => {
  const missing = /financeir|contas a pagar|orçado|dashboard|indicadores gerenciais|relatórios (completos|avançados)|visão consolidada/i

  it('nos cartões', () => {
    for (const p of PLANS) for (const f of p.features.filter((f) => missing.test(f.label))) expect(f.soon, `${p.id}: ${f.label}`).toBe(true)
  })

  it('com uma nota que diz que o recurso ainda não está disponível, sem a expressão "em breve"', () => {
    expect(SOON_NOTE.startsWith('*')).toBe(true)
    expect(SOON_NOTE).toContain('ainda não disponível')
    expect(JSON.stringify([PLANS, COMPARISON, SOON_NOTE, WHY, FAQ])).not.toMatch(/em breve/i)
  })

  it('no comparativo', () => {
    for (const row of COMPARISON.filter((r) => missing.test(r.label))) expect(row.soon, row.label).toBe(true)
    expect(COMPARISON.find((r) => r.label === 'Relatórios')!.cells.map((c) => !!c.soon)).toEqual([false, true, true, true])
  })
})

describe('planos — canal comercial', () => {
  const none = { url: '', whatsapp: '', email: '' }

  it('sem canal configurado não cria link', () => {
    expect(salesLink('oi', none)).toBeNull()
  })

  it('usa o endereço, depois o WhatsApp, depois o e-mail', () => {
    expect(salesLink('Olá!', { ...none, email: 'comercial@exemplo.test' })).toBe('mailto:comercial@exemplo.test?subject=Ol%C3%A1!')
    expect(salesLink('a b', { ...none, email: 'x@exemplo.test', whatsapp: '+55 (00) 00000-0000' })).toBe('https://wa.me/5500000000000?text=a%20b')
    expect(salesLink('a', { url: 'https://exemplo.test/agenda', whatsapp: '55', email: 'x@y.test' })).toBe('https://exemplo.test/agenda')
  })

  it('o canal configurado é o WhatsApp comercial da HighTech, com a mensagem do plano', () => {
    const link = salesLink(salesMessage(plan('pro'), 'monthly'))!

    expect(link.startsWith('https://wa.me/5547992073875?text=')).toBe(true)
    expect(decodeURIComponent(link)).toContain('plano ViaObras Pro (cobrança mensal)')
  })

  it('a mensagem identifica o plano e a cobrança escolhida', () => {
    expect(salesMessage(plan('business'), 'annual')).toBe('Olá! Tenho interesse no plano ViaObras Business (cobrança anual).')
    expect(salesMessage(plan('enterprise'), 'annual')).toBe('Olá! Tenho interesse no plano ViaObras Enterprise.')
  })
})

describe('planos — página e links', () => {
  it('tem o título, a descrição e o canonical pedidos', () => {
    expect(html).toContain('<title>Planos ViaObras | Gestão Inteligente de Obras</title>')
    expect(html).toContain('Conheça os planos ViaObras e simplifique a gestão de obras, orçamentos, custos, suprimentos e indicadores da sua empresa.')
    expect(html).toContain('rel="canonical" href="https://viaobras.com.br/planos.html"')
    expect(html).toContain('property="og:url" content="https://viaobras.com.br/planos.html"')
    expect(html).toContain('/src/pricing/main.tsx')
    expect(html).not.toContain('/src/main.tsx')
    expect(html).not.toContain('"offers"')
  })

  it('toda âncora aponta para uma seção que existe e o acesso vai para o app', () => {
    const ids = new Set<string>(Object.values(IDS))
    for (const link of [...NAV, ...FOOTER.links]) if (link.href.startsWith('#')) expect(ids.has(link.href.slice(1)), link.href).toBe(true)
    expect(FOOTER.links.find((l) => l.label === 'Acessar plataforma')?.href).toBe('https://app.viaobras.com.br/')
  })
})
