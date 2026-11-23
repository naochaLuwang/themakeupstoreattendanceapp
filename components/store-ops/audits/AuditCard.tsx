'use client'

import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

interface AuditCardProps {
  id: string
  templateName: string
  category: string | null
  finalScore: number | null
  maxScore: number | null
  status: string
  conductedByName: string | null
  createdAt: string
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  in_progress: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Completed' },
}

export default function AuditCard({
  id, templateName, category, finalScore, maxScore, status, conductedByName, createdAt, basePath
}: AuditCardProps) {
  const style = statusStyles[status] || statusStyles.in_progress
  const pct = finalScore !== null && maxScore && maxScore > 0
    ? Math.round((finalScore / maxScore) * 100)
    : null

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
            {category && (
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                {category.replace('_', ' ')}
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate mt-1">{templateName}</h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
            <span>{new Date(createdAt).toLocaleDateString()}</span>
            {conductedByName && <span>by {conductedByName}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {pct !== null ? (
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-slate-900">{pct}%</span>
              <span className="text-[9px] font-bold text-slate-400">{finalScore}/{maxScore}</span>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center">
              <ClipboardCheck size={24} className="text-amber-400" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
