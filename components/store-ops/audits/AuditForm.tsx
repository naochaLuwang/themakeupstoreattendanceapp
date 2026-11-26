'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { AUDIT_CATEGORIES } from '@/lib/store-ops/constants'
import StorePicker from '@/components/store-ops/StorePicker'
import { useOperationsDraft } from '@/lib/store-ops/use-draft'
import { createAuditTemplate } from '@/app/actions/store-ops/audits'

export default function AuditForm() {
  const router = useRouter()
  const [storeId,setStoreId]=useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [questions, setQuestions] = useState([{ question: '', max_score: 5 }])

  const clearDraft=useOperationsDraft('audit-template:new',{name,category,questions,storeId},draft=>{setName(draft.name);setCategory(draft.category);setQuestions(draft.questions);setStoreId(draft.storeId)})
  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Template name is required'
    if (!category) errs.category = 'Category is required'
    const filtered = questions.filter(q => q.question.trim())
    if (filtered.length === 0) errs.questions = 'Add at least one question'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const filtered = questions.filter(q => q.question.trim())
      const result = await createAuditTemplate({
        store_id:storeId || undefined,
        name: name.trim(),
        category,
        questions: filtered.map(q => ({
          question: q.question.trim(),
          max_score: q.max_score,
        })),
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        clearDraft()
        toast.success('Audit template created')
        router.push('/admin/store-operations/audits')
        router.refresh()
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The form could not be saved. Your draft is kept.')
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, { question: '', max_score: 5 }])
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: 'question' | 'max_score', value: string | number) => {
    const updated = questions.map((q, i) => i === index ? { ...q, [field]: value } : q)
    setQuestions(updated)
    if (errors.questions) setErrors(prev => ({ ...prev, questions: '' }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <StorePicker value={storeId} onChange={setStoreId} />
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
              New Audit Template
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Create a template for store audits
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Template Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })) }}
            placeholder="e.g. Morning Store Inspection"
            className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.name && <p className="text-[9px] font-bold text-rose-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Category <span className="text-rose-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); if (errors.category) setErrors(prev => ({ ...prev, category: '' })) }}
            className={`w-full px-4 py-3 rounded-xl border ${errors.category ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            <option value="">Select category</option>
            {AUDIT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
          {errors.category && <p className="text-[9px] font-bold text-rose-500">{errors.category}</p>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Questions ({questions.filter(q => q.question.trim()).length})
            </h2>
            {errors.questions && <p className="text-[9px] font-bold text-rose-500 mt-1">{errors.questions}</p>}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={13} /> Add Question
          </button>
        </div>

        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 pt-1">
                <GripVertical size={14} className="text-slate-300 shrink-0" />
                <span className="text-[10px] font-black text-slate-400 w-5">{index + 1}.</span>
              </div>
              <div className="flex-1 min-w-0">
                <input
                  value={q.question}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                  placeholder="Enter question"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
                />
              </div>
              <div className="w-24 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={q.max_score}
                  onChange={(e) => updateQuestion(index, 'max_score', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all text-center"
                />
              </div>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}
