

// 'use client';
// import { useState, useEffect, useRef, useCallback } from 'react';
// import { createClient } from '@/lib/supabase/client';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//     ChevronLeft, ChevronRight, CheckCircle2, Clock, X,
//     Navigation, Loader2, AlertCircle,
//     MapPin, Ban, RefreshCcw, ArrowRight, ArrowLeftRight, ShieldCheck, Timer, XCircle
// } from 'lucide-react';
// import { clockInAction, clockOutAction } from '@/app/actions/attendance';
// import { createSwapRequestAction } from '@/app/actions/requests';

// export default function EmployeeShiftView({ userId }: { userId: string }) {
//     const supabase = createClient();
//     const [viewDate, setViewDate] = useState(new Date());
//     const [schedule, setSchedule] = useState<any[]>([]);
//     const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
//     const [storeInfo, setStoreInfo] = useState<any>(null);
//     const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

//     // Interchange & Request States
//     const [isInterchangeModalOpen, setIsInterchangeModalOpen] = useState(false);
//     const [sourceDay, setSourceDay] = useState<any>(null);
//     const [targetDay, setTargetDay] = useState<any>(null);
//     const [shiftPresets, setShiftPresets] = useState<any[]>([]);
//     const [selectedNewShift, setSelectedNewShift] = useState<any>(null);
//     const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
//     const [interchangeMode, setInterchangeMode] = useState<'shift_type' | 'swap_date'>('shift_type');
//     const [interchangeNote, setInterchangeNote] = useState('');

//     // Attendance & Timer
//     const [elapsedTime, setElapsedTime] = useState('00:00:00');
//     const [attendanceStatus, setAttendanceStatus] = useState<'idle' | 'loading' | 'active' | 'completed'>('idle');
//     const timerRef = useRef<NodeJS.Timeout | null>(null);

//     // Geolocation state for clock‑in
//     const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
//     const [locationError, setLocationError] = useState<string | null>(null);
//     const [distanceToStore, setDistanceToStore] = useState<number | null>(null);

//     const currentMonth = viewDate.getMonth();
//     const currentYear = viewDate.getFullYear();
//     const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

//     const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
//         setToast({ msg, type });
//         setTimeout(() => setToast(null), 3000);
//     };

//     // --- HELPERS ---
//     const formatTo12H = (time24: string) => {
//         if (!time24) return { time: '', period: '' };
//         const [hours, minutes] = time24.split(':').map(Number);
//         const period = hours >= 12 ? 'PM' : 'AM';
//         const hours12 = hours % 12 || 12;
//         return { time: `${hours12}:${minutes.toString().padStart(2, '0')}`, period };
//     };

//     const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
//         const R = 6371e3;
//         const φ1 = lat1 * Math.PI / 180;
//         const φ2 = lat2 * Math.PI / 180;
//         const Δφ = (lat2 - lat1) * Math.PI / 180;
//         const Δλ = (lon2 - lon1) * Math.PI / 180;
//         const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//         return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
//     };

//     // Check if current time is within allowed clock‑in window (30 min before start, up to end time)
//     const isWithinShiftWindow = (shiftStartTime: string, shiftEndTime: string): boolean => {
//         if (!shiftStartTime || !shiftEndTime) return false;
//         const now = new Date();
//         const [startHours, startMinutes] = shiftStartTime.split(':').map(Number);
//         const [endHours, endMinutes] = shiftEndTime.split(':').map(Number);
//         const startDateTime = new Date(now);
//         startDateTime.setHours(startHours, startMinutes, 0, 0);
//         const endDateTime = new Date(now);
//         endDateTime.setHours(endHours, endMinutes, 0, 0);
//         // Allow clock‑in from 30 min before start until the shift end time
//         const earlyWindow = new Date(startDateTime.getTime() - 30 * 60000);
//         return now >= earlyWindow && now <= endDateTime;
//     };

//     const fetchEverything = useCallback(async () => {
//         const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
//         const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay();
//         const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
//         const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

//         const [shiftsRes, leavesRes, presetsRes, requestsRes] = await Promise.all([
//             supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${monthStart}T00:00:00Z`).lte('start_time', `${monthEnd}T23:59:59Z`),
//             supabase.from('leave_requests').select('*').eq('employee_id', userId).eq('status', 'approved').or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`),
//             supabase.from('shift_presets').select('*'),
//             supabase.from('swap_requests').select('*').eq('requestor_id', userId).order('created_at', { ascending: false })
//         ]);

//         const shifts = shiftsRes.data || [];
//         const leaves = leavesRes.data || [];
//         const requests = requestsRes.data || [];
//         setShiftPresets(presetsRes.data || []);

//         const blanks = Array.from({ length: firstDayIdx }, () => ({ day: null }));
//         const days = Array.from({ length: daysInMonth }, (_, i) => {
//             const dayNum = i + 1;
//             const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
//             const currentDate = new Date(dateStr);
//             const shift = shifts.find(s => s.start_time.startsWith(dateStr));
//             const leave = leaves.find(l => currentDate >= new Date(l.start_date) && currentDate <= new Date(l.end_date));
//             const request = requests.find(r =>
//                 (r.shift_id === shift?.id || r.message.includes(dateStr)) &&
//                 r.status === 'pending'
//             );

//             const extractLocalTime = (timeString?: string) => {
//                 if (!timeString) return null;
//                 try {
//                     let timePart = '';
//                     if (timeString.includes('T')) {
//                         timePart = timeString.split('T')[1].substring(0, 5);
//                     } else if (timeString.includes(' ')) {
//                         timePart = timeString.split(' ')[1].substring(0, 5);
//                     } else {
//                         return null;
//                     }
//                     return formatTo12H(timePart);
//                 } catch (e) {
//                     return null;
//                 }
//             };

//             return {
//                 id: shift?.id,
//                 day: dayNum,
//                 active: !!shift,
//                 isLeave: !!leave,
//                 start: extractLocalTime(shift?.start_time),
//                 end: extractLocalTime(shift?.end_time),
//                 startRaw: shift?.start_time ? shift.start_time.split('T')[1]?.substring(0, 5) : null,
//                 endRaw: shift?.end_time ? shift.end_time.split('T')[1]?.substring(0, 5) : null,
//                 label: leave ? 'LEAVE' : (shift?.shift_label || null),
//                 fullDate: dateStr,
//                 request: request || null
//             };
//         });

//         setSchedule([...blanks, ...days]);
//     }, [userId, currentMonth, currentYear, supabase]);

//     const init = useCallback(async () => {
//         const { data: profile } = await supabase.from('profiles').select('*, stores(*)').eq('id', userId).single();
//         if (profile?.stores) setStoreInfo(profile.stores);

//         const now = new Date();
//         const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
//         const { data: record } = await supabase.from('attendance').select('*').eq('employee_id', userId).gte('check_in', `${today}T00:00:00Z`).order('check_in', { ascending: false }).limit(1).maybeSingle();

//         if (record) {
//             if (record.check_out) setAttendanceStatus('completed');
//             else { setAttendanceStatus('active'); startTimer(record.check_in); }
//         } else setAttendanceStatus('idle');
//     }, [userId, supabase]);

//     useEffect(() => { fetchEverything(); }, [fetchEverything]);
//     useEffect(() => { init(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [init]);

//     // REAL-TIME LISTENER
//     useEffect(() => {
//         const channel = supabase.channel('roster_sync_v2')
//             .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchEverything())
//             .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests', filter: `requestor_id=eq.${userId}` }, () => fetchEverything())
//             .subscribe();
//         return () => { supabase.removeChannel(channel); };
//     }, [userId, fetchEverything, supabase]);

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

//     // Improved clock‑in with location feedback and shift window check
//     const handleClockIn = async () => {
//         const now = new Date();
//         const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
//         if (activeDayData?.fullDate !== todayStr) {
//             return showToast("Clock‑in is only available for today's shift.");
//         }

//         // Check shift window
//         if (activeDayData.startRaw && activeDayData.endRaw) {
//             if (!isWithinShiftWindow(activeDayData.startRaw, activeDayData.endRaw)) {
//                 return showToast(`You can only clock in between 30 minutes before your shift start and the shift end time.`);
//             }
//         } else {
//             return showToast("Shift time missing. Please contact admin.");
//         }

//         if (!storeInfo?.lat || !storeInfo?.lng) {
//             return showToast("Store location data missing.");
//         }

//         setAttendanceStatus('loading');
//         setLocationStatus('requesting');
//         setLocationError(null);
//         setDistanceToStore(null);

//         navigator.geolocation.getCurrentPosition(
//             async (pos) => {
//                 const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, storeInfo.lat, storeInfo.lng);
//                 setDistanceToStore(dist);
//                 const radius = storeInfo.radius_meters || 100;
//                 if (dist > radius) {
//                     setLocationStatus('error');
//                     setLocationError(`You are ${Math.round(dist)} meters away. Must be within ${radius} meters.`);
//                     setAttendanceStatus('idle');
//                     return;
//                 }
//                 setLocationStatus('success');

//                 const result = await clockInAction(
//                     userId,
//                     storeInfo.id,
//                     activeDayData?.id || null,
//                     pos.coords.latitude,
//                     pos.coords.longitude
//                 );

//                 if (result.success) {
//                     init();
//                 } else {
//                     setAttendanceStatus('idle');
//                     showToast(result.error || "Clock-in failed.");
//                 }
//             },
//             (err) => {
//                 console.error(err);
//                 setLocationStatus('error');
//                 let errorMsg = "Unable to get your location.";
//                 if (err.code === 1) errorMsg = "Location permission denied. Please enable GPS.";
//                 else if (err.code === 2) errorMsg = "Location unavailable. Try again.";
//                 else if (err.code === 3) errorMsg = "Location request timed out.";
//                 setLocationError(errorMsg);
//                 setAttendanceStatus('idle');
//                 showToast(errorMsg);
//             },
//             { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
//         );
//     };

//     const handleClockOut = async () => {
//         setAttendanceStatus('loading');
//         const result = await clockOutAction(userId);
//         if (result.success) {
//             if (timerRef.current) clearInterval(timerRef.current);
//             setAttendanceStatus('completed');
//             showToast("Shift Ended", "success");
//         } else {
//             setAttendanceStatus('active');
//             showToast(result.error || "Clock-out failed.");
//         }
//     };

//     const handleRequestReEntry = async () => {
//         if (!activeDayData) return;
//         const { error } = await supabase.from('swap_requests').insert([{
//             requestor_id: userId, receiver_id: userId, shift_id: activeDayData.id, message: `OVERRIDE REQUEST: Accidental check-out on ${activeDayData.fullDate}`, status: 'pending'
//         }]);

//         if (!error) {
//             showToast("Override Requested to Admin", "success");
//             fetchEverything();
//         } else {
//             showToast("Failed to request override.");
//         }
//     };

//     // --- INTERCHANGE LOGIC (improved for day‑off swaps) ---
//     const handleInterchangeRequest = async () => {
//         let message = "";
//         let shiftIdToUpdate: string | null = null;

//         if (interchangeMode === 'shift_type' && sourceDay?.active && selectedNewShift) {
//             message = `Shift Change: Move from ${sourceDay.label} to ${selectedNewShift.label} for ${sourceDay.fullDate}`;
//             shiftIdToUpdate = sourceDay.id;
//         }
//         else if (interchangeMode === 'swap_date' && sourceDay && targetDay) {
//             // Determine swap type
//             const sourceIsWorking = sourceDay.active;
//             const targetIsWorking = targetDay.active;
//             if (sourceIsWorking && !targetIsWorking) {
//                 message = `Request day off on ${sourceDay.fullDate} (working day) and instead work on my off day ${targetDay.fullDate}.`;
//                 shiftIdToUpdate = sourceDay.id; // the shift we want to remove
//             } else if (!sourceIsWorking && targetIsWorking) {
//                 message = `Request to work on my off day ${targetDay.fullDate} and take ${sourceDay.fullDate} off instead.`;
//                 shiftIdToUpdate = targetDay.id; // the shift we want to add? Actually we need to link request to target shift
//                 // For admin clarity, we attach request to the shift that will be changed (target working day)
//             } else if (sourceIsWorking && targetIsWorking) {
//                 message = `Swap my shift on ${sourceDay.fullDate} with shift on ${targetDay.fullDate}.`;
//                 shiftIdToUpdate = sourceDay.id;
//             } else {
//                 showToast("Invalid swap: both days are off.", "error");
//                 return;
//             }
//         } else {
//             showToast("Please complete the selection.", "error");
//             return;
//         }

//         if (!shiftIdToUpdate) {
//             showToast("No shift found to link this request.", "error");
//             return;
//         }

//         const result = await createSwapRequestAction(
//             userId,
//             shiftIdToUpdate,
//             message,
//             interchangeNote.trim() || null
//         );

//         if (result.success) {
//             showToast("Sent to Admin", "success");
//             setIsInterchangeModalOpen(false);
//             setTargetDay(null);
//             setSelectedNewShift(null);
//             setInterchangeNote('');
//             fetchEverything();
//         } else {
//             showToast(result.error || "Submission failed.");
//         }
//     };

//     // --- CANCEL REQUEST ---
//     const handleCancelRequest = async (requestId: string) => {
//         setCancellingRequestId(requestId);
//         const { error } = await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', requestId);
//         if (!error) {
//             showToast("Request cancelled", "success");
//             fetchEverything();
//         } else {
//             showToast("Failed to cancel.");
//         }
//         setCancellingRequestId(null);
//     };

//     // --- THEMING ---
//     const getTheme = (d: any) => {
//         if (!d.day) return { bg: 'bg-transparent', text: 'text-transparent' };
//         if (d.isLeave) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Leave', dot: 'bg-amber-400' };
//         if (!d.active) return { bg: 'bg-rose-50/50', text: 'text-rose-400', label: 'Off', dot: 'bg-rose-400' };
//         const label = d.label?.toLowerCase() || '';
//         if (label.includes('sale')) return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', label: d.label, dot: 'bg-fuchsia-400' };
//         if (label.includes('day')) return { bg: 'bg-orange-50', text: 'text-orange-700', label: d.label, dot: 'bg-orange-400' };
//         if (label.includes('morning')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Morning', dot: 'bg-emerald-500' };
//         if (label.includes('evening')) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Evening', dot: 'bg-blue-500' };
//         return { bg: 'bg-slate-50', text: 'text-slate-700', label: d.label || 'Regular', dot: 'bg-slate-400' };
//     };

//     const activeDayData = schedule.find(d => d.day === selectedDay);
//     const todayStr = new Date().toISOString().split('T')[0];

//     return (
//         <div className="max-w-auto mx-auto space-y-8 font-sans pb-20">
//             {/* Toast */}
//             <AnimatePresence>{toast && (
//                 <motion.div initial={{ y: -50 }} animate={{ y: 20 }} exit={{ y: -50 }} className={`fixed top-0 left-6 right-6 z-[200] p-4 rounded-2xl shadow-xl border bg-white flex items-center gap-3 ${toast.type === 'error' ? 'text-rose-600 border-rose-100' : 'text-emerald-600 border-emerald-100'}`}>
//                     {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
//                     <span className="text-[10px] font-black uppercase tracking-widest">{toast.msg}</span>
//                 </motion.div>
//             )}</AnimatePresence>

//             {/* Header */}
//             <header className="flex justify-between items-center px-2">
//                 <div className="space-y-1">
//                     <h2 className="text-3xl font-medium text-slate-900 tracking-tight">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</h2>
//                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} /> {storeInfo?.name || 'Roster'}</p>
//                 </div>
//                 <div className="flex bg-slate-50 rounded-full p-1 border border-slate-100">
//                     <button onClick={() => setViewDate(new Date(currentYear, currentMonth - 1))} className="p-2 hover:bg-white rounded-full transition-all shadow-sm"><ChevronLeft size={16} /></button>
//                     <button onClick={() => setViewDate(new Date(currentYear, currentMonth + 1))} className="p-2 hover:bg-white rounded-full transition-all shadow-sm"><ChevronRight size={16} /></button>
//                 </div>
//             </header>

//             {/* Calendar Grid */}
//             <div className="grid grid-cols-7 gap-1">
//                 {weekDays.map((day, i) => <div key={i} className="text-center text-[9px] font-black text-slate-300 pb-2 uppercase tracking-widest">{day}</div>)}
//                 {schedule.map((d, i) => {
//                     const isSelected = selectedDay === d.day;
//                     const theme = getTheme(d);
//                     const hasRequest = !!d.request;
//                     const isToday = d.fullDate === todayStr;
//                     return (
//                         <button key={i} disabled={!d.day} onClick={() => d.day && setSelectedDay(d.day)}
//                             className={`aspect-square relative flex items-center justify-center rounded-xl text-[11px] font-bold transition-all
//                                 ${d.day ? theme.bg : ''} ${d.day ? theme.text : ''}
//                                 ${isSelected ? 'ring-2 ring-slate-900 ring-offset-2 scale-90 z-10 !bg-slate-900 !text-white' : 'hover:scale-95'}
//                                 ${isToday && !isSelected ? 'ring-1 ring-blue-400 ring-offset-1' : ''}`}>
//                             {d.day}
//                             {hasRequest && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white shadow-sm" />}
//                         </button>
//                     );
//                 })}
//             </div>

//             {/* Day Detail Card */}
//             <div className="relative px-2">
//                 <AnimatePresence mode="wait">
//                     {activeDayData?.request ? (
//                         <motion.div key="request-status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
//                             <div className="absolute -right-4 -top-4 opacity-10 rotate-12"><RefreshCcw size={120} /></div>
//                             <div className="relative z-10 space-y-6">
//                                 <div className="flex justify-between items-center">
//                                     <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
//                                         <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Request Sent</span>
//                                     </div>
//                                     <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-amber-500/20 border-amber-500/30 text-amber-400">Awaiting Admin</span>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Request Details</p>
//                                     <p className="text-sm font-medium leading-relaxed italic text-slate-200">"{activeDayData.request.message}"</p>
//                                 </div>
//                                 <div className="pt-4 border-t border-white/10 flex items-center justify-between">
//                                     <div className="flex items-center gap-2 text-slate-500">
//                                         <Clock size={12} />
//                                         <p className="text-[8px] font-black uppercase">Sent: {new Date(activeDayData.request.created_at).toLocaleDateString()}</p>
//                                     </div>
//                                     <button
//                                         onClick={() => handleCancelRequest(activeDayData.request.id)}
//                                         disabled={cancellingRequestId === activeDayData.request.id}
//                                         className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-full text-rose-400 hover:bg-rose-500/30 transition-all active:scale-95"
//                                     >
//                                         {cancellingRequestId === activeDayData.request.id ? (
//                                             <Loader2 size={12} className="animate-spin" />
//                                         ) : (
//                                             <XCircle size={12} />
//                                         )}
//                                         <span className="text-[8px] font-black uppercase tracking-widest">Cancel</span>
//                                     </button>
//                                 </div>
//                             </div>
//                         </motion.div>
//                     ) : activeDayData?.day ? (
//                         <motion.div key="shift-detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
//                             <div className={`border rounded-[2.5rem] p-8 shadow-sm ${!activeDayData.active ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
//                                 <div className="space-y-8">
//                                     <div className="flex justify-between items-start">
//                                         <div className="space-y-1">
//                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Schedule</p>
//                                             <div className="flex items-center gap-2">
//                                                 <span className={`w-2 h-2 rounded-full ${getTheme(activeDayData).dot}`} />
//                                                 <h4 className={`text-sm font-black italic uppercase ${!activeDayData.active ? 'text-rose-600' : 'text-slate-900'}`}>{getTheme(activeDayData).label}</h4>
//                                             </div>
//                                         </div>
//                                         {attendanceStatus === 'active' && activeDayData.active && (
//                                             <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
//                                                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
//                                                 <span className="text-[10px] font-black text-emerald-600 font-mono">{elapsedTime}</span>
//                                             </div>
//                                         )}
//                                     </div>
//                                     {activeDayData.active ? (
//                                         <div className="space-y-1">
//                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Shift Timing</p>
//                                             <div className="flex items-baseline gap-2">
//                                                 <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.start.time}</span>
//                                                 <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.start.period}</span>
//                                                 <span className="text-slate-100 text-2xl mx-1">—</span>
//                                                 <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.end.time}</span>
//                                                 <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.end.period}</span>
//                                             </div>
//                                         </div>
//                                     ) : (
//                                         <div className="flex flex-col items-center py-4 space-y-3">
//                                             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-400"><Ban size={24} /></div>
//                                             <p className="text-[10px] font-bold text-rose-700/60 uppercase tracking-widest">No Work Scheduled</p>
//                                         </div>
//                                     )}

//                                     {/* Interchange Button — only for future dates */}
//                                     {activeDayData.fullDate >= todayStr && (
//                                         <div className="pt-6 border-t border-slate-50 flex justify-center">
//                                             <button onClick={() => {
//                                                 setSourceDay(activeDayData);
//                                                 setTargetDay(null);
//                                                 setSelectedNewShift(null);
//                                                 setInterchangeNote('');
//                                                 // Default mode: shift_type for working days, swap_date for off days
//                                                 setInterchangeMode(activeDayData.active ? 'shift_type' : 'swap_date');
//                                                 setIsInterchangeModalOpen(true);
//                                             }} className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-6 py-3 rounded-full border transition-all active:scale-95
//                                                 ${!activeDayData.active
//                                                     ? 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50'
//                                                     : 'bg-slate-900 text-white border-slate-900 shadow-lg hover:bg-slate-800'}`}>
//                                                 <RefreshCcw size={12} /> Request Change
//                                             </button>
//                                         </div>
//                                     )}
//                                 </div>
//                             </div>

//                             {/* Clock In / Out Button — only for today's working shifts */}
//                             {activeDayData.active && activeDayData.fullDate === todayStr && (
//                                 <div className="space-y-4">
//                                     {/* Location feedback during clock‑in */}
//                                     {locationStatus === 'error' && distanceToStore !== null && (
//                                         <div className="bg-rose-50 rounded-2xl p-4 text-center space-y-2">
//                                             <p className="text-[10px] font-bold text-rose-600">⚠️ {locationError}</p>
//                                             <p className="text-[9px] text-rose-500">Distance: {Math.round(distanceToStore!)}m / Required within {storeInfo?.radius_meters || 100}m</p>
//                                             <button onClick={handleClockIn} className="text-[9px] font-black underline">Try Again</button>
//                                         </div>
//                                     )}
//                                     <button onClick={attendanceStatus === 'active' ? handleClockOut : handleClockIn}
//                                         disabled={attendanceStatus === 'loading' || attendanceStatus === 'completed'}
//                                         className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 border transition-all active:scale-95
//                                             ${attendanceStatus === 'active' ? 'bg-rose-500 border-rose-400 text-white shadow-lg'
//                                                 : attendanceStatus === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'
//                                                     : 'bg-slate-900 border-slate-800 text-white shadow-xl shadow-slate-200'}`}>
//                                         {attendanceStatus === 'loading' ? <Loader2 className="animate-spin" size={18} /> : attendanceStatus === 'completed' ? <CheckCircle2 size={18} /> : <Navigation size={18} />}
//                                         <span className="text-[11px] font-black uppercase tracking-[0.2em]">{attendanceStatus === 'active' ? 'End Shift' : attendanceStatus === 'completed' ? 'Shift Locked' : 'Start Shift'}</span>
//                                     </button>
//                                     {attendanceStatus === 'completed' && (
//                                         <button onClick={handleRequestReEntry} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest underline decoration-dotted underline-offset-4">
//                                             Clocked out by accident? Request Re-Entry
//                                         </button>
//                                     )}
//                                 </div>
//                             )}
//                         </motion.div>
//                     ) : null}
//                 </AnimatePresence>
//             </div>

//             {/* ======== INTERCHANGE MODAL (improved for day‑off swaps) ======== */}
//             <AnimatePresence>
//                 {isInterchangeModalOpen && sourceDay && (
//                     <div className="fixed inset-0 z-[100] flex items-end justify-center px-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInterchangeModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
//                         <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-white rounded-t-[3rem] p-8 pb-12 overflow-hidden shadow-2xl">
//                             <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />

//                             <div className="space-y-6">
//                                 <div className="text-center space-y-1">
//                                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Request Change</h3>
//                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Admin approval required</p>
//                                 </div>

//                                 {/* Current Selection (FROM) */}
//                                 <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
//                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Current</p>
//                                     <div className="flex items-center gap-3">
//                                         <span className={`w-2.5 h-2.5 rounded-full ${getTheme(sourceDay).dot}`} />
//                                         <div>
//                                             <p className="text-sm font-bold text-slate-900">{new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
//                                             <p className="text-[10px] text-slate-400 font-bold">{getTheme(sourceDay).label} {sourceDay.active && sourceDay.start ? `• ${sourceDay.start.time} ${sourceDay.start.period}` : ''}</p>
//                                         </div>
//                                     </div>
//                                 </div>

//                                 {/* Mode Tabs — only for working days (off days always use swap_date) */}
//                                 {sourceDay.active && (
//                                     <div className="flex bg-slate-100 p-1 rounded-2xl">
//                                         <button
//                                             onClick={() => { setInterchangeMode('shift_type'); setTargetDay(null); setSelectedNewShift(null); }}
//                                             className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
//                                                 ${interchangeMode === 'shift_type' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>
//                                             <RefreshCcw size={12} /> Change Shift
//                                         </button>
//                                         <button
//                                             onClick={() => { setInterchangeMode('swap_date'); setSelectedNewShift(null); }}
//                                             className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
//                                                 ${interchangeMode === 'swap_date' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>
//                                             <ArrowLeftRight size={12} /> Swap Date
//                                         </button>
//                                     </div>
//                                 )}

//                                 {/* ===== MODE: SHIFT TYPE CHANGE ===== */}
//                                 {interchangeMode === 'shift_type' && sourceDay.active && (
//                                     <div className="space-y-4">
//                                         <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">Select new shift type</p>
//                                         <div className="flex gap-3 justify-center flex-wrap">
//                                             {shiftPresets.filter(p => p.label !== sourceDay.label).map(preset => (
//                                                 <button key={preset.id} onClick={() => setSelectedNewShift(preset)}
//                                                     className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all
//                                                         ${selectedNewShift?.id === preset.id
//                                                             ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105'
//                                                             : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600'}`}>
//                                                     {preset.label}
//                                                 </button>
//                                             ))}
//                                         </div>
//                                         {selectedNewShift && (
//                                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
//                                                 <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-2">Change To</p>
//                                                 <p className="text-sm font-bold text-slate-900">{selectedNewShift.label}</p>
//                                                 <p className="text-[10px] text-slate-500 font-bold">on {new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
//                                             </motion.div>
//                                         )}
//                                     </div>
//                                 )}

//                                 {/* ===== MODE: SWAP DATE (improved for off ↔ working) ===== */}
//                                 {interchangeMode === 'swap_date' && (
//                                     <div className="space-y-4">
//                                         <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">
//                                             {sourceDay.active
//                                                 ? 'Select a date to swap with (working or off day)'
//                                                 : 'Select a working day to swap with'
//                                             }
//                                         </p>
//                                         <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
//                                             {schedule.filter(d => {
//                                                 if (!d.day || d.fullDate < todayStr) return false;
//                                                 if (d.day === sourceDay.day) return false;
//                                                 if (!sourceDay.active) {
//                                                     // For off day, only show working days as target
//                                                     return d.active;
//                                                 }
//                                                 // For working day, show any other day (including off)
//                                                 return true;
//                                             }).map(d => {
//                                                 const dTheme = getTheme(d);
//                                                 const isTargetOff = !d.active;
//                                                 return (
//                                                     <button key={d.day} onClick={() => { setTargetDay(d); setSelectedNewShift(null); }}
//                                                         className={`aspect-square rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center justify-center gap-0.5
//                                                             ${targetDay?.day === d.day
//                                                                 ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-95'
//                                                                 : `bg-white border-slate-100 hover:border-slate-300 ${dTheme.text}`}`}>
//                                                         <span>{d.day}</span>
//                                                         <span className={`text-[6px] uppercase ${targetDay?.day === d.day ? 'text-white/60' : 'opacity-50'}`}>
//                                                             {d.active ? 'WORK' : 'OFF'}
//                                                         </span>
//                                                     </button>
//                                                 );
//                                             })}
//                                         </div>

//                                         {/* Target Preview with clear swap explanation */}
//                                         {targetDay && (
//                                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
//                                                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-2">Swap To</p>
//                                                 <div className="flex items-center gap-3 mb-2">
//                                                     <span className={`w-2.5 h-2.5 rounded-full ${getTheme(targetDay).dot}`} />
//                                                     <div>
//                                                         <p className="text-sm font-bold text-slate-900">
//                                                             {new Date(targetDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
//                                                         </p>
//                                                         <p className="text-[10px] text-slate-500 font-bold">
//                                                             {getTheme(targetDay).label}
//                                                             {targetDay.active && targetDay.start ? ` • ${targetDay.start.time} ${targetDay.start.period}` : ''}
//                                                         </p>
//                                                     </div>
//                                                 </div>
//                                                 <div className="text-[9px] font-medium text-slate-600 bg-white p-2 rounded-xl">
//                                                     {sourceDay.active && !targetDay.active ? (
//                                                         <>🔁 You will have <strong>{sourceDay.fullDate}</strong> off and work on <strong>{targetDay.fullDate}</strong> instead.</>
//                                                     ) : !sourceDay.active && targetDay.active ? (
//                                                         <>🔁 You will work on <strong>{targetDay.fullDate}</strong> and take <strong>{sourceDay.fullDate}</strong> off.</>
//                                                     ) : sourceDay.active && targetDay.active ? (
//                                                         <>🔄 Swap your shift from <strong>{sourceDay.fullDate}</strong> to <strong>{targetDay.fullDate}</strong>.</>
//                                                     ) : (
//                                                         <>⚠️ Both days are off – no change possible.</>
//                                                     )}
//                                                 </div>
//                                             </motion.div>
//                                         )}
//                                     </div>
//                                 )}

//                                 {/* Reason/Note Input */}
//                                 <div className="space-y-2">
//                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Reason for Change (Optional)</label>
//                                     <textarea
//                                         value={interchangeNote}
//                                         onChange={(e) => setInterchangeNote(e.target.value)}
//                                         placeholder="E.g., Doctor appointment, Family emergency..."
//                                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-slate-300 focus:bg-white transition-all resize-none h-20"
//                                     />
//                                 </div>

//                                 {/* Submit */}
//                                 <button
//                                     disabled={
//                                         (interchangeMode === 'shift_type' && !selectedNewShift) ||
//                                         (interchangeMode === 'swap_date' && !targetDay)
//                                     }
//                                     onClick={handleInterchangeRequest}
//                                     className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-20 transition-all">
//                                     Submit to Admin
//                                 </button>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, CheckCircle2, Clock, X,
    Navigation, Loader2, AlertCircle,
    MapPin, Ban, RefreshCcw, ArrowRight, ArrowLeftRight, ShieldCheck, Timer, XCircle
} from 'lucide-react';
import { clockInAction, clockOutAction } from '@/app/actions/attendance';
import { createSwapRequestAction } from '@/app/actions/requests';

export default function EmployeeShiftView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [viewDate, setViewDate] = useState(new Date());
    const [schedule, setSchedule] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
    const [storeInfo, setStoreInfo] = useState<any>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    // Interchange & Request States
    const [isInterchangeModalOpen, setIsInterchangeModalOpen] = useState(false);
    const [sourceDay, setSourceDay] = useState<any>(null);
    const [targetDay, setTargetDay] = useState<any>(null);
    const [shiftPresets, setShiftPresets] = useState<any[]>([]);
    const [selectedNewShift, setSelectedNewShift] = useState<any>(null);
    const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
    const [interchangeMode, setInterchangeMode] = useState<'shift_type' | 'swap_date'>('shift_type');
    const [interchangeNote, setInterchangeNote] = useState('');

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

    // --- HELPERS ---
    const formatTo12H = (time24: string) => {
        if (!time24) return { time: '', period: '' };
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return { time: `${hours12}:${minutes.toString().padStart(2, '0')}`, period };
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const fetchEverything = useCallback(async () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay();
        const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        const [shiftsRes, leavesRes, presetsRes, requestsRes] = await Promise.all([
            supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${monthStart}T00:00:00Z`).lte('start_time', `${monthEnd}T23:59:59Z`),
            supabase.from('leave_requests').select('*').eq('employee_id', userId).eq('status', 'approved').or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`),
            supabase.from('shift_presets').select('*'),
            supabase.from('swap_requests').select('*').eq('requestor_id', userId).order('created_at', { ascending: false })
        ]);

        const shifts = shiftsRes.data || [];
        const leaves = leavesRes.data || [];
        const requests = requestsRes.data || [];
        setShiftPresets(presetsRes.data || []);

        const blanks = Array.from({ length: firstDayIdx }, () => ({ day: null }));
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            const shift = shifts.find(s => s.start_time.startsWith(dateStr));
            const leave = leaves.find(l => currentDate >= new Date(l.start_date) && currentDate <= new Date(l.end_date));
            const request = requests.find(r =>
                (r.shift_id === shift?.id || r.message.includes(dateStr)) &&
                r.status === 'pending'
            );

            const extractLocalTime = (timeString?: string) => {
                if (!timeString) return null;
                try {
                    let timePart = '';
                    if (timeString.includes('T')) {
                        timePart = timeString.split('T')[1].substring(0, 5);
                    } else if (timeString.includes(' ')) {
                        timePart = timeString.split(' ')[1].substring(0, 5);
                    } else {
                        return null;
                    }
                    return formatTo12H(timePart);
                } catch (e) {
                    return null;
                }
            };

            return {
                id: shift?.id,
                day: dayNum,
                active: !!shift,
                isLeave: !!leave,
                start: extractLocalTime(shift?.start_time),
                end: extractLocalTime(shift?.end_time),
                startRaw: shift?.start_time ? shift.start_time.split('T')[1]?.substring(0, 5) : null,
                endRaw: shift?.end_time ? shift.end_time.split('T')[1]?.substring(0, 5) : null,
                label: leave ? 'LEAVE' : (shift?.shift_label || null),
                fullDate: dateStr,
                request: request || null
            };
        });

        setSchedule([...blanks, ...days]);
    }, [userId, currentMonth, currentYear, supabase]);

    const init = useCallback(async () => {
        const { data: profile } = await supabase.from('profiles').select('*, stores(*)').eq('id', userId).single();
        if (profile?.stores) setStoreInfo(profile.stores);

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const { data: record } = await supabase.from('attendance').select('*').eq('employee_id', userId).gte('check_in', `${today}T00:00:00Z`).order('check_in', { ascending: false }).limit(1).maybeSingle();

        if (record) {
            if (record.check_out) {
                setAttendanceStatus('completed');
                if (timerRef.current) clearInterval(timerRef.current);
            } else {
                setAttendanceStatus('active');
                startTimer(record.check_in);
            }
        } else {
            setAttendanceStatus('idle');
        }
    }, [userId, supabase]);

    useEffect(() => { fetchEverything(); }, [fetchEverything]);
    useEffect(() => { init(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [init]);

    // REAL-TIME LISTENER with override approval auto-reactivation
    useEffect(() => {
        const channel = supabase.channel('roster_sync_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchEverything())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests', filter: `requestor_id=eq.${userId}` }, async (payload) => {
                await fetchEverything();
                // If an override request was approved, reactivate the shift automatically
                if (payload.eventType === 'UPDATE' && payload.new.status === 'approved' && payload.new.message?.includes('OVERRIDE REQUEST')) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const activeDay = schedule.find(d => d.fullDate === todayStr);
                    if (activeDay?.active && attendanceStatus !== 'active') {
                        const { data: record } = await supabase
                            .from('attendance')
                            .select('*')
                            .eq('employee_id', userId)
                            .gte('check_in', `${todayStr}T00:00:00`)
                            .order('check_in', { ascending: false })
                            .limit(1)
                            .single();
                        if (record && !record.check_out) {
                            setAttendanceStatus('active');
                            startTimer(record.check_in);
                            showToast('Override approved – shift resumed', 'success');
                        }
                    }
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, supabase, fetchEverything, schedule, attendanceStatus]);

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

    const handleClockIn = async () => {
        // Prevent double-click
        if (attendanceStatus === 'loading') return;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Validate today's shift
        if (!activeDayData) {
            showToast("No shift data available.");
            return;
        }
        if (activeDayData.fullDate !== todayStr) {
            showToast("Only available for today's shift.");
            return;
        }
        if (!activeDayData.active) {
            showToast("No scheduled shift today.");
            return;
        }
        if (!storeInfo?.lat || !storeInfo?.lng) {
            showToast("Store location data missing.");
            return;
        }

        setAttendanceStatus('loading');

        // Use a promise with timeout for geolocation
        const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        try {
            const pos = await getPosition();
            const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, storeInfo.lat, storeInfo.lng);
            const radius = storeInfo.radius_meters || 100;
            if (dist > radius) {
                setAttendanceStatus('idle');
                showToast(`Too far (${Math.round(dist)}m). Required within ${radius}m.`);
                return;
            }

            const result = await clockInAction(
                userId,
                storeInfo.id,
                activeDayData.id || null,
                pos.coords.latitude,
                pos.coords.longitude
            );

            if (result.success) {
                await init(); // Refresh attendance status
                showToast("Clocked in successfully!", "success");
            } else {
                setAttendanceStatus('idle');
                showToast(result.error || "Clock-in failed.");
            }
        } catch (err: any) {
            console.error("Clock-in error:", err);
            setAttendanceStatus('idle');
            if (err.code === 1) showToast("Location permission denied. Please enable GPS.");
            else if (err.code === 2) showToast("Location unavailable. Try again.");
            else if (err.code === 3) showToast("Location request timed out.");
            else showToast(err.message || "Clock-in failed.");
        }
    };

    const handleClockOut = async () => {
        if (attendanceStatus !== 'active') return;
        setAttendanceStatus('loading');
        try {
            const result = await clockOutAction(userId);
            if (result.success) {
                if (timerRef.current) clearInterval(timerRef.current);
                setAttendanceStatus('completed');
                showToast("Shift Ended", "success");
                await init(); // Refresh to ensure consistency
            } else {
                setAttendanceStatus('active');
                showToast(result.error || "Clock-out failed.");
            }
        } catch (err: any) {
            console.error("Clock-out error:", err);
            setAttendanceStatus('active');
            showToast(err.message || "Clock-out failed.");
        }
    };

    const handleRequestReEntry = async () => {
        if (!activeDayData) return;
        const { error } = await supabase.from('swap_requests').insert([{
            requestor_id: userId, receiver_id: userId, shift_id: activeDayData.id, message: `OVERRIDE REQUEST: Accidental check-out on ${activeDayData.fullDate}`, status: 'pending'
        }]);

        if (!error) {
            showToast("Override Requested to Admin", "success");
            fetchEverything();
        } else {
            showToast("Failed to request override.");
        }
    };

    const handleInterchangeRequest = async () => {
        let message = "";
        let shiftIdToUpdate: string | null = null;

        if (interchangeMode === 'shift_type' && sourceDay?.active && selectedNewShift) {
            message = `Shift Change: Move from ${sourceDay.label} to ${selectedNewShift.label} for ${sourceDay.fullDate}`;
            shiftIdToUpdate = sourceDay.id;
        }
        else if (interchangeMode === 'swap_date' && sourceDay && targetDay) {
            const sourceIsWorking = sourceDay.active;
            const targetIsWorking = targetDay.active;
            if (sourceIsWorking && !targetIsWorking) {
                message = `Request day off on ${sourceDay.fullDate} (working day) and instead work on my off day ${targetDay.fullDate}.`;
                shiftIdToUpdate = sourceDay.id;
            } else if (!sourceIsWorking && targetIsWorking) {
                message = `Request to work on my off day ${targetDay.fullDate} and take ${sourceDay.fullDate} off instead.`;
                shiftIdToUpdate = targetDay.id;
            } else if (sourceIsWorking && targetIsWorking) {
                message = `Swap my shift on ${sourceDay.fullDate} with shift on ${targetDay.fullDate}.`;
                shiftIdToUpdate = sourceDay.id;
            } else {
                showToast("Invalid swap: both days are off.", "error");
                return;
            }
        } else {
            showToast("Please complete the selection.", "error");
            return;
        }

        if (!shiftIdToUpdate) {
            showToast("No shift found to link this request.", "error");
            return;
        }

        const result = await createSwapRequestAction(
            userId,
            shiftIdToUpdate,
            message,
            interchangeNote.trim() || null
        );

        if (result.success) {
            showToast("Sent to Admin", "success");
            setIsInterchangeModalOpen(false);
            setTargetDay(null);
            setSelectedNewShift(null);
            setInterchangeNote('');
            fetchEverything();
        } else {
            showToast(result.error || "Submission failed.");
        }
    };

    const handleCancelRequest = async (requestId: string) => {
        setCancellingRequestId(requestId);
        const { error } = await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', requestId);
        if (!error) {
            showToast("Request cancelled", "success");
            fetchEverything();
        } else {
            showToast("Failed to cancel.");
        }
        setCancellingRequestId(null);
    };

    const getTheme = (d: any) => {
        if (!d.day) return { bg: 'bg-transparent', text: 'text-transparent' };
        if (d.isLeave) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Leave', dot: 'bg-amber-400' };
        if (!d.active) return { bg: 'bg-rose-50/50', text: 'text-rose-400', label: 'Off', dot: 'bg-rose-400' };
        const label = d.label?.toLowerCase() || '';
        if (label.includes('sale')) return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', label: d.label, dot: 'bg-fuchsia-400' };
        if (label.includes('day')) return { bg: 'bg-orange-50', text: 'text-orange-700', label: d.label, dot: 'bg-orange-400' };
        if (label.includes('morning')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Morning', dot: 'bg-emerald-500' };
        if (label.includes('evening')) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Evening', dot: 'bg-blue-500' };
        return { bg: 'bg-slate-50', text: 'text-slate-700', label: d.label || 'Regular', dot: 'bg-slate-400' };
    };

    const activeDayData = schedule.find(d => d.day === selectedDay);
    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="max-w-auto mx-auto space-y-8 font-sans pb-20">
            <AnimatePresence>{toast && (
                <motion.div initial={{ y: -50 }} animate={{ y: 20 }} exit={{ y: -50 }} className={`fixed top-0 left-6 right-6 z-[200] p-4 rounded-2xl shadow-xl border bg-white flex items-center gap-3 ${toast.type === 'error' ? 'text-rose-600 border-rose-100' : 'text-emerald-600 border-emerald-100'}`}>
                    {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{toast.msg}</span>
                </motion.div>
            )}</AnimatePresence>

            <header className="flex justify-between items-center px-2">
                <div className="space-y-1">
                    <h2 className="text-3xl font-medium text-slate-900 tracking-tight">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} /> {storeInfo?.name || 'Roster'}</p>
                </div>
                <div className="flex bg-slate-50 rounded-full p-1 border border-slate-100">
                    <button onClick={() => setViewDate(new Date(currentYear, currentMonth - 1))} className="p-2 hover:bg-white rounded-full transition-all shadow-sm"><ChevronLeft size={16} /></button>
                    <button onClick={() => setViewDate(new Date(currentYear, currentMonth + 1))} className="p-2 hover:bg-white rounded-full transition-all shadow-sm"><ChevronRight size={16} /></button>
                </div>
            </header>

            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => <div key={i} className="text-center text-[9px] font-black text-slate-300 pb-2 uppercase tracking-widest">{day}</div>)}
                {schedule.map((d, i) => {
                    const isSelected = selectedDay === d.day;
                    const theme = getTheme(d);
                    const hasRequest = !!d.request;
                    const isToday = d.fullDate === todayStr;
                    return (
                        <button key={i} disabled={!d.day} onClick={() => d.day && setSelectedDay(d.day)}
                            className={`aspect-square relative flex items-center justify-center rounded-xl text-[11px] font-bold transition-all
                                ${d.day ? theme.bg : ''} ${d.day ? theme.text : ''}
                                ${isSelected ? 'ring-2 ring-slate-900 ring-offset-2 scale-90 z-10 !bg-slate-900 !text-white' : 'hover:scale-95'}
                                ${isToday && !isSelected ? 'ring-1 ring-blue-400 ring-offset-1' : ''}`}>
                            {d.day}
                            {hasRequest && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white shadow-sm" />}
                        </button>
                    );
                })}
            </div>

            <div className="relative px-2">
                <AnimatePresence mode="wait">
                    {activeDayData?.request ? (
                        <motion.div key="request-status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10 rotate-12"><RefreshCcw size={120} /></div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Request Sent</span>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-amber-500/20 border-amber-500/30 text-amber-400">Awaiting Admin</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Request Details</p>
                                    <p className="text-sm font-medium leading-relaxed italic text-slate-200">"{activeDayData.request.message}"</p>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Clock size={12} />
                                        <p className="text-[8px] font-black uppercase">Sent: {new Date(activeDayData.request.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => handleCancelRequest(activeDayData.request.id)}
                                        disabled={cancellingRequestId === activeDayData.request.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-full text-rose-400 hover:bg-rose-500/30 transition-all active:scale-95"
                                    >
                                        {cancellingRequestId === activeDayData.request.id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <XCircle size={12} />
                                        )}
                                        <span className="text-[8px] font-black uppercase tracking-widest">Cancel</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : activeDayData?.day ? (
                        <motion.div key="shift-detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <div className={`border rounded-[2.5rem] p-8 shadow-sm ${!activeDayData.active ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                                <div className="space-y-8">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Schedule</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${getTheme(activeDayData).dot}`} />
                                                <h4 className={`text-sm font-black italic uppercase ${!activeDayData.active ? 'text-rose-600' : 'text-slate-900'}`}>{getTheme(activeDayData).label}</h4>
                                            </div>
                                        </div>
                                        {attendanceStatus === 'active' && activeDayData.active && (
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] font-black text-emerald-600 font-mono">{elapsedTime}</span>
                                            </div>
                                        )}
                                    </div>
                                    {activeDayData.active ? (
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Shift Timing</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.start.time}</span>
                                                <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.start.period}</span>
                                                <span className="text-slate-100 text-2xl mx-1">—</span>
                                                <span className="text-4xl font-light tracking-tighter text-slate-900">{activeDayData.end.time}</span>
                                                <span className="text-[10px] font-black text-slate-300 uppercase">{activeDayData.end.period}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center py-4 space-y-3">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-400"><Ban size={24} /></div>
                                            <p className="text-[10px] font-bold text-rose-700/60 uppercase tracking-widest">No Work Scheduled</p>
                                        </div>
                                    )}

                                    {activeDayData.fullDate >= todayStr && (
                                        <div className="pt-6 border-t border-slate-50 flex justify-center">
                                            <button onClick={() => {
                                                setSourceDay(activeDayData);
                                                setTargetDay(null);
                                                setSelectedNewShift(null);
                                                setInterchangeNote('');
                                                setInterchangeMode(activeDayData.active ? 'shift_type' : 'swap_date');
                                                setIsInterchangeModalOpen(true);
                                            }} className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-6 py-3 rounded-full border transition-all active:scale-95
                                                ${!activeDayData.active
                                                    ? 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50'
                                                    : 'bg-slate-900 text-white border-slate-900 shadow-lg hover:bg-slate-800'}`}>
                                                <RefreshCcw size={12} /> Request Change
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {activeDayData.active && activeDayData.fullDate === todayStr && (
                                <div className="space-y-4">
                                    <button
                                        onClick={attendanceStatus === 'active' ? handleClockOut : handleClockIn}
                                        disabled={attendanceStatus === 'loading' || attendanceStatus === 'completed'}
                                        className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 border transition-all active:scale-95
                                            ${attendanceStatus === 'active' ? 'bg-rose-500 border-rose-400 text-white shadow-lg'
                                                : attendanceStatus === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'
                                                    : 'bg-slate-900 border-slate-800 text-white shadow-xl shadow-slate-200'}`}>
                                        {attendanceStatus === 'loading' ? <Loader2 className="animate-spin" size={18} /> : attendanceStatus === 'completed' ? <CheckCircle2 size={18} /> : <Navigation size={18} />}
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">{attendanceStatus === 'active' ? 'End Shift' : attendanceStatus === 'completed' ? 'Shift Locked' : 'Start Shift'}</span>
                                    </button>
                                    {attendanceStatus === 'completed' && (
                                        <button onClick={handleRequestReEntry} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest underline decoration-dotted underline-offset-4">
                                            Clocked out by accident? Request Re-Entry
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isInterchangeModalOpen && sourceDay && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center px-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInterchangeModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-white rounded-t-[3rem] p-8 pb-12 overflow-hidden shadow-2xl">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />
                            <div className="space-y-6">
                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Request Change</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Admin approval required</p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Current</p>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full ${getTheme(sourceDay).dot}`} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{getTheme(sourceDay).label} {sourceDay.active && sourceDay.start ? `• ${sourceDay.start.time} ${sourceDay.start.period}` : ''}</p>
                                        </div>
                                    </div>
                                </div>
                                {sourceDay.active && (
                                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                                        <button onClick={() => { setInterchangeMode('shift_type'); setTargetDay(null); setSelectedNewShift(null); }} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${interchangeMode === 'shift_type' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>
                                            <RefreshCcw size={12} /> Change Shift
                                        </button>
                                        <button onClick={() => { setInterchangeMode('swap_date'); setSelectedNewShift(null); }} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${interchangeMode === 'swap_date' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>
                                            <ArrowLeftRight size={12} /> Swap Date
                                        </button>
                                    </div>
                                )}
                                {interchangeMode === 'shift_type' && sourceDay.active && (
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">Select new shift type</p>
                                        <div className="flex gap-3 justify-center flex-wrap">
                                            {shiftPresets.filter(p => p.label !== sourceDay.label).map(preset => (
                                                <button key={preset.id} onClick={() => setSelectedNewShift(preset)} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${selectedNewShift?.id === preset.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600'}`}>
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedNewShift && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                                                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-2">Change To</p>
                                                <p className="text-sm font-bold text-slate-900">{selectedNewShift.label}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">on {new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                            </motion.div>
                                        )}
                                    </div>
                                )}
                                {interchangeMode === 'swap_date' && (
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">
                                            {sourceDay.active ? 'Select a date to swap with (working or off day)' : 'Select a working day to swap with'}
                                        </p>
                                        <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                                            {schedule.filter(d => {
                                                if (!d.day || d.fullDate < todayStr) return false;
                                                if (d.day === sourceDay.day) return false;
                                                if (!sourceDay.active) return d.active;
                                                return true;
                                            }).map(d => {
                                                const dTheme = getTheme(d);
                                                return (
                                                    <button key={d.day} onClick={() => { setTargetDay(d); setSelectedNewShift(null); }} className={`aspect-square rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${targetDay?.day === d.day ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-95' : `bg-white border-slate-100 hover:border-slate-300 ${dTheme.text}`}`}>
                                                        <span>{d.day}</span>
                                                        <span className={`text-[6px] uppercase ${targetDay?.day === d.day ? 'text-white/60' : 'opacity-50'}`}>{d.active ? 'WORK' : 'OFF'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {targetDay && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-2">Swap To</p>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${getTheme(targetDay).dot}`} />
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{new Date(targetDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold">{getTheme(targetDay).label}{targetDay.active && targetDay.start ? ` • ${targetDay.start.time} ${targetDay.start.period}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-[9px] font-medium text-slate-600 bg-white p-2 rounded-xl">
                                                    {sourceDay.active && !targetDay.active ? <>🔁 You will have <strong>{sourceDay.fullDate}</strong> off and work on <strong>{targetDay.fullDate}</strong> instead.</> : !sourceDay.active && targetDay.active ? <>🔁 You will work on <strong>{targetDay.fullDate}</strong> and take <strong>{sourceDay.fullDate}</strong> off.</> : sourceDay.active && targetDay.active ? <>🔄 Swap your shift from <strong>{sourceDay.fullDate}</strong> to <strong>{targetDay.fullDate}</strong>.</> : <>⚠️ Both days are off – no change possible.</>}
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Reason for Change (Optional)</label>
                                    <textarea value={interchangeNote} onChange={(e) => setInterchangeNote(e.target.value)} placeholder="E.g., Doctor appointment, Family emergency..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-slate-300 focus:bg-white transition-all resize-none h-20" />
                                </div>
                                <button disabled={(interchangeMode === 'shift_type' && !selectedNewShift) || (interchangeMode === 'swap_date' && !targetDay)} onClick={handleInterchangeRequest} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-20 transition-all">
                                    Submit to Admin
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}