'use client'
import {runOperation} from '@/lib/store-ops/client-action';

import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2,  } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTemplate } from '@/app/actions/store-ops/daily-checklist'

interface TemplateListProps {
  templates: {
    id: string
    name: string
    type: 'opening' | 'closing'
    is_active: boolean
    created_by: string
  }[]
}

export default function ChecklistTemplateList({ templates }: TemplateListProps) {
  const router = useRouter()

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" template?`)) return
    const result = await runOperation(() => deleteTemplate(id))
    if (result.error) toast.error(result.error)
    else {
      toast.success('Template deleted')
      router.refresh()
    }
  }

  const opening = templates.filter(t => t.type === 'opening')
  const closing = templates.filter(t => t.type === 'closing')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900 uppercase">Checklist Templates</h2>
        <button
          onClick={() => router.push('/admin/store-operations/daily-checklist/templates/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            No templates yet — create one to get started
          </p>
        </div>
      ) : (
        <>
          <TemplateGroup type="opening" label="Opening" templates={opening} onDelete={handleDelete} />
          <TemplateGroup type="closing" label="Closing" templates={closing} onDelete={handleDelete} />
        </>
      )}
    </div>
  )
}

function TemplateGroup({
  label, templates, onDelete
}: {
  type: string
  label: string
  templates: TemplateListProps['templates']
  onDelete: (id: string, name: string) => void
}) {
  const router = useRouter()

  if (templates.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(t => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase">{t.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                    t.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/admin/store-operations/daily-checklist/templates/${t.id}/edit`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                onClick={() => onDelete(t.id, t.name)}
                className="flex items-center justify-center gap-1.5 py-2 bg-rose-50 rounded-xl text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-100 transition-all px-3"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
