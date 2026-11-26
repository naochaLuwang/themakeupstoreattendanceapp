import { notFound } from 'next/navigation'
import { getAuditById } from '@/lib/store-ops/audits'
import { createClient } from '@/lib/supabase/server'
import AuditRunner from '@/components/store-ops/audits/AuditRunner'
import AuditDetailView from './AuditDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuditDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  try {
    const audit = await getAuditById(id)

    if (audit.status === 'in_progress') {
      return (
        <div className="space-y-6">
          <AuditRunner audit={audit} />
        </div>
      )
    }

    return <AuditDetailView audit={audit} isAdmin={isAdmin} basePath="/admin/store-operations/audits" />
  } catch {
    notFound()
  }
}
