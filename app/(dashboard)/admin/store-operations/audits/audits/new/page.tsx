import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditForm from '@/components/store-ops/audits/AuditForm'

export default async function NewAuditTemplatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    redirect('/admin/store-operations/audits')
  }

  return <AuditForm />
}
