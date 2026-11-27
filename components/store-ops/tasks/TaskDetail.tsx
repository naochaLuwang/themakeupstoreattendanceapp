'use client'
import {runOperation} from '@/lib/store-ops/client-action';
import {prepareImage} from '@/lib/store-ops/image-compression'

import StoreImage from '@/components/store-ops/StoreImage'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, X, Trash2, Send, Upload,
  Loader2, User, Calendar, Tag, Clock,
  RefreshCw, Paperclip, FileText
} from 'lucide-react'
import {
  completeTask, cancelTask, deleteTask,
  addTaskComment, uploadTaskAttachment, saveTaskAttachment, deleteTaskAttachment
} from '@/app/actions/store-ops/tasks'
import type { TaskWithRelations } from '@/lib/store-ops/types'
import { canManageApprovals, canDelete } from '@/lib/store-ops/permissions'

interface TaskDetailProps {
  task: TaskWithRelations
  userRole: string | null
  basePath: string
}

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', label: 'Urgent' },
  high: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'High' },
  medium: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-500', label: 'Low' },
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-500', label: 'Pending' },
  in_progress: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Completed' },
  cancelled: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-500', label: 'Cancelled' },
}

export default function TaskDetail({ task, userRole, basePath }: TaskDetailProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentTask, setCurrentTask] = useState(task)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const ps = priorityStyles[currentTask.priority] || priorityStyles.medium
  const ss = statusStyles[currentTask.status] || statusStyles.pending
  const isManager = canManageApprovals(userRole as 'admin' | 'manager' | 'employee' | null)
  const isAdmin = canDelete(userRole as 'admin' | 'manager' | 'employee' | null)

  useEffect(() => {
    const channel = supabase.channel(`task_${task.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${task.id}` },
        (payload) => {
          if (payload.new) setCurrentTask(prev => ({ ...prev, ...payload.new as Partial<TaskWithRelations> }))
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` },
        async () => {
          const { data } = await supabase
            .from('task_comments')
            .select('*, profiles:profiles!created_by(full_name)')
            .eq('task_id', task.id)
            .order('created_at', { ascending: true })
          if (data) {
            setCurrentTask(prev => ({ ...prev, task_comments: data as TaskWithRelations['task_comments'] }))
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${task.id}` },
        async () => {
          const { data } = await supabase
            .from('task_attachments')
            .select('*')
            .eq('task_id', task.id)
            .order('created_at', { ascending: true })
          if (data) {
            setCurrentTask(prev => ({ ...prev, task_attachments: data as TaskWithRelations['task_attachments'] }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [task.id, supabase])

  const handleToggleComplete = async () => {
    const result = await runOperation(() => completeTask(currentTask.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.data?.status === 'completed' ? 'Task completed' : 'Task reopened')
    }
  }

  const handleCancel = async () => {
    const result = await runOperation(() => cancelTask(currentTask.id))
    if (result.error) toast.error(result.error)
    else toast.success('Task cancelled')
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task permanently?')) return
    const result = await runOperation(() => deleteTask(currentTask.id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Task deleted')
      router.push(basePath)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    const result = await runOperation(() => addTaskComment(currentTask.id, comment.trim()))
    if (result.error) {
      toast.error(result.error)
    } else {
      setComment('')
    }
    setSubmitting(false)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        const prepared=await prepareImage(file)
      formData.append('file', prepared.file)
      formData.append('thumbnail', prepared.thumbnail)

        const uploadResult = await runOperation(() => uploadTaskAttachment(formData))
        if (uploadResult.success && uploadResult.url) {
          const saveResult = await runOperation(() => saveTaskAttachment(currentTask.id, uploadResult.url))
          if (saveResult.error) {
            toast.error(saveResult.error)
          } else {
            const { data } = await supabase
              .from('task_attachments')
              .select('*')
              .eq('task_id', currentTask.id)
              .order('created_at', { ascending: true })
            if (data) {
              setCurrentTask(prev => ({ ...prev, task_attachments: data as TaskWithRelations['task_attachments'] }))
            }
          }
        } else {
          toast.error(uploadResult.error || 'Upload failed')
        }
      }
    } catch(cause) { toast.error(cause instanceof Error?cause.message:'Photo upload failed.') } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    const result = await runOperation(() => deleteTaskAttachment(attachmentId))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Attachment removed')
      setCurrentTask(prev => ({
        ...prev,
        task_attachments: prev.task_attachments.filter(a => a.id !== attachmentId)
      }))
    }
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
                {currentTask.title}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${ps.bg} ${ps.text}`}>
                {ps.label}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${ss.bg} ${ss.text}`}>
                {ss.label}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {currentTask.category || 'General'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && <button type="button" onClick={()=>router.push(`${basePath}/${task.id}/edit`)} className="rounded-lg border px-4 py-2 text-sm">Edit</button>}
          {currentTask.status !== 'completed' && currentTask.status !== 'cancelled' && (
            <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
              <Check size={13} /> Complete
            </button>
          )}
          {currentTask.status === 'completed' && (
            <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">
              <RefreshCw size={13} /> Reopen
            </button>
          )}
          {currentTask.status === 'pending' && isManager && (
            <button onClick={handleCancel} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
              <X size={13} /> Cancel
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
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Task Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={Tag} label="Priority" value={ps.label} />
              <DetailItem icon={Tag} label="Status" value={ss.label} />
              <DetailItem icon={Tag} label="Category" value={currentTask.category ? currentTask.category.charAt(0).toUpperCase() + currentTask.category.slice(1) : '—'} />
              <DetailItem icon={User} label="Assignee" value={currentTask.assigned_to_profile?.full_name || 'Unassigned'} />
              <DetailItem icon={User} label="Assigned By" value={currentTask.assigned_by_profile?.full_name || 'Unknown'} />
              <DetailItem icon={Calendar} label="Due Date" value={currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : '—'} />
              <DetailItem icon={RefreshCw} label="Recurring" value={currentTask.is_recurring ? 'Yes' : 'No'} />
              {currentTask.is_recurring && currentTask.recurrence_rule && (
                <DetailItem icon={Clock} label="Recurrence" value={currentTask.recurrence_rule} />
              )}
              <DetailItem icon={Calendar} label="Created" value={new Date(currentTask.created_at).toLocaleDateString()} />
            </div>
            {currentTask.description && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{currentTask.description}</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Attachments ({currentTask.task_attachments?.length || 0})
              </h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                onChange={handleUpload}
                className="hidden"
              />
            </div>
            {currentTask.task_attachments && currentTask.task_attachments.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentTask.task_attachments.map((att) => {
                  const isImage = att.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                  return (
                    <div key={att.id} className="relative group">
                      {isImage ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-xl overflow-hidden bg-slate-100 block"
                        >
                          <StoreImage src={att.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        </a>
                      ) : (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                          <FileText size={24} className="text-slate-400" />
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <Paperclip size={28} className="mx-auto text-slate-200" />
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">No attachments</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Comments ({currentTask.task_comments?.length || 0})
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
              {currentTask.task_comments && currentTask.task_comments.length > 0 ? (
                currentTask.task_comments.map((c) => (
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
          {/* Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Timeline</h3>
            <div className="space-y-4">
              <TimelineItem
                icon={User}
                label="Created By"
                value={currentTask.assigned_by_profile?.full_name || 'Unknown'}
                date={currentTask.created_at}
                active
              />
              {currentTask.assigned_to && (
                <TimelineItem
                  icon={User}
                  label="Assigned To"
                  value={currentTask.assigned_to_profile?.full_name || 'Unknown'}
                  date={currentTask.created_at}
                  active
                />
              )}
              {currentTask.status === 'completed' && (
                <TimelineItem
                  icon={Check}
                  label="Completed"
                  value="Task finished"
                  date={currentTask.updated_at}
                  active
                />
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Info</h3>
            <div className="space-y-3">
              <StatRow label="Priority" value={ps.label} valueClass={ps.text} />
              <StatRow label="Status" value={ss.label} valueClass={ss.text} />
              <StatRow label="Category" value={currentTask.category ? currentTask.category.charAt(0).toUpperCase() + currentTask.category.slice(1) : 'General'} />
              <StatRow label="Comments" value={(currentTask.task_comments?.length || 0).toString()} />
              <StatRow label="Attachments" value={(currentTask.task_attachments?.length || 0).toString()} />
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
