'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TASK_PRIORITIES, TASK_CATEGORIES } from '@/lib/store-ops/constants'
import { createTask, updateTask, getEmployees } from '@/app/actions/store-ops/tasks'

interface TaskFormProps {
  initialData?: {
    id: string
    title: string
    description: string | null
    assigned_to: string | null
    priority: string
    due_date: string | null
    category: string | null
    is_recurring: boolean
    recurrence_rule: string | null
  }
  basePath: string
}

export default function TaskForm({ initialData, basePath }: TaskFormProps) {
  const router = useRouter()
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [employees, setEmployees] = useState<{ id: string; full_name: string | null }[]>([])

  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    assigned_to: initialData?.assigned_to || '',
    priority: initialData?.priority || 'medium',
    due_date: initialData?.due_date ? initialData.due_date.split('T')[0] : '',
    category: initialData?.category || 'general',
    is_recurring: initialData?.is_recurring || false,
    recurrence_rule: initialData?.recurrence_rule || '',
  })

  useEffect(() => {
    getEmployees().then(setEmployees)
  }, [])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.priority) errs.priority = 'Priority is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assigned_to: form.assigned_to || undefined,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
        category: form.category || undefined,
        is_recurring: form.is_recurring,
        recurrence_rule: form.is_recurring ? form.recurrence_rule.trim() || undefined : undefined,
      }

      const result = isEditing
        ? await updateTask(initialData.id, payload)
        : await createTask(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Task updated' : 'Task created')
        router.push(basePath)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
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
              {isEditing ? 'Edit Task' : 'New Task'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isEditing ? 'Update task details' : 'Assign a new task'}
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Task'}
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
            placeholder="Task title"
            className={`w-full px-4 py-3 rounded-xl border ${errors.title ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          />
          {errors.title && <p className="text-[9px] font-bold text-rose-500">{errors.title}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Describe the task in detail..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assignee</label>
          <select
            value={form.assigned_to}
            onChange={(e) => updateField('assigned_to', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          >
            <option value="">Unassigned</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name || 'Unknown'}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Priority <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.priority}
            onChange={(e) => updateField('priority', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${errors.priority ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all`}
          >
            {TASK_PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          {errors.priority && <p className="text-[9px] font-bold text-rose-500">{errors.priority}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</label>
          <select
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          >
            {TASK_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => updateField('due_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </div>

        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recurring Task</label>
            <button
              type="button"
              onClick={() => updateField('is_recurring', !form.is_recurring)}
              className={`relative w-12 h-6 rounded-full transition-all ${form.is_recurring ? 'bg-slate-900' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${form.is_recurring ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {form.is_recurring && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recurrence Rule</label>
              <input
                value={form.recurrence_rule}
                onChange={(e) => updateField('recurrence_rule', e.target.value)}
                placeholder="e.g. every day, every week on Monday"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
              />
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
