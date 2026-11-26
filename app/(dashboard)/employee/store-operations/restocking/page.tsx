import type { RestockRequestWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestockList from '@/components/store-ops/restocking/RestockList'
import { can } from '@/lib/store-ops/permissions'

export default async function EmployeeRestockingPage() {
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
    .from('restock_requests')
    .select(`
      *,
      profiles:profiles!created_by(full_name),
      restock_items(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  if(loadError)throw new Error('Store operations records could not be loaded.');
  return (
    <div className="space-y-6">
      <RestockList
        initialData={(data || []) as RestockRequestWithRelations[]}
        total={count || 0}
        page={1}
        totalPages={Math.ceil((count || 0) / 20)}
        basePath="/employee/store-operations/restocking"
        canCreate={can(role, 'restock.create')}
      />
    </div>
  )
}
