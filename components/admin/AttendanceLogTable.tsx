'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Calendar, RotateCcw, Clock, ArrowRight, AlertCircle, UserCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AttendanceLogTable({ employees }: { employees: any[] }) {
    const supabase = createClient();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const today = new Date().toLocaleDateString('en-CA');
    const [selectedEmp, setSelectedEmp] = useState('');
    const [selectedDate, setSelectedDate] = useState(today);

    // --- TIMEZONE SAFE STITCHING ---
    const getScheduledTime = (attendanceIn: string, shiftTime: string | null) => {
        if (!shiftTime) return null;
        const actualDate = new Date(attendanceIn);
        const dbDate = new Date(shiftTime);
        const combined = new Date(actualDate);
        // Extracts the literal hour/min from DB (UTC) and applies to the log date
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
            .select(`
                *, 
                profiles(full_name), 
                shifts(shift_label, start_time, end_time)
            `)
            .order('check_in', { ascending: false });

        if (selectedEmp) query = query.eq('employee_id', selectedEmp);
        if (selectedDate) {
            query = query
                .gte('check_in', `${selectedDate}T00:00:00Z`)
                .lte('check_in', `${selectedDate}T23:59:59Z`);
        }

        const { data } = await query.limit(100);
        setLogs(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchLogs(); }, [selectedEmp, selectedDate]);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-6 rounded-[2.5rem] shadow-xl">
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <select
                        value={selectedEmp}
                        onChange={(e) => setSelectedEmp(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest text-white outline-none cursor-pointer appearance-none"
                    >
                        <option value="">All Personnel</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                </div>

                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest text-white outline-none"
                    />
                </div>

                <button
                    onClick={() => { setSelectedEmp(''); setSelectedDate(today); }}
                    className="flex items-center justify-center gap-2 bg-white text-slate-900 rounded-2xl py-4 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                >
                    <RotateCcw size={14} /> Reset Filters
                </button>
            </div>

            {/* Log Table */}
            <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personnel & Shift</th>
                            <th className="py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">In / Out Performance</th>
                            <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Work Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={3} className="py-24 text-center animate-pulse text-slate-300 font-black text-[10px] uppercase tracking-[0.3em]">Querying Floor Data...</td></tr>
                        ) : logs.length > 0 ? (
                            logs.map((log) => {
                                const actualIn = new Date(log.check_in);
                                const actualOut = log.check_out ? new Date(log.check_out) : null;
                                const schedStart = getScheduledTime(log.check_in, log.shifts?.start_time);
                                const schedEnd = getScheduledTime(log.check_in, log.shifts?.end_time);

                                const diffIn = schedStart ? Math.floor((actualIn.getTime() - schedStart.getTime()) / 60000) : 0;
                                const diffOut = (schedEnd && actualOut) ? Math.floor((actualOut.getTime() - schedEnd.getTime()) / 60000) : 0;

                                return (
                                    <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="py-6 px-8">
                                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.profiles?.full_name}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {log.shifts?.shift_label || 'Flex Shift'}
                                                </span>
                                                {log.shifts && (
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase italic">
                                                        Sched: {new Date(log.shifts.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-6 px-6">
                                            <div className="flex items-center justify-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-[11px] font-black text-slate-900">{actualIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    {diffIn > 0 ? (
                                                        <span className="text-[8px] font-black text-amber-500 uppercase">Late {formatDuration(log.check_in, schedStart?.toISOString() || null)}</span>
                                                    ) : (
                                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">On Time</span>
                                                    )}
                                                </div>
                                                <ArrowRight className="text-slate-200" size={14} />
                                                <div className="text-center min-w-[60px]">
                                                    {actualOut ? (
                                                        <>
                                                            <p className="text-[11px] font-black text-slate-900">{actualOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                            {diffOut < 0 ? (
                                                                <span className="text-[8px] font-black text-rose-500 uppercase">Early {formatDuration(log.check_out, schedEnd?.toISOString() || null)}</span>
                                                            ) : (
                                                                <span className="text-[8px] font-black text-blue-500 uppercase">OT {formatDuration(log.check_out, schedEnd?.toISOString() || null)}</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mb-1" />
                                                            <p className="text-[8px] font-black text-emerald-500 uppercase">Active</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6 px-8 text-right">
                                            {actualOut ? (
                                                <div className="inline-flex flex-col items-end">
                                                    <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-lg shadow-slate-200">
                                                        <Clock size={12} className="text-blue-400" />
                                                        <span className="text-[11px] font-black tracking-widest tabular-nums">
                                                            {formatDuration(log.check_in, log.check_out)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-end gap-2">
                                                    On Clock <Clock size={12} />
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-24 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No logs archived for {selectedDate}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}