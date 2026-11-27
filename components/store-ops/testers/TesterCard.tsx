'use client'

import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

interface TesterCardProps {
  id: string
  product_name: string
  brand: string | null
  shade: string | null
  condition: string
  remaining_percentage: number
  expiry_date: string | null
  needs_replacement: boolean
  basePath: string
}

const expiryBadge = (expiry: string | null) => {
  if (!expiry) return null
  const daysLeft = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Expired', class: 'bg-rose-50 border-rose-200 text-rose-600' }
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, class: 'bg-amber-50 border-amber-200 text-amber-600' }
  return null
}

const conditionStyles: Record<string, { bg: string; text: string }> = {
  good: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  fair: { bg: 'bg-amber-50', text: 'text-amber-600' },
  poor: { bg: 'bg-orange-50', text: 'text-orange-600' },
  finished: { bg: 'bg-rose-50', text: 'text-rose-600' },
}

export default function TesterCard({
  id, product_name, brand, shade, condition, remaining_percentage, expiry_date, needs_replacement, basePath
}: TesterCardProps) {
  const expiry = expiryBadge(expiry_date)
  const condStyle = conditionStyles[condition] || conditionStyles.good
  const barColor = remaining_percentage > 50 ? 'bg-emerald-500' : remaining_percentage > 20 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <Link
      href={`${basePath}/${id}`}
      className="ops-record-card block p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {expiry && (
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${expiry.class}`}>
                {expiry.label}
              </span>
            )}
            {needs_replacement && (
              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-600">
                Replace
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${condStyle.bg} ${condStyle.text}`}>
              {condition}
            </span>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase truncate">{product_name}</h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
            {brand && <span>{brand}</span>}
            {shade && <span>{shade}</span>}
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Remaining</span>
              <span className="text-[10px] font-black text-slate-900">{remaining_percentage}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${remaining_percentage}%` }}
              />
            </div>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <FlaskConical size={20} className="text-slate-400" />
        </div>
      </div>
    </Link>
  )
}
