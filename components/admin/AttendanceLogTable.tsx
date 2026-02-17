'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Calendar, RotateCcw, Clock, ArrowRight } from 'lucide-react';

export default function AttendanceLogTable({ employees }: { employees: any[] }) {
    const supabase = createClient();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. Default to Today's Date (Local Timezone)
    const today = new Date().toLocaleDateString('en-CA'); // Outputs YYYY-MM-DD
    const [selectedEmp, setSelectedEmp] = useState('');
    const [selectedDate, setSelectedDate] = useState(today);

    // 2. Precise Duration Calculator
    const formatDuration = (start: string, end: string | null) => {
        if (!end) return null;

        const diffInMs = new Date(end).getTime() - new Date(start).getTime();
        if (diffInMs < 0) return "00:00:00";

        const totalSeconds = Math.floor(diffInMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
    };

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('attendance')
            .select('*, profiles(full_name)')
            .order('check_in', { ascending: false });

        if (selectedEmp) query = query.eq('employee_id', selectedEmp);

        // Date Filtering Logic
        if (selectedDate) {
            query = query
                .gte('check_in', `${selectedDate}T00:00:00Z`)
                .lte('check_in', `${selectedDate}T23:59:59Z`);
        }

        const { data } = await query.limit(100);
        setLogs(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [selectedEmp, selectedDate]);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-6 rounded-[2.5rem] shadow-xl shadow-slate-200">
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <select
                        value={selectedEmp}
                        onChange={(e) => setSelectedEmp(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest text-white outline-none appearance-none cursor-pointer"
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
                        className="w-full pl-12 pr-6 py-4 bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest text-white outline-none color-scheme-dark"
                    />
                </div>

                <button
                    onClick={() => { setSelectedEmp(''); setSelectedDate(today); }}
                    className="flex items-center justify-center gap-2 bg-white text-slate-900 rounded-2xl py-4 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                >
                    <RotateCcw size={14} /> Clear Search
                </button>
            </div>

            {/* Log Table */}
            <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                            <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">In / Out Cycle</th>
                            <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Shift</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={3} className="py-24 text-center animate-pulse text-slate-300 font-black text-[10px] uppercase tracking-[0.3em]">Querying Database...</td></tr>
                        ) : logs.length > 0 ? (
                            logs.map((log) => (
                                <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="py-6 px-6">
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.profiles?.full_name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Staff ID: {log.employee_id.slice(0, 8)}</p>
                                    </td>
                                    <td className="py-6 px-6">
                                        <div className="flex items-center justify-center gap-4">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-900">{new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Clock In</p>
                                            </div>
                                            <ArrowRight className="text-slate-200" size={14} />
                                            <div className="text-center">
                                                {log.check_out ? (
                                                    <>
                                                        <p className="text-[10px] font-black text-slate-900">{new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Clock Out</p>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mb-1" />
                                                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Active</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-6 text-right">
                                        {log.check_out ? (
                                            <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
                                                <Clock size={12} className="text-blue-400" />
                                                <span className="text-[11px] font-black tracking-widest tabular-nums">
                                                    {formatDuration(log.check_in, log.check_out)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Shift Open</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-24 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No logs for {selectedDate}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}