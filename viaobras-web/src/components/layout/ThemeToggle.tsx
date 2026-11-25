import { Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { getTheme, nextTheme, setTheme, subscribeTheme, THEMES, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const options: Record<Theme, { label: string; icon: typeof Sun }> = {
  light: { label: 'Claro', icon: Sun },
  dark: { label: 'Escuro', icon: Moon },
  auto: { label: 'Automático', icon: Monitor },
}

const useTheme = () => useSyncExternalStore(subscribeTheme, getTheme, getTheme)

/** As três opções lado a lado (menu lateral e telas sem sessão). */
export function ThemeToggle({ tone = 'default', className }: { tone?: 'default' | 'sidebar'; className?: string }) {
  const theme = useTheme()
  const sidebar = tone === 'sidebar'
  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn('flex gap-0.5 rounded-lg border p-0.5', sidebar ? 'border-sidebar-border' : 'bg-card', className)}
    >
      {THEMES.map((value) => {
        const { label, icon: Icon } = options[value]
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            title={value === 'auto' ? 'Automático: segue o tema do aparelho' : `Tema ${label.toLowerCase()}`}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap',
              sidebar
                ? selected
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'hover:bg-sidebar-accent'
                : selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className={value === 'auto' ? 'sr-only' : undefined}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Um botão só, que passa para o próximo tema (barra superior e menu recolhido). */
export function ThemeButton({ className }: { className?: string }) {
  const theme = useTheme()
  const { label, icon: Icon } = options[theme]
  const description = `Tema: ${label}. Mudar para ${options[nextTheme(theme)].label}`
  return (
    <Button variant="ghost" size="icon" className={className} aria-label={description} title={description} onClick={() => setTheme(nextTheme(theme))}>
      <Icon className="size-5" />
    </Button>
  )
}
