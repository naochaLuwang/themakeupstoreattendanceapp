import type { DamageReportWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DamageReportList from '@/components/store-ops/damage-reports/DamageReportList'
import { can } from '@/lib/store-ops/permissions'

export default async function EmployeeDamageReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'employee'

  const { data, count, error: loadError } = await supabase
    .from('damage_reports')
    .select(`
      *,
      profiles:profiles!reported_by(full_name, email),
      damage_images(*),
      damage_comments(*, profiles:profiles!created_by(full_name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  if(loadError)throw new Error('Store operations records could not be loaded.');
  return (
    <div className="space-y-6">
      <DamageReportList
        initialData={(data || []) as DamageReportWithRelations[]}
        total={count || 0}
        page={1}
        totalPages={Math.ceil((count || 0) / 20)}
        basePath="/employee/store-operations/damage-reports"
        canCreate={can(role, 'damage_reports.create')}
      />
    </div>
  )
}
