'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Calendar, RotateCcw, Clock, ArrowRight,
    Timer, Filter, X, AlertTriangle, CheckCircle2, MinusCircle
} from 'lucide-react';

export default function AttendanceLogTable({ employees }: { employees: any[] }) {
    const supabase = createClient();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const today = new Date().toLocaleDateString('en-CA');
    const [selectedEmp, setSelectedEmp] = useState('');
    const [selectedDate, setSelectedDate] = useState(today);

    // --- TIMEZONE SAFE STITCHING ---
    const getScheduledTime = (attendanceIn: string, shiftTime: string | null) => {
        if (!shiftTime) return null;
        const actualDate = new Date(attendanceIn);
        const dbDate = new Date(shiftTime);
        const combined = new Date(actualDate);
        combined.setHours(dbDate.getUTCHours(), dbDate.getUTCMinutes(), 0, 0);
        return combined;
    };

    const formatDuration = (start: string, end: string | null) => {
        if (!end) return null;
        const diffInMs = new Date(end).getTime() - new Date(start).getTime();
        const totalMinutes = Math.floor(Math.abs(diffInMs) / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('attendance')
            .select(`*, profiles(full_name), shifts(shift_label, start_time, end_time)`)
            .order('check_in', { ascending: false });

        if (selectedEmp) query = query.eq('employee_id', selectedEmp);
        if (selectedDate) {
            query = query.gte('check_in', `${selectedDate}T00:00:00Z`).lte('check_in', `${selectedDate}T23:59:59Z`);
        }

        const { data } = await query.limit(100);
        setLogs(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchLogs(); }, [selectedEmp, selectedDate]);

    return (
        <div className="space-y-6 pb-20 lg:pb-0 font-sans">
            {/* --- MOBILE COMPACT HEADER --- */}
            <div className="flex items-center justify-between lg:hidden px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tighter">ATTENDANCE</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Punctuality Tracking</p>
                </div>
                <button
                    onClick={() => setIsFilterOpen(true)}
                    className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-90 transition-all"
                >
                    <Filter size={18} />
                </button>
            </div>

            {/* --- RESPONSIVE FILTER BAR --- */}
            <AnimatePresence>
                {(isFilterOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className={`fixed inset-0 z-[110] bg-white lg:bg-transparent p-6 lg:p-0 lg:relative lg:inset-auto lg:block ${isFilterOpen ? 'block' : 'hidden lg:block'}`}
                    >
                        <div className="flex justify-between items-center mb-8 lg:hidden">
                            <span className="text-xs font-black uppercase tracking-widest">Filter Archive</span>
                            <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 bg-slate-900 p-6 lg:p-5 rounded-[2.5rem] lg:rounded-3xl shadow-2xl">
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <select
                                    value={selectedEmp}
                                    onChange={(e) => { setSelectedEmp(e.target.value); setIsFilterOpen(false); }}
                                    className="w-full pl-11 pr-4 py-4 lg:py-3 bg-slate-800 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest text-white outline-none cursor-pointer appearance-none"
                                >
                                    <option value="">All Personnel</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                                </select>
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => { setSelectedDate(e.target.value); setIsFilterOpen(false); }}
                                    className="w-full pl-11 pr-6 py-4 lg:py-3 bg-slate-800 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest text-white outline-none"
                                />
                            </div>
                            <button
                                onClick={() => { setSelectedEmp(''); setSelectedDate(today); setIsFilterOpen(false); }}
                                className="flex items-center justify-center gap-2 bg-white text-slate-900 rounded-2xl py-4 lg:py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                            >
                                <RotateCcw size={14} /> Reset Filters
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- LOG CONTENT --- */}
            <div className="space-y-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-slate-100 rounded-[3rem]">
                        <RotateCcw className="animate-spin text-slate-200" size={32} />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Querying Floor Data</span>
                    </div>
                ) : logs.length > 0 ? (
                    <>
                        {/* Mobile Stack */}
                        <div className="grid grid-cols-1 gap-4 lg:hidden">
                            {logs.map((log) => (
                                <AttendanceCard key={log.id} log={log} getScheduledTime={getScheduledTime} formatDuration={formatDuration} />
                            ))}
                        </div>

                        {/* Desktop Grid */}
                        <div className="hidden lg:block overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personnel & Shift</th>
                                        <th className="py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">In/Out Punctuality</th>
                                        <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Work Session</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {logs.map((log) => (
                                        <DesktopRow key={log.id} log={log} getScheduledTime={getScheduledTime} formatDuration={formatDuration} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/30">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No logs archived for this day</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- SHARED PERFORMANCE HELPER ---
function getPerformance(actual: Date, scheduled: Date | null, mode: 'in' | 'out') {
    if (!scheduled) return { label: 'Flexible', color: 'text-slate-400', icon: <MinusCircle size={10} /> };

    const diff = Math.floor((actual.getTime() - scheduled.getTime()) / 60000);

    if (mode === 'in') {
        if (diff > 5) return { label: `Late (${diff}m)`, color: 'text-amber-500', icon: <AlertTriangle size={10} /> };
        return { label: 'On Time', color: 'text-emerald-500', icon: <CheckCircle2 size={10} /> };
    } else {
        if (diff < -5) return { label: `Early Exit (${Math.abs(diff)}m)`, color: 'text-rose-500', icon: <AlertTriangle size={10} /> };
        if (diff > 15) return { label: `Overtime (${diff}m)`, color: 'text-blue-500', icon: <Clock size={10} /> };
        return { label: 'Full Shift', color: 'text-emerald-500', icon: <CheckCircle2 size={10} /> };
    }
}

// --- MOBILE COMPONENT ---
function AttendanceCard({ log, getScheduledTime, formatDuration }: any) {
    const actualIn = new Date(log.check_in);
    const actualOut = log.check_out ? new Date(log.check_out) : null;
    const schedStart = getScheduledTime(log.check_in, log.shifts?.start_time);
    const schedEnd = getScheduledTime(log.check_in, log.shifts?.end_time);

    const perfIn = getPerformance(actualIn, schedStart, 'in');
    const perfOut = actualOut ? getPerformance(actualOut, schedEnd, 'out') : null;

    return (
        <motion.div layout className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">{log.profiles?.full_name}</h4>
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{log.shifts?.shift_label || 'FLEX'}</span>
                </div>
                {actualOut ? (
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2">
                        <Timer size={12} /> {formatDuration(log.check_in, log.check_out)}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase">Active</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-3xl space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clock In</p>
                    <p className="text-sm font-black text-slate-900">{actualIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <div className={`flex items-center gap-1 ${perfIn.color}`}>
                        {perfIn.icon}
                        <span className="text-[8px] font-black uppercase">{perfIn.label}</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clock Out</p>
                    <p className="text-sm font-black text-slate-900">
                        {actualOut ? actualOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                    {perfOut && (
                        <div className={`flex items-center gap-1 ${perfOut.color}`}>
                            {perfOut.icon}
                            <span className="text-[8px] font-black uppercase">{perfOut.label}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// --- DESKTOP COMPONENT ---
function DesktopRow({ log, getScheduledTime, formatDuration }: any) {
    const actualIn = new Date(log.check_in);
    const actualOut = log.check_out ? new Date(log.check_out) : null;
    const schedStart = getScheduledTime(log.check_in, log.shifts?.start_time);
    const schedEnd = getScheduledTime(log.check_in, log.shifts?.end_time);

    const perfIn = getPerformance(actualIn, schedStart, 'in');
    const perfOut = actualOut ? getPerformance(actualOut, schedEnd, 'out') : null;

    return (
        <tr className="group hover:bg-slate-50 transition-colors">
            <td className="py-6 px-8">
                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.profiles?.full_name}</p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                        {log.shifts?.shift_label || 'FLEX'}
                    </span>
                    {log.shifts && (
                        <span className="text-[8px] font-bold text-slate-300 uppercase italic tabular-nums">
                            {new Date(log.shifts.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                            -
                            {new Date(log.shifts.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        </span>
                    )}
                </div>
            </td>
            <td className="py-6 px-6">
                <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                        <p className="text-xs font-black text-slate-900 leading-none">{actualIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <div className={`flex items-center justify-center gap-1 mt-1.5 ${perfIn.color}`}>
                            {perfIn.icon}
                            <span className="text-[8px] font-black uppercase tracking-tighter">{perfIn.label}</span>
                        </div>
                    </div>
                    <ArrowRight className="text-slate-200" size={14} />
                    <div className="text-center min-w-[80px]">
                        {actualOut ? (
                            <>
                                <p className="text-xs font-black text-slate-900 leading-none">{actualOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                <div className={`flex items-center justify-center gap-1 mt-1.5 ${perfOut?.color}`}>
                                    {perfOut?.icon}
                                    <span className="text-[8px] font-black uppercase tracking-tighter">{perfOut?.label}</span>
                                </div>
                            </>
                        ) : (
                            <span className="text-[8px] font-black text-emerald-500 uppercase flex items-center gap-1.5 justify-center">
                                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Active
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="py-6 px-8 text-right">
                {actualOut ? (
                    <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl shadow-slate-200">
                        <Timer size={14} className="text-blue-400" />
                        <span className="text-xs font-black tracking-widest tabular-nums">{formatDuration(log.check_in, log.check_out)}</span>
                    </div>
                ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">In Progress...</span>
                )}
            </td>
        </tr>
    );
}