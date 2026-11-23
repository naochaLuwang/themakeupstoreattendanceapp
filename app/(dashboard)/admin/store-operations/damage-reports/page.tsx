import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DamageReportList from '@/components/store-ops/damage-reports/DamageReportList'
import { can } from '@/lib/store-ops/permissions'

export default async function DamageReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'employee'

  const { data, count } = await supabase
    .from('damage_reports')
    .select(`
      *,
      profiles:reported_by(full_name, email),
      damage_images(*),
      damage_comments(*, profiles:created_by(full_name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  return (
    <DamageReportList
      initialData={(data || []) as any}
      total={count || 0}
      page={1}
      totalPages={Math.ceil((count || 0) / 20)}
      basePath="/admin/store-operations/damage-reports"
      canCreate={can(role, 'damage_reports.create')}
    />
  )
}
