import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import IncidentForm from '@/components/store-ops/incidents/IncidentForm'

export default async function EmployeeNewIncidentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'incidents.create')) {
    redirect('/employee/store-operations/incidents')
  }

  return (
    <div className="space-y-6">
      <IncidentForm />
    </div>
  )
}
