'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import WorkspaceDialog from '@/components/WorkspaceDialog';
import SwipeToConfirm from '@/components/SwipeToConfirm';
import { calculateDistance } from '@/lib/geofence';
import { getClockInLocation } from '@/lib/attendance/location';
import { getAttendanceDate } from '@/lib/attendance/date';
import { SHIFT_LOCK_MESSAGE } from '@/lib/shifts/rules';
import { nativeFeedback } from '@/lib/native/experience';
import type { Database } from '@/lib/supabase/database.types';
import {
    ChevronLeft, ChevronRight, CheckCircle2, Clock, X,
    Loader2, AlertCircle,
    MapPin, Ban, RefreshCcw, ArrowLeftRight, XCircle
} from 'lucide-react';

type Store = Database['public']['Tables']['stores']['Row'];
type ShiftPreset = Database['public']['Tables']['shift_presets']['Row'];
type SwapRequest = Database['public']['Tables']['swap_requests']['Row'];
type FormattedTime = { time: string; period: string };
type CalendarDay = {
    id?: string;
    day: number | null;
    active: boolean;
    isLeave: boolean;
    start: FormattedTime | null;
    end: FormattedTime | null;
    startRaw: string | null;
    endRaw: string | null;
    label: string | null;
    fullDate: string;
    request: SwapRequest | null;
    locked: boolean;
};

export default function EmployeeShiftView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [viewDate, setViewDate] = useState(new Date());
    const [schedule, setSchedule] = useState<CalendarDay[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
    const [storeInfo, setStoreInfo] = useState<Store | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    // Interchange & Request States
    const [isInterchangeModalOpen, setIsInterchangeModalOpen] = useState(false);
    const [sourceDay, setSourceDay] = useState<CalendarDay | null>(null);
    const [targetDay, setTargetDay] = useState<CalendarDay | null>(null);
    const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>([]);
    const [selectedNewShift, setSelectedNewShift] = useState<ShiftPreset | null>(null);
    const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
    const [interchangeMode, setInterchangeMode] = useState<'shift_type' | 'swap_date'>('shift_type');
    const [interchangeNote, setInterchangeNote] = useState('');
    const [sendingRequest, setSendingRequest] = useState(false);

    // Attendance & Timer
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [attendanceStatus, setAttendanceStatus] = useState<'checking' | 'idle' | 'active' | 'completed'>('checking');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceMessage, setAttendanceMessage] = useState('');
    const [attendanceError, setAttendanceError] = useState<string | null>(null);
    const attendanceOperationRef = useRef(false);
    const attendanceVersionRef = useRef(0);
    const attendanceAbortRef = useRef<AbortController | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
        setToast({ msg, type });
        nativeFeedback(type);
        setTimeout(() => setToast(null), 3000);
    };

    const reportAttendanceError = (message: string) => {
        setAttendanceError(message);
        nativeFeedback('error');
    };

    // --- HELPERS ---
    const formatTo12H = (time24: string) => {
        if (!time24) return { time: '', period: '' };
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return { time: `${hours12}:${minutes.toString().padStart(2, '0')}`, period };
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

        const blanks: CalendarDay[] = Array.from({ length: firstDayIdx }, () => ({
            day: null, active: false, isLeave: false, start: null, end: null,
            startRaw: null, endRaw: null, label: null, fullDate: '', request: null, locked: false,
        }));
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            const shift = shifts.find(s => s.start_time.startsWith(dateStr));
            const leave = leaves.find(l => currentDate >= new Date(l.start_date) && currentDate <= new Date(l.end_date));
            const request = requests.find(r =>
                (r.shift_id === shift?.id || r.message?.includes(dateStr)) &&
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
                } catch {
                    return null;
                }
            };

            return {
                id: shift?.id,
                day: dayNum,
                active: !!shift,
                isLeave: !!leave,
                start: extractLocalTime(shift?.start_time || undefined),
                end: extractLocalTime(shift?.end_time || undefined),
                startRaw: shift?.start_time ? shift.start_time.split('T')[1]?.substring(0, 5) : null,
                endRaw: shift?.end_time ? shift.end_time.split('T')[1]?.substring(0, 5) : null,
                label: leave ? 'LEAVE' : (shift?.shift_label || null),
                fullDate: dateStr,
                request: request || null,
                locked: Boolean(shift?.attendance_started_at),
            };
        });

        setSchedule([...blanks, ...days]);
    }, [userId, currentMonth, currentYear, supabase]);

    const startTimer = useCallback((startTimeISO: string) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const updateCounter = () => {
            const diff = Math.max(0, Date.now() - new Date(startTimeISO).getTime());
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };
        updateCounter();
        timerRef.current = setInterval(updateCounter, 1000);
    }, []);

    const init = useCallback(async () => {
        if (attendanceOperationRef.current) return;
        const version = ++attendanceVersionRef.current;
        const { data: profile } = await supabase.from('profiles').select('stores(*)').eq('id', userId)
            .single().overrideTypes<{ stores: Store | null }, { merge: false }>();
        if (profile?.stores) setStoreInfo(profile.stores);

        // 1. Check for ANY active session
        const { data: activeRecord, error: activeError } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', userId)
            .is('check_out', null)
            .order('check_in', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (version !== attendanceVersionRef.current || attendanceOperationRef.current) return;
        if (activeError) {
            setAttendanceError('Could not load your attendance. Check your connection and retry.');
            setAttendanceStatus('checking');
            return;
        }
        if (activeRecord) {
            setAttendanceError(null);
            setAttendanceStatus('active');
            startTimer(activeRecord.check_in);
            return;
        }

        // 2. If no active session, check if there was a completed session TODAY
        const today = getAttendanceDate();
        const { data: completedToday, error: completedError } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', userId)
            .gte('check_in', `${today}T00:00:00+05:30`)
            .not('check_out', 'is', null)
            .limit(1)
            .maybeSingle();

        if (version !== attendanceVersionRef.current || attendanceOperationRef.current) return;
        if (completedError) {
            setAttendanceError('Could not load your attendance. Check your connection and retry.');
            setAttendanceStatus('checking');
            return;
        }
        setAttendanceError(null);
        if (completedToday) {
            setAttendanceStatus('completed');
            if (timerRef.current) clearInterval(timerRef.current);
        } else {
            setAttendanceStatus('idle');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [userId, supabase, startTimer]);

    useEffect(() => { fetchEverything(); }, [fetchEverything]);
    useEffect(() => {
        const refresh = () => { void init(); void fetchEverything(); };
        const reconnect = (event: Event) => {
            if ((event as CustomEvent<{ connected: boolean }>).detail?.connected) refresh();
        };
        window.addEventListener('hrm:resume', refresh);
        window.addEventListener('hrm:connection', reconnect);
        return () => {
            window.removeEventListener('hrm:resume', refresh);
            window.removeEventListener('hrm:connection', reconnect);
        };
    }, [init, fetchEverything]);
    useEffect(() => {
        void init();
        return () => {
            attendanceVersionRef.current += 1;
            attendanceAbortRef.current?.abort();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [init]);

    // REAL-TIME LISTENER
    useEffect(() => {
        const channel = supabase.channel('roster_sync_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchEverything())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `employee_id=eq.${userId}` }, () => { void init(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests', filter: `requestor_id=eq.${userId}` }, async (payload) => {
                await fetchEverything();
                if (payload.eventType === 'UPDATE' && payload.new.status === 'approved' && payload.new.message?.includes('OVERRIDE REQUEST')) {
                    init();
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, supabase, fetchEverything, init]);

    const handleClockIn = async () => {
        if (attendanceOperationRef.current || attendanceStatus !== 'idle') return;
        const todayStr = getAttendanceDate();
        setAttendanceError(null);

        if (!activeDayData || activeDayData.fullDate !== todayStr || !activeDayData.active) {
            reportAttendanceError('No scheduled shift found for today.');
            return;
        }
        if (storeInfo?.lat == null || storeInfo?.lng == null) {
            reportAttendanceError('Store location is missing. Ask your manager to update it.');
            return;
        }

        if (!navigator.onLine) {
            reportAttendanceError('You are offline. Connect to the internet, then swipe again.');
            return;
        }
        attendanceOperationRef.current = true;
        attendanceVersionRef.current += 1;
        const controller = new AbortController();
        attendanceAbortRef.current = controller;
        setIsSubmitting(true);
        setAttendanceMessage('Finding your location…');

        try {
            const pos = await getClockInLocation(
                { lat: storeInfo.lat, lng: storeInfo.lng, radius_meters: storeInfo.radius_meters },
                () => setAttendanceMessage('Refining your location…'),
                controller.signal,
            );

            const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, storeInfo.lat, storeInfo.lng);
            const radius = storeInfo.radius_meters || 100;
            if (dist > radius) {
                reportAttendanceError(`You are ${Math.round(dist)}m from the store. Move within ${radius}m, then swipe again.`);
                return;
            }

            setAttendanceMessage('Saving clock-in…');
            const response = await fetch('/api/attendance/clock-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    userId,
                    storeId: storeInfo.id,
                    shiftId: activeDayData.id || null,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (typeof result.data?.check_in !== 'string') throw new Error('Could not confirm your clock-in. Refresh your attendance before retrying.');
                startTimer(result.data.check_in);
                setAttendanceStatus('active');
                showToast("Clocked in", "success");
            } else {
                reportAttendanceError(result.error || 'Clock-in failed. Please swipe again.');
            }
        } catch (error: unknown) {
            if (controller.signal.aborted) return;
            reportAttendanceError(error instanceof Error && !(error instanceof TypeError)
                ? error.message : 'Could not confirm clock-in. Check your connection and refresh attendance before retrying.');
        } finally {
            attendanceOperationRef.current = false;
            setIsSubmitting(false);
            setAttendanceMessage('');
        }
    };

    const handleClockOut = async () => {
        if (attendanceOperationRef.current || attendanceStatus !== 'active') return;
        setAttendanceError(null);
        if (!navigator.onLine) {
            reportAttendanceError('You are offline. Connect to the internet, then swipe again.');
            return;
        }
        attendanceOperationRef.current = true;
        attendanceVersionRef.current += 1;
        const controller = new AbortController();
        attendanceAbortRef.current = controller;
        setIsSubmitting(true);
        setAttendanceMessage('Saving clock-out…');
        try {
            const response = await fetch('/api/attendance/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ userId })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (timerRef.current) clearInterval(timerRef.current);
                setAttendanceStatus('completed');
                showToast("Shift Ended", "success");
                void fetchEverything();
            } else {
                reportAttendanceError(result.error || 'Clock-out failed. Please swipe again.');
            }
        } catch {
            if (controller.signal.aborted) return;
            reportAttendanceError('Could not confirm clock-out. Check your connection and refresh attendance before retrying.');
        } finally {
            attendanceOperationRef.current = false;
            setIsSubmitting(false);
            setAttendanceMessage('');
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
        if (sendingRequest) return;
        if (isDayLocked(sourceDay) || (interchangeMode === 'swap_date' && isDayLocked(targetDay))) {
            showToast(SHIFT_LOCK_MESSAGE);
            return;
        }
        let message = "";
        let shiftIdToUpdate: string | null = null;

        if (interchangeMode === 'shift_type' && sourceDay?.active && selectedNewShift) {
            message = `Shift Change: Move from ${sourceDay.label} to ${selectedNewShift.label} for ${sourceDay.fullDate}`;
            shiftIdToUpdate = sourceDay.id || null;
        }
        else if (interchangeMode === 'swap_date' && sourceDay && targetDay) {
            if (sourceDay.active && !targetDay.active) {
                message = `Request day off on ${sourceDay.fullDate} (working day) and instead work on my off day ${targetDay.fullDate}.`;
                shiftIdToUpdate = sourceDay.id || null;
            } else if (!sourceDay.active && targetDay.active) {
                message = `Request to work on my off day ${sourceDay.fullDate} and take ${targetDay.fullDate} off instead.`;
                shiftIdToUpdate = targetDay.id || null;
            } else if (sourceDay.active && targetDay.active) {
                message = `Swap my shift on ${sourceDay.fullDate} with shift on ${targetDay.fullDate}.`;
                shiftIdToUpdate = sourceDay.id || null;
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

        setSendingRequest(true);
        try {
            const response = await fetch('/api/requests/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    shiftId: shiftIdToUpdate,
                    message,
                    note: interchangeNote.trim() || null
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showToast("Sent to Admin", "success");
                setIsInterchangeModalOpen(false);
                setTargetDay(null);
                setSelectedNewShift(null);
                setInterchangeNote('');
                fetchEverything();
            } else {
                showToast(result.error || "Submission failed.");
            }
        } catch {
            showToast("Submission failed.");
        } finally {
            setSendingRequest(false);
        }
    };

    const handleCancelRequest = async (requestId: string) => {
        setCancellingRequestId(requestId);
        const { data, error } = await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', requestId).eq('status', 'pending').select('id');
        if (!error && data?.length) {
            showToast("Request cancelled", "success");
            fetchEverything();
        } else {
            showToast("Failed to cancel.");
        }
        setCancellingRequestId(null);
    };

    const getTheme = (d: CalendarDay) => {
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
    const todayStr = getAttendanceDate();
    const isDayLocked = (day: CalendarDay | null | undefined) => Boolean(day && (
        day.locked || schedule.find(current => current.fullDate === day.fullDate)?.locked ||
        (day.fullDate === todayStr && (attendanceStatus === 'active' || attendanceStatus === 'completed'))
    ));

    return (
        <div className="space-y-6">
            <>{toast && (
                <div role="status" aria-live="polite" className={`employee-toast flex items-center gap-3 ${toast.type === 'error' ? 'text-rose-600 border-rose-100' : 'text-emerald-600 border-emerald-100'}`}>
                    {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span className="text-sm font-medium tracking-normal">{toast.msg}</span>
                </div>
            )}</>

            <div className="employee-schedule-layout">
            <section className="employee-calendar-panel" aria-label="Shift calendar">
            <header className="flex justify-between items-center gap-3 mb-6">
                <div className="space-y-1">
                    <h2 className="text-xl font-medium text-slate-900">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</h2>
                    <p className="text-sm font-medium text-slate-500 tracking-normal flex items-center gap-1"><MapPin size={10} /> {storeInfo?.name || 'Roster'}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                    <button aria-label="Previous month" onClick={() => setViewDate(new Date(currentYear, currentMonth - 1))} className="employee-icon-button"><ChevronLeft size={16} /></button>
                    <button aria-label="Next month" onClick={() => setViewDate(new Date(currentYear, currentMonth + 1))} className="employee-icon-button"><ChevronRight size={16} /></button>
                </div>
            </header>

            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => <div key={i} className="text-center text-xs font-medium text-slate-500 pb-2 tracking-normal">{day}</div>)}
                {schedule.map((d, i) => {
                    const isSelected = selectedDay === d.day;
                    const hasRequest = !!d.request;
                    const isToday = d.fullDate === todayStr;
                    return (
                        <button key={i} disabled={!d.day} onClick={() => d.day && setSelectedDay(d.day)}
                            aria-label={d.day ? `${d.fullDate}, ${d.isLeave ? 'Leave' : d.active ? d.label || 'Working day' : 'Day off'}${hasRequest ? ', change requested' : ''}` : undefined}
                            aria-pressed={d.day ? isSelected : undefined} aria-current={isToday ? 'date' : undefined}
                            className={`employee-calendar-day relative ${d.isLeave ? 'employee-calendar-day-leave' : d.active ? 'employee-calendar-day-work' : 'employee-calendar-day-off'}`}>
                            {d.day}
                            {hasRequest && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white shadow-sm" />}
                        </button>
                    );
                })}
            </div>

            <div className="employee-calendar-legend" aria-label="Calendar legend">
                <span><i className="bg-emerald-500" />Working</span>
                <span><i className="bg-slate-200" />Off</span>
                <span><i className="bg-amber-500" />Leave</span>
            </div>
            </section>
            <section aria-label="Selected shift" className="min-w-0 space-y-4">
                {isDayLocked(activeDayData) && <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Shift locked because attendance has started. Requests for other unworked days are still available.</p>}
                <>
                    {activeDayData?.request ? (
                        <div key="request-status" className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                                        <span className="text-xs font-medium tracking-normal text-blue-400">Request sent</span>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-xs font-medium border bg-amber-500/20 border-amber-500/30 text-amber-400">Awaiting approval</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-slate-500 tracking-normal leading-none">Request details</p>
                                    <p className="text-sm font-medium leading-relaxed text-slate-200">&ldquo;{activeDayData.request.message}&rdquo;</p>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Clock size={12} />
                                        <p className="text-xs font-medium">Sent: {activeDayData.request.created_at ? new Date(activeDayData.request.created_at).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <button
                                        onClick={() => { if (activeDayData.request) void handleCancelRequest(activeDayData.request.id); }}
                                        disabled={cancellingRequestId === activeDayData.request.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-full text-rose-400 hover:bg-rose-500/30 transition-colors"
                                    >
                                        {cancellingRequestId === activeDayData.request.id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <XCircle size={12} />
                                        )}
                                        <span className="text-xs font-medium tracking-normal">Cancel</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeDayData?.day ? (
                        <div key="shift-detail" className="space-y-4">
                            <div className={`border rounded-xl p-5 ${!activeDayData.active ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                                <div className="space-y-8">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-500 tracking-normal">Selected day</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${getTheme(activeDayData).dot}`} />
                                                <h4 className={`text-sm font-medium   ${!activeDayData.active ? 'text-rose-600' : 'text-slate-900'}`}>{getTheme(activeDayData).label}</h4>
                                            </div>
                                        </div>
                                        {attendanceStatus === 'active' && activeDayData.active && (
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                <span className="text-sm font-medium text-emerald-600 font-mono">{elapsedTime}</span>
                                            </div>
                                        )}
                                    </div>
                                    {activeDayData.active ? (
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-500 tracking-normal leading-none mb-2">Shift time</p>
                                            <div className="employee-shift-time">
                                                <span>{activeDayData.start?.time || '—'}<small>{activeDayData.start?.period}</small></span>
                                                <span aria-hidden="true" className="text-slate-500">–</span><span className="sr-only">to</span>
                                                <span>{activeDayData.end?.time || '—'}<small>{activeDayData.end?.period}</small></span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center py-4 space-y-3">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-rose-400"><Ban size={24} /></div>
                                            <p className="text-sm font-medium text-rose-700/60 tracking-normal">No shift scheduled</p>
                                        </div>
                                    )}

                                    {activeDayData.fullDate >= todayStr && !isDayLocked(activeDayData) && (
                                        <div className="pt-6 border-t border-slate-50 flex justify-center">
                                            <button onClick={() => {
                                                setSourceDay(activeDayData);
                                                setTargetDay(null);
                                                setSelectedNewShift(null);
                                                setInterchangeNote('');
                                                setInterchangeMode(activeDayData.active ? 'shift_type' : 'swap_date');
                                                setIsInterchangeModalOpen(true);
                                            }} className="text-sm font-medium flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
                                                <RefreshCcw size={12} /> Request a change
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : null}
                </>
                {(attendanceStatus === 'active' || (activeDayData?.active && activeDayData.fullDate === todayStr)) && (
                    <div className="space-y-4" aria-label="Attendance">
                        {attendanceStatus === 'completed' ? (
                            <>
                                <p role="status" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-5 text-slate-600">
                                    <CheckCircle2 size={18} aria-hidden="true" /> Shift completed
                                </p>
                                <button onClick={handleRequestReEntry} className="w-full text-center text-sm font-medium text-slate-500 hover:text-rose-500 underline decoration-dotted underline-offset-4">
                                    Clocked out by accident? Request re-entry
                                </button>
                            </>
                        ) : attendanceStatus === 'checking' ? (
                            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
                                {attendanceError ? 'Attendance could not be loaded.' : <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking attendance…</>}
                            </p>
                        ) : (
                            <>
                                <SwipeToConfirm key={attendanceStatus}
                                    label={attendanceStatus === 'active' ? 'Swipe to clock out' : 'Swipe to clock in'}
                                    variant={attendanceStatus === 'active' ? 'end' : 'start'}
                                    busy={isSubmitting} busyLabel={attendanceMessage || 'Saving attendance…'}
                                    onConfirm={attendanceStatus === 'active' ? handleClockOut : handleClockIn} />
                                <p className="text-xs text-slate-500">
                                    {attendanceStatus === 'active' ? 'You are clocked in. Location is not required to clock out.' : 'Your location will be checked after you swipe.'}
                                </p>
                            </>
                        )}
                        {attendanceError && (
                            <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                                <p>{attendanceError}</p>
                                <button type="button" disabled={isSubmitting} className="mt-2 min-h-11 underline underline-offset-4"
                                    onClick={() => { setAttendanceError(null); setAttendanceStatus('checking'); void init(); }}>
                                    Refresh attendance
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>
            </div>

            <>
                {sourceDay && (
                    <WorkspaceDialog open={isInterchangeModalOpen} onClose={() => setIsInterchangeModalOpen(false)} labelledBy="shift-change-title">
                            <div className="space-y-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 id="shift-change-title" className="text-xl font-medium text-slate-900">Request a change</h3>
                                        <p className="text-sm text-slate-500 mt-1">Admin approval required</p>
                                    </div>
                                    <button type="button" onClick={() => setIsInterchangeModalOpen(false)} aria-label="Close shift change" className="employee-icon-button"><X size={20} /></button>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-medium text-slate-500 tracking-normal mb-2">Current</p>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full ${getTheme(sourceDay).dot}`} />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                            <p className="text-sm text-slate-500 font-medium">{getTheme(sourceDay).label} {sourceDay.active && sourceDay.start ? `• ${sourceDay.start.time} ${sourceDay.start.period}` : ''}</p>
                                        </div>
                                    </div>
                                </div>
                                {sourceDay.active && (
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button onClick={() => { setInterchangeMode('shift_type'); setTargetDay(null); setSelectedNewShift(null); }} className={`flex-1 py-3 rounded-xl text-xs font-medium  tracking-normal transition-colors flex items-center justify-center gap-2 ${interchangeMode === 'shift_type' ? 'bg-white text-slate-900 ' : 'text-slate-500'}`}>
                                            <RefreshCcw size={12} /> Change shift
                                        </button>
                                        <button onClick={() => { setInterchangeMode('swap_date'); setSelectedNewShift(null); }} className={`flex-1 py-3 rounded-xl text-xs font-medium  tracking-normal transition-colors flex items-center justify-center gap-2 ${interchangeMode === 'swap_date' ? 'bg-white text-slate-900 ' : 'text-slate-500'}`}>
                                            <ArrowLeftRight size={12} /> Swap date
                                        </button>
                                    </div>
                                )}
                                {interchangeMode === 'shift_type' && sourceDay.active && (
                                    <div className="space-y-4">
                                        <p className="text-xs font-medium text-slate-500 text-center tracking-normal">Select new shift type</p>
                                        <div className="flex gap-3 justify-center flex-wrap">
                                            {shiftPresets.filter(p => p.label !== sourceDay.label).map(preset => (
                                                <button key={preset.id} onClick={() => setSelectedNewShift(preset)} className={`px-6 py-4 rounded-xl text-sm font-medium  tracking-normal border transition-colors ${selectedNewShift?.id === preset.id ? 'bg-slate-900 border-slate-900 text-white ' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600'}`}>
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedNewShift && (
                                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                <p className="text-xs font-medium text-blue-600 tracking-normal mb-2">Change To</p>
                                                <p className="text-sm font-medium text-slate-900">{selectedNewShift.label}</p>
                                                <p className="text-sm text-slate-500 font-medium">on {new Date(sourceDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {interchangeMode === 'swap_date' && (
                                    <div className="space-y-4">
                                        <p className="text-xs font-medium text-slate-500 text-center tracking-normal">
                                            {sourceDay.active ? 'Select a date to swap with (working or off day)' : 'Select a working day to swap with'}
                                        </p>
                                        <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                                            {schedule.filter(d => {
                                                if (!d.day || d.fullDate < todayStr || isDayLocked(d)) return false;
                                                if (d.day === sourceDay.day) return false;
                                                if (!sourceDay.active) return d.active;
                                                return true;
                                            }).map(d => {
                                                const dTheme = getTheme(d);
                                                return (
                                                    <button key={d.day} onClick={() => { setTargetDay(d); setSelectedNewShift(null); }} className={`aspect-square rounded-xl text-sm font-medium border transition-colors flex flex-col items-center justify-center gap-0.5 ${targetDay?.day === d.day ? 'bg-slate-900 border-slate-900 text-white ' : `bg-white border-slate-100 hover:border-slate-300 ${dTheme.text}`}`}>
                                                        <span>{d.day}</span>
                                                        <span className={`text-xs  ${targetDay?.day === d.day ? 'text-white/60' : ''}`}>{d.active ? 'Work' : 'Off'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {targetDay && (
                                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                                <p className="text-xs font-medium text-emerald-600 tracking-normal mb-2">Swap To</p>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${getTheme(targetDay).dot}`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">{new Date(targetDay.fullDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                        <p className="text-sm text-slate-500 font-medium">{getTheme(targetDay).label}{targetDay.active && targetDay.start ? ` • ${targetDay.start.time} ${targetDay.start.period}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-medium text-slate-600 bg-white p-2 rounded-xl">
                                                    {sourceDay.active && !targetDay.active ? <>You will have <strong>{sourceDay.fullDate}</strong> off and work on <strong>{targetDay.fullDate}</strong> instead.</> : !sourceDay.active && targetDay.active ? <>You will work on <strong>{sourceDay.fullDate}</strong> and take <strong>{targetDay.fullDate}</strong> off.</> : sourceDay.active && targetDay.active ? <>Swap your shift from <strong>{sourceDay.fullDate}</strong> to <strong>{targetDay.fullDate}</strong>.</> : <>Both days are off – no change possible.</>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label htmlFor="shift-change-reason" className="text-xs font-medium text-slate-500">Reason for change (optional)</label>
                                    <textarea id="shift-change-reason" value={interchangeNote} onChange={(e) => setInterchangeNote(e.target.value)} placeholder="E.g., Doctor appointment, Family emergency..." className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-700 placeholder:text-slate-500 outline-none focus:border-slate-300 focus:bg-white transition-colors resize-none h-20" />
                                </div>
                                {(isDayLocked(sourceDay) || (interchangeMode === 'swap_date' && isDayLocked(targetDay))) && <p role="alert" className="text-sm text-rose-600">{SHIFT_LOCK_MESSAGE}</p>}
                                <button disabled={sendingRequest || isDayLocked(sourceDay) || (interchangeMode === 'shift_type' && !selectedNewShift) || (interchangeMode === 'swap_date' && (!targetDay || isDayLocked(targetDay)))} onClick={handleInterchangeRequest} className="w-full bg-slate-900 text-white py-5 rounded-xl text-sm font-medium tracking-normal disabled:opacity-20 transition-colors">
                                    {sendingRequest ? 'Sending request…' : 'Send request'}
                                </button>
                            </div>
                    </WorkspaceDialog>
                )}
            </>
        </div>
    );
}
