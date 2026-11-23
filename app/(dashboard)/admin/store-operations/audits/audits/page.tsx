import { getAudits, getAuditTemplates } from '@/lib/store-ops/audits'
import { createClient } from '@/lib/supabase/server'
import AuditList from '@/components/store-ops/audits/AuditList'
import TemplatesSection from './TemplatesSection'

export default async function AuditsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let canCreate = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    canCreate = profile?.role === 'admin' || profile?.role === 'manager'
  }

  const result = await getAudits({ page: 1, limit: 20 })
  const templates = await getAuditTemplates()

  return (
    <div className="space-y-10">
      <TemplatesSection templates={templates} basePath="/admin/store-operations/audits" canCreate={canCreate} />
      <AuditList
        initialData={result.data}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        basePath="/admin/store-operations/audits"
        canCreate={canCreate}
      />
    </div>
  )
}
