import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import DamageReportForm from '@/components/store-ops/damage-reports/DamageReportForm'

export default async function NewDamageReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'damage_reports.create')) {
    redirect('/admin/store-operations/damage-reports')
  }

  return <DamageReportForm />
}
