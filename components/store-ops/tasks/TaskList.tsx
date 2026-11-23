'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Plus, X, Loader2, ClipboardList } from 'lucide-react'
import { TASK_PRIORITIES, TASK_STATUSES, TASK_CATEGORIES } from '@/lib/store-ops/constants'
import type { TaskWithRelations } from '@/lib/store-ops/types'
import TaskCard from './TaskCard'

interface TaskListProps {
  initialData: TaskWithRelations[]
  total: number
  page: number
  totalPages: number
  basePath: string
  canCreate: boolean
  employees?: { id: string; full_name: string | null }[]
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-500' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-600' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-500' },
}

const priorityTableStyles: Record<string, { bg: string; text: string }> = {
  urgent: { bg: 'bg-rose-50', text: 'text-rose-600' },
  high: { bg: 'bg-amber-50', text: 'text-amber-600' },
  medium: { bg: 'bg-blue-50', text: 'text-blue-600' },
  low: { bg: 'bg-slate-100', text: 'text-slate-500' },
}

export default function TaskList({
  initialData, total, page: initialPage, totalPages: initialTotalPages, basePath, canCreate, employees
}: TaskListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState(initialData)
  const [totalCount, setTotalCount] = useState(total)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_to_profile:assigned_to(full_name),
        assigned_by_profile:assigned_by(full_name),
        task_comments(*, profiles:created_by(full_name)),
        task_attachments(*)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('title', `%${search}%`)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (priorityFilter) query = query.eq('priority', priorityFilter)
    if (categoryFilter) query = query.eq('category', categoryFilter)
    if (assigneeFilter) query = query.eq('assigned_to', assigneeFilter)

    const limit = 20
    const offset = (pageNum - 1) * limit
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: results, count } = await query
    if (results) setData(results as unknown as TaskWithRelations[])
    if (count !== null) {
      setTotalCount(count)
      setTotalPages(Math.ceil(count / limit))
    }
    setLoading(false)
  }, [search, statusFilter, priorityFilter, categoryFilter, assigneeFilter, supabase])

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage, fetchData])

  useEffect(() => {
    const channel = supabase.channel('tasks_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        () => { fetchData(currentPage) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
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
    setPriorityFilter('')
    setCategoryFilter('')
    setAssigneeFilter('')
    setCurrentPage(1)
  }

  const hasFilters = search || statusFilter || priorityFilter || categoryFilter || assigneeFilter

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Tasks</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {totalCount} task{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`${basePath}/new`)}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            New Task
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
            placeholder="Search tasks..."
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Statuses</option>
                {TASK_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Priorities</option>
                {TASK_PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
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
                {TASK_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Assignee</label>
              <select
                value={assigneeFilter}
                onChange={(e) => { setAssigneeFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none"
              >
                <option value="">All Assignees</option>
                {(employees || []).map(e => (
                  <option key={e.id} value={e.id}>{e.full_name || 'Unknown'}</option>
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
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Task</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Assignee</th>
              <th className="text-left px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Due</th>
              <th className="text-right px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
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
                    <ClipboardList size={32} className="text-slate-200" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No tasks found</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map(item => {
                const ps = priorityTableStyles[item.priority] || priorityTableStyles.medium
                const ss = statusStyles[item.status] || statusStyles.pending
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`${basePath}/${item.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-black text-slate-900 uppercase">{item.title}</p>
                      {item.description && (
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${ps.bg} ${ps.text}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${ss.bg} ${ss.text}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] font-bold text-slate-500">{item.assigned_to_profile?.full_name || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-[10px] font-bold text-slate-500">
                      {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {item.category && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item.category}</span>
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
              <ClipboardList size={40} className="text-slate-200" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No tasks found</p>
            </div>
          </div>
        ) : (
          data.map(item => (
            <TaskCard
              key={item.id}
              id={item.id}
              title={item.title}
              priority={item.priority}
              status={item.status}
              due_date={item.due_date}
              assignee_name={item.assigned_to_profile?.full_name || null}
              category={item.category}
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
