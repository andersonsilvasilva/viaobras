import { FOOTER, FOOTER_LINKS, SITE_URL } from '../content'
import { Container } from './primitives'

const CURRENT_YEAR = new Date().getFullYear()

/** Rodapé minimalista em grafite. */
export function Footer() {
  return (
    <footer className="bg-ink text-white">
      <Container className="py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <img src="/brand/logo-negativa.png" alt="ViaObras" width={440} height={146} className="h-10 w-auto mix-blend-lighten" />
            <p className="mt-4 text-sm text-on-deep">{FOOTER.tagline}</p>
          </div>

          <nav aria-label="Rodapé">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="rounded-sm text-sm text-on-deep transition-colors hover:text-white focus-visible:outline-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-on-deep sm:flex-row sm:items-center sm:justify-between">
          <a href={SITE_URL} className="rounded-sm hover:text-white focus-visible:outline-white">
            viaobras.com.br
          </a>
          <p>
            © {CURRENT_YEAR} ViaObras · {FOOTER.company}
          </p>
        </div>
      </Container>
    </footer>
  )
}
