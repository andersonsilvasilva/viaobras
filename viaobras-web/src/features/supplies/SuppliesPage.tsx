import { PageHeader } from '@/components/layout/PageHeader'
import { RequestList } from './RequestList'

/** Menu Suprimentos: as solicitações de todas as obras que a pessoa pode ver. */
export function SuppliesPage() {
  return (
    <>
      <PageHeader title="Suprimentos" description="Solicitações de materiais por obra, com aprovação e acompanhamento." />
      <RequestList canCreate />
    </>
  )
}
