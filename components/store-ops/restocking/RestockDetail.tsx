'use client'
import {runOperation} from '@/lib/store-ops/client-action';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, X, Trash2, Package,
   User
} from 'lucide-react'
import {
  approveRestockRequest, rejectRestockRequest,
  completeRestockRequest, deleteRestockRequest
} from '@/app/actions/store-ops/restocking'
import type { RestockRequestWithRelations } from '@/lib/store-ops/types'
import { canManageApprovals, canDelete } from '@/lib/store-ops/permissions'

interface RestockDetailProps {
  request: RestockRequestWithRelations
  userRole: string | null
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Pending Review' },
  approved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Approved' },
  rejected: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Rejected' },
  completed: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Completed' },
}

export default function RestockDetail({ request, userRole, basePath }: RestockDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  const [currentRequest, setCurrentRequest] = useState(request)
  const [submitting, setSubmitting] = useState(false)

  const style = statusStyles[currentRequest.status] || statusStyles.pending
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)

  useEffect(() => {
    const channel = supabase.channel(`restock_request_${request.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'restock_requests', filter: `id=eq.${request.id}` },
        (payload) => {
          if (payload.new) setCurrentRequest(prev => ({ ...prev, ...payload.new as Partial<RestockRequestWithRelations> }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [request.id, supabase])

  const handleApprove = async () => {
    setSubmitting(true)
    const result = await runOperation(() => approveRestockRequest(currentRequest.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Restock request approved')
      setCurrentRequest(prev => ({ ...prev, status: 'approved' }))
    }
    setSubmitting(false)
  }

  const handleReject = async () => {
    setSubmitting(true)
    const result = await runOperation(() => rejectRestockRequest(currentRequest.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Restock request rejected')
      setCurrentRequest(prev => ({ ...prev, status: 'rejected' }))
    }
    setSubmitting(false)
  }

  const handleComplete = async () => {
    setSubmitting(true)
    const result = await runOperation(() => completeRestockRequest(currentRequest.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Restock completed')
      setCurrentRequest(prev => ({ ...prev, status: 'completed' }))
    }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this restock request permanently?')) return
    const result = await runOperation(() => deleteRestockRequest(currentRequest.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Restock request deleted')
      router.push(basePath)
    }
  }

  const items = currentRequest.restock_items || []

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
                {currentRequest.notes || 'Restock Request'}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && currentRequest.status==='pending' && <button type="button" onClick={()=>router.push(`${basePath}/${request.id}/edit`)} className="rounded-lg border px-4 py-2 text-sm">Edit</button>}
          {currentRequest.status === 'pending' && isManager && (
            <>
              <button onClick={handleApprove} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                <Check size={13} /> Approve
              </button>
              <button onClick={handleReject} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50">
                <X size={13} /> Reject
              </button>
            </>
          )}
          {currentRequest.status === 'approved' && isManager && (
            <button onClick={handleComplete} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
              <Check size={13} /> Complete
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
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="text-left px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Barcode</th>
                  <th className="text-left px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Brand</th>
                  <th className="text-right px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Qty Needed</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <Package size={24} className="mx-auto text-slate-200" />
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">No items</p>
                    </td>
                  </tr>
                ) : (
                  items.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 last:border-none">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900 uppercase">{item.product_name}</p>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-bold text-slate-500">#{item.barcode}</td>
                      <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{item.brand || '—'}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.quantity_needed}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {currentRequest.notes && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Notes</h2>
              <p className="text-sm font-bold text-slate-700 leading-relaxed">{currentRequest.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Timeline</h3>
            <div className="space-y-4">
              <TimelineItem
                icon={User}
                label="Requested by"
                value={currentRequest.profiles?.full_name || 'Unknown'}
                date={currentRequest.created_at}
                active
              />
              {currentRequest.approved_by && (
                <TimelineItem
                  icon={Check}
                  label="Approved"
                  value={`by ${currentRequest.approved_by}`}
                  date={currentRequest.approved_at || ''}
                  active
                />
              )}
              {currentRequest.status === 'completed' && (
                <TimelineItem
                  icon={Package}
                  label="Completed"
                  value="Restock finished"
                  date={currentRequest.updated_at}
                  active
                />
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Status" value={style.label} valueClass={style.text} />
              <StatRow label="Items" value={items.length.toString()} />
              <StatRow label="Date" value={new Date(currentRequest.created_at).toLocaleDateString()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ icon: Icon, label, value, date, active }: { icon: import('lucide-react').LucideIcon; label: string; value: string; date: string; active?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={13} />
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-900 uppercase">{label}</p>
        <p className="text-[9px] font-bold text-slate-500">{value}</p>
        <p className="text-[8px] text-slate-400">{new Date(date).toLocaleDateString()}</p>
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
