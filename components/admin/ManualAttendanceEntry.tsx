'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createManualAttendance, updateManualAttendance, deleteManualAttendance } from '@/app/actions/manual-attendance'
import { toast } from 'sonner'
import {
    User, Calendar, Clock, Plus, Pencil, Trash2, Check, X,
    RotateCcw, Loader2, AlertTriangle, Save, ChevronDown
} from 'lucide-react'

interface Employee { id: string; full_name: string | null; store_id: string | null }
interface ShiftPreset { id: string; label: string | null; start_time: string | null; end_time: string | null }
interface AttendanceRecord {
    id: string; employee_id: string; shift_id: string | null; store_id: string | null;
    check_in: string; check_out: string | null;
    profiles?: { full_name: string | null } | null;
    shifts?: { shift_label: string | null; start_time: string | null; end_time: string | null } | null;
}

export default function ManualAttendanceEntry({ employees }: { employees: Employee[] }) {
    const supabase = createClient()

    const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>([])
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [fetching, setFetching] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const today = new Date().toLocaleDateString('en-CA')
    const [selectedDate, setSelectedDate] = useState(today)

    const [formEmployee, setFormEmployee] = useState('')
    const [formShift, setFormShift] = useState('')
    const [formDate, setFormDate] = useState(today)
    const [formCheckIn, setFormCheckIn] = useState('')
    const [formCheckOut, setFormCheckOut] = useState('')

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editCheckIn, setEditCheckIn] = useState('')
    const [editCheckOut, setEditCheckOut] = useState('')
    const [editShift, setEditShift] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        supabase.from('shift_presets').select('id, label, start_time, end_time').order('start_time')
            .then(({ data }) => setShiftPresets(data || []))
    }, [supabase])

    const fetchRecords = async () => {
        setFetching(true)
        const { data } = await supabase
            .from('attendance')
            .select('*, profiles(full_name), shifts(shift_label, start_time, end_time)')
            .gte('check_in', `${selectedDate}T00:00:00Z`)
            .lte('check_in', `${selectedDate}T23:59:59Z`)
            .order('check_in', { ascending: false })
            .limit(100)
        setRecords((data as unknown as AttendanceRecord[]) || [])
        setFetching(false)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchRecords() }, [selectedDate, supabase])

    const resetForm = () => {
        setFormEmployee('')
        setFormShift('')
        setFormDate(today)
        setFormCheckIn('')
        setFormCheckOut('')
    }

    const handleCreate = async () => {
        if (!formEmployee || !formShift || !formDate || !formCheckIn) {
            toast.error('Fill all required fields.')
            return
        }
        setSubmitting(true)
        const result = await createManualAttendance({
            employee_id: formEmployee,
            shift_id: formShift,
            date: formDate,
            check_in_time: formCheckIn,
            check_out_time: formCheckOut || undefined,
        })
        setSubmitting(false)
        if (result.error) { toast.error(result.error); return }
        toast.success('Attendance record created.')
        resetForm()
        fetchRecords()
    }

    const startEdit = (record: AttendanceRecord) => {
        setEditingId(record.id)
        const ci = new Date(record.check_in)
        setEditCheckIn(ci.toISOString().slice(11, 16))
        setEditCheckOut(record.check_out ? new Date(record.check_out).toISOString().slice(11, 16) : '')
        setEditShift(record.shift_id || '')
    }

    const saveEdit = async (id: string) => {
        if (!editCheckIn) { toast.error('Check-in time is required.'); return }
        const record = records.find(r => r.id === id)
        if (!record) return

        const baseDate = record.check_in.slice(0, 10)
        const checkIn = `${baseDate}T${editCheckIn}:00+00`
        const checkOut = editCheckOut ? `${baseDate}T${editCheckOut}:00+00` : null

        setSubmitting(true)
        const result = await updateManualAttendance(id, {
            check_in: checkIn,
            check_out: checkOut,
            shift_id: editShift,
        })
        setSubmitting(false)
        if (result.error) { toast.error(result.error); return }
        toast.success('Record updated.')
        setEditingId(null)
        fetchRecords()
    }

    const confirmDelete = async (id: string) => {
        setSubmitting(true)
        const result = await deleteManualAttendance(id)
        setSubmitting(false)
        if (result.error) { toast.error(result.error); return }
        toast.success('Record deleted.')
        setDeletingId(null)
        fetchRecords()
    }

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-8">
            {/* --- CREATE FORM --- */}
            <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Plus size={18} className="text-slate-900" />
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-slate-900 tracking-normal">Manual entry</h3>
                        <p className="text-xs font-medium text-slate-500 tracking-normal">Backdate or add attendance</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <label htmlFor="manual-formEmployee" className="text-xs font-medium text-slate-500 tracking-normal mb-1.5 block">Employee *</label>
                        <User className="absolute left-3 top-[2.3rem] text-slate-500" size={14} />
                        <select id="manual-formEmployee" value={formEmployee} onChange={e => setFormEmployee(e.target.value)}
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none appearance-none cursor-pointer">
                            <option value="">Select Employee</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-[2.3rem] text-slate-500 pointer-events-none" size={14} />
                    </div>

                    <div className="relative">
                        <label htmlFor="manual-formShift" className="text-xs font-medium text-slate-500 tracking-normal mb-1.5 block">Shift *</label>
                        <Clock className="absolute left-3 top-[2.3rem] text-slate-500" size={14} />
                        <select id="manual-formShift" value={formShift} onChange={e => setFormShift(e.target.value)}
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none appearance-none cursor-pointer">
                            <option value="">Select Shift</option>
                            {shiftPresets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-[2.3rem] text-slate-500 pointer-events-none" size={14} />
                    </div>

                    <div>
                        <label htmlFor="manual-formDate" className="text-xs font-medium text-slate-500 tracking-normal mb-1.5 block">Date *</label>
                        <input type="date" id="manual-formDate" value={formDate} onChange={e => setFormDate(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none" />
                    </div>

                    <div>
                        <label htmlFor="manual-formCheckIn" className="text-xs font-medium text-slate-500 tracking-normal mb-1.5 block">Check-In *</label>
                        <input type="time" id="manual-formCheckIn" value={formCheckIn} onChange={e => setFormCheckIn(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none" />
                    </div>

                    <div>
                        <label htmlFor="manual-formCheckOut" className="text-xs font-medium text-slate-500 tracking-normal mb-1.5 block">Check-Out</label>
                        <input type="time" id="manual-formCheckOut" value={formCheckOut} onChange={e => setFormCheckOut(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none" />
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                    <button onClick={handleCreate} disabled={submitting}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-xl text-sm font-medium tracking-normal hover:bg-slate-50 transition-colors disabled:opacity-50">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {submitting ? 'Saving...' : 'Create record'}
                    </button>
                    <button onClick={resetForm}
                        className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-500 px-6 py-3.5 rounded-xl text-sm font-medium tracking-normal hover:text-slate-900 transition-colors">
                        <RotateCcw size={14} /> Reset
                    </button>
                </div>
            </div>

            {/* --- RECORDS LIST --- */}
            <div>
                <div className="flex items-center justify-between mb-6 px-1">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-medium text-slate-900 tracking-normal">Records</h3>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input aria-label="Records date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 tracking-normal">{records.length} found</span>
                </div>

                {fetching ? (
                    <div className="h-40 flex flex-col items-center justify-center border border-dashed border-slate-100 rounded-xl">
                        <Loader2 className="animate-spin text-slate-500" size={24} />
                        <span className="text-xs font-medium text-slate-500 tracking-normal mt-3">Loading...</span>
                    </div>
                ) : records.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                        <p className="text-sm font-medium text-slate-500 tracking-normal">No records for this date</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="grid grid-cols-1 gap-3 lg:hidden">
                            {records.map(record => (
                                <RecordCard key={record.id} record={record}
                                    editingId={editingId} editCheckIn={editCheckIn} editCheckOut={editCheckOut} editShift={editShift}
                                    deletingId={deletingId} submitting={submitting} shiftPresets={shiftPresets}
                                    onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)}
                                    onSetEditCheckIn={setEditCheckIn} onSetEditCheckOut={setEditCheckOut} onSetEditShift={setEditShift}
                                    onStartDelete={setDeletingId} onConfirmDelete={confirmDelete} onCancelDelete={() => setDeletingId(null)}
                                    formatTime={formatTime} />
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="py-5 px-8 text-sm font-medium text-slate-500 tracking-normal">Employee</th>
                                        <th className="py-5 px-6 text-sm font-medium text-slate-500 tracking-normal">Shift</th>
                                        <th className="py-5 px-6 text-sm font-medium text-slate-500 tracking-normal text-center">Check-In</th>
                                        <th className="py-5 px-6 text-sm font-medium text-slate-500 tracking-normal text-center">Check-Out</th>
                                        <th className="py-5 px-8 text-sm font-medium text-slate-500 tracking-normal text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {records.map(record => (
                                        <DesktopRow key={record.id} record={record}
                                            editingId={editingId} editCheckIn={editCheckIn} editCheckOut={editCheckOut} editShift={editShift}
                                            deletingId={deletingId} submitting={submitting} shiftPresets={shiftPresets}
                                            onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)}
                                            onSetEditCheckIn={setEditCheckIn} onSetEditCheckOut={setEditCheckOut} onSetEditShift={setEditShift}
                                            onStartDelete={setDeletingId} onConfirmDelete={confirmDelete} onCancelDelete={() => setDeletingId(null)}
                                            formatTime={formatTime} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

/* ---------- SHARED PROPS ---------- */
interface RowProps {
    record: AttendanceRecord
    editingId: string | null
    editCheckIn: string
    editCheckOut: string
    editShift: string
    deletingId: string | null
    submitting: boolean
    shiftPresets: ShiftPreset[]
    onStartEdit: (r: AttendanceRecord) => void
    onSaveEdit: (id: string) => void
    onCancelEdit: () => void
    onSetEditCheckIn: (v: string) => void
    onSetEditCheckOut: (v: string) => void
    onSetEditShift: (v: string) => void
    onStartDelete: (id: string) => void
    onConfirmDelete: (id: string) => void
    onCancelDelete: () => void
    formatTime: (iso: string) => string
}

/* ---------- MOBILE CARD ---------- */
function RecordCard({
    record, editingId, editCheckIn, editCheckOut, editShift, deletingId, submitting, shiftPresets,
    onStartEdit, onSaveEdit, onCancelEdit, onSetEditCheckIn, onSetEditCheckOut, onSetEditShift,
    onStartDelete, onConfirmDelete, onCancelDelete, formatTime,
}: RowProps) {
    const isEditing = editingId === record.id
    const isDeleting = deletingId === record.id

    return (
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm space-y-4">
            {isEditing ? (
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 tracking-normal mb-1 block">Shift</label>
                        <select value={editShift} onChange={e => onSetEditShift(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none">
                            {shiftPresets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-500 tracking-normal mb-1 block">Check-In</label>
                            <input type="time" value={editCheckIn} onChange={e => onSetEditCheckIn(e.target.value)}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 tracking-normal mb-1 block">Check-Out</label>
                            <input type="time" value={editCheckOut} onChange={e => onSetEditCheckOut(e.target.value)}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onSaveEdit(record.id)} disabled={submitting}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-medium tracking-normal disabled:opacity-50">
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                        </button>
                        <button onClick={onCancelEdit}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-3 rounded-xl text-sm font-medium tracking-normal">
                            <X size={12} /> Cancel
                        </button>
                    </div>
                </div>
            ) : isDeleting ? (
                <div className="flex items-center justify-between bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={16} className="text-rose-500" />
                        <span className="text-sm font-medium text-rose-700 tracking-normal">Delete this record?</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onConfirmDelete(record.id)} disabled={submitting}
                            className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-medium tracking-normal disabled:opacity-50">
                            {submitting ? '...' : 'Yes'}
                        </button>
                        <button onClick={onCancelDelete}
                            className="px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-xl text-xs font-medium tracking-normal">
                            No
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-medium text-slate-900 tracking-normal">{record.profiles?.full_name}</p>
                            <span className="text-xs font-medium text-blue-500 tracking-normal">{record.shifts?.shift_label || 'FLEX'}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onStartEdit(record)}
                                className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors">
                                <Pencil size={14} />
                            </button>
                            <button onClick={() => onStartDelete(record.id)}
                                className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 tracking-normal">Check-In</p>
                            <p className="text-sm font-medium text-slate-900 mt-1">{formatTime(record.check_in)}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 tracking-normal">Check-Out</p>
                            <p className="text-sm font-medium text-slate-900 mt-1">{record.check_out ? formatTime(record.check_out) : '--:--'}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

/* ---------- DESKTOP ROW ---------- */
function DesktopRow({
    record, editingId, editCheckIn, editCheckOut, editShift, deletingId, submitting, shiftPresets,
    onStartEdit, onSaveEdit, onCancelEdit, onSetEditCheckIn, onSetEditCheckOut, onSetEditShift,
    onStartDelete, onConfirmDelete, onCancelDelete, formatTime,
}: RowProps) {
    const isEditing = editingId === record.id
    const isDeleting = deletingId === record.id

    if (isEditing) {
        return (
            <tr className="bg-slate-50/80">
                <td className="py-4 px-8">
                    <p className="text-xs font-medium text-slate-900 tracking-normal">{record.profiles?.full_name}</p>
                </td>
                <td className="py-4 px-6">
                    <select value={editShift} onChange={e => onSetEditShift(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium tracking-normal text-slate-900 outline-none">
                        {shiftPresets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </td>
                <td className="py-4 px-6 text-center">
                    <input type="time" value={editCheckIn} onChange={e => onSetEditCheckIn(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none text-center" />
                </td>
                <td className="py-4 px-6 text-center">
                    <input type="time" value={editCheckOut} onChange={e => onSetEditCheckOut(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none text-center" />
                </td>
                <td className="py-4 px-8">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => onSaveEdit(record.id)} disabled={submitting}
                            className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={onCancelEdit}
                            className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:text-slate-900 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                </td>
            </tr>
        )
    }

    if (isDeleting) {
        return (
            <tr className="bg-rose-50/50">
                <td colSpan={4} className="py-4 px-8">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={14} className="text-rose-500" />
                        <span className="text-sm font-medium text-rose-700 tracking-normal">Delete record for {record.profiles?.full_name}?</span>
                    </div>
                </td>
                <td className="py-4 px-8">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => onConfirmDelete(record.id)} disabled={submitting}
                            className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-medium tracking-normal disabled:opacity-50">
                            {submitting ? '...' : 'Confirm'}
                        </button>
                        <button onClick={onCancelDelete}
                            className="px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-xl text-xs font-medium tracking-normal">
                            Cancel
                        </button>
                    </div>
                </td>
            </tr>
        )
    }

    return (
        <tr className="group hover:bg-slate-50 transition-colors">
            <td className="py-5 px-8">
                <p className="text-xs font-medium text-slate-900 tracking-normal">{record.profiles?.full_name}</p>
            </td>
            <td className="py-5 px-6">
                <span className="text-xs font-medium text-slate-500 tracking-normal bg-slate-100 px-2.5 py-1 rounded-lg">
                    {record.shifts?.shift_label || 'FLEX'}
                </span>
            </td>
            <td className="py-5 px-6 text-center">
                <span className="text-xs font-medium text-slate-900 tabular-nums">{formatTime(record.check_in)}</span>
            </td>
            <td className="py-5 px-6 text-center">
                {record.check_out ? (
                    <span className="text-xs font-medium text-slate-900 tabular-nums">{formatTime(record.check_out)}</span>
                ) : (
                    <span className="text-xs font-medium text-emerald-500">Active</span>
                )}
            </td>
            <td className="py-5 px-8">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onStartEdit(record)}
                        className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <Pencil size={14} />
                    </button>
                    <button onClick={() => onStartDelete(record.id)}
                        className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}
