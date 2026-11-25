/**
 * Tema do app: claro (padrão), escuro ou automático (segue o aparelho). A escolha fica no navegador.
 * public/theme-init.js repete a leitura para aplicar o tema antes da primeira pintura; theme.test.ts
 * confere que os dois concordam.
 */
export const THEMES = ['light', 'dark', 'auto'] as const
export type Theme = (typeof THEMES)[number]
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'viaobras:theme'
export const DEFAULT_THEME: Theme = 'light'
/** Cor da barra do navegador no celular: o fundo de cada tema. */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f3f4f6', dark: '#0f1420' }

const DARK_QUERY = '(prefers-color-scheme: dark)'

export const parseTheme = (value: string | null | undefined): Theme =>
  (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : DEFAULT_THEME

export const resolveTheme = (theme: Theme, systemDark: boolean): ResolvedTheme =>
  theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme

export const nextTheme = (theme: Theme): Theme => THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!

function readStored(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return DEFAULT_THEME // armazenamento indisponível
  }
}

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DARK_QUERY) : null)

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(theme, media()?.matches ?? false)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

let current: Theme | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export const getTheme = (): Theme => (current ??= readStored())

export function setTheme(theme: Theme): void {
  current = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // armazenamento indisponível: a escolha vale só nesta aba
  }
  applyTheme(theme)
  notify()
}

/** Para o useSyncExternalStore. Acompanha também o aparelho (modo automático) e outras abas. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  const query = media()
  const onSystem = () => {
    if (getTheme() === 'auto') applyTheme('auto')
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return
    current = parseTheme(event.newValue)
    applyTheme(current)
    notify()
  }
  query?.addEventListener('change', onSystem)
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    query?.removeEventListener('change', onSystem)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

export function resetThemeForTests(): void {
  current = null
  listeners.clear()
}
