'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TESTER_CONDITIONS } from '@/lib/store-ops/constants'
import { createTester, updateTester } from '@/app/actions/store-ops/testers'

interface TesterFormProps {
  initialData?: {
    id: string
    product_name: string
    brand: string | null
    shade: string | null
    opened_date: string | null
    expiry_date: string | null
    condition: string
    remaining_percentage: number
  }
}

export default function TesterForm({ initialData }: TesterFormProps) {
  const router = useRouter()
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    product_name: initialData?.product_name || '',
    brand: initialData?.brand || '',
    shade: initialData?.shade || '',
    opened_date: initialData?.opened_date || '',
    expiry_date: initialData?.expiry_date || '',
    condition: initialData?.condition || 'good',
    remaining_percentage: initialData?.remaining_percentage?.toString() || '100',
  })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.product_name.trim()) errs.product_name = 'Product name is required'
    if (!form.expiry_date) errs.expiry_date = 'Expiry date is required'
    const rem = parseInt(form.remaining_percentage)
    if (isNaN(rem) || rem < 0 || rem > 100) errs.remaining_percentage = 'Must be 0-100'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        product_name: form.product_name.trim(),
        brand: form.brand.trim() || undefined,
        shade: form.shade.trim() || undefined,
        opened_date: form.opened_date || undefined,
        expiry_date: form.expiry_date || undefined,
        condition: form.condition,
        remaining_percentage: parseInt(form.remaining_percentage),
      }

      const result = isEditing
        ? await updateTester(initialData.id, payload)
        : await createTester(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Tester updated' : 'Tester created')
        router.push('/admin/store-operations/testers')
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
              {isEditing ? 'Edit Tester' : 'New Tester'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isEditing ? 'Update tester details' : 'Add a new tester product'}
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Tester'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Opened Date</label>
          <input
            type="date"
            value={form.opened_date}
            onChange={(e) => updateField('opened_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Expiry Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) => updateField('expiry_date', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.expiry_date ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.expiry_date && <p className="text-[9px] font-bold text-rose-500">{errors.expiry_date}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Condition</label>
          <select
            value={form.condition}
            onChange={(e) => updateField('condition', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          >
            {TESTER_CONDITIONS.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Remaining % <span className="text-rose-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={form.remaining_percentage}
            onChange={(e) => updateField('remaining_percentage', e.target.value)}
            className="flex-1 h-2 rounded-full appearance-none bg-slate-200 accent-slate-900"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={form.remaining_percentage}
              onChange={(e) => updateField('remaining_percentage', e.target.value)}
              className={`w-20 px-3 py-2.5 rounded-xl border text-center text-sm font-black ${
                errors.remaining_percentage ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'
              } text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
            />
            <span className="text-xs font-black text-slate-400">%</span>
          </div>
        </div>
        {errors.remaining_percentage && <p className="text-[9px] font-bold text-rose-500">{errors.remaining_percentage}</p>}
        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              parseInt(form.remaining_percentage) > 50 ? 'bg-emerald-500' :
              parseInt(form.remaining_percentage) > 20 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${form.remaining_percentage}%` }}
          />
        </div>
      </div>
    </form>
  )
}
