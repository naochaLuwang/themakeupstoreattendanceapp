import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DailyCheckListView from '@/components/store-ops/daily-checklist/DailyChecklistView'

export default async function EmployeeDailyChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="ops-page-heading">
        <h1 className="text-2xl font-medium text-slate-900 tracking-normal">Daily checklist</h1>
        <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
          Complete your opening and closing checklists
        </p>
      </div>
      <DailyCheckListView initialType="opening" />
    </div>
  )
}
