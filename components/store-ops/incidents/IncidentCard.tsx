'use client'

import StoreImage from '@/components/store-ops/StoreImage'

import Link from 'next/link'
import { ImageIcon } from 'lucide-react'

interface IncidentCardProps {
  id: string
  title: string
  incident_type: string
  priority: string
  status: string
  created_at: string
  reporter_name: string | null
  images: { url: string }[]
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', label: 'Open' },
  in_progress: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Resolved' },
  closed: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Closed' },
}

const priorityStyles: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-500',
  high: 'text-rose-500',
  urgent: 'text-rose-600',
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

export default function IncidentCard({
  id, title, incident_type, priority, status, created_at, reporter_name, images, basePath
}: IncidentCardProps) {
  const style = statusStyles[status] || statusStyles.open

  return (
    <Link
      href={`${basePath}/${id}`}
      className="ops-record-card block p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${style.bg} ${style.text} border`}>
              {style.label}
            </span>
            <span className={`text-[8px] font-bold uppercase tracking-wider ${priorityStyles[priority] || 'text-slate-400'}`}>
              {priority}
            </span>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate">{title}</h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
            <span>{typeLabels[incident_type] || incident_type}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px] font-bold text-slate-400">
            <span>{new Date(created_at).toLocaleDateString()}</span>
            {reporter_name && <span>by {reporter_name}</span>}
          </div>
        </div>
        {images.length > 0 && (
          <div className="shrink-0">
            {images[0] ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100">
                <StoreImage src={images[0].url} alt="" className="w-full h-full object-cover" />
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
