import { Container } from '../../landing/components/primitives'
import { LEGAL } from '../config'
import { FOOTER, SITE_URL } from '../content'

const CURRENT_YEAR = new Date().getFullYear()
const linkClass = 'rounded-sm text-sm text-on-deep transition-colors hover:text-white focus-visible:outline-white'

export function PricingFooter() {
  // só aparecem quando a página existir (config.ts): nada de endereço fictício
  const legal = [
    { label: 'Política de Privacidade', href: LEGAL.privacyUrl },
    { label: 'Termos de Uso', href: LEGAL.termsUrl },
  ].filter((link) => link.href)

  return (
    <footer className="bg-ink text-white">
      <Container className="py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <img src="/brand/logo-negativa.png" alt="ViaObras" width={440} height={146} className="h-10 w-auto mix-blend-lighten" />
            <p className="mt-4 text-sm text-on-deep">{FOOTER.tagline}</p>
            <p className="mt-2 text-sm font-medium text-white">{FOOTER.company}</p>
          </div>

          <nav aria-label="Rodapé">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
              {FOOTER.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className={linkClass}>{link.label}</a>
                </li>
              ))}
              {legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className={linkClass}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-on-deep sm:flex-row sm:items-center sm:justify-between">
          <a href={SITE_URL} className="rounded-sm hover:text-white focus-visible:outline-white">viaobras.com.br</a>
          <p>© {CURRENT_YEAR} ViaObras · HighTech Tecnologia</p>
        </div>
      </Container>
    </footer>
  )
}
