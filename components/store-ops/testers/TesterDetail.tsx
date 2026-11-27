'use client'
import {runOperation} from '@/lib/store-ops/client-action';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, Edit3,
  Calendar, User, Package, Loader2, Send, AlertTriangle
} from 'lucide-react'
import {
  deleteTester, logTesterAction, markNeedsReplacement
} from '@/app/actions/store-ops/testers'
import { canDelete, canManageApprovals } from '@/lib/store-ops/permissions'
import type { TesterWithRelations } from '@/lib/store-ops/types'

interface TesterDetailProps {
  tester: TesterWithRelations
  userRole: string | null
  basePath: string
  canEdit: boolean
}

const conditionStyles: Record<string, { bg: string; text: string; label: string }> = {
  good: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Good' },
  fair: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Fair' },
  poor: { bg: 'bg-orange-50 border-orange-100', text: 'text-orange-600', label: 'Poor' },
  finished: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Finished' },
}

export default function TesterDetail({ tester, userRole, basePath, canEdit }: TesterDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  const [currentTester, setCurrentTester] = useState(tester)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const style = conditionStyles[currentTester.condition] || conditionStyles.good
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)

  const daysLeft = currentTester.expiry_date
    ? Math.ceil((new Date(currentTester.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const expiryStatus = daysLeft !== null
    ? daysLeft < 0 ? { label: 'Expired', class: 'text-rose-600' }
      : daysLeft <= 30 ? { label: `${daysLeft} days left`, class: 'text-amber-600' }
      : { label: `${daysLeft} days left`, class: 'text-slate-400' }
    : null

  const barColor = currentTester.remaining_percentage > 50 ? 'bg-emerald-500'
    : currentTester.remaining_percentage > 20 ? 'bg-amber-500' : 'bg-rose-500'

  useEffect(() => {
    const channel = supabase.channel(`tester_${tester.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'testers', filter: `id=eq.${tester.id}` },
        (payload) => {
          if (payload.new) setCurrentTester(prev => ({ ...prev, ...payload.new as Partial<TesterWithRelations> }))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tester_logs', filter: `tester_id=eq.${tester.id}` },
        async () => {
          const { data } = await supabase
            .from('tester_logs')
            .select('*, profiles:profiles!created_by(full_name)')
            .eq('tester_id', tester.id)
            .order('created_at', { ascending: false })
          if (data) {
            setCurrentTester(prev => ({ ...prev, tester_logs: data as TesterWithRelations['tester_logs'] }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tester.id, supabase])

  const handleDelete = async () => {
    if (!confirm('Delete this tester permanently?')) return
    const result = await runOperation(() => deleteTester(currentTester.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Tester deleted')
      router.push(basePath)
    }
  }

  const handleMarkReplace = async () => {
    const result = await runOperation(() => markNeedsReplacement(currentTester.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Marked for replacement')
      setCurrentTester(prev => ({ ...prev, needs_replacement: true }))
    }
  }

  const handleLogAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    const result = await runOperation(() => logTesterAction(currentTester.id, 'comment', comment.trim()))
    if (result.error) {
      toast.error(result.error)
    } else {
      setComment('')
    }
    setSubmitting(false)
  }

  return (
    <div className="ops-detail space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {currentTester.product_name}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {currentTester.needs_replacement && (
                <span className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border bg-rose-50 border-rose-200 text-rose-600">
                  Replace
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {currentTester.brand && `${currentTester.brand} `}
              {currentTester.shade && `• ${currentTester.shade}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => router.push(`${basePath}/${currentTester.id}/edit`)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              <Edit3 size={13} /> Edit
            </button>
          )}
          {isManager && !currentTester.needs_replacement && (
            <button onClick={handleMarkReplace} className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
              <AlertTriangle size={13} /> Mark Replace
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-rose-200 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tester Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={Package} label="Product" value={currentTester.product_name} />
              <DetailItem icon={Package} label="Brand" value={currentTester.brand || '—'} />
              <DetailItem icon={Package} label="Shade" value={currentTester.shade || '—'} />
              <DetailItem icon={Calendar} label="Opened" value={currentTester.opened_date ? new Date(currentTester.opened_date).toLocaleDateString() : '—'} />
              <DetailItem icon={Calendar} label="Expiry" value={currentTester.expiry_date ? new Date(currentTester.expiry_date).toLocaleDateString() : '—'} />
              <DetailItem icon={Calendar} label="Condition" value={style.label} />
              <DetailItem icon={User} label="Created By" value={currentTester.profiles?.full_name || 'Unknown'} />
              <DetailItem icon={Calendar} label="Created" value={new Date(currentTester.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Remaining % Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Product</h2>
              <span className="text-2xl font-black text-slate-900">{currentTester.remaining_percentage}%</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${currentTester.remaining_percentage}%` }}
              />
            </div>
            {expiryStatus && (
              <p className={`text-[10px] font-bold mt-2 ${expiryStatus.class}`}>
                {expiryStatus.label}
              </p>
            )}
          </div>

          {/* Activity Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Activity Log ({currentTester.tester_logs?.length || 0})
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {currentTester.tester_logs && currentTester.tester_logs.length > 0 ? (
                currentTester.tester_logs.map((log) => (
                  <div key={log.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-black shrink-0 uppercase">
                      {log.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase">
                          {log.profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{log.action}</p>
                      {log.notes && <p className="text-xs font-bold text-slate-600 mt-0.5">{log.notes}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] font-bold text-slate-400 text-center py-6">No activity recorded</p>
              )}
            </div>

            <form onSubmit={handleLogAction} className="flex gap-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
              />
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Log
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Condition" value={style.label} valueClass={style.text} />
              <StatRow label="Remaining" value={`${currentTester.remaining_percentage}%`} />
              <StatRow label="Needs Replacement" value={currentTester.needs_replacement ? 'Yes' : 'No'} valueClass={currentTester.needs_replacement ? 'text-rose-600' : 'text-slate-400'} />
              <StatRow label="Status" value={expiryStatus?.label || 'No expiry'} valueClass={expiryStatus?.class} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Expiry Timeline</h3>
            <div className="space-y-4">
              {currentTester.opened_date && (
                <TimelineItem
                  icon={Calendar}
                  label="Opened"
                  date={currentTester.opened_date}
                  active
                />
              )}
              {currentTester.expiry_date && (
                <TimelineItem
                  icon={AlertTriangle}
                  label={daysLeft !== null && daysLeft < 0 ? 'Expired' : 'Expires'}
                  date={currentTester.expiry_date}
                  active
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }: { icon: import('lucide-react').LucideIcon; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
        <Icon size={11} />
        {label}
      </div>
      <p className="text-sm font-black text-slate-900">{value}</p>
    </div>
  )
}

function TimelineItem({ icon: Icon, label, date, active }: { icon: import('lucide-react').LucideIcon; label: string; date: string; active?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={13} />
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-900 uppercase">{label}</p>
        <p className="text-[9px] font-bold text-slate-500">{new Date(date).toLocaleDateString()}</p>
      </div>
    </div>
  )
}

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-black ${valueClass || 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
