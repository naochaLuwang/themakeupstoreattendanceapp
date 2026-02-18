'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, ChevronRight, Search, Calendar, UserCheck, UserX } from 'lucide-react';

export default function FreeMonthlyRoaster() {
    const supabase = createClient();
    const [viewDate, setViewDate] = useState(new Date());
    const [employees, setEmployees] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Helper: Formats a date to YYYY-MM-DD based on local values (No UTC shift)
    const formatToLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper: Formats specific year/month/day to YYYY-MM-DD
    const getLocalISOString = (year: number, month: number, day: number) => {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    };

    const [searchDate, setSearchDate] = useState(formatToLocalDate(new Date()));

    const daysInMonth = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    }, [viewDate]);

    const fetchRoaster = async () => {
        setLoading(true);
        // We use local boundary dates to fetch data from Supabase
        const firstDay = getLocalISOString(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const lastDay = getLocalISOString(viewDate.getFullYear(), viewDate.getMonth(), daysInMonth.length);

        const [empRes, shiftRes, leaveRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name').eq('role', 'employee'),
            supabase.from('shifts').select('*').gte('start_time', `${firstDay}T00:00:00`).lte('start_time', `${lastDay}T23:59:59`),
            supabase.from('leave_requests').select('*').eq('status', 'approved')
        ]);

        setEmployees(empRes.data || []);
        setShifts(shiftRes.data || []);
        setLeaves(leaveRes.data || []);
        setLoading(false);
    };

    useEffect(() => { fetchRoaster(); }, [viewDate]);

    const getStatus = (empId: string, dateStr: string) => {
        // 1. Check Approved Leaves first (Highest Priority)
        const onLeave = leaves.find(l => {
            return l.employee_id === empId &&
                dateStr >= l.start_date &&
                dateStr <= l.end_date;
        });

        if (onLeave) {
            return {
                type: 'LEAVE',
                label: 'LV',
                color: 'bg-rose-100 text-rose-600 border-rose-200'
            };
        }

        // 2. Check Shifts (Only if NOT on leave)
        const shift = shifts.find(s => {
            // Compare the first 10 characters (YYYY-MM-DD)
            const shiftDate = s.start_time.substring(0, 10);
            return s.employee_id === empId && shiftDate === dateStr;
        });

        if (shift) {
            const isMorning = shift.shift_label?.toLowerCase().includes('morning');
            return {
                type: 'SHIFT',
                label: isMorning ? 'M' : 'E',
                color: isMorning ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200',
            };
        }

        // 3. Default to Off Day (Red per your request)
        return {
            type: 'OFF',
            label: 'OFF',
            color: 'bg-red-50 text-red-500 border-red-100 opacity-80'
        };
    };

    const daySummary = useMemo(() => {
        const working: any[] = [];
        const off: any[] = [];

        employees.forEach(emp => {
            const status = getStatus(emp.id, searchDate);
            if (status.type === 'SHIFT') working.push({ name: emp.full_name, label: status.label });
            else off.push({ name: emp.full_name, type: status.type });
        });

        return { working, off };
    }, [searchDate, employees, shifts, leaves]);

    if (loading) return (
        <div className="h-96 flex flex-col items-center justify-center opacity-30">
            <Loader2 className="animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Syncing Roaster...</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            {/* Quick Day Search Section */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <Search size={20} className="text-blue-400" /> Daily Quick Lookup
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identify coverage gaps instantly</p>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="date"
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="bg-slate-800 border-none rounded-2xl pl-12 pr-6 py-4 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:ring-2 ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {/* Working Card */}
                    <div className="bg-slate-800/50 rounded-[2rem] p-6 border border-slate-700">
                        <div className="flex items-center gap-2 mb-4 text-emerald-400">
                            <UserCheck size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Working Today ({daySummary.working.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {daySummary.working.length > 0 ? daySummary.working.map((emp, i) => (
                                <span key={i} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[10px] font-bold">
                                    {emp.name} <span className="opacity-50 ml-1">({emp.label})</span>
                                </span>
                            )) : <span className="text-[10px] text-slate-500 italic">No shifts assigned</span>}
                        </div>
                    </div>

                    {/* Off/Leave Card */}
                    <div className="bg-slate-800/50 rounded-[2rem] p-6 border border-slate-700">
                        <div className="flex items-center gap-2 mb-4 text-rose-400">
                            <UserX size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Off / Leave ({daySummary.off.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {daySummary.off.map((emp, i) => (
                                <span key={i} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${emp.type === 'LEAVE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                    {emp.name} <span className="text-[8px] opacity-60 ml-1">[{emp.type}]</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Roaster Grid */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 flex items-center justify-between border-b border-slate-50">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
                        {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                        <NavBtn onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} icon={<ChevronLeft size={18} />} />
                        <NavBtn onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} icon={<ChevronRight size={18} />} />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="sticky left-0 z-20 bg-white p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left border-b border-slate-100 min-w-[160px]">Personnel</th>
                                {daysInMonth.map(day => (
                                    <th key={day} className="p-2 text-[10px] font-black text-slate-400 border-b border-slate-100 min-w-[50px] text-center">
                                        {day}
                                        <div className="text-[7px] font-bold opacity-40 uppercase">
                                            {new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="sticky left-0 z-20 bg-white p-4 border-b border-slate-50 text-[11px] font-black text-slate-800 uppercase tracking-tight shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                        {emp.full_name}
                                    </td>
                                    {daysInMonth.map(day => {
                                        const dateStr = getLocalISOString(viewDate.getFullYear(), viewDate.getMonth(), day);
                                        const status = getStatus(emp.id, dateStr);
                                        return (
                                            <td key={day} className="p-1 border-b border-slate-50">
                                                <div className={`h-10 w-full rounded-xl border flex items-center justify-center text-[9px] font-black transition-all ${status.color}`}>
                                                    {status.label}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const NavBtn = ({ onClick, icon }: any) => (
    <button onClick={onClick} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 text-slate-600 border border-slate-100">
        {icon}
    </button>
);