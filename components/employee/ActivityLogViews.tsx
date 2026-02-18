'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar as CalendarIcon, Loader2, ArrowRight,
    AlertCircle, ArrowUpRight, ArrowDownRight,
    UserCheck, Activity, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function ActivityLogView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => { fetchLogs(); }, [userId, searchDate]);

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('attendance')
            .select(`*, shifts(shift_label, start_time, end_time)`)
            .eq('employee_id', userId)
            .order('check_in', { ascending: false });

        if (searchDate) {
            query = query.gte('check_in', `${searchDate}T00:00:00Z`)
                .lte('check_in', `${searchDate}T23:59:59Z`);
        }

        const { data, error } = await query;
        if (!error) setLogs(data || []);
        setLoading(false);
    };

    // --- NAVIGATION LOGIC ---
    const navigateDate = (days: number) => {
        const current = new Date(searchDate);
        current.setDate(current.getDate() + days);
        setSearchDate(current.toISOString().split('T')[0]);
    };

    const handleDragEnd = (event: any, info: any) => {
        const swipeThreshold = 50;
        if (info.offset.x > swipeThreshold) {
            navigateDate(-1);
        } else if (info.offset.x < -swipeThreshold) {
            navigateDate(1);
        }
    };

    // --- HELPERS ---
    const getScheduledTime = (attendanceIn: string, shiftScheduled: string | null) => {
        if (!shiftScheduled) return null;
        const actualLogDate = new Date(attendanceIn);
        const dbShiftDate = new Date(shiftScheduled);
        const combined = new Date(actualLogDate);
        combined.setHours(dbShiftDate.getUTCHours(), dbShiftDate.getUTCMinutes(), 0, 0);
        return combined;
    };

    const formatDuration = (totalMinutes: number) => {
        const absMins = Math.abs(totalMinutes);
        const h = Math.floor(absMins / 60);
        const m = absMins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatTimeDisplay = (dateString: string | null, useUTC = false) => {
        if (!dateString) return '--:--';
        const d = new Date(dateString);
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
            ...(useUTC && { timeZone: 'UTC' })
        });
    };

    const dayStats = useMemo(() => {
        const totals = { lateIn: 0, earlyIn: 0, earlyOut: 0, lateOut: 0, totalWork: 0 };
        logs.forEach(log => {
            const actualIn = new Date(log.check_in);
            const actualOut = log.check_out ? new Date(log.check_out) : null;
            const schedStart = getScheduledTime(log.check_in, log.shifts?.start_time);
            const schedEnd = getScheduledTime(log.check_in, log.shifts?.end_time);

            if (schedStart) {
                const diff = Math.floor((actualIn.getTime() - schedStart.getTime()) / 60000);
                if (diff > 0) totals.lateIn += diff;
                else totals.earlyIn += Math.abs(diff);
            }
            if (schedEnd && actualOut) {
                const diff = Math.floor((actualOut.getTime() - schedEnd.getTime()) / 60000);
                if (diff < 0) totals.earlyOut += Math.abs(diff);
                else totals.lateOut += diff;
            }
            if (actualOut) {
                const workMins = Math.floor((actualOut.getTime() - actualIn.getTime()) / 60000);
                totals.totalWork += workMins;
            }
        });
        return totals;
    }, [logs]);

    return (
        <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            className="px-6 pt-6 pb-24 max-w-md mx-auto relative z-10 bg-slate-50 min-h-screen overflow-x-hidden"
        >
            <header className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Daily Summary</p>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">Report</h2>
                    </div>
                    <div className="relative group">
                        <input
                            type="date"
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                        />
                        <div className="bg-black p-3 rounded-2xl text-white shadow-xl group-active:scale-95 transition-all">
                            <CalendarIcon size={20} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-50 active:scale-90 rounded-xl transition-all">
                        <ChevronLeft size={16} className="text-slate-900" />
                    </button>
                    <div className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-900">
                        {new Date(searchDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-50 active:scale-90 rounded-xl transition-all">
                        <ChevronRight size={16} className="text-slate-900" />
                    </button>
                </div>
            </header>

            {/* DASHBOARD */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={searchDate}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3 mb-8"
                >
                    {/* TOTAL WORKING HOURS CARD */}
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-between overflow-hidden relative">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">Total Work Hours</p>
                            <h3 className="text-4xl font-black tracking-tighter italic">
                                {formatDuration(dayStats.totalWork)}
                            </h3>
                        </div>
                        <Activity className="opacity-10 absolute -right-4 -bottom-4 text-white" size={120} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Late In" value={formatDuration(dayStats.lateIn)} icon={<AlertCircle size={14} />} color="text-amber-600" bg="bg-amber-50" />
                        <StatCard label="Early In" value={formatDuration(dayStats.earlyIn)} icon={<UserCheck size={14} />} color="text-emerald-600" bg="bg-emerald-50" />
                        <StatCard label="Early Out" value={formatDuration(dayStats.earlyOut)} icon={<ArrowDownRight size={14} />} color="text-rose-600" bg="bg-rose-50" />
                        <StatCard label="Overtime" value={formatDuration(dayStats.lateOut)} icon={<ArrowUpRight size={14} />} color="text-blue-600" bg="bg-blue-50" />
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* LOGS LIST */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-20 opacity-10"><Loader2 className="animate-spin" size={30} /></div>
                ) : logs.length > 0 ? (
                    logs.map((log) => {
                        const actualIn = new Date(log.check_in);
                        const actualOut = log.check_out ? new Date(log.check_out) : null;
                        const schedStart = getScheduledTime(log.check_in, log.shifts?.start_time);
                        const schedEnd = getScheduledTime(log.check_in, log.shifts?.end_time);

                        const diffIn = schedStart ? Math.floor((actualIn.getTime() - schedStart.getTime()) / 60000) : 0;
                        const diffOut = (schedEnd && actualOut) ? Math.floor((actualOut.getTime() - schedEnd.getTime()) / 60000) : 0;

                        // Session Work Calculation
                        const sessionMins = actualOut
                            ? Math.floor((actualOut.getTime() - actualIn.getTime()) / 60000)
                            : 0;

                        return (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={log.id}
                                className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm"
                            >
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-14 bg-black rounded-2xl flex flex-col items-center justify-center text-white">
                                            <span className="text-[8px] font-black uppercase opacity-60">{actualIn.toLocaleDateString('en-US', { month: 'short' })}</span>
                                            <span className="text-sm font-black mt-1">{actualIn.getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">{log.shifts?.shift_label || 'Shift'}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">
                                                Sched: {formatTimeDisplay(log.shifts?.start_time, true)} - {formatTimeDisplay(log.shifts?.end_time, true)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        {diffIn > 0 ? <Badge text={`Late ${formatDuration(diffIn)}`} color="amber" /> : <Badge text={`Early ${formatDuration(diffIn)}`} color="emerald" />}
                                        {actualOut && (diffOut < 0 ? <Badge text={`Early ${formatDuration(diffOut)}`} color="rose" /> : <Badge text={`OT ${formatDuration(diffOut)}`} color="blue" />)}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-slate-50/80 rounded-[1.5rem] p-4 border border-slate-100 relative">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">In</p>
                                        <p className="text-xs font-black text-slate-900">{formatTimeDisplay(log.check_in)}</p>
                                    </div>

                                    {/* Duration above Arrow */}
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-[9px] font-black text-indigo-600 mb-0.5">
                                            {log.check_out ? formatDuration(sessionMins) : 'Active'}
                                        </span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </div>

                                    <div className="text-right space-y-1">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Out</p>
                                        <p className={`text-xs font-black ${log.check_out ? 'text-slate-900' : 'text-emerald-500 italic'}`}>
                                            {log.check_out ? formatTimeDisplay(log.check_out) : 'On Duty'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                        <Activity size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Logs Found</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function StatCard({ label, value, icon, color, bg }: any) {
    return (
        <div className={`${bg} p-4 rounded-[2rem] border border-black/5 shadow-sm`}>
            <div className={`flex items-center gap-2 ${color} mb-1`}>
                {icon}
                <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>
            </div>
            <p className="text-lg font-black text-slate-900">{value}</p>
        </div>
    );
}

function Badge({ text, color }: { text: string, color: 'amber' | 'emerald' | 'rose' | 'blue' }) {
    const colors = {
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100'
    };
    return <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md border ${colors[color]}`}>{text}</span>;
}