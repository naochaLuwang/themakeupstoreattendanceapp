'use client'

import StoreImage from '@/components/store-ops/StoreImage'

import { useState, useEffect, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, ImageIcon } from 'lucide-react'
import { DAMAGE_TYPES, DAMAGE_REPORT_STATUSES } from '@/lib/store-ops/constants'
import type { DamageReportWithRelations } from '@/lib/store-ops/types'
import DamageReportCard from './DamageReportCard'

interface DamageReportListProps {
  initialData: DamageReportWithRelations[]
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
  archived: { bg: 'bg-slate-100', text: 'text-slate-500' },
}

export default function DamageReportList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate
}: DamageReportListProps) {
  const router = useRouter()
  const filterId = useId()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)
  const [loadError,setLoadError]=useState<string|null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('damage_reports')
      .select(`
        *,
        profiles:profiles!reported_by(full_name, email),
        damage_images(*),
        damage_comments(*, profiles:profiles!created_by(full_name))
      `, { count: 'exact' })

    if (search) {
      query = query.or(`product_name.ilike.%${search}%,barcode.ilike.%${search}%`)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (typeFilter) query = query.eq('damage_type', typeFilter)

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: results, count, error: queryError } = await query
    setLoadError(queryError?'Records could not be loaded. Refresh to retry.':null)
    if (results) setData(results as unknown as DamageReportWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, statusFilter, typeFilter, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('damage_reports_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'damage_reports' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'damage_images' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'damage_comments' },
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
    setTypeFilter('')
    setCurrentPage(1)
  }

  const hasFilters = search || statusFilter || typeFilter

  return (
    <div className="ops-record-list space-y-6">
      {loadError&&<p role="alert" className="rounded-lg border border-rose-300 p-3 text-sm text-rose-700">{loadError}</p>}
      {/* Header */}
      <div className="ops-page-heading flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Damage Reports</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} report{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="ops-primary-action flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Report
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="ops-search-toolbar flex items-center gap-3">
        <form onSubmit={handleSearch} className="ops-search flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search damage reports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or barcode..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
          />
        </form>
        <button
          type="button"
          aria-label="Filter damage reports"
          aria-expanded={showFilters}
          aria-controls={filterId}
          data-active={Boolean(hasFilters)}
          onClick={() => setShowFilters(!showFilters)}
          className={`ops-filter-toggle p-3 rounded-xl border transition-all ${showFilters || hasFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
        >
          <Filter size={18} aria-hidden="true" /><span className="ops-filter-label hidden">Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div id={filterId} role="region" aria-label="Damage reports filters" className="ops-filter-panel bg-slate-900 p-5 rounded-2xl space-y-4">
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
              <label htmlFor={`${filterId}-statusFilter`} className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
              <select id={`${filterId}-statusFilter`}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Statuses</option>
                {DAMAGE_REPORT_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${filterId}-typeFilter`} className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Damage Type</label>
              <select id={`${filterId}-typeFilter`}
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Types</option>
                {DAMAGE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="ops-record-table hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Product</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Barcode</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Damage</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Reported</th>
              <th className="text-right px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
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
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No damage reports found</p>
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
                      <div className="flex items-center gap-3">
                        {item.damage_images?.[0] ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <StoreImage src={item.damage_images[0].url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <ImageIcon size={16} className="text-slate-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{item.product_name}</p>
                          {item.brand && <p className="text-[9px] font-bold text-slate-400">{item.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[11px] font-bold text-slate-500">#{item.barcode}</td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-slate-500">{item.damage_type}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] font-bold text-slate-500">{item.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-[8px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black text-slate-900">{item.quantity}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="ops-record-cards md:hidden space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <ImageIcon size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No damage reports found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <DamageReportCard
              key={item.id}
              id={item.id}
              barcode={item.barcode}
              product_name={item.product_name}
              brand={item.brand}
              quantity={item.quantity}
              damage_type={item.damage_type}
              status={item.status}
              created_at={item.created_at}
              reporter_name={item.profiles?.full_name ?? null}
              images={item.damage_images || []}
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
