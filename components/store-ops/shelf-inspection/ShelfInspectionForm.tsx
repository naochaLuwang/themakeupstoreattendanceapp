'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { INSPECTION_STATUSES } from '@/lib/store-ops/constants'
import { createShelfInspection, updateShelfInspection, uploadInspectionImage } from '@/app/actions/store-ops/shelf-inspection'
import { createClient } from '@/lib/supabase/client'
import ImageUpload from '@/components/store-ops/ImageUpload'

interface ShelfInspectionFormProps {
  initialData?: {
    id: string
    section_id: string
    status: string
    notes: string | null
    inspection_images?: { url: string }[]
  }
}

const statusLabels: Record<string, string> = {
  good: 'Good',
  needs_restock: 'Needs Restock',
  dirty: 'Dirty',
  wrong_display: 'Wrong Display',
  missing_tester: 'Missing Tester',
  missing_price_tag: 'Missing Price Tag',
  damaged_display: 'Damaged Display',
}

export default function ShelfInspectionForm({ initialData }: ShelfInspectionFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sections, setSections] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState({
    section_id: initialData?.section_id || '',
    status: initialData?.status || 'good',
    notes: initialData?.notes || '',
  })

  const [images, setImages] = useState<string[]>(
    initialData?.inspection_images?.map(i => i.url) || []
  )

  useEffect(() => {
    const fetchSections = async () => {
      const { data } = await supabase
        .from('store_sections')
        .select('id, name')
        .order('name', { ascending: true })
      if (data) setSections(data)
    }
    fetchSections()
  }, [supabase])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.section_id) errs.section_id = 'Section is required'
    if (!form.status) errs.status = 'Status is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        section_id: form.section_id,
        status: form.status,
        notes: form.notes.trim() || undefined,
        image_urls: images,
      }

      const result = isEditing
        ? await updateShelfInspection(initialData.id, payload)
        : await createShelfInspection(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Shelf inspection updated' : 'Shelf inspection created')
        router.back()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {isEditing ? 'Edit Shelf Inspection' : 'New Shelf Inspection'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Inspect and record shelf conditions
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Inspection'}
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Section <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.section_id}
            onChange={(e) => updateField('section_id', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.section_id ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            <option value="">Select section...</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.section_id && <p className="text-[9px] font-bold text-rose-500">{errors.section_id}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Status <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.status}
            onChange={(e) => updateField('status', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.status ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            {INSPECTION_STATUSES.map(s => (
              <option key={s} value={s}>{statusLabels[s] || s}</option>
            ))}
          </select>
          {errors.status && <p className="text-[9px] font-bold text-rose-500">{errors.status}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Describe the shelf condition..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
        />
      </div>

      <ImageUpload
        images={images}
        onChange={setImages}
        uploadAction={uploadInspectionImage}
      />
    </form>
  )
}
