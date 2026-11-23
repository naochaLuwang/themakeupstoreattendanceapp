'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAuditTemplate, startAudit } from '@/app/actions/store-ops/audits'
import type { AuditTemplateWithQuestions } from '@/lib/store-ops/types'

interface TemplatesSectionProps {
  templates: AuditTemplateWithQuestions[]
  basePath: string
  canCreate: boolean
}

export default function TemplatesSection({ templates, basePath, canCreate }: TemplatesSectionProps) {
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleStart = async (templateId: string) => {
    setStarting(templateId)
    const result = await startAudit(templateId)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      toast.success('Audit started')
      router.push(`${basePath}/${result.data.id}`)
      router.refresh()
    }
    setStarting(null)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template permanently?')) return
    setDeleting(templateId)
    const result = await deleteAuditTemplate(templateId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Template deleted')
      router.refresh()
    }
    setDeleting(null)
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <ClipboardCheck size={40} className="text-slate-200 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-slate-500 tracking-normal">No templates yet</h2>
        <p className="text-sm font-medium text-slate-500 mt-1 max-w-xs mx-auto">
          Create an audit template to start conducting store audits.
        </p>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium tracking-normal hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} /> Create Template
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-500 tracking-normal">Templates ({templates.length})</h2>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium tracking-normal hover:bg-slate-800 transition-colors"
          >
            <Plus size={13} /> New Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-medium text-slate-900 truncate">{template.name}</h3>
                {template.category && (
                  <span className="text-xs font-medium text-slate-500 tracking-normal mt-0.5 block">
                    {template.category.replace('_', ' ')}
                  </span>
                )}
              </div>
              {canCreate && (
                <button
                  onClick={() => handleDelete(template.id)}
                  disabled={deleting === template.id}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                >
                  {deleting === template.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>

            <p className="text-sm font-medium text-slate-500 mb-4">
              {template.audit_questions?.length || 0} question{(template.audit_questions?.length || 0) !== 1 ? 's' : ''}
            </p>

            <button
              onClick={() => handleStart(template.id)}
              disabled={starting === template.id}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-medium tracking-normal hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {starting === template.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ClipboardCheck size={12} />
              )}
              {starting === template.id ? 'Starting...' : 'Start Audit'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
