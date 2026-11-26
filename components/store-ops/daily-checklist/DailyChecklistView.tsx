'use client'
import {runOperation} from '@/lib/store-ops/client-action';
import ImageUpload from '@/components/store-ops/ImageUpload'
import StorePicker from '@/components/store-ops/StorePicker'

import { useState, useEffect, useCallback } from 'react'

import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check,   Loader2, ClipboardCheck, Play } from 'lucide-react'
import {
  startDailyChecklist, completeChecklistItem,
  completeDailyChecklist, uploadChecklistPhoto,
  getTodayChecklist, getTemplates
} from '@/app/actions/store-ops/daily-checklist'

interface Template {
  id: string
  name: string
  type: 'opening' | 'closing'
}

interface ChecklistItem {
  id: string
  label: string
  is_completed: boolean
  completed_by: string | null
  completed_at: string | null
  photo_url: string | null
  sort_order: number
  profiles?: { full_name: string | null } | null
}

interface Checklist {
  id: string
  template_id: string
  type: 'opening' | 'closing'
  date: string
  status: string
  completed_by: string | null
  completed_at: string | null
  photo_url: string | null
  notes: string | null
  daily_checklist_items: ChecklistItem[]
}

export default function DailyCheckListView({ initialType }: { initialType: 'opening' | 'closing' }) {

  const supabase = createClient()
  const [type, setType] = useState<'opening' | 'closing'>(initialType)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [storeId, setStoreId] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchChecklist = useCallback(async () => {
    setLoading(true)
    let data: Awaited<ReturnType<typeof getTodayChecklist>> = null
    try { data = await getTodayChecklist(type, storeId || undefined); setLoadError(null) } catch { setLoadError('Today’s checklist could not be loaded. Refresh to retry.') }
    if (data && !('error' in data)) {
      setChecklist(data as Checklist)
    } else {
      setChecklist(null)
    }
    setLoading(false)
  }, [type, storeId])

  const fetchTemplates = useCallback(async () => {
    const data = await getTemplates().catch(() => { setLoadError('Templates could not be loaded.'); return [] })
    setTemplates(data.filter((t) => t.type === type && !checklist && (!storeId || t.store_id === storeId)))
  }, [type, checklist, storeId])

  useEffect(() => {
    fetchChecklist()
  }, [fetchChecklist])

  useEffect(() => {
    if (!checklist) fetchTemplates()
  }, [checklist, fetchTemplates])

  useEffect(() => {
    if (!checklist) return
    const channel = supabase.channel(`checklist_${checklist.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'daily_checklist_items', filter: `daily_checklist_id=eq.${checklist.id}` },
        () => { fetchChecklist() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [checklist, fetchChecklist, supabase])

  const handleStartChecklist = async (templateId: string) => {
    const result = await runOperation(() => startDailyChecklist(templateId, type))
    if (result.error) {
      toast.error(result.error)
    }
    fetchChecklist()
  }

  const handleToggleItem = async (itemId: string) => {
    const result = await runOperation(() => completeChecklistItem(itemId))
    if (result.error) toast.error(result.error)
    else {
      setChecklist(prev => {
        if (!prev) return prev
        return {
          ...prev,
          daily_checklist_items: prev.daily_checklist_items.map(item =>
            item.id === itemId
              ? { ...item, is_completed: result.completed ?? !item.is_completed }
              : item
          )
        }
      })
    }
  }

  const handleCompleteChecklist = async () => {
    if (!checklist) return
    setCompleting(true)
    const result = await runOperation(() => completeDailyChecklist(checklist.id, photos[0], notes || undefined))
    if (result.error) toast.error(result.error)
    else {
      toast.success(`${type === 'opening' ? 'Opening' : 'Closing'} checklist completed!`)
      fetchChecklist()
    }
    setCompleting(false)
  }

  const allDone = checklist?.daily_checklist_items?.every(i => i.is_completed) ?? false
  const doneCount = checklist?.daily_checklist_items?.filter(i => i.is_completed).length ?? 0
  const totalCount = checklist?.daily_checklist_items?.length ?? 0

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StorePicker value={storeId} onChange={setStoreId} />
      {loadError && <p role="alert" className="text-sm text-rose-600">{loadError}</p>}
      {/* Type Toggle */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit">
        {(['opening', 'closing'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === t ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!checklist || checklist.status !== 'in_progress' ? (
        <div className="space-y-4">
          {checklist?.status === 'completed' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
              <Check size={32} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-sm font-black text-emerald-700 uppercase">Today&apos;s {type} checklist completed</h3>
              <p className="text-[10px] font-bold text-emerald-500 mt-1">
                {checklist.completed_at ? new Date(checklist.completed_at).toLocaleTimeString() : ''}
              </p>
            </div>
          )}

          <h2 className="text-lg font-black text-slate-900 uppercase">Start {type} Checklist</h2>

          {templates.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <ClipboardCheck size={32} className="mx-auto text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">
                No {type} templates available. Ask an admin to create one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleStartChecklist(t.id)}
                  className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <span className="text-sm font-black text-slate-900 uppercase">{t.name}</span>
                  <Play size={16} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase">{type} Checklist</h3>
              <span className="text-[10px] font-bold text-slate-400">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          <ImageUpload images={photos} onChange={setPhotos} maxImages={1} uploadAction={uploadChecklistPhoto} />
          {/* Items */}
          <div className="space-y-2">
            {checklist.daily_checklist_items
              ?.slice().sort((a, b) => a.sort_order - b.sort_order)
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                    item.is_completed
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    item.is_completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300'
                  }`}>
                    {item.is_completed && <Check size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold transition-all ${
                      item.is_completed ? 'text-emerald-600 line-through' : 'text-slate-900'
                    }`}>
                      {item.label}
                    </p>
                    {item.completed_at && (
                      <p className="text-[8px] font-bold text-emerald-400 mt-0.5">
                        {new Date(item.completed_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </button>
              ))}
          </div>

          {/* Complete Button */}
          {allDone && checklist.status === 'in_progress' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes (optional)..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
              />
              <button
                onClick={handleCompleteChecklist}
                disabled={completing}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {completing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {completing ? 'Completing...' : 'Complete Checklist'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
