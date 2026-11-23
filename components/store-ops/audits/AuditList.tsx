'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, ClipboardCheck } from 'lucide-react'
import { AUDIT_CATEGORIES, AUDIT_STATUSES } from '@/lib/store-ops/constants'
import type { AuditWithRelations } from '@/lib/store-ops/types'
import AuditCard from './AuditCard'

interface AuditListProps {
  initialData: AuditWithRelations[]
  total: number
  page: number
  totalPages: number
  basePath: string
  canCreate: boolean
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-600' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
}

export default function AuditList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate
}: AuditListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('audits')
      .select(`
        *,
        audit_templates(name, category),
        profiles:conducted_by(full_name)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('audit_templates.name', `%${search}%`)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (categoryFilter) query = query.eq('audit_templates.category', categoryFilter)

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: results, count } = await query
    if (results) setData(results as unknown as AuditWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, statusFilter, categoryFilter, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('audits_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'audits' },
        () => { fetchData(currentPage) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentPage, fetchData, supabase])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData(1)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setCategoryFilter('')
    setCurrentPage(1)
  }

  const hasFilters = search || statusFilter || categoryFilter

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Store Audits</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} audit{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Template
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </form>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3 rounded-xl border transition-all ${showFilters || hasFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
        >
          <Filter size={18} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-slate-900 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters</h3>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-white transition-colors">
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Statuses</option>
                {AUDIT_STATUSES.map(s => (
                  <option key={s} value={s}>{s === 'in_progress' ? 'In Progress' : 'Completed'}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Categories</option>
                {AUDIT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Template</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Conducted By</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="text-right px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto text-slate-300" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardCheck size={32} className="text-slate-200" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No audits found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map(item => {
                const st = statusStyles[item.status] || statusStyles.in_progress
                const pct = item.final_score !== null && item.max_score && item.max_score > 0
                  ? Math.round((item.final_score / item.max_score) * 100)
                  : null
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`${basePath}/${item.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-black text-slate-900 uppercase">{item.audit_templates?.name || 'Untitled'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {item.audit_templates?.category?.replace('_', ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                        {item.status === 'in_progress' ? 'In Progress' : 'Completed'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-slate-500">{item.profiles?.full_name || 'Unknown'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {pct !== null ? (
                        <span className="text-sm font-black text-slate-900">{pct}%</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <ClipboardCheck size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No audits found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <AuditCard
              key={item.id}
              id={item.id}
              templateName={item.audit_templates?.name || 'Untitled'}
              category={item.audit_templates?.category || null}
              finalScore={item.final_score}
              maxScore={item.max_score}
              status={item.status}
              conductedByName={item.profiles?.full_name ?? null}
              createdAt={item.created_at}
              basePath={basePath}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="text-slate-300 text-[10px] font-bold px-1">...</span>
                )}
                <button
                  onClick={() => setCurrentPage(p)}
                  className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all ${
                    currentPage === p
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
