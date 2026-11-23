import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ChecklistTemplateForm from '@/components/store-ops/daily-checklist/ChecklistTemplateForm'

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: template } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (!template) notFound()

  const { data: items } = await supabase
    .from('daily_checklist_items')
    .select('*')
    .eq('daily_checklist_id', id)
    .order('sort_order')

  return (
    <ChecklistTemplateForm
      initialData={{
        id: template.id,
        name: template.name,
        type: template.type as 'opening' | 'closing',
        items: (items || []).map(i => ({ id: i.id, label: i.label, sort_order: i.sort_order })),
      }}
    />
  )
}
