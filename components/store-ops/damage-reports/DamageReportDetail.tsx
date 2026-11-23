'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, X, Archive, Trash2, Send,
  ImageIcon, Loader2, User, Calendar, Hash, Tag, DollarSign, Package
} from 'lucide-react'
import {
  approveDamageReport, rejectDamageReport, archiveDamageReport,
  deleteDamageReport, addDamageComment, deleteDamageImage
} from '@/app/actions/store-ops/damage-reports'
import type { DamageReportWithRelations } from '@/lib/store-ops/types'
import { canManageApprovals, canDelete } from '@/lib/store-ops/permissions'

interface DamageReportDetailProps {
  report: DamageReportWithRelations
  userRole: string | null
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Pending Review' },
  approved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Approved' },
  rejected: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Rejected' },
  archived: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Archived' },
}

export default function DamageReportDetail({ report, userRole, basePath }: DamageReportDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  const [currentReport, setCurrentReport] = useState(report)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const style = statusStyles[currentReport.status] || statusStyles.pending
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)

  useEffect(() => {
    const channel = supabase.channel(`damage_report_${report.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'damage_reports', filter: `id=eq.${report.id}` },
        (payload) => {
          if (payload.new) setCurrentReport(prev => ({ ...prev, ...payload.new as any }))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'damage_comments', filter: `damage_report_id=eq.${report.id}` },
        async () => {
          const { data } = await supabase
            .from('damage_comments')
            .select('*, profiles:created_by(full_name)')
            .eq('damage_report_id', report.id)
            .order('created_at', { ascending: true })
          if (data) {
            setCurrentReport(prev => ({ ...prev, damage_comments: data as any }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [report.id, supabase])

  const handleApprove = async () => {
    const result = await approveDamageReport(currentReport.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Damage report approved')
      setCurrentReport(prev => ({ ...prev, status: 'approved' }))
    }
  }

  const handleReject = async () => {
    const result = await rejectDamageReport(currentReport.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Damage report rejected')
      setCurrentReport(prev => ({ ...prev, status: 'rejected' }))
    }
  }

  const handleArchive = async () => {
    const result = await archiveDamageReport(currentReport.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Damage report archived')
      setCurrentReport(prev => ({ ...prev, status: 'archived' }))
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this damage report permanently?')) return
    const result = await deleteDamageReport(currentReport.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Damage report deleted')
      router.push(basePath)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    const result = await addDamageComment(currentReport.id, comment.trim())
    if (result.error) {
      toast.error(result.error)
    } else {
      setComment('')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
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
                {currentReport.product_name}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              #{currentReport.barcode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentReport.status === 'pending' && isManager && (
            <>
              <button onClick={handleApprove} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
                <Check size={13} /> Approve
              </button>
              <button onClick={handleReject} className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
                <X size={13} /> Reject
              </button>
            </>
          )}
          {isManager && currentReport.status !== 'archived' && (
            <button onClick={handleArchive} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
              <Archive size={13} /> Archive
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
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={Hash} label="Barcode" value={currentReport.barcode} />
              <DetailItem icon={Tag} label="Brand" value={currentReport.brand || '—'} />
              <DetailItem icon={Tag} label="Shade" value={currentReport.shade || '—'} />
              <DetailItem icon={Package} label="Batch" value={currentReport.batch || '—'} />
              <DetailItem icon={DollarSign} label="MRP" value={currentReport.mrp ? `₹${currentReport.mrp}` : '—'} />
              <DetailItem icon={Package} label="Quantity" value={currentReport.quantity.toString()} />
              <DetailItem icon={Tag} label="Damage Type" value={currentReport.damage_type} />
              <DetailItem icon={User} label="Reported By" value={currentReport.profiles?.full_name || 'Unknown'} />
              <DetailItem icon={Calendar} label="Date" value={new Date(currentReport.created_at).toLocaleDateString()} />
            </div>
            {currentReport.description && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{currentReport.description}</p>
              </div>
            )}
          </div>

          {/* Image Gallery */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Photos ({currentReport.damage_images?.length || 0})
              </h2>
            </div>
            {currentReport.damage_images && currentReport.damage_images.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {currentReport.damage_images.map((img) => (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => setSelectedImage(img.url)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-100 w-full"
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          await deleteDamageImage(img.id)
                          toast.success('Image removed')
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <ImageIcon size={28} className="mx-auto text-slate-200" />
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">No photos</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Comments ({currentReport.damage_comments?.length || 0})
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {currentReport.damage_comments && currentReport.damage_comments.length > 0 ? (
                currentReport.damage_comments.map((c) => (
                  <div key={c.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-black shrink-0 uppercase">
                      {(c as any).profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase">
                          {(c as any).profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 mt-0.5">{c.comment}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] font-bold text-slate-400 text-center py-6">No comments yet</p>
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
              />
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Timeline</h3>
            <div className="space-y-4">
              <TimelineItem
                icon={User}
                label="Reported"
                value={currentReport.profiles?.full_name || 'Unknown'}
                date={currentReport.created_at}
                active
              />
              {currentReport.reviewed_by && (
                <TimelineItem
                  icon={currentReport.status === 'approved' ? Check : X}
                  label={currentReport.status === 'approved' ? 'Approved' : 'Reviewed'}
                  value={`by ${currentReport.reviewed_by}`}
                  date={currentReport.reviewed_at || ''}
                  active
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Damage Value" value={currentReport.mrp ? `₹${(currentReport.mrp * currentReport.quantity).toLocaleString()}` : '—'} />
              <StatRow label="Status" value={style.label} valueClass={style.text} />
              <StatRow label="Quantity" value={currentReport.quantity.toString()} />
              <StatRow label="Type" value={currentReport.damage_type} />
            </div>
          </div>
        </div>
      </div>

      {/* Image Fullscreen Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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

function TimelineItem({ icon: Icon, label, value, date, active }: { icon: any; label: string; value: string; date: string; active?: boolean }) {
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
