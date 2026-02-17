// 'use client';
// import { useState, useEffect } from 'react';
// import { createClient } from '@/lib/supabase/client';
// import { motion } from 'framer-motion';
// import {
//     History, Calendar as CalendarIcon,
//     Clock, MapPin, Loader2, X, ChevronRight
// } from 'lucide-react';

// export default function ActivityLogView({ userId }: { userId: string }) {
//     const supabase = createClient();
//     const [logs, setLogs] = useState<any[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [searchDate, setSearchDate] = useState('');

//     useEffect(() => {
//         fetchLogs();
//     }, [userId, searchDate]);

//     const fetchLogs = async () => {
//         setLoading(true);
//         let query = supabase
//             .from('attendance')
//             .select(`*, shifts(shift_label)`)
//             .eq('employee_id', userId)
//             .order('check_in', { ascending: false });

//         if (searchDate) {
//             query = query.gte('check_in', `${searchDate}T00:00:00Z`)
//                 .lte('check_in', `${searchDate}T23:59:59Z`);
//         }

//         const { data, error } = await query;
//         if (!error) setLogs(data || []);
//         setLoading(false);
//     };

//     return (
//         <div className="px-6 pt-6 pb-24 max-w-md mx-auto">
//             <header className="flex items-end justify-between mb-6">
//                 <div>
//                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Archive</p>
//                     <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Timesheets</h2>
//                 </div>
//                 <div className="relative">
//                     <input
//                         type="date"
//                         value={searchDate}
//                         onChange={(e) => setSearchDate(e.target.value)}
//                         className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
//                     />
//                     <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg shadow-slate-200">
//                         <CalendarIcon size={18} />
//                     </div>
//                 </div>
//             </header>

//             {searchDate && (
//                 <button
//                     onClick={() => setSearchDate('')}
//                     className="mb-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full"
//                 >
//                     <X size={10} /> Clear Filter: {searchDate}
//                 </button>
//             )}

//             <div className="space-y-2">
//                 {loading ? (
//                     <div className="flex flex-col items-center justify-center py-20 opacity-20">
//                         <Loader2 className="animate-spin" size={20} />
//                     </div>
//                 ) : logs.length > 0 ? (
//                     logs.map((log) => {
//                         const duration = log.check_out
//                             ? ((new Date(log.check_out).getTime() - new Date(log.check_in).getTime()) / 3600000).toFixed(1)
//                             : null;

//                         return (
//                             <motion.div
//                                 initial={{ opacity: 0, scale: 0.98 }}
//                                 animate={{ opacity: 1, scale: 1 }}
//                                 key={log.id}
//                                 className="bg-white border border-slate-100 p-4 rounded-[1.5rem] flex items-center justify-between group active:scale-[0.98] transition-all"
//                             >
//                                 <div className="flex items-center gap-4">
//                                     <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100">
//                                         <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">
//                                             {new Date(log.check_in).toLocaleDateString('en-US', { month: 'short' })}
//                                         </span>
//                                         <span className="text-sm font-bold text-slate-900 leading-none">
//                                             {new Date(log.check_in).getDate()}
//                                         </span>
//                                     </div>

//                                     <div>
//                                         <div className="flex items-center gap-2 mb-1">
//                                             <span className={`w-1.5 h-1.5 rounded-full ${log.check_out ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
//                                             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
//                                                 {log.shifts?.shift_label || 'Regular Shift'}
//                                             </p>
//                                         </div>
//                                         <div className="flex items-center gap-3 text-slate-400">
//                                             <span className="text-[9px] font-bold uppercase tracking-tighter flex items-center gap-1">
//                                                 <Clock size={10} /> {duration ? `${duration} hrs` : 'In Progress'}
//                                             </span>
//                                             <span className="text-[9px] font-bold uppercase tracking-tighter flex items-center gap-1">
//                                                 <MapPin size={10} /> {log.is_within_geofence ? 'Verified' : 'Manual'}
//                                             </span>
//                                         </div>
//                                     </div>
//                                 </div>

//                                 <div className="text-right">
//                                     <ChevronRight size={14} className="text-slate-200 group-hover:text-slate-900 transition-colors" />
//                                 </div>
//                             </motion.div>
//                         );
//                     })
//                 ) : (
//                     <div className="text-center py-16">
//                         <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
//                             <History size={20} className="text-slate-200" />
//                         </div>
//                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No Records Found</p>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }


'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import {
    History, Calendar as CalendarIcon,
    Clock, MapPin, Loader2, X, ChevronRight,
    ArrowRight
} from 'lucide-react';

export default function ActivityLogView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchDate, setSearchDate] = useState('');

    useEffect(() => {
        fetchLogs();
    }, [userId, searchDate]);

    // Helper to format timestamps to readable time strings
    const formatTime = (dateString: string | null) => {
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('attendance')
            .select(`*, shifts(shift_label)`)
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

    return (
        <div className="px-6 pt-6 pb-24 max-w-md mx-auto">
            <header className="flex items-end justify-between mb-6">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Archive</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Timesheets</h2>
                </div>
                <div className="relative">
                    <input
                        type="date"
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                    />
                    <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg shadow-slate-200">
                        <CalendarIcon size={18} />
                    </div>
                </div>
            </header>

            {searchDate && (
                <button
                    onClick={() => setSearchDate('')}
                    className="mb-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full"
                >
                    <X size={10} /> Clear Filter: {searchDate}
                </button>
            )}

            <div className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                        <Loader2 className="animate-spin" size={20} />
                    </div>
                ) : logs.length > 0 ? (
                    logs.map((log) => {
                        const duration = log.check_out
                            ? ((new Date(log.check_out).getTime() - new Date(log.check_in).getTime()) / 3600000).toFixed(1)
                            : null;

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={log.id}
                                className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm group active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">
                                                {new Date(log.check_in).toLocaleDateString('en-US', { month: 'short' })}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 leading-none">
                                                {new Date(log.check_in).getDate()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${log.check_out ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
                                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                                    {log.shifts?.shift_label || 'Regular Shift'}
                                                </p>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                                {log.is_within_geofence ? 'Verified Location' : 'Manual Entry'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 px-3 py-1 rounded-full">
                                        <span className="text-[10px] font-black text-slate-900 uppercase">
                                            {duration ? `${duration} hrs` : 'Live'}
                                        </span>
                                    </div>
                                </div>

                                {/* DISPLAY CHECK-IN AND CHECK-OUT TIMES */}
                                <div className="flex items-center justify-between bg-slate-50/50 rounded-2xl p-4 border border-slate-50">
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Check In</p>
                                        <p className="text-xs font-bold text-slate-900">{formatTime(log.check_in)}</p>
                                    </div>

                                    <ArrowRight size={14} className="text-slate-200" />

                                    <div className="text-right space-y-0.5">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Check Out</p>
                                        <p className={`text-xs font-bold ${log.check_out ? 'text-slate-900' : 'text-emerald-500 italic'}`}>
                                            {log.check_out ? formatTime(log.check_out) : 'On Duty'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="text-center py-16">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <History size={20} className="text-slate-200" />
                        </div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No Records Found</p>
                    </div>
                )}
            </div>
        </div>
    );
}