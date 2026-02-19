
// 'use client';
// import { useState, useEffect, useRef } from 'react';
// import { createClient } from '@/lib/supabase/client';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//     ChevronLeft, ChevronRight, CheckCircle2, Clock, X, User,
//     Navigation, Loader2, LogOut, History, AlertCircle,
//     MapPin, LifeBuoy, ArrowLeftRight, Bell, Check, Ban
// } from 'lucide-react';

// function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
//     const R = 6371e3;
//     const φ1 = lat1 * Math.PI / 180;
//     const φ2 = lat2 * Math.PI / 180;
//     const Δφ = (lat2 - lat1) * Math.PI / 180;
//     const Δλ = (lon2 - lon1) * Math.PI / 180;
//     const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//     return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
// }

// export default function EmployeeShiftView({ userId }: { userId: string }) {
//     const supabase = createClient();
//     const [viewDate, setViewDate] = useState(new Date());
//     const [schedule, setSchedule] = useState<any[]>([]);
//     const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
//     const [storeInfo, setStoreInfo] = useState<any>(null);
//     const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

//     // Swap & Inbox States
//     const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
//     const [isInboxOpen, setIsInboxOpen] = useState(false);
//     const [colleagues, setColleagues] = useState<any[]>([]);
//     const [selectedColleague, setSelectedColleague] = useState<string | null>(null);
//     const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

//     // Attendance & Timer
//     const [elapsedTime, setElapsedTime] = useState('00:00:00');
//     const [attendanceStatus, setAttendanceStatus] = useState<'idle' | 'loading' | 'active' | 'completed'>('idle');
//     const timerRef = useRef<NodeJS.Timeout | null>(null);

//     const currentMonth = viewDate.getMonth();
//     const currentYear = viewDate.getFullYear();
//     const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

//     const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
//         setToast({ msg, type });
//         setTimeout(() => setToast(null), 3000);
//     };

//     const startTimer = (startTimeISO: string) => {
//         if (timerRef.current) clearInterval(timerRef.current);
//         const updateCounter = () => {
//             const diff = new Date().getTime() - new Date(startTimeISO).getTime();
//             const h = Math.floor(diff / 3600000);
//             const m = Math.floor((diff % 3600000) / 60000);
//             const s = Math.floor((diff % 60000) / 1000);
//             setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
//         };
//         updateCounter();
//         timerRef.current = setInterval(updateCounter, 1000);
//     };

//     const formatTo12H = (time24: string) => {
//         if (!time24) return { time: '', period: '' };
//         const [hours, minutes] = time24.split(':').map(Number);
//         const period = hours >= 12 ? 'PM' : 'AM';
//         const hours12 = hours % 12 || 12;
//         return { time: `${hours12}:${minutes.toString().padStart(2, '0')}`, period };
//     };

//     // 1. Unified Fetch Data
//     const fetchEverything = async () => {
//         const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
//         const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay();
//         const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00Z`;
//         const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59Z`;

//         const { data: shifts } = await supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', start).lte('start_time', end);
//         const { data: profiles } = await supabase.from('profiles').select('id, full_name').neq('id', userId);
//         const { data: requests } = await supabase.from('swap_requests').select('*, profiles!requestor_id(full_name)').eq('receiver_id', userId).eq('status', 'pending');

//         const blanks = Array.from({ length: firstDayIdx }, () => ({ day: null }));
//         const days = Array.from({ length: daysInMonth }, (_, i) => {
//             const dayNum = i + 1;
//             const shift = shifts?.find(s => parseInt(s.start_time.split('T')[0].split('-')[2]) === dayNum);
//             return {
//                 id: shift?.id,
//                 day: dayNum,
//                 active: !!shift,
//                 start: shift ? formatTo12H(shift.start_time.split('T')[1].slice(0, 5)) : null,
//                 end: shift ? formatTo12H(shift.end_time.split('T')[1].slice(0, 5)) : null,
//                 label: shift?.shift_label || null,
//                 fullDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
//             };
//         });
//         setSchedule([...blanks, ...days]);
//         setColleagues(profiles || []);
//         setIncomingRequests(requests || []);
//     };

//     // 2. Realtime Subscription
//     useEffect(() => {
//         fetchEverything();
//         const channel = supabase.channel('shift_sync')
//             .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, fetchEverything)
//             .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests', filter: `receiver_id=eq.${userId}` }, fetchEverything)
//             .subscribe();
//         return () => { supabase.removeChannel(channel); };
//     }, [userId, currentMonth, currentYear]);

//     // 3. Status Initialization
//     useEffect(() => {
//         const init = async () => {
//             const { data: profile } = await supabase.from('profiles').select('*, stores(*)').eq('id', userId).single();
//             if (profile?.stores) setStoreInfo(profile.stores);

//             const today = new Date();
//             today.setHours(0, 0, 0, 0);
//             const { data: record } = await supabase.from('attendance').select('*').eq('employee_id', userId).gte('check_in', today.toISOString()).order('check_in', { ascending: false }).limit(1).maybeSingle();

//             if (record) {
//                 if (record.check_out) setAttendanceStatus('completed');
//                 else { setAttendanceStatus('active'); startTimer(record.check_in); }
//             } else setAttendanceStatus('idle');
//         };
//         init();
//     }, [userId]);

//     const activeShift = schedule.find(d => d.day === selectedDay && d.active);

//     // 4. Peer-to-Peer Interchange Logic
//     const handleSwapRequest = async () => {
//         if (!selectedColleague || !activeShift) return;
//         const { error } = await supabase.from('swap_requests').insert([{
//             requestor_id: userId,
//             receiver_id: selectedColleague,
//             shift_id: activeShift.id,
//             status: 'pending',
//             message: `INTERCHANGE:${activeShift.fullDate}`
//         }]);
//         if (!error) { setIsSwapModalOpen(false); showToast("Request sent", "success"); }
//     };

//     const handleAcceptSwap = async (request: any) => {
//         const dateToSwap = request.message.split(':')[1];

//         // Find Receiver's shift on the same date
//         const { data: receiverShift } = await supabase.from('shifts')
//             .select('id')
//             .eq('employee_id', userId)
//             .ilike('start_time', `${dateToSwap}%`)
//             .maybeSingle();

//         if (!receiverShift) return showToast("You have no shift to trade on this day.");

//         // Peer-to-Peer Transaction (Swap IDs)
//         const { error: e1 } = await supabase.from('shifts').update({ employee_id: request.requestor_id }).eq('id', receiverShift.id);
//         const { error: e2 } = await supabase.from('shifts').update({ employee_id: userId }).eq('id', request.shift_id);
//         const { error: e3 } = await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', request.id);

//         if (!e1 && !e2 && !e3) {
//             showToast("Shift traded!", "success");
//             fetchEverything();
//         } else showToast("Trade failed.");
//     };

//     const handleClockIn = async () => {
//         const now = new Date();
//         if (selectedDay !== now.getDate() || currentMonth !== now.getMonth()) return showToast("Only for today.");
//         setAttendanceStatus('loading');
//         navigator.geolocation.getCurrentPosition(async (pos) => {
//             const checkInTime = new Date().toISOString();
//             const { error } = await supabase.from('attendance').insert([{
//                 employee_id: userId, check_in: checkInTime,
//                 is_within_geofence: true, shift_id: activeShift?.id, store_id: storeInfo?.id
//             }]);
//             if (!error) { setAttendanceStatus('active'); startTimer(checkInTime); }
//             else setAttendanceStatus('idle');
//         });
//     };

//     const handleClockOut = async () => {
//         setAttendanceStatus('loading');
//         const { error } = await supabase.from('attendance').update({ check_out: new Date().toISOString() }).eq('employee_id', userId).is('check_out', null);
//         if (!error) { if (timerRef.current) clearInterval(timerRef.current); setAttendanceStatus('completed'); }
//     };

//     const getTheme = (label: string | null, isActive: boolean, isDay: boolean) => {
//         if (!isDay) return { bg: 'bg-transparent', text: 'text-transparent' };
//         if (!isActive) return { bg: 'bg-rose-50/50', text: 'text-rose-400', label: 'Off' };
//         const lower = (label || '').toLowerCase();
//         if (lower.includes('morning')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Morning' };
//         if (lower.includes('evening')) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Evening' };
//         return { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Shift' };
//     };

//     return (
//         <div className="max-w-auto mx-auto space-y-8 font-sans selection:bg-slate-100 pb-24">
//             <AnimatePresence>
//                 {toast && (
//                     <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
//                         className={`fixed top-0 left-6 right-6 z-[200] p-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-white border-rose-100 text-rose-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
//                         {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
//                         <span className="text-xs font-bold uppercase tracking-wide">{toast.msg}</span>
//                     </motion.div>
//                 )}
//             </AnimatePresence>

//             <header className="flex items-center justify-between">
//                 <div className="space-y-1">
//                     <h2 className="text-3xl font-medium text-slate-900 tracking-tight">
//                         {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}
//                     </h2>
//                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1">
//                         <MapPin size={10} /> {storeInfo?.name || 'Roster'}
//                     </p>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     {/* <button onClick={() => setIsInboxOpen(true)} className="relative p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-all">
//                         <Bell size={18} className="text-slate-600" />
//                         {incomingRequests.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">{incomingRequests.length}</span>}
//                     </button> */}
//                     <div className="flex bg-slate-50 rounded-full p-1">
//                         <button onClick={() => setViewDate(new Date(currentYear, currentMonth - 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all"><ChevronLeft size={16} /></button>
//                         <button onClick={() => setViewDate(new Date(currentYear, currentMonth + 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all"><ChevronRight size={16} /></button>
//                     </div>
//                 </div>
//             </header>

//             <div className="grid grid-cols-7 gap-1">
//                 {weekDays.map((day, i) => (
//                     <div key={`wd-${i}`} className="text-center text-[9px] font-bold text-slate-300 pb-2 uppercase tracking-widest">{day}</div>
//                 ))}
//                 {schedule.map((d, idx) => {
//                     const isSelected = selectedDay === d.day;
//                     const theme = getTheme(d.label, d.active, !!d.day);
//                     return (
//                         <button key={idx} disabled={!d.day} onClick={() => d.day && setSelectedDay(d.day)}
//                             className={`aspect-square relative flex items-center justify-center rounded-xl text-[11px] font-semibold transition-all duration-300
//                                 ${d.day ? theme.bg : ''} ${d.day ? theme.text : ''}
//                                 ${isSelected ? 'ring-2 ring-slate-900 ring-offset-2 scale-90 z-10 !bg-slate-900 !text-white' : 'hover:opacity-80'}`}>
//                             {d.day}
//                         </button>
//                     );
//                 })}
//             </div>

//             <div className="relative">
//                 <AnimatePresence mode="wait">
//                     {activeShift ? (
//                         <motion.div key={selectedDay} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
//                             <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
//                                 <div className="space-y-8">
//                                     <div className="flex justify-between items-start">
//                                         <div className="space-y-1">
//                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Type</p>
//                                             <h4 className="text-sm font-semibold text-slate-900 italic">{getTheme(activeShift.label, true, true).label} Session</h4>
//                                         </div>
//                                         {attendanceStatus === 'active' && (
//                                             <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
//                                                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
//                                                 <span className="text-[10px] font-bold text-emerald-600 font-mono tracking-tighter">{elapsedTime}</span>
//                                             </div>
//                                         )}
//                                     </div>
//                                     <div className="space-y-1">
//                                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scheduled</p>
//                                         <div className="flex items-baseline gap-2">
//                                             <span className="text-4xl font-light tracking-tighter text-slate-900">{activeShift.start.time}</span>
//                                             <span className="text-[10px] font-black text-slate-300 uppercase">{activeShift.start.period}</span>
//                                             <span className="text-slate-100 text-2xl mx-1">—</span>
//                                             <span className="text-4xl font-light tracking-tighter text-slate-900">{activeShift.end.time}</span>
//                                             <span className="text-[10px] font-black text-slate-300 uppercase">{activeShift.end.period}</span>
//                                         </div>
//                                     </div>
//                                     <div className="flex items-center justify-between pt-6 border-t border-slate-50">
//                                         <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5"><Clock size={12} /> Status</span>
//                                         <button onClick={() => setIsSwapModalOpen(true)} className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-100 pb-0.5 flex items-center gap-1">
//                                             <ArrowLeftRight size={10} /> Trade Shift
//                                         </button>
//                                     </div>
//                                 </div>
//                             </div>

//                             <div className="space-y-3">
//                                 <button onClick={attendanceStatus === 'active' ? handleClockOut : handleClockIn}
//                                     disabled={attendanceStatus === 'loading' || attendanceStatus === 'completed'}
//                                     className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 transition-all active:scale-95 border
//                                         ${attendanceStatus === 'active' ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-100' :
//                                             attendanceStatus === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50' :
//                                                 'bg-slate-900 border-slate-800 text-white shadow-lg shadow-slate-200'}`}>
//                                     {attendanceStatus === 'loading' ? <Loader2 className="animate-spin" size={18} /> :
//                                         attendanceStatus === 'active' ? <LogOut size={18} /> :
//                                             attendanceStatus === 'completed' ? <CheckCircle2 size={18} /> : <Navigation size={18} />}
//                                     <span className="text-[11px] font-black uppercase tracking-[0.2em]">
//                                         {attendanceStatus === 'loading' ? 'Verifying...' : attendanceStatus === 'active' ? 'Clock Out' : attendanceStatus === 'completed' ? 'Shift Finished' : 'Clock In Now'}
//                                     </span>
//                                 </button>
//                             </div>
//                         </motion.div>
//                     ) : (
//                         <div className="h-32 flex items-center justify-center border border-dashed border-slate-200 rounded-[2rem]">
//                             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Rest Day</p>
//                         </div>
//                     )}
//                 </AnimatePresence>
//             </div>

//             {/* Swap Modal */}
//             <AnimatePresence>
//                 {isSwapModalOpen && (
//                     <div className="fixed inset-0 z-[100] flex items-end justify-center">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSwapModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
//                         <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
//                             className="relative w-full max-w-md bg-white rounded-t-[3rem] shadow-2xl p-8 pb-12">
//                             <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
//                             <div className="space-y-6">
//                                 <div className="space-y-1">
//                                     <h3 className="text-xl font-bold tracking-tight">Interchange Shift</h3>
//                                     <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Select a colleague to trade with</p>
//                                 </div>
//                                 <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
//                                     {colleagues.map((c) => (
//                                         <button key={c.id} onClick={() => setSelectedColleague(c.id)}
//                                             className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${selectedColleague === c.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-50 text-slate-600'}`}>
//                                             <span className="text-xs font-bold uppercase tracking-tight">{c.full_name}</span>
//                                             {selectedColleague === c.id && <CheckCircle2 size={16} />}
//                                         </button>
//                                     ))}
//                                 </div>
//                                 <button disabled={!selectedColleague} onClick={handleSwapRequest} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-95 transition-all">Send Trade Request</button>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>

//             {/* Inbox Modal */}
//             {/* <AnimatePresence>
//                 {isInboxOpen && (
//                     <div className="fixed inset-0 z-[110] flex items-end justify-center">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInboxOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
//                         <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-white rounded-t-[3rem] p-8 pb-12 max-h-[85vh] overflow-y-auto">
//                             <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
//                             <h3 className="text-xl font-bold mb-6">Trade Requests</h3>
//                             {incomingRequests.length === 0 ? (
//                                 <p className="text-[10px] font-bold text-slate-300 uppercase text-center py-12">No pending trades</p>
//                             ) : (
//                                 <div className="space-y-3">
//                                     {incomingRequests.map((req) => (
//                                         <div key={req.id} className="p-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between">
//                                             <div>
//                                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.profiles.full_name}</p>
//                                                 <p className="text-xs font-bold text-slate-700 italic">Day {req.message.split('-')[2]}</p>
//                                             </div>
//                                             <div className="flex gap-2">
//                                                 <button onClick={() => handleAcceptSwap(req)} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"><Check size={14} /></button>
//                                                 <button onClick={async () => await supabase.from('swap_requests').update({ status: 'rejected' }).eq('id', req.id)} className="p-3 bg-white text-rose-500 border border-rose-100 rounded-xl"><X size={14} /></button>
//                                             </div>
//                                         </div>
//                                     ))}
//                                 </div>
//                             )}
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence> */}
//         </div>
//     );
// }


'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, CheckCircle2, Clock, X, User,
    Navigation, Loader2, LogOut, History, AlertCircle,
    MapPin, LifeBuoy, ArrowLeftRight, Bell, Check, Ban, CalendarDays
} from 'lucide-react';

export default function EmployeeShiftView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [viewDate, setViewDate] = useState(new Date());
    const [schedule, setSchedule] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
    const [storeInfo, setStoreInfo] = useState<any>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    // Swap & Inbox States
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [colleagues, setColleagues] = useState<any[]>([]);
    const [selectedColleague, setSelectedColleague] = useState<string | null>(null);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

    // Attendance & Timer
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [attendanceStatus, setAttendanceStatus] = useState<'idle' | 'loading' | 'active' | 'completed'>('idle');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const startTimer = (startTimeISO: string) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const updateCounter = () => {
            const diff = new Date().getTime() - new Date(startTimeISO).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };
        updateCounter();
        timerRef.current = setInterval(updateCounter, 1000);
    };

    const formatTo12H = (time24: string) => {
        if (!time24) return { time: '', period: '' };
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return { time: `${hours12}:${minutes.toString().padStart(2, '0')}`, period };
    };

    // 1. Unified Fetch Data (Now including Leave Requests)
    const fetchEverything = async () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay();

        const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Fetch Shifts, Profiles, and Swap Requests
        const [shiftsRes, profilesRes, swapsRes, leavesRes] = await Promise.all([
            supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${monthStart}T00:00:00Z`).lte('start_time', `${monthEnd}T23:59:59Z`),
            supabase.from('profiles').select('id, full_name').neq('id', userId),
            supabase.from('swap_requests').select('*, profiles!requestor_id(full_name)').eq('receiver_id', userId).eq('status', 'pending'),
            supabase.from('leave_requests').select('*').eq('employee_id', userId).eq('status', 'approved')
                .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`)
        ]);

        const shifts = shiftsRes.data || [];
        const leaves = leavesRes.data || [];

        const blanks = Array.from({ length: firstDayIdx }, () => ({ day: null }));
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);

            // Logic: Check if current day falls within any approved leave range
            const leaveOnThisDay = leaves.find(l => {
                const start = new Date(l.start_date);
                const end = new Date(l.end_date);
                return currentDate >= start && currentDate <= end;
            });

            const shift = shifts.find(s => s.start_time.split('T')[0] === dateStr);

            return {
                id: shift?.id,
                day: dayNum,
                active: !!shift,
                isLeave: !!leaveOnThisDay,
                start: shift ? formatTo12H(shift.start_time.split('T')[1].slice(0, 5)) : null,
                end: shift ? formatTo12H(shift.end_time.split('T')[1].slice(0, 5)) : null,
                label: leaveOnThisDay ? 'LEAVE' : (shift?.shift_label || null),
                fullDate: dateStr
            };
        });

        setSchedule([...blanks, ...days]);
        setColleagues(profilesRes.data || []);
        setIncomingRequests(swapsRes.data || []);
    };

    useEffect(() => {
        fetchEverything();
        const channel = supabase.channel('global_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, fetchEverything)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, fetchEverything)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, currentMonth, currentYear]);

    useEffect(() => {
        const init = async () => {
            const { data: profile } = await supabase.from('profiles').select('*, stores(*)').eq('id', userId).single();
            if (profile?.stores) setStoreInfo(profile.stores);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { data: record } = await supabase.from('attendance').select('*').eq('employee_id', userId).gte('check_in', today.toISOString()).order('check_in', { ascending: false }).limit(1).maybeSingle();

            if (record) {
                if (record.check_out) setAttendanceStatus('completed');
                else { setAttendanceStatus('active'); startTimer(record.check_in); }
            } else setAttendanceStatus('idle');
        };
        init();
    }, [userId]);

    const activeDayData = schedule.find(d => d.day === selectedDay);

    const handleClockIn = async () => {
        const now = new Date();
        if (selectedDay !== now.getDate() || currentMonth !== now.getMonth()) return showToast("Only for today.");
        if (activeDayData?.isLeave) return showToast("You are on leave today.");

        setAttendanceStatus('loading');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const checkInTime = new Date().toISOString();
            const { error } = await supabase.from('attendance').insert([{
                employee_id: userId, check_in: checkInTime,
                is_within_geofence: true, shift_id: activeDayData?.id, store_id: storeInfo?.id
            }]);
            if (!error) { setAttendanceStatus('active'); startTimer(checkInTime); }
            else setAttendanceStatus('idle');
        });
    };

    const handleClockOut = async () => {
        setAttendanceStatus('loading');
        const { error } = await supabase.from('attendance').update({ check_out: new Date().toISOString() }).eq('employee_id', userId).is('check_out', null);
        if (!error) { if (timerRef.current) clearInterval(timerRef.current); setAttendanceStatus('completed'); }
    };

    const getTheme = (d: any) => {
        if (!d.day) return { bg: 'bg-transparent', text: 'text-transparent' };
        if (d.isLeave) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'On Leave' };
        if (!d.active) return { bg: 'bg-rose-50/50', text: 'text-rose-400', label: 'Off' };

        const lower = (d.label || '').toLowerCase();
        if (lower.includes('morning')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Morning' };
        if (lower.includes('evening')) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Evening' };
        return { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Shift' };
    };

    return (
        <div className="max-w-auto mx-auto space-y-8 font-sans pb-20">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className={`fixed top-0 left-6 right-6 z-[200] p-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-white border-rose-100 text-rose-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
                        {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                        <span className="text-xs font-bold uppercase tracking-wide">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-medium text-slate-900 tracking-tight">
                        {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1">
                        <MapPin size={10} /> {storeInfo?.name || 'Roster'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-50 rounded-full p-1">
                        <button onClick={() => setViewDate(new Date(currentYear, currentMonth - 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all"><ChevronLeft size={16} /></button>
                        <button onClick={() => setViewDate(new Date(currentYear, currentMonth + 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </header>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => (
                    <div key={`wd-${i}`} className="text-center text-[9px] font-bold text-slate-300 pb-2 uppercase tracking-widest">{day}</div>
                ))}
                {schedule.map((d, idx) => {
                    const isSelected = selectedDay === d.day;
                    const theme = getTheme(d);
                    return (
                        <button key={idx} disabled={!d.day} onClick={() => d.day && setSelectedDay(d.day)}
                            className={`aspect-square relative flex items-center justify-center rounded-xl text-[11px] font-semibold transition-all duration-300
                                ${d.day ? theme.bg : ''} ${d.day ? theme.text : ''}
                                ${isSelected ? 'ring-2 ring-slate-900 ring-offset-2 scale-90 z-10 !bg-slate-900 !text-white' : 'hover:opacity-80'}`}>
                            {d.day}
                            {d.isLeave && !isSelected && <span className="absolute bottom-1.5 w-1 h-1 bg-amber-400 rounded-full" />}
                        </button>
                    );
                })}
            </div>

            {/* Details Card */}
            <div className="relative">
                <AnimatePresence mode="wait">
                    {activeDayData?.isLeave ? (
                        <motion.div key="leave" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-amber-50 border border-amber-100 rounded-[2.5rem] p-10 text-center space-y-4">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm text-amber-500">
                                <Ban size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xl font-black text-amber-900 uppercase tracking-tight">Approved Leave</h4>
                                <p className="text-xs text-amber-700/60 font-medium">Your request for time off on this date was approved.</p>
                            </div>
                            <div className="pt-4">
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-[10px] font-black text-amber-600 uppercase tracking-widest border border-amber-100">
                                    <CalendarDays size={12} /> Time Off Active
                                </span>
                            </div>
                        </motion.div>
                    ) : activeDayData?.active ? (
                        <motion.div key="shift" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                                <div className="space-y-8">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Type</p>
                                            <h4 className="text-sm font-semibold text-slate-900 italic">{getTheme(activeDayData).label} Session</h4>
                                        </div>
                                        {attendanceStatus === 'active' && (
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] font-bold text-emerald-600 font-mono tracking-tighter">{elapsedTime}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scheduled</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.start.time}</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.start.period}</span>
                                            <span className="text-slate-100 text-2xl mx-1">—</span>
                                            <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.end.time}</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.end.period}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5"><Clock size={12} /> Status</span>
                                        <button onClick={() => setIsSwapModalOpen(true)} className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-100 pb-0.5 flex items-center gap-1">
                                            <ArrowLeftRight size={10} /> Trade Shift
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button onClick={attendanceStatus === 'active' ? handleClockOut : handleClockIn}
                                disabled={attendanceStatus === 'loading' || attendanceStatus === 'completed'}
                                className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 transition-all active:scale-95 border
                                    ${attendanceStatus === 'active' ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-100' :
                                        attendanceStatus === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50' :
                                            'bg-slate-900 border-slate-800 text-white shadow-lg shadow-slate-200'}`}>
                                {attendanceStatus === 'loading' ? <Loader2 className="animate-spin" size={18} /> :
                                    attendanceStatus === 'active' ? <LogOut size={18} /> :
                                        attendanceStatus === 'completed' ? <CheckCircle2 size={18} /> : <Navigation size={18} />}
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                                    {attendanceStatus === 'loading' ? 'Verifying...' : attendanceStatus === 'active' ? 'Clock Out' : attendanceStatus === 'completed' ? 'Shift Finished' : 'Clock In Now'}
                                </span>
                            </button>
                        </motion.div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/30 space-y-2">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <History size={20} className="text-slate-300" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No Activity Scheduled</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Swap Modal */}
            <AnimatePresence>
                {isSwapModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSwapModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-md bg-white rounded-t-[3rem] shadow-2xl p-8 pb-12">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold tracking-tight">Interchange Shift</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Select a colleague to trade with</p>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                    {colleagues.map((c) => (
                                        <button key={c.id} onClick={() => setSelectedColleague(c.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${selectedColleague === c.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-50 text-slate-600'}`}>
                                            <span className="text-xs font-bold uppercase tracking-tight">{c.full_name}</span>
                                            {selectedColleague === c.id && <CheckCircle2 size={16} />}
                                        </button>
                                    ))}
                                </div>
                                <button disabled={!selectedColleague} onClick={() => { }} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-95 transition-all">Send Trade Request</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}