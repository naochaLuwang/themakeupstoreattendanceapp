'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import WorkspaceDialog from '@/components/WorkspaceDialog';
import EmployeeAttendanceCard from './EmployeeAttendanceCard';
import EmployeeStoreOpsNav from './EmployeeStoreOpsNav';
import { addScheduleDays, calendarDay, calendarRange, scheduleDateLabel, shiftCoversInstant, weekDates } from '@/lib/attendance/schedule';
import type { AttendanceRecord, AttendanceStatus, CalendarDay, SwapRequest } from '@/lib/attendance/schedule';
import { calculateDistance } from '@/lib/geofence';
import { getClockInLocation } from '@/lib/attendance/location';
import { getAttendanceDate } from '@/lib/attendance/date';
import { SHIFT_LOCK_MESSAGE } from '@/lib/shifts/rules';
import { nativeFeedback } from '@/lib/native/experience';
import type { AttendanceResult } from '@/lib/attendance/engine';
import type { Database } from '@/lib/supabase/database.types';
import {
    ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, X,
    AlertCircle, LockKeyhole,
    RefreshCcw, ArrowLeftRight, XCircle
} from 'lucide-react';

type Store = Database['public']['Tables']['stores']['Row'];
type ShiftPreset = Database['public']['Tables']['shift_presets']['Row'];
export default function EmployeeShiftView({ userId, firstName = 'there' }: { userId: string; firstName?: string }) {
    const [supabase] = useState(() => createClient());
    const [todayStr, setTodayStr] = useState(() => getAttendanceDate());
    const [viewDate, setViewDate] = useState(() => new Date(`${getAttendanceDate()}T12:00:00Z`));
    const [schedule, setSchedule] = useState<CalendarDay[]>([]);
    const [selectedDate, setSelectedDate] = useState(() => getAttendanceDate());
    const [monthExpanded, setMonthExpanded] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(true);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [todaySchedule, setTodaySchedule] = useState<CalendarDay | null>(null);
    const [nextShift, setNextShift] = useState<CalendarDay | null>(null);
    const [todayLoading, setTodayLoading] = useState(true);
    const [todayError, setTodayError] = useState<string | null>(null);
    const [pendingRequests, setPendingRequests] = useState<SwapRequest[]>([]);
    const [requestsReady, setRequestsReady] = useState(false);
    const [requestsError, setRequestsError] = useState<string | null>(null);
    const [reEntryBusy, setReEntryBusy] = useState(false);
    const reEntryRef = useRef(false);
    const calendarVersionRef = useRef(0);
    const todayVersionRef = useRef(0);
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

    const [locationPolicy, setLocationPolicy] = useState<{ maxAccuracyMeters: number; maxLocationAgeSeconds: number } | undefined>();
    const [smartQrEnabled, setSmartQrEnabled] = useState(false);
    const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(null);
    const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('checking');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceMessage, setAttendanceMessage] = useState('');
    const [attendanceError, setAttendanceError] = useState<string | null>(null);
    const attendanceOperationRef = useRef(false);
    const attendanceVersionRef = useRef(0);
    const attendanceAbortRef = useRef<AbortController | null>(null);

    const currentMonth = viewDate.getUTCMonth();
    const currentYear = viewDate.getUTCFullYear();
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
        setToast({ msg, type });
        nativeFeedback(type);
        setTimeout(() => setToast(current => current?.msg === msg ? null : current), type === 'error' ? 8000 : 3000);
    };

    const reportAttendanceError = (message: string) => {
        setAttendanceError(message);
        nativeFeedback('error');
    };

    const fetchEverything = useCallback(async () => {
        const version = ++calendarVersionRef.current;
        const range = calendarRange(currentYear, currentMonth);
        setCalendarLoading(true);
        setCalendarError(null);
        try {
            const [shiftsRes, leavesRes, presetsRes, requestsRes] = await Promise.all([
                supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${range.start}T00:00:00Z`).lt('start_time', `${range.end}T00:00:00Z`),
                supabase.from('leave_requests').select('*').eq('employee_id', userId).eq('status', 'approved').lte('start_date', addScheduleDays(range.end, -1)).gte('end_date', range.start),
                supabase.from('shift_presets').select('*'),
                supabase.from('swap_requests').select('*').eq('requestor_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
            ]);
            if (version !== calendarVersionRef.current) return;
            setRequestsReady(!requestsRes.error);
            setRequestsError(requestsRes.error ? 'Could not check your pending requests. Refresh attendance before requesting re-entry.' : null);
            if (!requestsRes.error) setPendingRequests(requestsRes.data || []);
            if (shiftsRes.error || leavesRes.error || presetsRes.error || requestsRes.error) {
                setCalendarError('Schedule could not be loaded. Check your connection and retry.');
                return;
            }
            setShiftPresets(presetsRes.data || []);
            setSchedule(range.dates.map(date => calendarDay(date, shiftsRes.data || [], leavesRes.data || [], requestsRes.data || [])));
        } catch {
            if (version === calendarVersionRef.current) {
                setCalendarError('Schedule could not be loaded. Check your connection and retry.');
                setRequestsReady(false);
                setRequestsError('Could not check your pending requests. Refresh attendance before requesting re-entry.');
            }
        } finally {
            if (version === calendarVersionRef.current) setCalendarLoading(false);
        }
    }, [userId, currentMonth, currentYear, supabase]);

    // This query is deliberately independent of the date shown in the calendar.
    const fetchToday = useCallback(async () => {
        const version = ++todayVersionRef.current;
        const tomorrow = addScheduleDays(todayStr, 1);
        const yesterday = addScheduleDays(todayStr, -1);
        setTodayLoading(true);
        setTodayError(null);
        try {
            const [shiftsRes, leavesRes, upcomingRes] = await Promise.all([
                supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${yesterday}T00:00:00Z`).lt('start_time', `${tomorrow}T00:00:00Z`),
                supabase.from('leave_requests').select('*').eq('employee_id', userId).eq('status', 'approved').lte('start_date', todayStr).gte('end_date', yesterday),
                supabase.from('shifts').select('*').eq('employee_id', userId).gte('start_time', `${tomorrow}T00:00:00Z`).order('start_time').limit(1),
            ]);
            if (version !== todayVersionRef.current) return;
            const todayShifts = (shiftsRes.data || []).filter(shift => shift.start_time.slice(0, 10) === todayStr);
            const overnight = (shiftsRes.data || []).filter(shift => shift.start_time.slice(0, 10) !== todayStr && shiftCoversInstant(shift));
            const eligible = todayShifts.length ? todayShifts : overnight;
            if (shiftsRes.error || leavesRes.error || eligible.length > 1) throw new Error('Schedule unavailable');
            setTodaySchedule(calendarDay(eligible[0]?.start_time.slice(0, 10) || todayStr, eligible, leavesRes.data || []));
            const upcoming = upcomingRes.data?.[0];
            setNextShift(upcoming ? calendarDay(upcoming.start_time.slice(0, 10), [upcoming], []) : null);
        } catch {
            if (version === todayVersionRef.current) setTodayError('Today’s shift could not be loaded. Check your connection and refresh attendance.');
        } finally {
            if (version === todayVersionRef.current) setTodayLoading(false);
        }
    }, [userId, todayStr, supabase]);

    const init = useCallback(async () => {
        if (attendanceOperationRef.current) return;
        const version = ++attendanceVersionRef.current;
        const expectedDay = todayStr;
        try {
            const [profileRes, stateResponse] = await Promise.all([
                supabase.from('profiles').select('stores(*)').eq('id', userId).single().overrideTypes<{ stores: Store | null }, { merge: false }>(),
                fetch('/api/attendance/state', { cache: 'no-store' }),
            ]);
            const state = await stateResponse.json() as AttendanceResult;
            if (version !== attendanceVersionRef.current || attendanceOperationRef.current || expectedDay !== getAttendanceDate()) return;
            setStoreInfo(profileRes.data?.stores || null);
            if (!stateResponse.ok || !state.success) throw new Error(state.success ? 'Attendance unavailable' : state.error);
            if (state.state === 'attendance_exception' || state.state === 'pending_review') throw new Error('Your attendance needs administrator review. Existing recorded hours have been kept.');
            const record = state.data;
            if (state.state === 'clocked_in' && !record?.check_in) throw new Error('Attendance unavailable');
            setLocationPolicy(state.policy);
            setSmartQrEnabled(Boolean(state.policy?.smartQrEnabled));
            setAttendanceRecord(record);
            setAttendanceStatus(state.state === 'clocked_in' ? 'active' : state.state === 'completed' ? 'completed' : 'idle');
            setAttendanceError(profileRes.error && state.state === 'not_started' ? 'Store details could not be loaded. Refresh attendance before clocking in.' : null);
        } catch (error: unknown) {
            if (version !== attendanceVersionRef.current || attendanceOperationRef.current) return;
            setAttendanceError(error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message : 'Could not load your attendance. Check your connection and retry.');
            setAttendanceStatus('checking');
        }
    }, [userId, supabase, todayStr]);

    useEffect(() => {
        const updateDate = () => setTodayStr(getAttendanceDate());
        const interval = window.setInterval(updateDate, 60000);
        window.addEventListener('focus', updateDate);
        document.addEventListener('visibilitychange', updateDate);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', updateDate);
            document.removeEventListener('visibilitychange', updateDate);
        };
    }, []);
    useEffect(() => { void fetchToday(); return () => { todayVersionRef.current += 1; }; }, [fetchToday]);
    useEffect(() => { void fetchEverything(); return () => { calendarVersionRef.current += 1; }; }, [fetchEverything]);
    useEffect(() => {
        const refresh = () => { setTodayStr(getAttendanceDate()); void init(); void fetchEverything(); void fetchToday(); };
        const reconnect = (event: Event) => {
            if ((event as CustomEvent<{ connected: boolean }>).detail?.connected) refresh();
        };
        window.addEventListener('hrm:resume', refresh);
        window.addEventListener('hrm:attendance-updated', refresh);
        window.addEventListener('hrm:connection', reconnect);
        return () => {
            window.removeEventListener('hrm:resume', refresh);
            window.removeEventListener('hrm:attendance-updated', refresh);
            window.removeEventListener('hrm:connection', reconnect);
        };
    }, [init, fetchEverything, fetchToday]);
    useEffect(() => {
        void init();
        return () => {
            attendanceVersionRef.current += 1;
        };
    }, [init]);

    useEffect(() => () => attendanceAbortRef.current?.abort(), []);

    // REAL-TIME LISTENER
    useEffect(() => {
        const channel = supabase.channel('roster_sync_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => { void fetchEverything(); void fetchToday(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `employee_id=eq.${userId}` }, () => { void init(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests', filter: `requestor_id=eq.${userId}` }, async (payload) => {
                await Promise.all([fetchEverything(), fetchToday()]);
                if (payload.eventType === 'UPDATE' && payload.new.status === 'approved' && payload.new.message?.includes('OVERRIDE REQUEST')) {
                    init();
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, supabase, fetchEverything, fetchToday, init]);

    const handleClockIn = async () => {
        if (attendanceOperationRef.current || attendanceStatus !== 'idle') return;
        setAttendanceError(null);

        if (todayLoading || todayError || !todaySchedule || !todaySchedule.active || todaySchedule.isLeave) {
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
                locationPolicy,
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
                    shiftId: todaySchedule.id || null,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    capturedAt: new Date(pos.timestamp).toISOString(),
                    operationId: crypto.randomUUID()
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (typeof result.data?.check_in !== 'string') throw new Error('Could not confirm your clock-in. Refresh your attendance before retrying.');
                setAttendanceRecord(result.data);
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
        let saved = false;
        try {
            const response = await fetch('/api/attendance/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ userId, attendanceId: attendanceRecord?.id, expectedVersion: attendanceRecord?.version, operationId: crypto.randomUUID() })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                saved = true;
                setAttendanceStatus('completed');
                showToast("Clocked out", "success");
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
            if (saved) void init();
        }
    };

    const reEntryPending = pendingRequests.some(request => request.message?.startsWith('OVERRIDE REQUEST') &&
        Boolean(attendanceRecord && (request.shift_id === attendanceRecord.shift_id || request.message.includes(getAttendanceDate(new Date(attendanceRecord.check_in))))));
    const attendanceShiftId = attendanceRecord?.shift_id || (attendanceRecord && todaySchedule?.fullDate === getAttendanceDate(new Date(attendanceRecord.check_in)) ? todaySchedule.id : null);

    const handleRequestReEntry = async () => {
        if (reEntryRef.current || reEntryPending || !requestsReady || attendanceStatus !== 'completed' || !attendanceRecord || !attendanceShiftId) return;
        reEntryRef.current = true;
        setReEntryBusy(true);
        try {
            const { data, error } = await supabase.from('swap_requests').insert([{
                requestor_id: userId, receiver_id: userId, shift_id: attendanceShiftId,
                message: `OVERRIDE REQUEST: Accidental check-out on ${getAttendanceDate(new Date(attendanceRecord.check_in))}`, status: 'pending',
            }]).select('*').single();
            if (error) throw error;
            if (data) setPendingRequests(current => [data, ...current]);
            showToast('Re-entry request sent', 'success');
            await fetchEverything();
        } catch {
            showToast('Could not send your re-entry request. Please try again.');
        } finally {
            reEntryRef.current = false;
            setReEntryBusy(false);
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

    const activeDayData = schedule.find(day => day.fullDate === selectedDate);
    const visibleDates = monthExpanded ? schedule.map(day => day.fullDate) : weekDates(selectedDate);
    const isDayLocked = (day: CalendarDay | null | undefined) => Boolean(day && (
        day.locked || schedule.find(current => current.fullDate === day.fullDate)?.locked ||
        ((attendanceStatus === 'active' || attendanceStatus === 'completed') && attendanceRecord &&
            (day.id === attendanceRecord.shift_id || day.fullDate === getAttendanceDate(new Date(attendanceRecord.check_in))))
    ));
    const selectDate = (date: string) => {
        setSelectedDate(date);
        setViewDate(new Date(`${date}T12:00:00Z`));
    };
    const navigateSchedule = (direction: number) => {
        if (!monthExpanded) return selectDate(addScheduleDays(selectedDate, direction * 7));
        selectDate(new Date(Date.UTC(currentYear, currentMonth + direction, 1, 12)).toISOString().slice(0, 10));
    };
    const retryAttendance = () => {
        if (attendanceOperationRef.current) return;
        void init();
        void fetchToday();
        if (requestsError) void fetchEverything();
    };

    return (
        <div className="employee-home">
            {toast && <div role="status" aria-live="polite" className={`employee-toast flex items-center gap-3 ${toast.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{toast.msg}</span>
            </div>}
            <header className="employee-home-greeting">
                <h1>Hello, {firstName}</h1>
                <p>{scheduleDateLabel(todayStr)}</p>
            </header>
            <div className="employee-home-grid">
                <div className="employee-home-primary">
                    <EmployeeAttendanceCard today={todayStr} day={todaySchedule} nextShift={nextShift}
                        smartQrEnabled={smartQrEnabled}
                        scheduleLoading={todayLoading} scheduleError={todayError} status={attendanceStatus} record={attendanceRecord}
                        storeName={storeInfo?.name || null} busy={isSubmitting} busyLabel={attendanceMessage} error={attendanceError || (attendanceStatus === 'completed' ? requestsError : null)}
                        reEntryPending={reEntryPending} reEntryBusy={reEntryBusy} reEntryLoading={!requestsReady && !requestsError}
                        reEntryUnavailable={requestsError ? 'Re-entry is unavailable until pending requests can be checked.' : !attendanceShiftId && !todayLoading ? 'Ask your manager to review this attendance record if you need to clock in again.' : null}
                        onClockIn={handleClockIn} onClockOut={handleClockOut} onReEntry={handleRequestReEntry} onRetry={retryAttendance} />
                    <EmployeeStoreOpsNav variant="home" />
                </div>
                <section className="employee-home-schedule" aria-labelledby="employee-schedule-title" aria-busy={calendarLoading}>
                    <div className="employee-schedule-heading">
                        <h2 id="employee-schedule-title">My schedule</h2>
                        <button type="button" className="employee-schedule-toggle" onClick={() => setMonthExpanded(value => !value)} aria-expanded={monthExpanded} aria-controls="employee-schedule-dates">
                            {monthExpanded ? 'Show week' : 'Full month'}<ChevronDown size={15} className={monthExpanded ? 'employee-chevron-open' : ''} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="employee-schedule-navigation">
                        <button type="button" aria-label={`Previous ${monthExpanded ? 'month' : 'week'}`} onClick={() => navigateSchedule(-1)} className="employee-icon-button"><ChevronLeft size={18} /></button>
                        <p>{scheduleDateLabel(selectedDate, { month: 'long', year: 'numeric' })}</p>
                        <button type="button" aria-label={`Next ${monthExpanded ? 'month' : 'week'}`} onClick={() => navigateSchedule(1)} className="employee-icon-button"><ChevronRight size={18} /></button>
                    </div>
                    {calendarError ? <div role="alert" className="employee-schedule-error"><p>{calendarError}</p><button type="button" onClick={() => void fetchEverything()}>Retry schedule</button></div> : (
                        <div id="employee-schedule-dates" className={`employee-home-dates ${monthExpanded ? 'is-month' : 'is-week'}`}>
                            {monthExpanded && weekDays.map(day => <span className="employee-weekday" key={day}>{day.slice(0, 2)}</span>)}
                            {visibleDates.map((date, index) => {
                                const day = schedule.find(value => value.fullDate === date);
                                const unavailable = calendarLoading || !day;
                                const state = day?.isLeave ? 'leave' : day?.active ? 'work' : 'off';
                                return <button type="button" key={date} disabled={unavailable} onClick={() => selectDate(date)}
                                    className={`employee-home-date ${unavailable ? 'is-loading' : `is-${state}`} ${new Date(`${date}T12:00Z`).getUTCMonth() !== currentMonth ? 'is-adjacent' : ''}`}
                                    aria-label={`${scheduleDateLabel(date)}, ${unavailable ? 'Loading' : day?.isLeave ? 'Leave' : day?.active ? day.label || 'Working day' : 'Day off'}${day?.request ? ', change requested' : ''}`}
                                    aria-pressed={date === selectedDate} aria-current={date === todayStr ? 'date' : undefined}>
                                    {!monthExpanded && <span className="employee-date-weekday">{weekDays[index].slice(0, 3)}</span>}
                                    <span>{Number(date.slice(8, 10))}</span><i aria-hidden="true" />
                                </button>;
                            })}
                        </div>
                    )}
                    <div className="employee-home-legend"><span><i className="is-work" />Working</span><span><i className="is-off" />Off</span><span><i className="is-leave" />Leave</span></div>
                    {!calendarError && !calendarLoading && activeDayData && <div className="employee-selected-shift">
                        <div className="employee-selected-heading"><h3>{scheduleDateLabel(selectedDate)}</h3>{selectedDate !== todayStr && <button type="button" onClick={() => selectDate(todayStr)}>Today</button>}</div>
                        <p className="employee-selected-label">{activeDayData.isLeave ? 'Approved leave' : activeDayData.active ? activeDayData.label || 'Working day' : 'Day off'}</p>
                        {activeDayData.active && !activeDayData.isLeave && <p className="employee-selected-time">{activeDayData.start?.time} {activeDayData.start?.period} – {activeDayData.end?.time} {activeDayData.end?.period}</p>}
                        {activeDayData.request ? <div className="employee-pending-request"><p>Change requested · awaiting approval</p><p>{activeDayData.request.message}</p><button type="button" disabled={cancellingRequestId === activeDayData.request.id} onClick={() => { if (activeDayData.request) void handleCancelRequest(activeDayData.request.id); }}><XCircle size={15} aria-hidden="true" />{cancellingRequestId ? 'Cancelling…' : 'Cancel request'}</button></div>
                        : isDayLocked(activeDayData) ? <p className="employee-shift-locked"><LockKeyhole size={13} aria-hidden="true" />Attendance started · shift changes locked</p>
                        : activeDayData.fullDate >= todayStr && !activeDayData.isLeave && <button type="button" className="employee-request-change" onClick={() => {
                            setSourceDay(activeDayData); setTargetDay(null); setSelectedNewShift(null); setInterchangeNote('');
                            setInterchangeMode(activeDayData.active ? 'shift_type' : 'swap_date'); setIsInterchangeModalOpen(true);
                        }}><RefreshCcw size={15} aria-hidden="true" />Request a change</button>}
                    </div>}
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
                                            <p className="text-sm font-medium text-slate-900">{scheduleDateLabel(sourceDay.fullDate)}</p>
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
                                                <p className="text-sm text-slate-500 font-medium">on {scheduleDateLabel(sourceDay.fullDate)}</p>
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
                                                if (d.fullDate === sourceDay.fullDate || d.isLeave || d.request) return false;
                                                if (!sourceDay.active) return d.active;
                                                return true;
                                            }).map(d => {
                                                const dTheme = getTheme(d);
                                                return (
                                                    <button key={d.fullDate} onClick={() => { setTargetDay(d); setSelectedNewShift(null); }} className={`aspect-square rounded-xl text-sm font-medium border transition-colors flex flex-col items-center justify-center gap-0.5 ${targetDay?.fullDate === d.fullDate ? 'bg-slate-900 border-slate-900 text-white ' : `bg-white border-slate-100 hover:border-slate-300 ${dTheme.text}`}`}>
                                                        <span>{scheduleDateLabel(d.fullDate, { day: 'numeric', month: 'short' })}</span>
                                                        <span className={`text-xs  ${targetDay?.fullDate === d.fullDate ? 'text-white/60' : ''}`}>{d.active ? 'Work' : 'Off'}</span>
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
                                                        <p className="text-sm font-medium text-slate-900">{scheduleDateLabel(targetDay.fullDate)}</p>
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
