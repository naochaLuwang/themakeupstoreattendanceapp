'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, FlaskConical } from 'lucide-react'
import { TESTER_CONDITIONS } from '@/lib/store-ops/constants'
import type { TesterWithRelations } from '@/lib/store-ops/types'
import TesterCard from './TesterCard'

interface TesterListProps {
  initialData: TesterWithRelations[]
  total: number
  page: number
  totalPages: number
  basePath: string
  canCreate: boolean
}

export default function TesterList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate
}: TesterListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)
  const [loadError,setLoadError]=useState<string|null>(null)

  const [search, setSearch] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [replacementFilter, setReplacementFilter] = useState('')
  const [sortBy, setSortBy] = useState<'expiry_date' | 'created_at' | 'product_name'>('expiry_date')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('testers')
      .select(`
        *,
        profiles:profiles!created_by(full_name),
        tester_logs(*, profiles:profiles!created_by(full_name))
      `, { count: 'exact' })

    if (search) {
      query = query.or(`product_name.ilike.%${search}%,brand.ilike.%${search}%`)
    }
    if (conditionFilter) query = query.eq('condition', conditionFilter)
    if (replacementFilter === 'yes') query = query.eq('needs_replacement', true)
    if (replacementFilter === 'no') query = query.eq('needs_replacement', false)

    query = query.order(sortBy, { ascending: sortBy === 'expiry_date' ? true : false })

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: results, count, error: queryError } = await query
    setLoadError(queryError?'Records could not be loaded. Refresh to retry.':null)
    if (results) setData(results as unknown as TesterWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, conditionFilter, replacementFilter, sortBy, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('testers_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'testers' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tester_logs' },
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
    setConditionFilter('')
    setReplacementFilter('')
    setCurrentPage(1)
  }

  const hasFilters = search || conditionFilter || replacementFilter

  return (
    <div className="space-y-6">
      {loadError&&<p role="alert" className="rounded-lg border border-rose-300 p-3 text-sm text-rose-700">{loadError}</p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Testers</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} tester{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Tester
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or brand..."
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
              <select
                value={conditionFilter}
                onChange={(e) => { setConditionFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Conditions</option>
                {TESTER_CONDITIONS.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Needs Replacement</label>
              <select
                value={replacementFilter}
                onChange={(e) => { setReplacementFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="expiry_date">Expiry Date</option>
                <option value="created_at">Recently Added</option>
                <option value="product_name">Product Name</option>
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
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Product</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Condition</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Remaining</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Expiry</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Replace</th>
              <th className="text-right px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Created</th>
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
                    <FlaskConical size={32} className="text-slate-200" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No testers found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map(item => {
                const condStyle = condStyles[item.condition] || condStyles.good
                const daysLeft = item.expiry_date
                  ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null
                const barColor = item.remaining_percentage > 50 ? 'bg-emerald-500' : item.remaining_percentage > 20 ? 'bg-amber-500' : 'bg-rose-500'
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`${basePath}/${item.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <FlaskConical size={16} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{item.product_name}</p>
                          {item.brand && <p className="text-[9px] font-bold text-slate-400">{item.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${condStyle.bg} ${condStyle.text}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${item.remaining_percentage}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{item.remaining_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {daysLeft !== null ? (
                        <span className={`text-[10px] font-bold ${daysLeft < 0 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {daysLeft < 0 ? 'Expired' : `${daysLeft}d left`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {item.needs_replacement ? (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-600">Yes</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">No</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-[9px] font-bold text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
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
              <FlaskConical size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No testers found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <TesterCard
              key={item.id}
              id={item.id}
              product_name={item.product_name}
              brand={item.brand}
              shade={item.shade}
              condition={item.condition}
              remaining_percentage={item.remaining_percentage}
              expiry_date={item.expiry_date}
              needs_replacement={item.needs_replacement}
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

const condStyles: Record<string, { bg: string; text: string }> = {
  good: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  fair: { bg: 'bg-amber-50', text: 'text-amber-600' },
  poor: { bg: 'bg-orange-50', text: 'text-orange-600' },
  finished: { bg: 'bg-rose-50', text: 'text-rose-600' },
}
