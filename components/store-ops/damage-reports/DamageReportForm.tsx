'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import BarcodeInput from '@/components/store-ops/BarcodeInput'
import StorePicker from '@/components/store-ops/StorePicker'
import { useOperationsDraft } from '@/lib/store-ops/use-draft'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DAMAGE_TYPES } from '@/lib/store-ops/constants'
import { createDamageReport, updateDamageReport, uploadDamageImage } from '@/app/actions/store-ops/damage-reports'
import ImageUpload from '@/components/store-ops/ImageUpload'

interface DamageReportFormProps {
  initialData?: {
    id: string
    barcode: string
    product_name: string
    brand: string | null
    shade: string | null
    batch: string | null
    mrp: number | null
    quantity: number
    damage_type: string
    description: string | null
    damage_images?: { url: string }[]
  }
}

export default function DamageReportForm({ initialData }: DamageReportFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [storeId, setStoreId] = useState('')
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    barcode: initialData?.barcode || '',
    product_name: initialData?.product_name || '',
    brand: initialData?.brand || '',
    shade: initialData?.shade || '',
    batch: initialData?.batch || '',
    mrp: initialData?.mrp?.toString() || '',
    quantity: initialData?.quantity?.toString() || '1',
    damage_type: initialData?.damage_type || 'Broken',
    description: initialData?.description || '',
  })

  const [images, setImages] = useState<string[]>(
    initialData?.damage_images?.map(i => i.url) || []
  )

  const clearDraft = useOperationsDraft(`damage:${initialData?.id || 'new'}`, { form, images, storeId }, draft => { setForm(draft.form); setImages(draft.images); setStoreId(draft.storeId) })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.barcode.trim()) errs.barcode = 'Barcode is required'
    if (!form.product_name.trim()) errs.product_name = 'Product name is required'
    if (!form.damage_type) errs.damage_type = 'Damage type is required'
    const qty = parseInt(form.quantity)
    if (!qty || qty < 1) errs.quantity = 'Quantity must be at least 1'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        store_id: storeId || undefined,
        barcode: form.barcode.trim(),
        product_name: form.product_name.trim(),
        brand: form.brand.trim() || undefined,
        shade: form.shade.trim() || undefined,
        batch: form.batch.trim() || undefined,
        mrp: form.mrp ? parseFloat(form.mrp) : undefined,
        quantity: parseInt(form.quantity),
        damage_type: form.damage_type,
        description: form.description.trim() || undefined,
        image_urls: images,
      }

      const result = isEditing
        ? await updateDamageReport(initialData.id, payload)
        : await createDamageReport(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Damage report updated' : 'Damage report created')
        clearDraft()
        router.push(pathname.startsWith('/employee') ? '/employee/store-operations/damage-reports' : '/admin/store-operations/damage-reports')
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {!isEditing && <StorePicker value={storeId} onChange={setStoreId} />}
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
              {isEditing ? 'Edit Damage Report' : 'New Damage Report'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Report damaged or expired products
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Report'}
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Barcode <span className="text-rose-500">*</span>
          </label>
          <BarcodeInput value={form.barcode} onChange={value=>updateField('barcode',value)} onProduct={product=>{updateField('product_name',product.product_name);updateField('brand',product.brand||'')}} />
          {errors.barcode && <p className="text-[9px] font-bold text-rose-500">{errors.barcode}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Product Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.product_name}
            onChange={(e) => updateField('product_name', e.target.value)}
            placeholder="Product name"
            className={`w-full px-4 py-3 rounded-xl border ${errors.product_name ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.product_name && <p className="text-[9px] font-bold text-rose-500">{errors.product_name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brand</label>
          <input
            value={form.brand}
            onChange={(e) => updateField('brand', e.target.value)}
            placeholder="Brand name"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shade</label>
          <input
            value={form.shade}
            onChange={(e) => updateField('shade', e.target.value)}
            placeholder="Shade / color"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Batch</label>
          <input
            value={form.batch}
            onChange={(e) => updateField('batch', e.target.value)}
            placeholder="Batch number"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">MRP</label>
          <input
            type="number"
            step="0.01"
            value={form.mrp}
            onChange={(e) => updateField('mrp', e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Quantity <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(e) => updateField('quantity', e.target.value)}
            placeholder="1"
            className={`w-full px-4 py-3 rounded-xl border ${errors.quantity ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.quantity && <p className="text-[9px] font-bold text-rose-500">{errors.quantity}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Damage Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.damage_type}
            onChange={(e) => updateField('damage_type', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.damage_type ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            {DAMAGE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {errors.damage_type && <p className="text-[9px] font-bold text-rose-500">{errors.damage_type}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe the damage in detail..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
        />
      </div>

      <ImageUpload
        images={images}
        onChange={setImages}
        uploadAction={uploadDamageImage}
      />
    </form>
  )
}
