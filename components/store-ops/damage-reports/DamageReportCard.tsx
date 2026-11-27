'use client'

import StoreImage from '@/components/store-ops/StoreImage'

import Link from 'next/link'
import { ImageIcon } from 'lucide-react'

interface DamageReportCardProps {
  id: string
  barcode: string
  product_name: string
  brand: string | null
  quantity: number
  damage_type: string
  status: string
  created_at: string
  reporter_name: string | null
  images: { url: string }[]
  basePath: string
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', label: 'Pending' },
  approved: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', label: 'Approved' },
  rejected: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-600', label: 'Rejected' },
  archived: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', label: 'Archived' },
}

export default function DamageReportCard({
  id, barcode, product_name, brand, quantity, damage_type, status, created_at, reporter_name, images, basePath
}: DamageReportCardProps) {
  const style = statusStyles[status] || statusStyles.pending

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
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              {damage_type}
            </span>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate">{product_name}</h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
            {brand && <span>{brand}</span>}
            <span>Qty: {quantity}</span>
            <span>#{barcode}</span>
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
