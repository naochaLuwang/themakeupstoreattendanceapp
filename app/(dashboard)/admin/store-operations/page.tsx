import { createClient } from '@/lib/supabase/server'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface DashboardCard {
  title: string
  count: number
  href: string
}

export default async function StoreOpsDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [damageResult, incidentResult, taskResult, restockResult, testerResult, checklistResult] = await Promise.all([
    supabase.from('damage_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('restock_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('testers').select('*', { count: 'exact', head: true }).lte('expiry_date', sevenDaysFromNow.toISOString()).gte('expiry_date', new Date().toISOString()),
    supabase.from('daily_checklists').select('*', { count: 'exact', head: true }).eq('date', new Date().toISOString().split('T')[0]),
  ])

  const cards: DashboardCard[] = [
    {
      title: 'Pending damage reports',
      count: damageResult.count || 0,
      href: '/admin/store-operations/damage-reports',
    },
    {
      title: 'Open incidents',
      count: incidentResult.count || 0,
      href: '/admin/store-operations/incidents',
    },
    {
      title: "Today’s tasks",
      count: taskResult.count || 0,
      href: '/admin/store-operations/tasks',
    },
    {
      title: 'Pending restocks',
      count: restockResult.count || 0,
      href: '/admin/store-operations/restocking',
    },
    {
      title: 'Testers expiring in 7 days',
      count: testerResult.count || 0,
      href: '/admin/store-operations/testers',
    },
    {
      title: "Today’s checklists",
      count: checklistResult.count || 0,
      href: '/admin/store-operations/daily-checklist',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-slate-900 tracking-normal">Store operations</h1>
        <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
          Daily checks, store reports, and staff tasks
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
            >
              <p className="text-sm text-slate-500">{card.title}</p>
              <div className="flex items-end justify-between gap-4 mt-4">
                <p className="text-3xl font-medium text-slate-900">{card.count}</p>
                <ArrowRight size={16} className="text-slate-500" aria-hidden="true" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-medium text-slate-900 tracking-normal mb-1">Quick actions</h2>
        <p className="text-sm font-medium text-slate-500 mb-4">Common tasks</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'New inspection', href: '/admin/store-operations/shelf-inspection/new' },
            { label: 'Report damage', href: '/admin/store-operations/damage-reports/new' },
            { label: 'Create task', href: '/admin/store-operations/tasks/new' },
            { label: 'Run audit', href: '/admin/store-operations/audits/new' },
            { label: 'View reports', href: '/admin/store-operations/reports' },
          ].map((action, index) => (
            <Link
              key={action.label}
              href={action.href}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${index === 0 ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
