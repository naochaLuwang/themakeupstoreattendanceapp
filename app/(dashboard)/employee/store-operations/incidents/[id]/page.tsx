import type { IncidentWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import IncidentDetail from '@/components/store-ops/incidents/IncidentDetail'

export default async function EmployeeIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: incident, error } = await supabase
    .from('incidents')
    .select(`
      *,
      profiles:profiles!created_by(full_name, email),
      assigned_to_profile:profiles!assigned_to(full_name),
      incident_images(*),
      incident_comments(*, profiles:profiles!created_by(full_name))
    `)
    .eq('id', id)
    .single()

  if (error || !incident) notFound()

  return (
    <div className="space-y-6">
      <IncidentDetail
        incident={incident as IncidentWithRelations}
        userRole={profile?.role || 'employee'}
        basePath="/employee/store-operations/incidents"
      />
    </div>
  )
}
