import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { APP_URL, NAV_LINKS, SECTION_IDS } from '../content'
import { ButtonLink } from './primitives'

const MENU_ID = 'menu-mobile'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Esc fecha o menu mobile e devolve o foco ao botão; fechar também ao voltar para telas largas.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => mq.matches && setOpen(false)
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onChange)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-200 ${
        scrolled ? 'border-line bg-white/85 shadow-lp-sm backdrop-blur-md' : 'border-transparent bg-white'
      }`}
    >
      <nav aria-label="Principal" className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href={`#${SECTION_IDS.top}`} aria-label="ViaObras — voltar ao início" className="rounded-md">
          <img src="/brand/logo-completa.png" alt="ViaObras" width={806} height={240} className="h-9 w-auto" />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-soft hover:text-brand"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="ml-2">
            <ButtonLink href={APP_URL}>Acessar sistema</ButtonLink>
          </li>
        </ul>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-brand-soft md:hidden"
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </nav>

      <div id={MENU_ID} hidden={!open} className="border-t border-line bg-white md:hidden">
        <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={close}
                className="flex min-h-11 items-center rounded-md px-3 text-base font-medium text-ink hover:bg-brand-soft hover:text-brand"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="pt-2">
            <ButtonLink href={APP_URL} className="w-full">
              Acessar sistema
            </ButtonLink>
          </li>
        </ul>
      </div>
    </header>
  )
}
