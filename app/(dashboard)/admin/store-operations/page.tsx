import {getAttendanceDate} from '@/lib/attendance/date';
import StoreImage from '@/components/store-ops/StoreImage';
import NotificationPanel from '@/components/store-ops/notifications/NotificationPanel';
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

  const today=getAttendanceDate()
  const todayStart=new Date(today+'T00:00:00+05:30')
  const tomorrow=new Date(todayStart.getTime()+86400_000)
  const inSevenDays=getAttendanceDate(new Date(todayStart.getTime()+7*86400_000))
  const [damageResult,incidentResult,taskResult,restockResult,testerResult,checklistResult,audits,activity,photos]=await Promise.all([
    supabase.from('damage_reports').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('incidents').select('*',{count:'exact',head:true}).in('status',['open','in_progress']),
    supabase.from('tasks').select('*',{count:'exact',head:true}).in('status',['pending','in_progress']).gte('due_date',todayStart.toISOString()).lt('due_date',tomorrow.toISOString()),
    supabase.from('restock_requests').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('testers').select('*',{count:'exact',head:true}).gte('expiry_date',today).lte('expiry_date',inSevenDays),
    supabase.from('daily_checklists').select('*',{count:'exact',head:true}).eq('date',today).eq('status','completed').is('superseded_at',null),
    supabase.from('audits').select('final_score,max_score').eq('status','completed').order('created_at',{ascending:false}).limit(10),
    supabase.from('store_operation_events').select('id,record_type,record_id,action,created_at').order('created_at',{ascending:false}).limit(15),
    supabase.from('inspection_images').select('id,url,inspection_id').order('created_at',{ascending:false}).limit(8),
  ])
  if([damageResult,incidentResult,taskResult,restockResult,testerResult,checklistResult,audits,activity,photos].some(result=>result.error))throw new Error('Store dashboard could not be loaded. Please retry.')
  const scores=(audits.data||[]).filter(audit=>audit.max_score && audit.final_score!==null).map(audit=>100* audit.final_score!/audit.max_score!)
  const auditScore=scores.length?Math.round(scores.reduce((sum,score)=>sum+score,0)/scores.length):0

  const cards: DashboardCard[] = [
    {title:'Recent audit score (%)',count:auditScore,href:'/admin/store-operations/audits'},
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
      title: "Checklists completed today",
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

      <section className="space-y-3"><h2 className="text-lg font-medium">Recent activity</h2>{activity.data?.length?<ul className="divide-y rounded-xl border">{activity.data.map(item=><li key={item.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{item.record_type.replaceAll('_',' ')} · {item.action}</span><time dateTime={item.created_at} className="text-slate-500">{new Date(item.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</time></li>)}</ul>:<p className="text-sm text-slate-500">No recent operations activity.</p>}</section>
      <section className="space-y-3"><h2 className="text-lg font-medium">Recent inspection photos</h2>{photos.data?.length?<div className="grid grid-cols-4 gap-2">{photos.data.map(photo=><Link key={photo.id} href={`/admin/store-operations/shelf-inspection/${photo.inspection_id}`} aria-label="Open inspection photo"><StoreImage src={photo.url} alt="Recent shelf inspection" thumbnail className="aspect-square w-full rounded-lg object-cover"/></Link>)}</div>:<p className="text-sm text-slate-500">No inspection photos yet.</p>}</section>
      <NotificationPanel userId={user.id} embedded operationsOnly/>
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
