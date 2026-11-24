import { ImageIcon } from 'lucide-react'
import { useState } from 'react'
import type { Shot, ShotCrop } from '../content'

const FULL: ShotCrop = { x: 0, y: 0, w: 1, h: 1 }

interface ProductShotProps {
  shot: Shot
  /** Recorte em frações (0–1) da captura original. Sem `crop`, mostra a imagem inteira. */
  crop?: ShotCrop
  /** Primeira imagem da página: carrega com prioridade. */
  priority?: boolean
  sizes?: string
}

/**
 * Screenshot real do sistema dentro de uma moldura de navegador.
 *
 * O recorte é exato e nunca distorce: o quadro assume a proporção do trecho recortado e a imagem é
 * posicionada/escalada por trás dele. Se o arquivo ainda não existir, mostra um espaço reservado
 * neutro (sem dados nem telas inventadas).
 */
export function ProductShot({ shot, crop = FULL, priority = false, sizes = '(min-width: 1024px) 60vw, 100vw' }: ProductShotProps) {
  const [missing, setMissing] = useState(false)
  const ratio = (crop.w * shot.width) / (crop.h * shot.height)

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white shadow-lp-shot">
      <div className="flex items-center gap-3 border-b border-line bg-paper px-3 py-2.5" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md border border-line bg-white px-3 py-1 text-xs text-muted-ink">
          app.viaobras.com.br
        </span>
      </div>

      <div className="relative w-full overflow-hidden bg-paper" style={{ aspectRatio: ratio }}>
        {missing ? (
          <div
            role="img"
            aria-label={shot.alt}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line p-6 text-center"
          >
            <ImageIcon className="size-8 text-muted-ink" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm font-medium text-brand-deep">Captura de tela da plataforma</p>
            <p className="text-xs text-muted-ink">
              Adicione <code className="rounded bg-white px-1.5 py-0.5">public/landing/{shot.file}</code>
            </p>
          </div>
        ) : (
          <img
            src={`/landing/${shot.file}`}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            sizes={sizes}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            onError={() => setMissing(true)}
            className="absolute max-w-none"
            style={{
              width: `${100 / crop.w}%`,
              left: `${(-crop.x / crop.w) * 100}%`,
              top: `${(-crop.y / crop.h) * 100}%`,
            }}
          />
        )}
      </div>
    </figure>
  )
}
