import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api-error'
import { saveBlob } from '@/lib/http'
import { planningApi } from '../api'

/** Exportar o orçamento sintético do planejamento (6B, D-P96): XLSX (28 colunas, recursos e cronograma) ou PDF. */
export function ExportMenu({ uuid, code }: { uuid: string; code: string }) {
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const run = async (format: 'xlsx' | 'pdf') => {
    setBusy(format)
    setOpen(false)
    try {
      const { blob, filename } = await planningApi.exportFile(uuid, format)
      saveBlob(blob, filename ?? `${code.replace(/[^A-Za-z0-9]+/g, '-')}-orcamento-sintetico.${format}`)
    } catch (e) {
      notify('error', 'Não foi possível exportar', getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={box}>
      <Button size="sm" variant="outline" aria-haspopup="menu" aria-expanded={open} disabled={busy !== null} onClick={() => setOpen(!open)}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Exportar
      </Button>
      {open && (
        <div role="menu" className="bg-popover text-popover-foreground absolute right-0 z-30 mt-1 w-64 rounded-lg border p-1 shadow-lg">
          <button type="button" role="menuitem" className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm" onClick={() => run('xlsx')}>
            <FileSpreadsheet className="text-primary mt-0.5 size-4" />
            <span>
              <span className="block font-medium">Planilha (XLSX)</span>
              <span className="text-muted-foreground block text-xs">28 colunas do sintético, recursos e cronograma</span>
            </span>
          </button>
          <button type="button" role="menuitem" className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm" onClick={() => run('pdf')}>
            <FileText className="text-primary mt-0.5 size-4" />
            <span>
              <span className="block font-medium">PDF</span>
              <span className="text-muted-foreground block text-xs">Totais, atividades, custo por tipo e cronograma</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
