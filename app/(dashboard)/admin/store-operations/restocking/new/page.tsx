import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import RestockForm from '@/components/store-ops/restocking/RestockForm'

export default async function NewRestockRequestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'restock.create')) {
    redirect('/admin/store-operations/restocking')
  }

  return <RestockForm />
}
