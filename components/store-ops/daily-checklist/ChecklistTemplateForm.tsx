'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CHECKLIST_TYPES, DEFAULT_OPENING_ITEMS, DEFAULT_CLOSING_ITEMS } from '@/lib/store-ops/constants'
import StorePicker from '@/components/store-ops/StorePicker'
import { useOperationsDraft } from '@/lib/store-ops/use-draft'
import { createTemplate, updateTemplate } from '@/app/actions/store-ops/daily-checklist'

interface ChecklistTemplateFormProps {
  initialData?: {
    id: string
    name: string
    type: 'opening' | 'closing'
    items: { id?: string; label: string; sort_order: number }[]
  }
}

export default function ChecklistTemplateForm({ initialData }: ChecklistTemplateFormProps) {
  const router = useRouter()
  const [storeId, setStoreId] = useState('')
  const [requiresPhoto, setRequiresPhoto] = useState(true)
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState<'opening' | 'closing'>(initialData?.type || 'opening')
  const [items, setItems] = useState<string[]>(
    initialData?.items?.map(i => i.label) || []
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const clearDraft = useOperationsDraft(`checklist-template:${initialData?.id || 'new'}`, {name,type,items,storeId,requiresPhoto}, draft=>{setName(draft.name);setType(draft.type);setItems(draft.items);setStoreId(draft.storeId);setRequiresPhoto(draft.requiresPhoto)})

  const addItem = () => {
    setItems([...items, ''])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    setItems(newItems)
  }

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const newItems = [...items]
    const [moved] = newItems.splice(from, 1)
    newItems.splice(to, 0, moved)
    setItems(newItems)
  }

  const fillDefaults = (t: 'opening' | 'closing') => {
    setType(t)
    if (!isEditing) {
      setItems(t === 'opening'
        ? [...DEFAULT_OPENING_ITEMS]
        : [...DEFAULT_CLOSING_ITEMS]
      )
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    const validItems = items.filter(i => i.trim())
    if (validItems.length === 0) errs.items = 'Add at least one item'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const cleanItems = items.filter(i => i.trim())
      const result = isEditing
        ? await updateTemplate(initialData.id, { name: name.trim(), type, items: cleanItems, requires_photo: requiresPhoto })
        : await createTemplate({ name: name.trim(), type, items: cleanItems, store_id: storeId || undefined, requires_photo: requiresPhoto })

      if (result.error) {
        toast.error(result.error)
      } else {
        clearDraft()
        toast.success(isEditing ? 'Template updated' : 'Template created')
        router.push('/admin/store-operations/daily-checklist')
        router.refresh()
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The form could not be saved. Your draft is kept.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {!isEditing && <StorePicker value={storeId} onChange={setStoreId} />}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={requiresPhoto} onChange={e=>setRequiresPhoto(e.target.checked)} />Require photo proof before completion</label>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {isEditing ? 'Edit Template' : 'New Template'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isEditing ? 'Update checklist template' : 'Create a daily checklist template'}
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
            placeholder="e.g. Opening Checklist"
            className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.name && <p className="text-[9px] font-bold text-rose-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Type</label>
          <div className="flex gap-2">
            {CHECKLIST_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => fillDefaults(t)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  type === t
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Items <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={12} /> Add Item
          </button>
        </div>

        {errors.items && <p className="text-[9px] font-bold text-rose-500">{errors.items}</p>}

        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group">
              <div className="text-slate-300 cursor-grab active:cursor-grabbing">
                <GripVertical size={14} />
              </div>
              <span className="text-[9px] font-bold text-slate-400 w-5">{index + 1}.</span>
              <input
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder="Task description"
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
              />
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button type="button" onClick={() => moveItem(index, index - 1)} className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                )}
                {index < items.length - 1 && (
                  <button type="button" onClick={() => moveItem(index, index + 1)} className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                )}
                <button type="button" onClick={() => removeItem(index)} className="p-1.5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <button
            type="button"
            onClick={() => fillDefaults(type)}
            className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-slate-300 transition-colors"
          >
            <Plus size={16} className="mx-auto mb-1" />
            Add items or use defaults
          </button>
        )}
      </div>
    </form>
  )
}
