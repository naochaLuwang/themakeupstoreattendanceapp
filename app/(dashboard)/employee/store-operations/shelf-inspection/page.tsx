import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ShelfInspectionList from '@/components/store-ops/shelf-inspection/ShelfInspectionList'
import { can } from '@/lib/store-ops/permissions'

export default async function EmployeeShelfInspectionsPage() {
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
    .from('shelf_inspections')
    .select(`
      *,
      store_sections(name, description),
      profiles:employee_id(full_name, email),
      inspection_images(*),
      inspection_comments(*, profiles:created_by(full_name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  const { data: sections } = await supabase
    .from('store_sections')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <ShelfInspectionList
        initialData={(data || []) as any}
        total={count || 0}
        page={1}
        totalPages={Math.ceil((count || 0) / 20)}
        basePath="/employee/store-operations/shelf-inspection"
        canCreate={can(role, 'shelf_inspection.create')}
        sections={sections || []}
      />
    </div>
  )
}
