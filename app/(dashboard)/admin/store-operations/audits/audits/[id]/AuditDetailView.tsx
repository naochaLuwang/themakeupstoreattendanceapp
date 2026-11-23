'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardCheck, ImageIcon } from 'lucide-react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAuditTemplate } from '@/app/actions/store-ops/audits'
import type { AuditWithRelations } from '@/lib/store-ops/types'

interface AuditDetailViewProps {
  audit: AuditWithRelations
  isAdmin: boolean
  basePath: string
}

export default function AuditDetailView({ audit, isAdmin, basePath }: AuditDetailViewProps) {
  const router = useRouter()

  const pct = audit.final_score !== null && audit.max_score && audit.max_score > 0
    ? Math.round((audit.final_score / audit.max_score) * 100)
    : 0

  const handleDelete = async () => {
    if (!confirm('Delete this audit record?')) return
    const result = await deleteAuditTemplate(audit.template_id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Audit deleted')
      router.push(basePath)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-medium text-slate-900 tracking-normal">
                {audit.audit_templates?.name || 'Audit'}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium  tracking-normal border ${
                audit.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {audit.status === 'completed' ? 'Completed' : 'In Progress'}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
              {audit.audit_templates?.category?.replace('_', ' ') || 'General'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-rose-200 text-rose-500 rounded-xl text-xs font-medium tracking-normal hover:bg-rose-50 transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-slate-500 tracking-normal mb-4">Score Breakdown</h2>
            <div className="space-y-3">
              {audit.audit_answers.map((a) => {
                const qScore = a.score || 0
                const qMax = a.audit_questions?.max_score || 5
                const barPct = qMax > 0 ? (qScore / qMax) * 100 : 0
                return (
                  <div key={a.id} className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="text-xs font-medium text-slate-900 flex-1">{a.audit_questions?.question}</p>
                      <span className="text-sm font-medium text-slate-900 shrink-0">{qScore}/{qMax}</span>
                    </div>
                    <div className="bg-white rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full transition-colors" style={{ width: `${barPct}%` }} />
                    </div>
                    {a.comment && (
                      <p className="text-sm font-medium text-slate-500 mt-2">{a.comment}</p>
                    )}
                    {a.photo_url && (
                      <img src={a.photo_url} alt="" className="mt-2 w-20 h-20 rounded-xl object-cover bg-slate-100" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
              <ClipboardCheck size={32} className="text-slate-900" />
            </div>
            <div className="text-3xl font-medium text-slate-900">{pct}%</div>
            <p className="text-sm font-medium text-slate-500">{audit.final_score} / {audit.max_score} points</p>
            <div className="bg-slate-50 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-slate-500 tracking-normal">Details</h3>
            <DetailRow label="Conducted By" value={audit.profiles?.full_name || 'Unknown'} />
            <DetailRow label="Date" value={new Date(audit.created_at).toLocaleDateString()} />
            <DetailRow label="Questions" value={audit.audit_answers.length.toString()} />
          </div>

          {audit.audit_answers.some(a => a.photo_url) && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-500 tracking-normal mb-3">Photos</h3>
              <div className="grid grid-cols-3 gap-2">
                {audit.audit_answers.filter(a => a.photo_url).map(a => (
                  <div key={a.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                    <img src={a.photo_url!} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-500 tracking-normal">{label}</span>
      <span className="text-xs font-medium text-slate-900">{value}</span>
    </div>
  )
}
