'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MapPin, ScanLine } from 'lucide-react';
import SwipeToConfirm from '@/components/SwipeToConfirm';
import { attendanceTime, scheduleDateLabel, workedDuration } from '@/lib/attendance/schedule';
import { getAttendanceDate } from '@/lib/attendance/date';
import type { AttendanceRecord, AttendanceStatus, CalendarDay } from '@/lib/attendance/schedule';

interface Props {
    today: string;
    day: CalendarDay | null;
    nextShift: CalendarDay | null;
    scheduleLoading: boolean;
    scheduleError: string | null;
    status: AttendanceStatus;
    record: AttendanceRecord | null;
    storeName: string | null;
    busy: boolean;
    busyLabel: string;
    error: string | null;
    reEntryPending: boolean;
    reEntryBusy: boolean;
    reEntryLoading: boolean;
    reEntryUnavailable: string | null;
    onClockIn: () => Promise<void>;
    onClockOut: () => Promise<void>;
    onReEntry: () => Promise<void>;
    onRetry: () => void;
    smartQrEnabled?: boolean;
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
    const label = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
    return <span className="employee-attendance-timer" role="timer" aria-label="Time on shift" aria-live="off">{label}</span>;
}

export default function EmployeeAttendanceCard(props: Props) {
    const manual = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const openManual = () => { if (window.location.hash === '#manual-attendance' && manual.current) manual.current.open = true; };
        openManual(); window.addEventListener('hashchange', openManual);
        return () => window.removeEventListener('hashchange', openManual);
    }, [props.smartQrEnabled]);
    const { today, day, nextShift, scheduleLoading, scheduleError, status, record, storeName, busy, busyLabel, error, onClockIn, onClockOut, onRetry } = props;
    const working = status === 'active';
    const completed = status === 'completed';
    const checking = status === 'checking' || (!working && !completed && scheduleLoading);
    const unavailable = !working && !completed && Boolean(scheduleError);
    const canClockIn = !checking && !unavailable && day?.active && !day.isLeave;
    const label = working ? 'On shift' : completed ? 'Completed' : checking ? 'Checking…' : unavailable ? 'Unavailable' : day?.isLeave ? 'On leave' : !day?.active ? 'Day off' : 'Not clocked in';
    const previousDay = working && record && getAttendanceDate(new Date(record.check_in)) !== today;
    const problem = error || (!working && !completed ? scheduleError : null);
    const manualControl = <><SwipeToConfirm key={working ? 'clock-out' : 'clock-in'} label={working ? 'Swipe to clock out' : 'Swipe to clock in'} variant={working ? 'end' : 'start'} busy={busy} busyLabel={busyLabel || 'Saving attendance…'} onConfirm={working ? onClockOut : onClockIn} /><p className="employee-attendance-hint">{working ? 'Location is not required to clock out.' : 'Your location is checked after you swipe.'}</p></>;

    return (
        <section id="today-attendance" className="employee-today-card" data-status={working ? 'active' : completed ? 'completed' : 'idle'} aria-labelledby="today-attendance-title" tabIndex={-1}>
            <div className="employee-today-heading">
                <h2 id="today-attendance-title">{previousDay ? 'Current shift' : 'Today’s shift'}</h2>
                <span className="employee-attendance-status" role="status"><i aria-hidden="true" />{label}</span>
            </div>
            <div className="employee-attendance-summary">
                {working && record ? (
                    <>
                        <ElapsedTime startedAt={record.check_in} />
                        <p>Clocked in at {attendanceTime(record.check_in)}{previousDay ? ` · ${scheduleDateLabel(getAttendanceDate(new Date(record.check_in)), { day: 'numeric', month: 'short' })}` : day?.end ? ` · Ends ${day.end.time} ${day.end.period}` : ''}</p>
                    </>
                ) : completed ? (
                    <>
                        <div className="employee-attendance-finished"><CheckCircle2 size={24} aria-hidden="true" /><strong>{workedDuration(record) || 'Shift complete'}</strong></div>
                        <p>{record?.check_out ? `In ${attendanceTime(record.check_in)} · Out ${attendanceTime(record.check_out)}` : 'Updating your attendance record…'}</p>
                    </>
                ) : checking ? (
                    <><div className="employee-attendance-loading"><Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" />Loading your shift</div><p>Getting today’s attendance</p></>
                ) : unavailable ? (
                    <><strong className="employee-attendance-empty">Schedule unavailable</strong><p>Refresh to check your shift.</p></>
                ) : day?.isLeave || !day?.active ? (
                    <>
                        <strong className="employee-attendance-empty">{day?.isLeave ? 'You’re on leave today' : 'No shift today'}</strong>
                        <p>{nextShift?.start ? `Next shift: ${scheduleDateLabel(nextShift.fullDate, { weekday: 'short', day: 'numeric', month: 'short' })} · ${nextShift.start.time} ${nextShift.start.period}` : 'You can check upcoming dates in your schedule.'}</p>
                    </>
                ) : (
                    <>
                        <div className="employee-today-shift-time"><span>{day.start?.time || '—'}<small>{day.start?.period}</small></span><span aria-hidden="true">–</span><span className="sr-only">to</span><span>{day.end?.time || '—'}<small>{day.end?.period}</small></span></div>
                        {storeName && <p className="employee-attendance-store"><MapPin size={13} aria-hidden="true" />{storeName}</p>}
                    </>
                )}
            </div>
            <div className="employee-smart-scan-entry">
                <Link href="/employee/smart-scan" className="employee-smart-scan-link"><ScanLine size={20} aria-hidden="true" />Smart Scan</Link>
                {!props.smartQrEnabled && <p className="employee-attendance-hint">QR attendance is not enabled for your branch. Ask your administrator to enable it in Attendance stations.</p>}
            </div>
            {(working || canClockIn) && (
                <div className="employee-attendance-action">
                    {props.smartQrEnabled ? <details ref={manual} id="manual-attendance" className="employee-manual-attendance"><summary>Use manual attendance</summary>{manualControl}</details> : manualControl}
                </div>
            )}
            {completed && (props.reEntryUnavailable ? <p className="employee-attendance-hint">{props.reEntryUnavailable}</p> : (
                <button type="button" className="employee-reentry-link" disabled={props.reEntryPending || props.reEntryBusy || props.reEntryLoading} onClick={() => void props.onReEntry()}>
                    {props.reEntryPending ? 'Re-entry request sent · awaiting approval' : props.reEntryLoading ? 'Checking re-entry requests…' : props.reEntryBusy ? 'Sending request…' : 'Clocked out by accident? Request re-entry'}
                </button>
            ))}
            {problem && <div role="alert" className="employee-attendance-problem"><p>{problem}</p><button type="button" disabled={busy} onClick={onRetry}>Refresh attendance</button></div>}
        </section>
    );
}
