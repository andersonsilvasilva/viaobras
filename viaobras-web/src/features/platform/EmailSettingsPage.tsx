import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Panel } from '@/components/data-display/DataTable'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/layout/Tabs'
import { platformMailApi, type EmailSettings } from './api'
import { MailboxTab } from './MailboxTab'
import { TemplatesTab } from './TemplatesTab'

const KEY = ['platform', 'mail']

/** Plataforma → E-mail (só o administrador da plataforma): caixa postal de envio e mensagens padrão. */
export function EmailSettingsPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: platformMailApi.get, refetchOnWindowFocus: false })
  const [tab, setTab] = useState('caixa')

  return (
    <>
      <PageHeader title="E-mail da plataforma" description="Caixa postal de envio e mensagens padrão. Vale para todas as organizações." />
      <QueryBoundary query={query}>
        {(settings) => (
          <Panel className="p-4">
            <Tabs
              tabs={[
                { id: 'caixa', label: 'Caixa postal' },
                { id: 'mensagens', label: 'Mensagens' },
              ]}
              active={tab}
              onChange={setTab}
              label="Configuração de e-mail"
            >
              {tab === 'caixa' && <MailboxTab status={settings.mailbox} onChanged={(next: EmailSettings) => client.setQueryData(KEY, next)} />}
              {tab === 'mensagens' && <TemplatesTab templates={settings.templates} onChanged={() => client.invalidateQueries({ queryKey: KEY })} />}
            </Tabs>
          </Panel>
        )}
      </QueryBoundary>
    </>
  )
}
