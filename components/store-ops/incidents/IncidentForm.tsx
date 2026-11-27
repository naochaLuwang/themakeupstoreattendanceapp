'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import StorePicker from '@/components/store-ops/StorePicker'
import VoiceNote from '@/components/store-ops/VoiceNote'
import { useOperationsDraft } from '@/lib/store-ops/use-draft'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { INCIDENT_TYPES, INCIDENT_PRIORITIES } from '@/lib/store-ops/constants'
import { createIncident, updateIncident, uploadIncidentImage } from '@/app/actions/store-ops/incidents'
import ImageUpload from '@/components/store-ops/ImageUpload'

interface IncidentFormProps {
  initialData?: {
    id: string
    title: string
    description: string | null
    incident_type: string
    priority: string
    voice_note_url?: string | null
    incident_images?: { url: string }[]
  }
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

export default function IncidentForm({ initialData }: IncidentFormProps) {
  const router = useRouter()
  const pathname=usePathname()
  const [storeId,setStoreId]=useState('')
  const [voice,setVoice]=useState(initialData?.voice_note_url || '')
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    incident_type: initialData?.incident_type || 'customer_complaint',
    priority: initialData?.priority || 'medium',
  })

  const [images, setImages] = useState<string[]>(
    initialData?.incident_images?.map(i => i.url) || []
  )

  const clearDraft=useOperationsDraft(`incident:${initialData?.id || 'new'}`,{form,images,storeId,voice},draft=>{setForm(draft.form);setImages(draft.images);setStoreId(draft.storeId);setVoice(draft.voice)})
  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.incident_type) errs.incident_type = 'Type is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        store_id:storeId||undefined,
        voice_note_url:voice||undefined,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        incident_type: form.incident_type,
        priority: form.priority,
        image_urls: images,
      }

      const result = isEditing
        ? await updateIncident(initialData.id, payload)
        : await createIncident(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Incident updated' : 'Incident created')
        clearDraft()
        router.push(pathname.startsWith('/employee')?'/employee/store-operations/incidents':'/admin/store-operations/incidents')
        router.refresh()
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The form could not be saved. Your draft is kept.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <form onSubmit={handleSubmit} className="ops-form space-y-8">
      {!isEditing && <StorePicker value={storeId} onChange={setStoreId} />}
      <VoiceNote value={voice} onChange={setVoice} />
      {/* Header */}
      <div className="ops-form-heading flex items-center justify-between">
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
              {isEditing ? 'Edit Incident' : 'New Incident'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Report an incident or issue
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Incident'}
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Brief title of the incident"
            className={`w-full px-4 py-3 rounded-xl border ${errors.title ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.title && <p className="text-[9px] font-bold text-rose-500">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.incident_type}
            onChange={(e) => updateField('incident_type', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.incident_type ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            {INCIDENT_TYPES.map(type => (
              <option key={type} value={type}>{typeLabels[type] || type}</option>
            ))}
          </select>
          {errors.incident_type && <p className="text-[9px] font-bold text-rose-500">{errors.incident_type}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => updateField('priority', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          >
            {INCIDENT_PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe the incident in detail..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
        />
      </div>

      <ImageUpload
        images={images}
        onChange={setImages}
        uploadAction={uploadIncidentImage}
      />
    </form>
  )
}
