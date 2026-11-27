'use client'
import {runOperation} from '@/lib/store-ops/client-action';

import StoreImage from '@/components/store-ops/StoreImage'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, Trash2, Send, X,
  ImageIcon, Loader2, User, Calendar, MessageSquare
} from 'lucide-react'
import {
  approveShelfInspection, deleteShelfInspection,
  addInspectionComment
} from '@/app/actions/store-ops/shelf-inspection'
import type { ShelfInspectionWithRelations } from '@/lib/store-ops/types'
import { canManageApprovals, canDelete } from '@/lib/store-ops/permissions'


interface ShelfInspectionDetailProps {
  inspection: ShelfInspectionWithRelations
  userRole: string | null
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  good: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Good' },
  needs_restock: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Needs Restock' },
  dirty: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'Dirty' },
  wrong_display: { bg: 'bg-orange-50 border-orange-100', text: 'text-orange-600', label: 'Wrong Display' },
  missing_tester: { bg: 'bg-purple-50 border-purple-100', text: 'text-purple-600', label: 'Missing Tester' },
  missing_price_tag: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Missing Price Tag' },
  damaged_display: { bg: 'bg-red-50 border-red-100', text: 'text-red-600', label: 'Damaged Display' },
}

export default function ShelfInspectionDetail({ inspection, userRole, basePath }: ShelfInspectionDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  const [currentInspection, setCurrentInspection] = useState(inspection)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const style = statusStyles[currentInspection.status] || statusStyles.good
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)
  const isReviewed = !!currentInspection.reviewed_by

  useEffect(() => {
    const channel = supabase.channel(`shelf_inspection_${inspection.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shelf_inspections', filter: `id=eq.${inspection.id}` },
        (payload) => {
          if (payload.new) setCurrentInspection(prev => ({ ...prev, ...payload.new as Partial<ShelfInspectionWithRelations> }))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspection_comments', filter: `inspection_id=eq.${inspection.id}` },
        async () => {
          const { data } = await supabase
            .from('inspection_comments')
            .select('*, profiles:profiles!created_by(full_name)')
            .eq('inspection_id', inspection.id)
            .order('created_at', { ascending: true })
          if (data) {
            setCurrentInspection(prev => ({ ...prev, inspection_comments: data as ShelfInspectionWithRelations['inspection_comments'] }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [inspection.id, supabase])

  const handleApprove = async () => {
    const result = await runOperation(() => approveShelfInspection(currentInspection.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Inspection approved')
      if (result.data) setCurrentInspection(prev => ({ ...prev, ...result.data }))
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this inspection permanently?')) return
    const result = await runOperation(() => deleteShelfInspection(currentInspection.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Inspection deleted')
      router.push(basePath)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    const result = await runOperation(() => addInspectionComment(currentInspection.id, comment.trim()))
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
                {currentInspection.store_sections?.name || 'Unknown Section'}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Shelf Inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && <button type="button" onClick={() => router.push(`${basePath}/${inspection.id}/edit`)} className="rounded-lg border px-4 py-2 text-sm">Edit</button>}
          {!isReviewed && isManager && (
            <button onClick={handleApprove} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
              <Check size={13} /> Approve
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
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspection Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={MessageSquare} label="Section" value={currentInspection.store_sections?.name || '—'} />
              <DetailItem icon={User} label="Employee" value={currentInspection.profiles?.full_name || 'Unknown'} />
              <DetailItem icon={Calendar} label="Date" value={new Date(currentInspection.created_at).toLocaleDateString()} />
              <DetailItem icon={Check} label="Status" value={style.label} />
              <DetailItem icon={Check} label="Reviewed" value={isReviewed ? 'Yes' : 'No'} />
            </div>
            {currentInspection.notes && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{currentInspection.notes}</p>
              </div>
            )}
          </div>

          {/* Image Gallery */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Photos ({currentInspection.inspection_images?.length || 0})
              </h2>
            </div>
            {currentInspection.inspection_images && currentInspection.inspection_images.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {currentInspection.inspection_images.map((img) => (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => setSelectedImage(img.url)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-100 w-full"
                    >
                      <StoreImage src={img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </button>
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
              Comments ({currentInspection.inspection_comments?.length || 0})
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {currentInspection.inspection_comments && currentInspection.inspection_comments.length > 0 ? (
                currentInspection.inspection_comments.map((c) => (
                  <div key={c.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-black shrink-0 uppercase">
                      {c.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase">
                          {c.profiles?.full_name || 'Unknown'}
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
                label="Inspected by"
                value={currentInspection.profiles?.full_name || 'Unknown'}
                date={currentInspection.created_at}
                active
              />
              {isReviewed && (
                <TimelineItem
                  icon={Check}
                  label="Reviewed"
                  value="Approved"
                  date={currentInspection.reviewed_at || ''}
                  active
                />
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Section" value={currentInspection.store_sections?.name || '—'} />
              <StatRow label="Status" value={style.label} valueClass={style.text} />
              <StatRow label="Reviewed" value={isReviewed ? 'Yes' : 'No'} />
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
          <StoreImage
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
