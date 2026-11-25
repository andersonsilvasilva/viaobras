import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { SITE_URL } from '@/landing/content'

/** Moldura das telas sem sessão (login, redefinir senha e aceitar convite). */
export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <div className="bg-card shadow-card w-full max-w-sm rounded-xl border p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo className="h-11" />
        </div>
        <h1 className="mb-1 text-lg font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground mb-5 text-sm">{description}</p>}
        {children}
        <div className="mt-5 border-t pt-4 text-center">
          <a href={SITE_URL} className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 rounded-sm text-sm hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Voltar para a página comercial
          </a>
        </div>
      </div>
      <ThemeToggle />
    </main>
  )
}
