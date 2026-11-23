'use client'

import Link from 'next/link'
import { ImageIcon } from 'lucide-react'
import { INSPECTION_STATUSES } from '@/lib/store-ops/constants'

interface ShelfInspectionCardProps {
  id: string
  section_name: string | null
  status: string
  notes: string | null
  created_at: string
  employee_name: string | null
  images: { url: string }[]
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

export default function ShelfInspectionCard({
  id, section_name, status, notes, created_at, employee_name, images, basePath
}: ShelfInspectionCardProps) {
  const style = statusStyles[status] || { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: status }

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
          <h3 className="text-sm font-black text-slate-900 uppercase truncate">{section_name || 'Unknown Section'}</h3>
          {notes && (
            <p className="text-[10px] font-bold text-slate-500 mt-1 line-clamp-2">{notes}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[9px] font-bold text-slate-400">
            <span>{new Date(created_at).toLocaleDateString()}</span>
            {employee_name && <span>by {employee_name}</span>}
          </div>
        </div>
        {images.length > 0 && (
          <div className="shrink-0">
            {images[0] ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100">
                <img src={images[0].url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                <ImageIcon size={20} className="text-slate-300" />
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
