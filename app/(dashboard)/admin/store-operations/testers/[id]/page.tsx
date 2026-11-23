import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TesterDetail from '@/components/store-ops/testers/TesterDetail'
import { can } from '@/lib/store-ops/permissions'

export default async function TesterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: tester, error } = await supabase
    .from('testers')
    .select(`
      *,
      profiles:created_by(full_name),
      tester_logs(*, profiles:created_by(full_name))
    `)
    .eq('id', id)
    .single()

  if (error || !tester) notFound()

  return (
    <TesterDetail
      tester={tester as any}
      userRole={profile?.role || 'employee'}
      basePath="/admin/store-operations/testers"
      canEdit={can(profile?.role || 'employee', 'testers.edit')}
    />
  )
}
