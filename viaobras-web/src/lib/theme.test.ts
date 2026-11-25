import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import css from '../index.css?raw'
import initScript from '../../public/theme-init.js?raw'
import { applyTheme, DEFAULT_THEME, getTheme, nextTheme, parseTheme, resetThemeForTests, resolveTheme, setTheme, THEME_COLOR, THEME_KEY } from './theme'

/** Navegador mínimo: armazenamento, preferência do aparelho, <html> e a meta theme-color. */
function fakeBrowser({ stored = null as string | null, systemDark = false, brokenStorage = false } = {}) {
  const data = new Map<string, string>(stored === null ? [] : [[THEME_KEY, stored]])
  const classes = new Set<string>()
  const meta = { content: '' }
  const fail = () => {
    throw new Error('bloqueado')
  }
  const localStorage = brokenStorage
    ? { getItem: fail, setItem: fail }
    : { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  const window = { matchMedia: () => ({ matches: systemDark, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
  const document = {
    documentElement: { classList: { toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)) } },
    querySelector: () => ({ setAttribute: (_: string, v: string) => void (meta.content = v) }),
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', document)
  return { data, classes, meta, window, document, localStorage }
}

beforeEach(() => resetThemeForTests())
afterEach(() => vi.unstubAllGlobals())

describe('tema — escolha', () => {
  it('quem nunca escolheu abre no claro, mesmo com o aparelho no escuro', () => {
    const browser = fakeBrowser({ systemDark: true })

    applyTheme(getTheme())

    expect(DEFAULT_THEME).toBe('light')
    expect(browser.classes.has('dark')).toBe(false)
  })

  it('a escolha é aplicada e guardada', () => {
    const browser = fakeBrowser()

    setTheme('dark')

    expect(browser.data.get(THEME_KEY)).toBe('dark')
    expect(browser.classes.has('dark')).toBe(true)
    expect(browser.meta.content).toBe(THEME_COLOR.dark)
  })

  it('automático segue o aparelho', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('valor desconhecido ou armazenamento bloqueado não quebram', () => {
    expect(parseTheme('roxo')).toBe('light')
    fakeBrowser({ brokenStorage: true })

    expect(getTheme()).toBe('light')
    expect(() => setTheme('dark')).not.toThrow()
    expect(getTheme()).toBe('dark')
  })

  it('o botão único passa pelas três opções', () => {
    expect([nextTheme('light'), nextTheme('dark'), nextTheme('auto')]).toEqual(['dark', 'auto', 'light'])
  })
})

describe('tema — o script da primeira pintura concorda com o app', () => {
  const cases = [null, 'light', 'dark', 'auto', 'roxo'].flatMap((stored) => [false, true].map((systemDark) => ({ stored, systemDark })))

  it.each(cases)('salvo=$stored aparelhoEscuro=$systemDark', ({ stored, systemDark }) => {
    const browser = fakeBrowser({ stored, systemDark })

    new Function('localStorage', 'window', 'document', initScript)(browser.localStorage, browser.window, browser.document)

    const expected = resolveTheme(parseTheme(stored), systemDark)
    expect(browser.classes.has('dark')).toBe(expected === 'dark')
    expect(browser.meta.content).toBe(THEME_COLOR[expected])
  })
})

describe('tema — contraste (WCAG AA para texto: 4,5)', () => {
  const block = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`)
    return css.slice(start, css.indexOf('\n}', start))
  }
  const tokens = (text: string) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
  const light = tokens(block(':root'))
  const dark = { ...light, ...tokens(block('.dark')) }

  const color = (set: Record<string, string>, name: string): string => {
    const value = set[name]!
    const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value)
    return ref ? color(set, ref[1]!) : value
  }
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
    return (x! + 0.05) / (y! + 0.05)
  }

  const pairs: [string, string][] = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['muted-foreground', 'card'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
    ['primary', 'card'], // links
    ['primary-foreground', 'primary'], // botão principal
    ['secondary-foreground', 'primary-soft'], // selo e aviso informativos
    ['success-strong', 'success-soft'],
    ['warning-strong', 'warning-soft'],
    ['sidebar-foreground', 'sidebar'],
    ['sidebar-primary-foreground', 'sidebar-primary'],
  ]
  // vermelho como texto sobre o fundo suave e no botão
  const darkOnly: [string, string][] = [['destructive', 'destructive-soft'], ['destructive', 'card'], ['destructive-foreground', 'destructive']]

  it.each(pairs)('claro e escuro: %s sobre %s', (fg, bg) => {
    for (const [name, set] of [['claro', light], ['escuro', dark]] as const) {
      expect(ratio(color(set, fg), color(set, bg)), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(darkOnly)('escuro: %s sobre %s', (fg, bg) => {
    expect(ratio(color(dark, fg), color(dark, bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('o escuro redefine todas as cores semânticas de fundo e texto', () => {
    const own = tokens(block('.dark'))
    for (const name of ['background', 'foreground', 'card', 'popover', 'primary', 'muted', 'border', 'input', 'destructive']) {
      expect(own[name], name).toBeDefined()
    }
  })
})
