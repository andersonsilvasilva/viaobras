import { cn } from '@/lib/utils'

/**
 * Logomarca completa conforme o tema. Os arquivos oficiais não têm transparência: no escuro vai a versão
 * negativa (branca sobre preto) com mix-blend-lighten, que deixa o fundo da tela aparecer no lugar do preto.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img src="/brand/logo-completa.png" alt="ViaObras" width={806} height={240} className={cn('w-auto shrink-0 dark:hidden', className)} />
      <img src="/brand/logo-negativa.png" alt="ViaObras" width={440} height={146} className={cn('hidden w-auto shrink-0 mix-blend-lighten dark:block', className)} />
    </>
  )
}
