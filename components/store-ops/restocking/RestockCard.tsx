'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'

interface RestockCardProps {
  id: string
  status: string
  items_count: number
  notes: string | null
  created_at: string
  requestor_name: string | null
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Pending' },
  approved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Approved' },
  rejected: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Rejected' },
  completed: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Completed' },
}

export default function RestockCard({
  id, status, items_count, notes, created_at, requestor_name, basePath
}: RestockCardProps) {
  const style = statusStyles[status] || statusStyles.pending

  return (
    <Link
      href={`${basePath}/${id}`}
      className="block p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${style.bg} ${style.text} border`}>
              {style.label}
            </span>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate flex items-center gap-2">
            <Package size={14} className="text-slate-400 shrink-0" />
            {items_count} item{items_count !== 1 ? 's' : ''}
          </h3>
          {notes && (
            <p className="text-[10px] font-bold text-slate-500 mt-1 line-clamp-2">{notes}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[9px] font-bold text-slate-400">
            <span>{new Date(created_at).toLocaleDateString()}</span>
            {requestor_name && <span>by {requestor_name}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}
