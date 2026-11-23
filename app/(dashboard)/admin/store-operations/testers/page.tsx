import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TesterList from '@/components/store-ops/testers/TesterList'
import { can } from '@/lib/store-ops/permissions'

export default async function TestersPage() {
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
    .from('testers')
    .select(`
      *,
      profiles:created_by(full_name),
      tester_logs(*, profiles:created_by(full_name))
    `, { count: 'exact' })
    .order('expiry_date', { ascending: true })
    .range(0, 19)

  return (
    <TesterList
      initialData={(data || []) as any}
      total={count || 0}
      page={1}
      totalPages={Math.ceil((count || 0) / 20)}
      basePath="/admin/store-operations/testers"
      canCreate={can(role, 'testers.create')}
    />
  )
}
