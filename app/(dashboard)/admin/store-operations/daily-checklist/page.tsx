import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChecklistTemplateList from '@/components/store-ops/daily-checklist/ChecklistTemplateList'
import DailyChecklistHistory from '@/components/store-ops/daily-checklist/DailyChecklistHistory'

export default async function DailyChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('checklist_templates')
    .select('*')
    .order('type')
    .order('name')

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-medium text-slate-900 tracking-normal">Daily Checklist</h1>
        <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
          Manage templates and view history
        </p>
      </div>

      <ChecklistTemplateList templates={templates || []} />

      <div className="pt-8 border-t border-slate-200">
        <h2 className="text-lg font-medium text-slate-900 mb-6">History</h2>
        <DailyChecklistHistory />
      </div>
    </div>
  )
}
