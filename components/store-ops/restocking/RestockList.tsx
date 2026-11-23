'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, Package } from 'lucide-react'
import { RESTOCK_STATUSES } from '@/lib/store-ops/constants'
import type { RestockRequestWithRelations } from '@/lib/store-ops/types'
import RestockCard from './RestockCard'

interface RestockListProps {
  initialData: RestockRequestWithRelations[]
  total: number
  page: number
  totalPages: number
  basePath: string
  canCreate: boolean
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-600' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-600' },
}

export default function RestockList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate
}: RestockListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('restock_requests')
      .select(`
        *,
        profiles:created_by(full_name),
        restock_items(*)
      `, { count: 'exact' })

    if (search) {
      query = query.or(`notes.ilike.%${search}%`)
    }
    if (statusFilter) query = query.eq('status', statusFilter)

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: results, count } = await query
    if (results) setData(results as unknown as RestockRequestWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, statusFilter, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('restock_requests_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'restock_requests' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'restock_items' },
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
    setCurrentPage(1)
  }

  const hasFilters = search || statusFilter

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Restocking</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} request{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Request
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
            placeholder="Search by notes..."
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
                {RESTOCK_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
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
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Request</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Items</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Requested By</th>
              <th className="text-right px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto text-slate-300" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package size={32} className="text-slate-200" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No restock requests found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map(item => {
                const st = statusStyles[item.status] || statusStyles.pending
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`${basePath}/${item.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-black text-slate-900 uppercase">{item.notes || 'Restock Request'}</p>
                      <p className="text-[9px] font-bold text-slate-400">#{item.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-5 py-4 text-[11px] font-bold text-slate-500">
                      {item.restock_items?.length || 0} items
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] font-bold text-slate-500">{item.profiles?.full_name || 'Unknown'}</p>
                    </td>
                    <td className="px-5 py-4 text-right text-[10px] font-bold text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
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
              <Package size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No restock requests found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <RestockCard
              key={item.id}
              id={item.id}
              status={item.status}
              items_count={item.restock_items?.length || 0}
              notes={item.notes}
              created_at={item.created_at}
              requestor_name={item.profiles?.full_name ?? null}
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
