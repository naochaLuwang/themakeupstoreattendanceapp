import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ShelfInspectionDetail from '@/components/store-ops/shelf-inspection/ShelfInspectionDetail'

export default async function EmployeeShelfInspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: inspection, error } = await supabase
    .from('shelf_inspections')
    .select(`
      *,
      store_sections(name, description),
      profiles:employee_id(full_name, email),
      inspection_images(*),
      inspection_comments(*, profiles:created_by(full_name))
    `)
    .eq('id', id)
    .single()

  if (error || !inspection) notFound()

  return (
    <div className="space-y-6">
      <ShelfInspectionDetail
        inspection={inspection as any}
        userRole={profile?.role || 'employee'}
        basePath="/employee/store-operations/shelf-inspection"
      />
    </div>
  )
}
