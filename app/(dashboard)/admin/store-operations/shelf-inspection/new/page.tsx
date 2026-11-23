import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import ShelfInspectionForm from '@/components/store-ops/shelf-inspection/ShelfInspectionForm'

export default async function NewShelfInspectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'shelf_inspection.create')) {
    redirect('/admin/store-operations/shelf-inspection')
  }

  return <ShelfInspectionForm />
}
