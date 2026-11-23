import { createClient } from '@/lib/supabase/server'
import {
  ClipboardCheck, AlertTriangle, Bug, Package, FlaskConical, ListTodo,
  ClipboardList, ShieldAlert, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

interface ModuleStat {
  title: string
  count: number
  icon: typeof ClipboardCheck
  href: string
  color: string
  description: string
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const [
    inspections, damages, testers, tasks, audits, incidents, restocks, checklists
  ] = await Promise.all([
    supabase.from('shelf_inspections').select('*', { count: 'exact', head: true }),
    supabase.from('damage_reports').select('*', { count: 'exact', head: true }),
    supabase.from('testers').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    supabase.from('audits').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }),
    supabase.from('restock_requests').select('*', { count: 'exact', head: true }),
    supabase.from('daily_checklists').select('*', { count: 'exact', head: true }),
  ])

  const modules: ModuleStat[] = [
    {
      title: 'Shelf Inspections',
      count: inspections.count || 0,
      icon: ClipboardCheck,
      href: '/admin/store-operations/shelf-inspection',
      color: 'text-sky-600 bg-sky-50',
      description: 'All inspections recorded',
    },
    {
      title: 'Damage Reports',
      count: damages.count || 0,
      icon: Bug,
      href: '/admin/store-operations/damage-reports',
      color: 'text-rose-600 bg-rose-50',
      description: 'Total damage entries',
    },
    {
      title: 'Testers',
      count: testers.count || 0,
      icon: FlaskConical,
      href: '/admin/store-operations/testers',
      color: 'text-emerald-600 bg-emerald-50',
      description: 'Testers in system',
    },
    {
      title: 'Tasks',
      count: tasks.count || 0,
      icon: ListTodo,
      href: '/admin/store-operations/tasks',
      color: 'text-blue-600 bg-blue-50',
      description: 'All tasks created',
    },
    {
      title: 'Audits',
      count: audits.count || 0,
      icon: ShieldAlert,
      href: '/admin/store-operations/audits',
      color: 'text-violet-600 bg-violet-50',
      description: 'Audits conducted',
    },
    {
      title: 'Incidents',
      count: incidents.count || 0,
      icon: AlertTriangle,
      href: '/admin/store-operations/incidents',
      color: 'text-amber-600 bg-amber-50',
      description: 'Incidents reported',
    },
    {
      title: 'Restock Requests',
      count: restocks.count || 0,
      icon: Package,
      href: '/admin/store-operations/restocking',
      color: 'text-indigo-600 bg-indigo-50',
      description: 'Restock requests',
    },
    {
      title: 'Daily Checklists',
      count: checklists.count || 0,
      icon: ClipboardList,
      href: '/admin/store-operations/daily-checklist',
      color: 'text-slate-600 bg-slate-100',
      description: 'Checklists completed',
    },
  ]

  const total = modules.reduce((acc, m) => acc + m.count, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-slate-900 tracking-normal">Reports</h1>
        <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
          {total} total records across all modules
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${mod.color}`}>
                  <Icon size={20} />
                </div>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-slate-600 transition-colors" />
              </div>
              <p className="text-3xl font-medium text-slate-900 mt-4">{mod.count}</p>
              <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">{mod.title}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{mod.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
