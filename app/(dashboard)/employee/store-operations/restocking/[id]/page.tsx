import type { RestockRequestWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import RestockDetail from '@/components/store-ops/restocking/RestockDetail'

export default async function RestockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: request, error } = await supabase
    .from('restock_requests')
    .select(`
      *,
      profiles:profiles!created_by(full_name),
      restock_items(*)
    `)
    .eq('id', id)
    .single()

  if (error || !request) notFound()

  return (
    <RestockDetail
      request={request as RestockRequestWithRelations}
      userRole={profile?.role || 'employee'}
      basePath="/employee/store-operations/restocking"
    />
  )
}
