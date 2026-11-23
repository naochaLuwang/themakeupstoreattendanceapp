'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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
                // Find the shift that starts on this specific local date string
                const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

                // Safe lookup: check if the start_time string starts with our local YYYY-MM-DD
                const shift = existingShifts.find(s => s.start_time.startsWith(prefix));

                // Safe literal extraction from "YYYY-MM-DDTHH:mm:00+05:30" or "YYYY-MM-DD HH:mm:00"
                const extractLocalTime = (timeString?: string, fallback: string = '10:00') => {
                    if (!timeString) return fallback;
                    try {
                        if (timeString.includes('T')) {
                            return timeString.split('T')[1].substring(0, 5);
                        } else if (timeString.includes(' ')) {
                            return timeString.split(' ')[1].substring(0, 5);
                        }
                    } catch (e) {
                         // Fallback on error
                    }
                    return fallback;
                };

                if (shift) {
                    return {
                        ...d,
                        id: shift.id, // Store ID
                        active: true,
                        start: extractLocalTime(shift.start_time, '10:00'),
                        end: extractLocalTime(shift.end_time || undefined, '18:00'),
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
                // Ensure we only ever grab 'HH:mm' from the preset regardless of how it's formatted
                const cleanStart = activePreset.start_time.includes('T') ? activePreset.start_time.split('T')[1].substring(0, 5) : activePreset.start_time.substring(0, 5);
                const cleanEnd = activePreset.end_time.includes('T') ? activePreset.end_time.split('T')[1].substring(0, 5) : activePreset.end_time.substring(0, 5);

                return {
                    ...d,
                    active: true,
                    start: cleanStart,
                    end: cleanEnd,
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
                    id: d.id || crypto.randomUUID(), // Generate valid UUID if missing
                    employee_id: selectedEmp,
                    // By removing the explicit timezone offset (+05:30), Supabase treats this as
                    // a naive timestamp or UTC timestamp depending on column setup, but guarantees
                    // the string "10:00:00" is what is stored and returned in the ISO output.
                    start_time: `${dateStr}T${d.start}:00`,
                    end_time: `${dateStr}T${d.end}:00`,
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
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col max-w-4xl mx-auto font-sans">

            <div className="px-6 md:px-8 py-6 border-b border-slate-50 flex flex-col lg:flex-row items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
                    <div>
                        <h3 className="text-xl md:text-2xl font-medium text-slate-900 tracking-normal leading-none">
                            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth))}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 tracking-normal mt-2">Roster Planner</p>
                    </div>
                    <div className="flex bg-slate-100 rounded-xl p-1 ml-auto lg:ml-0">
                        <button aria-label="Previous month" onClick={() => setCurrentMonth(m => m - 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-colors shadow-sm">
                            <ChevronLeft size={18} />
                        </button>
                        <button aria-label="Next month" onClick={() => setCurrentMonth(m => m + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-colors shadow-sm">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:min-w-[180px]">
                        <select
                            aria-label="Staff member to schedule" value={selectedEmp}
                            onChange={(e) => setSelectedEmp(e.target.value)}
                            className="w-full pl-10 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-medium text-sm tracking-normal outline-none hover:bg-white hover:border-slate-200 transition-colors cursor-pointer appearance-none shadow-sm"
                        >
                            <option value="">Select Staff</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    </div>
                    <button aria-label="Clear planned shifts" onClick={clearAll} className="p-3.5 text-red-400 hover:bg-red-50 rounded-xl transition-colors shadow-sm border border-red-50 shrink-0">
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
                        <p className="text-xs md:text-xs font-medium text-slate-500 tracking-normal mb-1">{stat.label}</p>
                        <p className="text-sm md:text-base font-medium text-slate-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className={`px-4 md:px-8 py-4 border-b border-slate-50 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth ${(!selectedEmp || loading) ? ' grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-full shrink-0">
                    <span className="text-xs font-medium text-slate-500 tracking-normal">Shift presets</span>
                </div>
                {presets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePreset(p)}
                        className={`px-4 md:px-5 py-2.5 rounded-xl text-sm md:text-sm font-medium  transition-colors shrink-0 border ${activePreset?.id === p.id
                            ? 'bg-slate-900 border-slate-900 text-white  '
                            : 'bg-white border-slate-50 text-slate-500 hover:border-slate-200 hover:text-slate-900'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    onClick={() => setActivePreset(null)}
                    className={`px-4 md:px-5 py-2.5 rounded-xl text-sm md:text-sm font-medium  border transition-colors flex items-center gap-2 shrink-0 ${!activePreset ? 'bg-rose-500 border-rose-500 text-white ' : 'bg-rose-50 border-rose-50 text-rose-400 hover:border-rose-200'}`}
                >
                    <Eraser size={14} /> Eraser
                </button>
            </div>

            <div className={selectedEmp && !loading ? 'overflow-x-auto' : ''}>
            <div className={`p-4 md:p-6 bg-white relative ${selectedEmp && !loading ? 'min-w-[560px] grid grid-cols-7 gap-2' : 'min-h-[280px]'}`}>
                <>
                    {(!selectedEmp || loading) && (
                        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center">
                            {loading ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mb-4" />
                                    <p className="text-sm font-medium tracking-normal text-slate-500">Loading shifts</p>
                                </div>
                            ) : (
                                <div className="text-center px-6">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 transition-transform">
                                        <AlertCircle className="text-slate-500" size={32} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-900 tracking-normal">Choose an employee</p>
                                    <p className="text-sm font-medium text-slate-500 mt-2">Select a staff member to plan their shifts</p>
                                </div>
                            )}
                        </div>
                    )}
                </>

                {selectedEmp && !loading && weekDays.map(day => (
                    <div key={day} className="text-center text-xs md:text-sm font-medium text-slate-500 py-2 tracking-normal">{day}</div>
                ))}

                {selectedEmp && !loading && schedule.map((d, idx) => (
                    <button
                        key={idx}
                        disabled={!d.day}
                        onClick={() => applyPreset(d.day)}
                        className={`aspect-square rounded-xl md:rounded-xl border flex flex-col items-center justify-center transition-colors relative overflow-hidden group ${!d.day ? 'border-transparent bg-transparent' :
                            d.active ? 'border-slate-900 bg-slate-900 text-white   z-10' :
                                'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                            }`}
                    >
                        {d.day && (
                            <>
                                <span className={`text-sm md:text-[12px] font-medium transition-opacity ${d.active ? 'text-white/20 absolute top-2 right-3' : 'text-slate-500'}`}>{d.day}</span>
                                {d.active && (
                                    <div className="text-center px-1">
                                        <p className={`text-xs md:text-xs font-medium  tracking-normal leading-none mb-1 ${getLabelStyles(d.label).split(' ')[0]}`}>{d.label}</p>
                                        <p className="text-xs md:text-xs font-medium  leading-none">{d.start}</p>
                                        <div className="h-[1px] w-4 bg-white/20 my-0.5 mx-auto" />
                                        <p className="text-xs md:text-xs font-medium  leading-none">{d.end}</p>
                                    </div>
                                )}
                                {!d.active && <div className="w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </>
                        )}
                    </button>
                ))}
            </div>

            </div>
            <div className="px-6 md:px-8 py-6 bg-slate-50 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs font-medium text-slate-500">Changes are internal until published</p>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !selectedEmp || loading}
                    className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-xl text-sm font-medium tracking-normal hover:bg-slate-800 transition-colors disabled:opacity-20 flex items-center justify-center gap-3 min-w-[200px]"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    {isSaving ? 'Publishing...' : 'Publish Schedule'}
                </button>
            </div>
        </div>
    );
}
