import { useState } from 'react'
import { Alert } from '@/components/feedback/Alert'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/layout/Tabs'
import { useAuth } from '@/features/auth/auth-context'
import { PeopleTab } from './PeopleTab'
import { RolesTab } from './RolesTab'

/** Membros e permissões (MEMBROS_PERMISSOES_MODELO.md): quem está na organização e o que cada um pode fazer. */
export function MembersPage() {
  const { can } = useAuth()
  const tabs = [{ id: 'pessoas', label: 'Pessoas' }, ...(can('roles.view') ? [{ id: 'papeis', label: 'Papéis' }] : [])]
  const [tab, setTab] = useState('pessoas')

  return (
    <>
      <PageHeader title="Membros" description="Quem está na organização e o que cada pessoa pode fazer." />
      <Alert tone="info" className="mb-4">
        O <strong>papel</strong> diz o que a pessoa pode fazer. A aba <strong>Acesso</strong> de cada obra diz em quais obras.
        Quem cria e edita obras já vê todas.
      </Alert>
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Membros e papéis">
        {tab === 'papeis' ? <RolesTab /> : <PeopleTab />}
      </Tabs>
    </>
  )
}
