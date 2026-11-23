import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import TesterForm from '@/components/store-ops/testers/TesterForm'

export default async function EditTesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'testers.edit')) {
    redirect('/admin/store-operations/testers')
  }

  const { data: tester, error } = await supabase
    .from('testers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !tester) notFound()

  return (
    <TesterForm
      initialData={{
        id: tester.id,
        product_name: tester.product_name,
        brand: tester.brand,
        shade: tester.shade,
        opened_date: tester.opened_date,
        expiry_date: tester.expiry_date,
        condition: tester.condition,
        remaining_percentage: tester.remaining_percentage,
      }}
    />
  )
}
