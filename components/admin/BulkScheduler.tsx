'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Save, Trash2,
    Eraser, User as UserIcon, Clock, Zap, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
    id: string;
    full_name: string;
}

interface ScheduleDay {
    day: number | null;
    start: string;
    end: string;
    active: boolean;
    label: string;
    id?: string; // Store the database ID to avoid conflicts/redundant inserts
}

export default function BulkScheduler({ employees = [] }: { employees: Employee[] }) {
    const supabase = createClient();
    const [selectedEmp, setSelectedEmp] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [presets, setPresets] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
    const [activePreset, setActivePreset] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const loadMonthData = useCallback(async () => {
        if (!selectedEmp) {
            const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
            const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
            const blanks = Array.from({ length: firstDayIndex }, () => ({ day: null, active: false, start: '10:00', end: '18:00', label: 'OFF' }));
            const days = Array.from({ length: daysCount }, (_, i) => ({
                day: i + 1,
                start: '10:00',
                end: '18:00',
                active: false,
                label: 'OFF'
            }));
            setSchedule([...blanks, ...days]);
            return;
        }

        setLoading(true);
        const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const blanks = Array.from({ length: firstDayIndex }, () => ({ day: null, active: false, start: '10:00', end: '18:00', label: 'OFF' }));

        let days: ScheduleDay[] = Array.from({ length: daysCount }, (_, i) => ({
            day: i + 1,
            start: '10:00',
            end: '18:00',
            active: false,
            label: 'OFF'
        }));

        // Offset-aware range to prevent timezone drift
        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const start = `${monthPrefix}-01T00:00:00+05:30`;
        const end = `${monthPrefix}-${String(daysCount).padStart(2, '0')}T23:59:59+05:30`;

        const { data: existingShifts, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('employee_id', selectedEmp)
            .gte('start_time', start)
            .lte('start_time', end);

        if (error) {
            toast.error("Failed to load shifts: " + error.message);
        } else if (existingShifts) {
            days = days.map(d => {
                const shift = existingShifts.find(s => {
                    const datePart = s.start_time.split('T')[0];
                    const [y, m, day] = datePart.split('-').map(Number);
                    return y === currentYear && m === (currentMonth + 1) && day === d.day;
                });

                if (shift) {
                    const startTime = shift.start_time.includes('T') ? shift.start_time.split('T')[1].slice(0, 5) : shift.start_time.split(' ')[1]?.slice(0, 5) || '10:00';
                    const endTime = shift.end_time.includes('T') ? shift.end_time.split('T')[1].slice(0, 5) : shift.end_time.split(' ')[1]?.slice(0, 5) || '18:00';
                    return {
                        ...d,
                        id: shift.id, // Store ID
                        active: true,
                        start: startTime,
                        end: endTime,
                        label: shift.shift_label || 'Shift'
                    };
                }
                return d;
            });
        }
        setSchedule([...blanks, ...days]);
        setLoading(false);
    }, [selectedEmp, currentMonth, currentYear, supabase]);

    useEffect(() => {
        loadMonthData();
    }, [loadMonthData]);

    useEffect(() => {
        const fetchPresets = async () => {
            const { data } = await supabase
                .from('shift_presets')
                .select('*')
                .order('created_at', { ascending: true });
            setPresets(data || []);
        };
        fetchPresets();
    }, [supabase]);

    const stats = useMemo(() => {
        const activeShifts = schedule.filter(d => d.day && d.active);
        const totalHours = activeShifts.reduce((acc, curr) => {
            const [sH, sM] = curr.start.split(':').map(Number);
            const [eH, eM] = curr.end.split(':').map(Number);
            let diff = (eH + eM / 60) - (sH + sM / 60);
            return acc + (diff > 0 ? diff : diff + 24);
        }, 0);

        return {
            hours: totalHours.toFixed(1),
            count: activeShifts.length,
            avg: activeShifts.length > 0 ? (totalHours / activeShifts.length).toFixed(1) : '0'
        };
    }, [schedule]);

    const applyPreset = (dayNum: number | null) => {
        if (dayNum === null || !selectedEmp) return;
        setSchedule(prev => prev.map(d => {
            if (d.day !== dayNum) return d;
            if (activePreset) {
                return {
                    ...d,
                    active: true,
                    start: activePreset.start_time.slice(0, 5),
                    end: activePreset.end_time.slice(0, 5),
                    label: activePreset.label
                };
            }
            // Eraser mode
            return { ...d, active: false, label: 'OFF' };
        }));
    };

    const clearAll = () => {
        if (confirm("Wipe all shifts for this month view? This won't affect the database until you Publish.")) {
            setSchedule(prev => prev.map(d => d.day ? { ...d, active: false, label: 'OFF' } : d));
        }
    };

    const handleSave = async () => {
        if (!selectedEmp) return;
        setIsSaving(true);
        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        try {
            // --- REFACTORED PERSISTENCE LOGIC TO AVOID 409 CONFLICTS ---
            // 1. Identify Deletions (Was active in DB, now OFF)
            const toDelete = schedule.filter(d => d.id && !d.active).map(d => d.id as string);
            
            // 2. Identify Upserts (Is active now)
            const toUpsert = schedule.filter(d => d.day && d.active).map(d => {
                const dateStr = `${monthPrefix}-${String(d.day).padStart(2, '0')}`;
                return {
                    id: d.id, // Providing ID triggers an update in Supabase upsert
                    employee_id: selectedEmp,
                    start_time: `${dateStr}T${d.start}:00+05:30`,
                    end_time: `${dateStr}T${d.end}:00+05:30`,
                    status: 'scheduled',
                    shift_label: d.label
                };
            });

            const results = [];

            // Execute Delete (If it fails due to conflict, we skip it and warn)
            if (toDelete.length > 0) {
                const { error: delError } = await supabase.from('shifts').delete().in('id', toDelete);
                if (delError) {
                    if (delError.code === '23503') { // Foreign Key Violation (Conflict)
                        toast.error("Some shifts couldn't be removed because they are linked to active swap requests.");
                    } else {
                        throw delError;
                    }
                }
            }

            // Execute Upsert (Atomic update/insert)
            if (toUpsert.length > 0) {
                const { error: upsError } = await supabase.from('shifts').upsert(toUpsert, { onConflict: 'id' });
                if (upsError) throw upsError;
            }

            toast.success("Schedule published successfully!");
            await loadMonthData();
            
        } catch (err: any) {
            toast.error("Error: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const getLabelStyles = (label: string) => {
        const l = label.toLowerCase();
        if (l.includes('sales')) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
        if (l.includes('day')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (l.includes('morning')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-w-4xl mx-auto font-sans pb-32 lg:pb-0">

            <div className="px-6 md:px-8 py-6 border-b border-slate-50 flex flex-col lg:flex-row items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">
                            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth))}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Roster Planner</p>
                    </div>
                    <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner ml-auto lg:ml-0">
                        <button onClick={() => setCurrentMonth(m => m - 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setCurrentMonth(m => m + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:min-w-[180px]">
                        <select
                            value={selectedEmp}
                            onChange={(e) => setSelectedEmp(e.target.value)}
                            className="w-full pl-10 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none hover:bg-white hover:border-slate-200 transition-all cursor-pointer appearance-none shadow-sm"
                        >
                            <option value="">Select Staff</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    <button onClick={clearAll} className="p-3.5 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm border border-red-50 shrink-0">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 bg-slate-50/30 border-b border-slate-50">
                {[
                    { label: 'Monthly Hours', value: `${stats.hours}h`, icon: Clock },
                    { label: 'Total Shifts', value: stats.count, icon: Zap },
                    { label: 'Avg Shift', value: `${stats.avg}h`, icon: Save }
                ].map((stat, i) => (
                    <div key={i} className="py-4 flex flex-col items-center border-r last:border-0 border-slate-100">
                        <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                        <p className="text-sm md:text-base font-black text-slate-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className={`px-4 md:px-8 py-4 border-b border-slate-50 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth ${(!selectedEmp || loading) ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-full shrink-0">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Brushes</span>
                </div>
                {presets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePreset(p)}
                        className={`px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-[11px] font-black uppercase transition-all shrink-0 border-2 ${activePreset?.id === p.id
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200'
                            : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-900'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    onClick={() => setActivePreset(null)}
                    className={`px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-[11px] font-black uppercase border-2 transition-all flex items-center gap-2 shrink-0 ${!activePreset ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'bg-rose-50 border-rose-50 text-rose-400 hover:border-rose-200'}`}
                >
                    <Eraser size={14} /> Eraser
                </button>
            </div>

            <div className="p-4 md:p-8 grid grid-cols-7 gap-2 md:gap-3 bg-white relative">
                <AnimatePresence>
                    {(!selectedEmp || loading) && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center">
                            {loading ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Syncing Roster...</p>
                                </div>
                            ) : (
                                <div className="text-center group">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 group-hover:scale-110 transition-transform">
                                        <AlertCircle className="text-slate-300" size={32} />
                                    </div>
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Locked</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2">Select an employee to start painting shifts</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {weekDays.map(day => (
                    <div key={day} className="text-center text-[8px] md:text-[10px] font-black text-slate-300 py-2 tracking-widest">{day}</div>
                ))}

                {schedule.map((d, idx) => (
                    <button
                        key={idx}
                        disabled={!d.day}
                        onClick={() => applyPreset(d.day)}
                        className={`aspect-square rounded-2xl md:rounded-[1.8rem] border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden group ${!d.day ? 'border-transparent bg-transparent' :
                            d.active ? 'border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-200 z-10' :
                                'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                            }`}
                    >
                        {d.day && (
                            <>
                                <span className={`text-[10px] md:text-[12px] font-black transition-opacity ${d.active ? 'text-white/20 absolute top-2 right-3' : 'text-slate-400'}`}>{d.day}</span>
                                {d.active && (
                                    <div className="text-center px-1">
                                        <p className={`text-[7px] md:text-[9px] font-black uppercase tracking-tight leading-none mb-1 ${getLabelStyles(d.label).split(' ')[0]}`}>{d.label}</p>
                                        <p className="text-[7px] md:text-[8px] font-bold opacity-60 leading-none">{d.start}</p>
                                        <div className="h-[1px] w-4 bg-white/20 my-0.5 mx-auto" />
                                        <p className="text-[7px] md:text-[8px] font-bold opacity-60 leading-none">{d.end}</p>
                                    </div>
                                )}
                                {!d.active && <div className="w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </>
                        )}
                    </button>
                ))}
            </div>

            <div className="px-6 md:px-8 py-6 bg-slate-50 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Changes are internal until published</p>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !selectedEmp || loading}
                    className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 min-w-[200px]"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    {isSaving ? 'Publishing...' : 'Publish Schedule'}
                </button>
            </div>
        </div>
    );
}