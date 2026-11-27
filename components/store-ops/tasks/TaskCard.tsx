'use client'

import Link from 'next/link'
import { Clock, User } from 'lucide-react'

interface TaskCardProps {
  id: string
  title: string
  priority: string
  status: string
  due_date: string | null
  assignee_name: string | null
  category: string | null
  basePath: string
}

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', label: 'Urgent' },
  high: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'High' },
  medium: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-500', label: 'Low' },
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Pending' },
  in_progress: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Completed' },
  cancelled: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-500', label: 'Cancelled' },
}

export default function TaskCard({
  id, title, priority, status, due_date, assignee_name, category, basePath
}: TaskCardProps) {
  const ps = priorityStyles[priority] || priorityStyles.medium
  const ss = statusStyles[status] || statusStyles.pending

  return (
    <Link
      href={`${basePath}/${id}`}
      className="ops-record-card block p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${ps.bg} ${ps.text}`}>
              {ps.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${ss.bg} ${ss.text}`}>
              {ss.label}
            </span>
            {category && (
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                {category}
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate">{title}</h3>
          <div className="flex items-center gap-3 mt-2 text-[9px] font-bold text-slate-400">
            {assignee_name && (
              <span className="flex items-center gap-1">
                <User size={10} />
                {assignee_name}
              </span>
            )}
            {due_date && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {new Date(due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
