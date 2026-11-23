import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChecklistTemplateForm from '@/components/store-ops/daily-checklist/ChecklistTemplateForm'

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    redirect('/admin/store-operations/daily-checklist')
  }

  return <ChecklistTemplateForm />
}
