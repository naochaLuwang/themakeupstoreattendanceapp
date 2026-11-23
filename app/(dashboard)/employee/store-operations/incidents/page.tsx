import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IncidentList from '@/components/store-ops/incidents/IncidentList'
import { can } from '@/lib/store-ops/permissions'

export default async function EmployeeIncidentsPage() {
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
    .from('incidents')
    .select(`
      *,
      profiles:created_by(full_name, email),
      assigned_to_profile:assigned_to(full_name),
      incident_images(*),
      incident_comments(*, profiles:created_by(full_name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  return (
    <div className="space-y-6">
      <IncidentList
        initialData={(data || []) as any}
        total={count || 0}
        page={1}
        totalPages={Math.ceil((count || 0) / 20)}
        basePath="/employee/store-operations/incidents"
        canCreate={can(role, 'incidents.create')}
      />
    </div>
  )
}
