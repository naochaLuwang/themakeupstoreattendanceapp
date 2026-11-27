'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import StorePicker from '@/components/store-ops/StorePicker'
import BarcodeInput from '@/components/store-ops/BarcodeInput'
import { useOperationsDraft } from '@/lib/store-ops/use-draft'
import { createRestockRequest, updateRestockRequest } from '@/app/actions/store-ops/restocking'

interface RestockItemForm {
  id: string
  barcode: string
  product_name: string
  brand: string
  quantity_needed: string
}

export default function RestockForm({initialData}:{initialData?:{id:string;notes:string|null;supplier_notes:string|null;restock_items:{id:string;barcode:string;product_name:string;brand:string|null;quantity_needed:number}[]}}) {
  const router = useRouter()
  const [storeId,setStoreId]=useState('')
  const [supplierNotes,setSupplierNotes]=useState(initialData?.supplier_notes || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState(initialData?.notes || '')

  const [items, setItems] = useState<RestockItemForm[]>(initialData?.restock_items.map(item=>({...item,brand:item.brand||'',quantity_needed:String(item.quantity_needed)})) || [
    { id: crypto.randomUUID(), barcode: '', product_name: '', brand: '', quantity_needed: '1' },
  ])

  const clearDraft=useOperationsDraft(`restock:${initialData?.id || 'new'}`,{items,notes,storeId,supplierNotes},draft=>{setItems(draft.items);setNotes(draft.notes);setStoreId(draft.storeId);setSupplierNotes(draft.supplierNotes)})
  const addItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), barcode: '', product_name: '', brand: '', quantity_needed: '1' }])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof RestockItemForm, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    const key = `${id}-${field}`
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    items.forEach((item, idx) => {
      if (!item.barcode.trim()) errs[`${item.id}-barcode`] = `Item ${idx + 1}: Barcode is required`
      if (!item.product_name.trim()) errs[`${item.id}-product_name`] = `Item ${idx + 1}: Product name is required`
      const qty = parseInt(item.quantity_needed)
      if (!qty || qty < 1) errs[`${item.id}-quantity_needed`] = `Item ${idx + 1}: Quantity must be at least 1`
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = items.map(item => ({
        barcode: item.barcode.trim(),
        product_name: item.product_name.trim(),
        brand: item.brand.trim() || undefined,
        quantity_needed: parseInt(item.quantity_needed),
      }))

      const result = initialData ? await updateRestockRequest(initialData.id,payload,notes.trim()||undefined,supplierNotes||undefined) : await createRestockRequest(payload, notes.trim() || undefined, storeId || undefined)

      if (result.error) {
        toast.error(result.error)
      } else {
        clearDraft()
        toast.success(initialData?'Restock request updated':'Restock request created')
        router.back()
        router.refresh()
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The form could not be saved. Your draft is kept.')
    } finally {
      setSaving(false)
    }
  }

  const errorBorder = (key: string) => errors[key] ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'

  return (
    <form onSubmit={handleSubmit} className="ops-form space-y-8">
      {!initialData && <StorePicker value={storeId} onChange={setStoreId} />}
      {initialData && <label className="block text-sm">Supplier notes<textarea value={supplierNotes} onChange={e=>setSupplierNotes(e.target.value)} className="mt-1 w-full rounded border bg-transparent p-3" maxLength={5000}/></label>}
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
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">New Restock Request</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Request products to be restocked
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Request'}
        </button>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Items</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={12} /> Add Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Barcode *</label>
                  <BarcodeInput value={item.barcode} onChange={value=>updateItem(item.id,'barcode',value)} onProduct={product=>{updateItem(item.id,'product_name',product.product_name);updateItem(item.id,'brand',product.brand||'')}} />
                  {errors[`${item.id}-barcode`] && <p className="text-[8px] font-bold text-rose-500">{errors[`${item.id}-barcode`]}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Product *</label>
                  <input
                    value={item.product_name}
                    onChange={(e) => updateItem(item.id, 'product_name', e.target.value)}
                    placeholder="Product name"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${errorBorder(`${item.id}-product_name`)}`}
                  />
                  {errors[`${item.id}-product_name`] && <p className="text-[8px] font-bold text-rose-500">{errors[`${item.id}-product_name`]}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Brand</label>
                  <input
                    value={item.brand}
                    onChange={(e) => updateItem(item.id, 'brand', e.target.value)}
                    placeholder="Brand"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Qty *</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity_needed}
                    onChange={(e) => updateItem(item.id, 'quantity_needed', e.target.value)}
                    placeholder="1"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${errorBorder(`${item.id}-quantity_needed`)}`}
                  />
                  {errors[`${item.id}-quantity_needed`] && <p className="text-[8px] font-bold text-rose-500">{errors[`${item.id}-quantity_needed`]}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes for this restock request..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
        />
      </div>
    </form>
  )
}
