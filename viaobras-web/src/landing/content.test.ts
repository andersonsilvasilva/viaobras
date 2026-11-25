import { describe, expect, it } from 'vitest'
import html from '../../landing.html?raw'
import { APP_URL, FOOTER_LINKS, NAV_LINKS, PRICING_SECTION, SECTION_IDS, SHOTS, SITE_URL } from './content'

describe('landing — conteúdo e links', () => {
  it('os links de acesso à plataforma apontam para o app', () => {
    expect(APP_URL).toBe('https://app.viaobras.com.br/')
    expect(SITE_URL).toBe('https://viaobras.com.br/')
    const acesso = FOOTER_LINKS.find((l) => l.label === 'Acessar sistema')
    expect(acesso?.href).toBe(APP_URL)
  })

  it('toda âncora de navegação aponta para uma seção que existe', () => {
    const ids = new Set<string>(Object.values(SECTION_IDS))
    for (const link of [...NAV_LINKS, ...FOOTER_LINKS]) {
      if (link.href.startsWith('#')) expect(ids.has(link.href.slice(1))).toBe(true)
    }
  })

  it('o cabeçalho, o rodapé e a seção de planos levam à página de preços', () => {
    for (const links of [NAV_LINKS, FOOTER_LINKS]) expect(links.find((l) => l.label === 'Planos')?.href).toBe('/planos.html')
    expect(PRICING_SECTION.href).toBe('/planos.html')
  })

  it('ids de seção são únicos', () => {
    const values = Object.values(SECTION_IDS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('as screenshots têm alt text e nomes de arquivo distintos', () => {
    const shots = Object.values(SHOTS)
    expect(new Set(shots.map((s) => s.file)).size).toBe(shots.length)
    for (const shot of shots) expect(shot.alt.length).toBeGreaterThan(20)
  })
})

describe('landing — página', () => {
  it('tem título, descrição e canonical conforme o SEO definido', () => {
    expect(html).toContain('<title>ViaObras | Gestão Inteligente de Obras</title>')
    expect(html).toContain('Gerencie obras, orçamentos, custos, suprimentos e projetos com mais controle e eficiência.')
    expect(html).toContain('rel="canonical" href="https://viaobras.com.br/"')
    expect(html).toContain('og:image" content="https://viaobras.com.br/landing/og-image.jpg"')
    expect(html).toContain('property="og:url" content="https://viaobras.com.br/"')
  })

  it('carrega só a entrada da landing (não o app autenticado)', () => {
    expect(html).toContain('/src/landing/main.tsx')
    expect(html).not.toContain('/src/main.tsx')
  })
})
