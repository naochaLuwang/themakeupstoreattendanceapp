'use client'
import {runOperation} from '@/lib/store-ops/client-action';

import { mediaUrl } from '@/lib/store-ops/media'
import StoreImage from '@/components/store-ops/StoreImage'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, X, Trash2, Send, UserCircle,
  ImageIcon, Loader2, Calendar, Tag, Flag, UserCheck, MessageSquare
} from 'lucide-react'
import {
  updateIncidentStatus, deleteIncident, addIncidentComment,
  deleteIncidentImage, assignIncident
} from '@/app/actions/store-ops/incidents'
import type { IncidentWithRelations } from '@/lib/store-ops/types'
import { canManageApprovals, canDelete } from '@/lib/store-ops/permissions'
import { INCIDENT_STATUSES } from '@/lib/store-ops/constants'

interface IncidentDetailProps {
  incident: IncidentWithRelations
  userRole: string | null
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Open' },
  in_progress: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Resolved' },
  closed: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Closed' },
}

const typeLabels: Record<string, string> = {
  customer_complaint: 'Customer Complaint',
  power_failure: 'Power Failure',
  internet_down: 'Internet Down',
  theft: 'Theft',
  broken_fixture: 'Broken Fixture',
  emergency: 'Emergency',
  medical: 'Medical',
  other: 'Other',
}

export default function IncidentDetail({ incident, userRole, basePath }: IncidentDetailProps) {
  const router = useRouter()
  const supabase = createClient()

  const [currentIncident, setCurrentIncident] = useState(incident)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [assigneeEmail, setAssigneeEmail] = useState('')

  const style = statusStyles[currentIncident.status] || statusStyles.open
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)

  useEffect(() => {
    const channel = supabase.channel(`incident_${incident.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `id=eq.${incident.id}` },
        (payload) => {
          if (payload.new) setCurrentIncident(prev => ({ ...prev, ...payload.new as Record<string, unknown> }))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_comments', filter: `incident_id=eq.${incident.id}` },
        async () => {
          const { data } = await supabase
            .from('incident_comments')
            .select('*, profiles:profiles!created_by(full_name)')
            .eq('incident_id', incident.id)
            .order('created_at', { ascending: true })
          if (data) {
            setCurrentIncident(prev => ({ ...prev, incident_comments: data }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [incident.id, supabase])

  const handleStatusChange = async (status: string) => {
    const result = await runOperation(() => updateIncidentStatus(currentIncident.id, status))
    if (result.error) toast.error(result.error)
    else {
      toast.success(`Incident marked as ${status.replace('_', ' ')}`)
      setCurrentIncident(prev => ({ ...prev, status }))
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this incident permanently?')) return
    const result = await runOperation(() => deleteIncident(currentIncident.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Incident deleted')
      router.push(basePath)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    const result = await runOperation(() => addIncidentComment(currentIncident.id, comment.trim()))
    if (result.error) {
      toast.error(result.error)
    } else {
      setComment('')
    }
    setSubmitting(false)
  }

  const handleAssign = async () => {
    if (!assigneeEmail.trim()) return
    const { data: assignee } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', assigneeEmail.trim())
      .single()

    if (!assignee) {
      toast.error('User not found')
      return
    }

    const result = await runOperation(() => assignIncident(currentIncident.id, assignee.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Incident assigned')
      setAssigneeEmail('')
      setCurrentIncident(prev => ({
        ...prev,
        assigned_to: assignee.id,
        assigned_to_profile: { full_name: assigneeEmail.trim() },
      }))
    }
  }

  const statusActions = INCIDENT_STATUSES.filter(s => s !== currentIncident.status)

  return (
    <div className="ops-detail space-y-6">
      {currentIncident.voice_note_url && <audio controls src={mediaUrl(currentIncident.voice_note_url)} aria-label="Incident voice note" className="w-full" />}
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
                {currentIncident.title}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {typeLabels[currentIncident.incident_type] || currentIncident.incident_type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && <button type="button" onClick={()=>router.push(`${basePath}/${incident.id}/edit`)} className="rounded-lg border px-4 py-2 text-sm">Edit</button>}
          {isManager && statusActions.length > 0 && (
            <div className="flex items-center gap-1">
              {statusActions.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    s === 'resolved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                    s === 'closed' ? 'bg-slate-700 text-white hover:bg-slate-800' :
                    'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {s === 'resolved' ? <Check size={13} /> :
                   s === 'closed' ? <X size={13} /> :
                   <Flag size={13} />}
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
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
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={Tag} label="Type" value={typeLabels[currentIncident.incident_type] || currentIncident.incident_type} />
              <DetailItem icon={Flag} label="Priority" value={currentIncident.priority.charAt(0).toUpperCase() + currentIncident.priority.slice(1)} />
              <DetailItem icon={UserCircle} label="Reported By" value={currentIncident.profiles?.full_name || 'Unknown'} />
              <DetailItem icon={Calendar} label="Date" value={new Date(currentIncident.created_at).toLocaleDateString()} />
              <DetailItem icon={UserCheck} label="Assigned To" value={currentIncident.assigned_to_profile?.full_name || 'Unassigned'} />
              <DetailItem icon={MessageSquare} label="Comments" value={currentIncident.incident_comments?.length.toString() || '0'} />
            </div>
            {currentIncident.description && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{currentIncident.description}</p>
              </div>
            )}
          </div>

          {/* Assign */}
          {isManager && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Assign Incident</h2>
              <div className="flex gap-3">
                <input
                  value={assigneeEmail}
                  onChange={(e) => setAssigneeEmail(e.target.value)}
                  placeholder="Enter employee email..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
                />
                <button
                  onClick={handleAssign}
                  disabled={!assigneeEmail.trim()}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <UserCheck size={14} />
                  Assign
                </button>
              </div>
            </div>
          )}

          {/* Image Gallery */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Photos ({currentIncident.incident_images?.length || 0})
              </h2>
            </div>
            {currentIncident.incident_images && currentIncident.incident_images.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {currentIncident.incident_images.map((img) => (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => setSelectedImage(img.url)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-100 w-full"
                    >
                      <StoreImage src={img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          const result = await runOperation(() => deleteIncidentImage(img.id))
                          if (result.error) toast.error(result.error)
                          else toast.success('Image removed')
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
              Comments ({currentIncident.incident_comments?.length || 0})
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {currentIncident.incident_comments && currentIncident.incident_comments.length > 0 ? (
                currentIncident.incident_comments.map((c) => (
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
                icon={UserCircle}
                label="Reported"
                value={currentIncident.profiles?.full_name || 'Unknown'}
                date={currentIncident.created_at}
                active
              />
              {currentIncident.assigned_to && (
                <TimelineItem
                  icon={UserCheck}
                  label="Assigned"
                  value={currentIncident.assigned_to_profile?.full_name || 'Unknown'}
                  date={currentIncident.updated_at}
                  active
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Status" value={style.label} valueClass={style.text} />
              <StatRow label="Priority" value={currentIncident.priority.charAt(0).toUpperCase() + currentIncident.priority.slice(1)} />
              <StatRow label="Type" value={typeLabels[currentIncident.incident_type] || currentIncident.incident_type} />
              <StatRow label="Assignments" value={currentIncident.assigned_to ? 'Yes' : 'No'} />
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
