'use client'

import { useState, useEffect } from 'react'
import { Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { getChecklistHistory } from '@/app/actions/store-ops/daily-checklist'

interface HistoryItem {
  id: string
  type: 'opening' | 'closing'
  date: string
  status: string
  completed_at: string | null
  completed_by: string | null
  photo_url: string | null
  notes: string | null
  profiles: { full_name: string | null } | null
  checklist_templates: { name: string }
  daily_checklist_items: { id: string; label: string; is_completed: boolean }[]
}

export default function DailyChecklistHistory() {
  const [data, setData] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError,setLoadError]=useState<string|null>(null)
  const [typeFilter, setTypeFilter] = useState<'opening' | 'closing' | ''>('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getChecklistHistory(typeFilter || undefined).then(result => {
      setData(result)
      setLoadError(null)
      setLoading(false)
    }).catch(()=>{setLoadError('Checklist history could not be loaded. Refresh to retry.');setLoading(false)})
  }, [typeFilter])

  return (
    <div className="space-y-4">
      {loadError&&<p role="alert" className="text-sm text-rose-600">{loadError}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            typeFilter === '' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setTypeFilter('opening')}
          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            typeFilter === 'opening' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'
          }`}
        >
          Opening
        </button>
        <button
          onClick={() => setTypeFilter('closing')}
          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            typeFilter === 'closing' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'
          }`}
        >
          Closing
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[10px] font-bold text-slate-400">Loading...</div>
      ) : data.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
          <Clock size={32} className="mx-auto text-slate-200" />
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">No checklist history</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(item => {
            const isOpen = expanded === item.id
            const done = item.daily_checklist_items?.filter(i => i.is_completed).length ?? 0
            const total = item.daily_checklist_items?.length ?? 0
            return (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'
                    }`}>
                      {item.status === 'completed' ? <Check size={18} /> : <X size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                          item.type === 'opening' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs font-black text-slate-900 uppercase">{item.checklist_templates?.name}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {new Date(item.date).toLocaleDateString()}
                        {item.profiles && <span> · {item.profiles.full_name}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400">{done}/{total}</span>
                    {isOpen ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-2 border-t border-slate-100 pt-4">
                    {item.daily_checklist_items?.map(i => (
                      <div key={i.id} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                          i.is_completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'
                        }`}>
                          {i.is_completed && <Check size={11} />}
                        </div>
                        <span className={`text-xs font-bold ${i.is_completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {i.label}
                        </span>
                      </div>
                    ))}
                    {item.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-3 pt-3 border-t border-slate-50">
                        Notes: {item.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
