import type { DamageReportWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DamageReportDetail from '@/components/store-ops/damage-reports/DamageReportDetail'

export default async function EmployeeDamageReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: report, error } = await supabase
    .from('damage_reports')
    .select(`
      *,
      profiles:profiles!reported_by(full_name, email),
      damage_images(*),
      damage_comments(*, profiles:profiles!created_by(full_name))
    `)
    .eq('id', id)
    .single()

  if (error || !report) notFound()

  return (
    <div className="space-y-6">
      <DamageReportDetail
        report={report as DamageReportWithRelations}
        userRole={profile?.role || 'employee'}
        basePath="/employee/store-operations/damage-reports"
      />
    </div>
  )
}
