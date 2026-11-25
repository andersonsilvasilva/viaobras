import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SearchInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { catalogApi, type CatalogResource } from '@/features/catalog/api'
import { getErrorMessage } from '@/lib/api-error'

/** Busca de materiais ativos do catálogo (D-P101): cada clique inclui um item; a lista continua aberta para os próximos. */
export function CatalogPicker({ chosen, onPick }: { chosen: Set<string>; onPick: (material: CatalogResource) => void }) {
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')

  // espera curta: evita uma requisição por tecla
  useEffect(() => {
    const id = setTimeout(() => setSearch(term.trim()), 300)
    return () => clearTimeout(id)
  }, [term])

  const query = useQuery({
    queryKey: ['resources', 'picker', search],
    queryFn: () => catalogApi.list({ kind: 'material', status: 'active', q: search, per_page: 8 }),
  })

  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <SearchInput autoFocus aria-label="Buscar material no catálogo" placeholder="Buscar material pelo nome ou código…" value={term} onChange={(e) => setTerm(e.target.value)} />
      {query.isError ? (
        <p role="alert" className="text-destructive mt-2 text-sm">{getErrorMessage(query.error)}</p>
      ) : query.isPending ? (
        <p className="text-muted-foreground mt-2 text-sm">Buscando…</p>
      ) : query.data.data.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">Nenhum material encontrado. Use “Item digitado”.</p>
      ) : (
        <>
          <ul className="bg-card mt-2 max-h-56 divide-y overflow-y-auto rounded-lg border">
            {query.data.data.map((m) => {
              const added = chosen.has(m.uuid)
              return (
                <li key={m.uuid} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {m.code && <span className="text-muted-foreground mr-2 text-xs tabular-nums">{m.code}</span>}
                    {m.name}
                  </span>
                  <span className="text-muted-foreground text-xs">{m.unit?.code}</span>
                  <Button type="button" variant="outline" size="icon-sm" disabled={added} onClick={() => onPick(m)} aria-label={added ? `${m.name} já incluído` : `Incluir ${m.name}`}>
                    {added ? <Check /> : <Plus />}
                  </Button>
                </li>
              )
            })}
          </ul>
          {query.data.meta.total > query.data.data.length && (
            <p className="text-muted-foreground mt-1 text-xs">Mostrando {query.data.data.length} de {query.data.meta.total}. Refine a busca para ver outros.</p>
          )}
        </>
      )}
    </div>
  )
}
