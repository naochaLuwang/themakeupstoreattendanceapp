// 'use client';
// import { useState, useEffect, useMemo } from 'react';
// import { createClient } from '@/lib/supabase/client';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//     ChevronLeft, ChevronRight, Save, Trash2,
//     Eraser, User as UserIcon, Clock, Zap
// } from 'lucide-react';

// export default function BulkScheduler({ employees }: { employees: any[] }) {
//     const supabase = createClient();
//     const [selectedEmp, setSelectedEmp] = useState('');
//     const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
//     const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
//     const [presets, setPresets] = useState<any[]>([]);
//     const [schedule, setSchedule] = useState<any[]>([]);
//     const [activePreset, setActivePreset] = useState<any>(null);
//     const [loading, setLoading] = useState(false);

//     const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

//     // Calculation logic for the stats header
//     const stats = useMemo(() => {
//         const activeShifts = schedule.filter(d => d.day && d.active);
//         const totalHours = activeShifts.reduce((acc, curr) => {
//             const [sH, sM] = curr.start.split(':').map(Number);
//             const [eH, eM] = curr.end.split(':').map(Number);
//             let diff = (eH + eM / 60) - (sH + sM / 60);
//             return acc + (diff > 0 ? diff : diff + 24);
//         }, 0);

//         return {
//             hours: totalHours.toFixed(1),
//             count: activeShifts.length,
//             avg: activeShifts.length > 0 ? (totalHours / activeShifts.length).toFixed(1) : '0'
//         };
//     }, [schedule]);

//     useEffect(() => {
//         const fetchPresets = async () => {
//             const { data } = await supabase.from('shift_presets').select('*').order('created_at', { ascending: true });
//             setPresets(data || []);
//         };
//         fetchPresets();
//     }, [supabase]);

//     useEffect(() => {
//         const loadMonthData = async () => {
//             const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
//             const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
//             const blanks = Array.from({ length: firstDayIndex }, () => ({ day: null, active: false }));

//             let days = Array.from({ length: daysCount }, (_, i) => ({
//                 day: i + 1,
//                 start: '10:00',
//                 end: '18:00',
//                 active: false,
//                 label: 'OFF'
//             }));

//             if (selectedEmp) {
//                 const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00`;
//                 const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}T23:59:59`;

//                 const { data: existingShifts } = await supabase
//                     .from('shifts')
//                     .select('*')
//                     .eq('employee_id', selectedEmp)
//                     .gte('start_time', start)
//                     .lte('start_time', end);

//                 if (existingShifts) {
//                     days = days.map(d => {
//                         const shift = existingShifts.find(s => {
//                             const shiftDay = parseInt(s.start_time.split('T')[0].split('-')[2]);
//                             return shiftDay === d.day;
//                         });

//                         if (shift) {
//                             const startTime = shift.start_time.split('T')[1].slice(0, 5);
//                             const endTime = shift.end_time.split('T')[1].slice(0, 5);

//                             // Find the preset label or assign one based on time
//                             const matchedPreset = presets.find(p => p.start_time.startsWith(startTime));
//                             const fallbackLabel = parseInt(startTime) < 12 ? 'Morning' : 'Evening';

//                             return {
//                                 ...d,
//                                 active: true,
//                                 start: startTime,
//                                 end: endTime,
//                                 label: shift.shift_label || matchedPreset?.label || fallbackLabel
//                             };
//                         }
//                         return d;
//                     });
//                 }
//             }
//             setSchedule([...blanks, ...days]);
//         };
//         loadMonthData();
//     }, [selectedEmp, currentMonth, currentYear, presets, supabase]);

//     const applyPreset = (dayNum: number | null) => {
//         if (dayNum === null || !selectedEmp) return;
//         setSchedule(prev => prev.map(d => {
//             if (d.day !== dayNum) return d;
//             if (activePreset) {
//                 return {
//                     ...d,
//                     active: true,
//                     start: activePreset.start_time.slice(0, 5),
//                     end: activePreset.end_time.slice(0, 5),
//                     label: activePreset.label
//                 };
//             }
//             return { ...d, active: false, label: 'OFF' };
//         }));
//     };

//     const clearAll = () => {
//         if (confirm("Wipe all shifts for this month?")) {
//             setSchedule(prev => prev.map(d => d.day ? { ...d, active: false, label: 'OFF' } : d));
//         }
//     };

//     const handleSave = async () => {
//         if (!selectedEmp) return;
//         setLoading(true);

//         const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
//         const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00`;
//         const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}T23:59:59`;

//         // 1. Clear existing shifts for the current month view
//         await supabase.from('shifts').delete()
//             .eq('employee_id', selectedEmp)
//             .gte('start_time', start)
//             .lte('start_time', end);

//         // 2. Map local schedule to Database Schema
//         const shiftsToInsert = schedule.filter(d => d.day && d.active).map(d => {
//             const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
//             return {
//                 employee_id: selectedEmp,
//                 start_time: `${dateStr}T${d.start}:00`,
//                 end_time: `${dateStr}T${d.end}:00`,
//                 status: 'scheduled',
//                 shift_label: d.label // THIS FIXES YOUR NULL ISSUE
//             };
//         });

//         if (shiftsToInsert.length > 0) {
//             const { error } = await supabase.from('shifts').insert(shiftsToInsert);
//             if (error) alert("Error saving: " + error.message);
//             else alert("Schedule published successfully!");
//         } else {
//             alert("Schedule cleared for this month.");
//         }

//         setLoading(false);
//     };

//     return (
//         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-w-4xl mx-auto font-sans">

//             {/* Header / Toolbar */}
//             <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white">
//                 <div className="flex items-center gap-6">
//                     <div>
//                         <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
//                             {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth))}
//                         </h3>
//                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Roster Planner</p>
//                     </div>
//                     <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
//                         <button onClick={() => setCurrentMonth(m => m - 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
//                             <ChevronLeft size={18} />
//                         </button>
//                         <button onClick={() => setCurrentMonth(m => m + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
//                             <ChevronRight size={18} />
//                         </button>
//                     </div>
//                 </div>

//                 <div className="flex items-center gap-4">
//                     <div className="relative group">
//                         <select
//                             value={selectedEmp}
//                             onChange={(e) => setSelectedEmp(e.target.value)}
//                             className="pl-10 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none hover:bg-white hover:border-slate-200 transition-all cursor-pointer appearance-none shadow-sm"
//                         >
//                             <option value="">Select Staff</option>
//                             {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
//                         </select>
//                         <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
//                     </div>
//                     <button onClick={clearAll} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm border border-red-50">
//                         <Trash2 size={18} />
//                     </button>
//                 </div>
//             </div>

//             {/* Insight Stats Bar */}
//             <div className="grid grid-cols-3 bg-slate-50/30 border-b border-slate-50 px-4">
//                 {[
//                     { label: 'Monthly Hours', value: `${stats.hours}h`, icon: Clock },
//                     { label: 'Total Shifts', value: stats.count, icon: Zap },
//                     { label: 'Avg Shift', value: `${stats.avg}h`, icon: Save }
//                 ].map((stat, i) => (
//                     <div key={i} className="py-4 flex flex-col items-center border-r last:border-0 border-slate-100">
//                         <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
//                         <p className="text-base font-black text-slate-900">{stat.value}</p>
//                     </div>
//                 ))}
//             </div>

//             {/* Brush Presets */}
//             <div className={`px-8 py-4 border-b border-slate-50 flex items-center gap-4 overflow-x-auto no-scrollbar ${!selectedEmp ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
//                 <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">
//                     <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Tools</span>
//                 </div>
//                 {presets.map(p => (
//                     <button
//                         key={p.id}
//                         onClick={() => setActivePreset(p)}
//                         className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shrink-0 border-2 ${activePreset?.id === p.id
//                             ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200 scale-105'
//                             : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-900'
//                             }`}
//                     >
//                         {p.label}
//                     </button>
//                 ))}
//                 <button
//                     onClick={() => setActivePreset(null)}
//                     className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase border-2 transition-all flex items-center gap-2 ${!activePreset ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-red-50 border-red-50 text-red-400'}`}
//                 >
//                     <Eraser size={14} /> Eraser
//                 </button>
//             </div>

//             {/* Calendar Drawing Board */}
//             <div className="p-8 grid grid-cols-7 gap-3 bg-white relative">
//                 <AnimatePresence>
//                     {!selectedEmp && (
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
//                             <div className="text-center">
//                                 <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Locked</p>
//                                 <p className="text-[10px] font-bold text-slate-400 mt-2">Select an employee to start planning</p>
//                             </div>
//                         </motion.div>
//                     )}
//                 </AnimatePresence>

//                 {weekDays.map(day => (
//                     <div key={day} className="text-center text-[10px] font-black text-slate-300 py-2 tracking-widest">{day}</div>
//                 ))}

//                 {schedule.map((d, idx) => (
//                     <button
//                         key={idx}
//                         disabled={!d.day}
//                         onClick={() => applyPreset(d.day)}
//                         className={`aspect-square rounded-[1.8rem] border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden group ${!d.day ? 'border-transparent bg-transparent' :
//                             d.active ? 'border-slate-900 bg-slate-900 text-white shadow-2xl shadow-slate-300 z-10' :
//                                 'border-slate-50 bg-slate-50/30 hover:border-slate-200'
//                             }`}
//                     >
//                         {d.day && (
//                             <>
//                                 <span className={`text-[12px] font-black transition-opacity ${d.active ? 'text-white/20 absolute top-3 right-4' : 'text-slate-400'}`}>{d.day}</span>
//                                 {d.active && (
//                                     <div className="text-center px-2">
//                                         <p className="text-[9px] font-black uppercase tracking-tight leading-none mb-1 text-emerald-400">{d.label}</p>
//                                         <p className="text-[8px] font-bold opacity-60 leading-none">{d.start}</p>
//                                         <div className="h-[1px] w-4 bg-white/20 my-0.5 mx-auto" />
//                                         <p className="text-[8px] font-bold opacity-60 leading-none">{d.end}</p>
//                                     </div>
//                                 )}
//                                 {!d.active && <div className="w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />}
//                             </>
//                         )}
//                     </button>
//                 ))}
//             </div>

//             {/* Footer Actions */}
//             <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
//                 <p className="text-[10px] font-bold text-slate-400 uppercase italic">Changes are not public until published</p>
//                 <button
//                     onClick={handleSave}
//                     disabled={loading || !selectedEmp}
//                     className="bg-slate-900 text-white px-12 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-300 active:scale-95 disabled:opacity-20 flex items-center gap-3"
//                 >
//                     {loading ? (
//                         <>
//                             <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                             Publishing...
//                         </>
//                     ) : (
//                         <>
//                             <Save size={16} /> Publish Schedule
//                         </>
//                     )}
//                 </button>
//             </div>
//         </div>
//     );
// }



'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Save, Trash2,
    Eraser, User as UserIcon, Clock, Zap
} from 'lucide-react';

interface Employee {
    id: string;
    full_name: string;
}

export default function BulkScheduler({ employees = [] }: { employees: Employee[] }) {
    const supabase = createClient();
    const [selectedEmp, setSelectedEmp] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [presets, setPresets] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [activePreset, setActivePreset] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // 1. Calculate stats based on local schedule state
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

    // 2. Fetch presets on mount
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

    // 3. Load Month Data (Existing shifts from DB)
    useEffect(() => {
        const loadMonthData = async () => {
            const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
            const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
            const blanks = Array.from({ length: firstDayIndex }, () => ({ day: null, active: false }));

            let days = Array.from({ length: daysCount }, (_, i) => ({
                day: i + 1,
                start: '10:00',
                end: '18:00',
                active: false,
                label: 'OFF'
            }));

            if (selectedEmp) {
                const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00`;
                const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}T23:59:59`;

                const { data: existingShifts } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('employee_id', selectedEmp)
                    .gte('start_time', start)
                    .lte('start_time', end);

                if (existingShifts) {
                    days = days.map(d => {
                        const shift = existingShifts.find(s => {
                            const shiftDay = parseInt(s.start_time.split('T')[0].split('-')[2]);
                            return shiftDay === d.day;
                        });

                        if (shift) {
                            const startTime = shift.start_time.split('T')[1].slice(0, 5);
                            const endTime = shift.end_time.split('T')[1].slice(0, 5);
                            return {
                                ...d,
                                active: true,
                                start: startTime,
                                end: endTime,
                                label: shift.shift_label || 'Shift'
                            };
                        }
                        return d;
                    });
                }
            }
            setSchedule([...blanks, ...days]);
        };
        loadMonthData();
    }, [selectedEmp, currentMonth, currentYear, presets, supabase]);

    // 4. Painting Logic
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
            return { ...d, active: false, label: 'OFF' };
        }));
    };

    const clearAll = () => {
        if (confirm("Wipe all shifts for this month view?")) {
            setSchedule(prev => prev.map(d => d.day ? { ...d, active: false, label: 'OFF' } : d));
        }
    };

    // 5. Database Save
    const handleSave = async () => {
        if (!selectedEmp) return;
        setLoading(true);

        const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
        const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00`;
        const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}T23:59:59`;

        try {
            // Delete current month's shifts
            await supabase.from('shifts').delete()
                .eq('employee_id', selectedEmp)
                .gte('start_time', start)
                .lte('start_time', end);

            const shiftsToInsert = schedule.filter(d => d.day && d.active).map(d => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                return {
                    employee_id: selectedEmp,
                    start_time: `${dateStr}T${d.start}:00`,
                    end_time: `${dateStr}T${d.end}:00`,
                    status: 'scheduled',
                    shift_label: d.label
                };
            });

            if (shiftsToInsert.length > 0) {
                const { error } = await supabase.from('shifts').insert(shiftsToInsert);
                if (error) throw error;
                alert("Schedule published successfully!");
            } else {
                alert("Schedule cleared.");
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-w-4xl mx-auto font-sans">

            {/* Toolbar */}
            <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth))}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Roster Planner</p>
                    </div>
                    <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
                        <button onClick={() => setCurrentMonth(m => m - 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setCurrentMonth(m => m + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 transition-all shadow-sm">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <select
                            value={selectedEmp}
                            onChange={(e) => setSelectedEmp(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none hover:bg-white hover:border-slate-200 transition-all cursor-pointer appearance-none shadow-sm"
                        >
                            <option value="">Select Staff</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    <button onClick={clearAll} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm border border-red-50">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 bg-slate-50/30 border-b border-slate-50">
                {[
                    { label: 'Monthly Hours', value: `${stats.hours}h`, icon: Clock },
                    { label: 'Total Shifts', value: stats.count, icon: Zap },
                    { label: 'Avg Shift', value: `${stats.avg}h`, icon: Save }
                ].map((stat, i) => (
                    <div key={i} className="py-4 flex flex-col items-center border-r last:border-0 border-slate-100">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                        <p className="text-base font-black text-slate-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Preset Selector */}
            <div className={`px-8 py-4 border-b border-slate-50 flex items-center gap-4 overflow-x-auto no-scrollbar ${!selectedEmp ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Brushes</span>
                </div>
                {presets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePreset(p)}
                        className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shrink-0 border-2 ${activePreset?.id === p.id
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200 scale-105'
                            : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-900'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    onClick={() => setActivePreset(null)}
                    className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase border-2 transition-all flex items-center gap-2 ${!activePreset ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-red-50 border-red-50 text-red-400'}`}
                >
                    <Eraser size={14} /> Eraser
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-8 grid grid-cols-7 gap-3 bg-white relative">
                <AnimatePresence>
                    {!selectedEmp && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Locked</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-2">Select an employee to start painting shifts</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {weekDays.map(day => (
                    <div key={day} className="text-center text-[10px] font-black text-slate-300 py-2 tracking-widest">{day}</div>
                ))}

                {schedule.map((d, idx) => (
                    <button
                        key={idx}
                        disabled={!d.day}
                        onClick={() => applyPreset(d.day)}
                        className={`aspect-square rounded-[1.8rem] border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden group ${!d.day ? 'border-transparent bg-transparent' :
                            d.active ? 'border-slate-900 bg-slate-900 text-white shadow-2xl shadow-slate-300 z-10' :
                                'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                            }`}
                    >
                        {d.day && (
                            <>
                                <span className={`text-[12px] font-black transition-opacity ${d.active ? 'text-white/20 absolute top-3 right-4' : 'text-slate-400'}`}>{d.day}</span>
                                {d.active && (
                                    <div className="text-center px-1">
                                        <p className="text-[9px] font-black uppercase tracking-tight leading-none mb-1 text-emerald-400">{d.label}</p>
                                        <p className="text-[8px] font-bold opacity-60 leading-none">{d.start}</p>
                                        <div className="h-[1px] w-4 bg-white/20 my-0.5 mx-auto" />
                                        <p className="text-[8px] font-bold opacity-60 leading-none">{d.end}</p>
                                    </div>
                                )}
                                {!d.active && <div className="w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </>
                        )}
                    </button>
                ))}
            </div>

            {/* Save Action */}
            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase italic">Changes are internal until published</p>
                <button
                    onClick={handleSave}
                    disabled={loading || !selectedEmp}
                    className="bg-slate-900 text-white px-12 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-300 active:scale-95 disabled:opacity-20 flex items-center gap-3"
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    Publish Schedule
                </button>
            </div>
        </div>
    );
}