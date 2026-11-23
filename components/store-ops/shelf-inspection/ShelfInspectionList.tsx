'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, ImageIcon } from 'lucide-react'
import { INSPECTION_STATUSES } from '@/lib/store-ops/constants'
import type { ShelfInspectionWithRelations } from '@/lib/store-ops/types'
import ShelfInspectionCard from './ShelfInspectionCard'

interface ShelfInspectionListProps {
  initialData: ShelfInspectionWithRelations[]
  total: number
  page: number
  totalPages: number
  basePath: string
  canCreate: boolean
  sections?: { id: string; name: string }[]
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  good: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  needs_restock: { bg: 'bg-amber-50', text: 'text-amber-600' },
  dirty: { bg: 'bg-slate-100', text: 'text-slate-600' },
  wrong_display: { bg: 'bg-orange-50', text: 'text-orange-600' },
  missing_tester: { bg: 'bg-purple-50', text: 'text-purple-600' },
  missing_price_tag: { bg: 'bg-rose-50', text: 'text-rose-600' },
  damaged_display: { bg: 'bg-red-50', text: 'text-red-600' },
}

const statusLabels: Record<string, string> = {
  good: 'Good',
  needs_restock: 'Needs Restock',
  dirty: 'Dirty',
  wrong_display: 'Wrong Display',
  missing_tester: 'Missing Tester',
  missing_price_tag: 'Missing Price Tag',
  damaged_display: 'Damaged Display',
}

export default function ShelfInspectionList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate, sections
}: ShelfInspectionListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('shelf_inspections')
      .select(`
        *,
        store_sections(name, description),
        profiles:employee_id(full_name, email),
        inspection_images(*),
        inspection_comments(*, profiles:created_by(full_name))
      `, { count: 'exact' })

    if (search) {
      query = query.or(`notes.ilike.%${search}%,store_sections.name.ilike.%${search}%`)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (sectionFilter) query = query.eq('section_id', sectionFilter)

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: results, count } = await query
    if (results) setData(results as unknown as ShelfInspectionWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, statusFilter, sectionFilter, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('shelf_inspections_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shelf_inspections' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inspection_images' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inspection_comments' },
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
    setSectionFilter('')
    setCurrentPage(1)
  }

  const hasFilters = search || statusFilter || sectionFilter

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Shelf Inspections</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} inspection{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Inspection
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by notes or section..."
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

      {/* Filter Panel */}
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
                {INSPECTION_STATUSES.map(s => (
                  <option key={s} value={s}>{statusLabels[s] || s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Section</label>
              <select
                value={sectionFilter}
                onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Sections</option>
                {sections?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Section</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Review</th>
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
                    <ImageIcon size={32} className="text-slate-200" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No inspections found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map(item => {
                const st = statusStyles[item.status] || statusStyles.good
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`${basePath}/${item.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {item.inspection_images?.[0] ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <img src={item.inspection_images[0].url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <ImageIcon size={16} className="text-slate-300" />
                          </div>
                        )}
                        <p className="text-xs font-black text-slate-900 uppercase">{item.store_sections?.name || 'Unknown'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[10px] font-bold text-slate-500 max-w-[200px] truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="px-5 py-4 text-[10px] font-bold text-slate-500">
                      {item.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-5 py-4 text-[10px] font-bold text-slate-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      {item.reviewed_by ? (
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Reviewed</span>
                      ) : (
                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <ImageIcon size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No inspections found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <ShelfInspectionCard
              key={item.id}
              id={item.id}
              section_name={item.store_sections?.name || null}
              status={item.status}
              notes={item.notes}
              created_at={item.created_at}
              employee_name={item.profiles?.full_name ?? null}
              images={item.inspection_images || []}
              basePath={basePath}
            />
          ))
        )}
      </div>

      {/* Pagination */}
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
