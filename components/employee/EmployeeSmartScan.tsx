'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Check, CircleAlert, Clock3, Loader2, MapPin, ScanLine } from 'lucide-react';
import { useSmartScan } from '@/lib/attendance/smart-scan/useSmartScan';
import { scanProgress } from '@/lib/attendance/smart-scan/progress';
import { attendanceTime, workedDuration } from '@/lib/attendance/schedule';
import { stationSeconds } from '@/lib/attendance/stations/clock';
import SmartScanProgress from './SmartScanProgress';
import type { SmartConfig, SmartFailure } from '@/lib/attendance/smart-scan/types';

const Camera = dynamic(() => import('./SmartScanCamera'), {
    ssr: false,
    loading: () => <div className="smart-camera-placeholder" role="status"><Loader2 size={24} className="smart-progress-spinner" aria-hidden="true" /><span>Opening camera</span></div>,
});

export default function EmployeeSmartScan({ initial }: { initial: SmartConfig | SmartFailure }) {
    const scan = useSmartScan(initial);
    const [now, setNow] = useState(0);
    const heading = useRef<HTMLHeadingElement>(null);
    const confirming = scan.outcome?.state === 'confirmation_required' ? scan.outcome : null;
    const result = scan.stage === 'success' && scan.outcome?.state !== 'confirmation_required' ? scan.outcome : null;
    const busy = scan.stage === 'locating' || scan.stage === 'submitting';
    const clockNow = Math.max(now, scan.serverTime?.received ?? 0);
    const seconds = stationSeconds(scan.deadline, clockNow);
    const expired = scan.stage === 'confirming' && seconds <= 0;
    const serverNow = scan.serverTime ? scan.serverTime.stamp + clockNow - scan.serverTime.received : 0;
    const previous = scan.config?.attendance;
    const clockingOut = previous?.success && previous.state === 'clocked_in';
    const alreadyComplete = scan.stage === 'scanning' && previous?.success && previous.state === 'completed';
    const needsReview = scan.stage === 'scanning' && previous?.success && (previous.state === 'attendance_exception' || previous.state === 'pending_review');
    const brokenLocation = scan.config?.enabled && (!scan.config.store || typeof scan.config.store.lat !== 'number' || typeof scan.config.store.lng !== 'number');
    const blocked = scan.stage === 'disabled' || brokenLocation || needsReview || alreadyComplete;
    const steps = scanProgress(scan.stage, scan.phase, scan.outcome, expired);

    useEffect(() => {
        if (!confirming) return;
        setNow(performance.now());
        const timer = window.setInterval(() => setNow(performance.now()), 500);
        return () => window.clearInterval(timer);
    }, [confirming]);
    useEffect(() => {
        if (scan.stage === 'confirming' || scan.stage === 'success' || scan.stage === 'error') heading.current?.focus();
    }, [scan.stage]);

    const title = result ? result.replayed ? result.state === 'clocked_in' ? 'Already clocked in' : 'Already clocked out' : result.state === 'clocked_in' ? 'You’re clocked in' : 'Shift complete'
        : scan.stage === 'scanning' ? clockingOut ? 'Scan to clock out' : 'Scan to clock in'
        : scan.stage === 'refreshing' ? 'Refreshing attendance'
        : confirming && (scan.stage === 'confirming' || busy) ? busy ? 'Confirming clock out' : expired ? 'Confirmation expired' : 'Ready to clock out?'
        : scan.stage === 'error' ? 'Let’s check that again' : 'Verifying your scan';
    const hasProgress = scan.stage === 'scanning' || scan.phase !== 'scan';
    const compactProgress = scan.stage === 'scanning' || Boolean(result) || Boolean(confirming && (scan.stage === 'confirming' || busy));

    return <div className="smart-scan-page">
        <header className="smart-scan-heading">
            <Link href="/employee" aria-label="Back to home"><ArrowLeft size={20} aria-hidden="true" /></Link>
            <div><h1>Smart Scan</h1><p><MapPin size={13} aria-hidden="true" />{scan.config?.branchName || 'Attendance'}</p></div>
        </header>
        {blocked ? <section className="smart-scan-card smart-scan-notice" aria-labelledby="smart-notice-title" role={brokenLocation || needsReview ? 'alert' : undefined}>
            <div className="smart-notice-icon">{alreadyComplete ? <Check size={28} aria-hidden="true" /> : needsReview || brokenLocation ? <CircleAlert size={28} aria-hidden="true" /> : <ScanLine size={28} aria-hidden="true" />}</div>
            <h2 id="smart-notice-title">{alreadyComplete ? 'Shift complete' : needsReview ? 'Attendance needs review' : brokenLocation ? 'Branch location unavailable' : 'QR attendance unavailable'}</h2>
            <p>{alreadyComplete ? previous?.success && previous.data?.check_out ? `Clocked out at ${attendanceTime(previous.data.check_out)}` : 'Your attendance is recorded' : needsReview ? 'Ask your manager to review your attendance' : brokenLocation ? 'Ask your manager to check the branch location' : 'Ask your manager to enable Smart Scan'}</p>
            {alreadyComplete && <Link className="smart-primary" href="/employee">Back to home</Link>}
        </section> : <section className="smart-scan-card" data-view={scan.stage} aria-labelledby="smart-scan-title" aria-busy={busy || scan.stage === 'refreshing'}>
            <div className="smart-card-heading">
                {result && <span className="smart-saved-mark"><Check size={24} strokeWidth={2} aria-hidden="true" /></span>}
                <h2 ref={heading} id="smart-scan-title" tabIndex={-1}>{title}</h2>
                {scan.stage === 'scanning' && clockingOut && previous?.success && previous.data && <span className="smart-shift-context"><Clock3 size={14} aria-hidden="true" />Started {attendanceTime(previous.data.check_in)}</span>}
            </div>
            {scan.stage === 'scanning' && <Camera onScan={token => void scan.submit({ action: 'scan', token })} />}
            {result && <div className="smart-scan-receipt" role="status">
                <span className="smart-receipt-label">{result.state === 'clocked_in' ? 'Clock-in time' : 'Clock-out time'}</span>
                <strong>{attendanceTime(result.state === 'clocked_in' ? result.data.check_in : result.data.check_out || result.data.check_in)}</strong>
                {result.state === 'completed' && workedDuration(result.data) && <span className="smart-worked-time">{workedDuration(result.data)} worked</span>}
                {result.replayed && <span className="smart-receipt-note">Previously recorded</span>}
            </div>}
            {scan.stage === 'refreshing' ? <div className="smart-refreshing" role="status"><Loader2 size={28} className="smart-progress-spinner" aria-hidden="true" /><span>Getting your latest status</span></div>
                : hasProgress && <SmartScanProgress steps={steps} compact={compactProgress} />}
            {busy && <p className="sr-only" role="status">{scan.label}</p>}
            {scan.stage === 'locating' && scan.label.includes('Refining') && <p className="smart-verification-note">Move closer to the store entrance</p>}
            {confirming && (scan.stage === 'confirming' || busy) && <div className="smart-scan-confirm">
                <dl><div><dt>Clocked in</dt><dd>{attendanceTime(confirming.data.check_in)}</dd></div><div><dt>Time worked</dt><dd>{serverNow ? workedDuration({ ...confirming.data, check_out: new Date(serverNow).toISOString() }) : '—'}</dd></div></dl>
                {confirming.scheduledEnd && <p className="smart-shift-timing"><span>Scheduled finish</span><span>{attendanceTime(confirming.scheduledEnd)}</span></p>}
                {expired && <p className="sr-only" role="alert">Confirmation expired. Scan again to clock out.</p>}
                {expired ? <button className="smart-primary" type="button" onClick={() => void scan.refresh()}>Scan again</button>
                    : <button className="smart-primary" type="button" disabled={busy || seconds <= 0} onClick={() => void scan.submit({ action: 'confirm', confirmationId: confirming.confirmationId })}>{busy ? <><Loader2 size={18} className="smart-progress-spinner" aria-hidden="true" />Confirming…</> : 'Confirm clock out'}</button>}
                {!busy && <><Link href="/employee" className="smart-secondary">Keep working</Link>{!expired && <p className="smart-expiry" role="timer" aria-live="off">Confirm within {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>}</>}
            </div>}
            {scan.stage === 'error' && <div className="smart-scan-error" role="alert">
                {!hasProgress && <CircleAlert size={28} aria-hidden="true" />}
                <p>{scan.error}</p>
                {scan.canRetry && <button type="button" className="smart-primary" onClick={() => void scan.retry()}>Retry request</button>}
                <button type="button" className={scan.canRetry ? 'smart-secondary' : 'smart-primary'} onClick={() => void scan.refresh()}>{scan.canRetry ? 'Refresh status' : 'Try again'}</button>
            </div>}
            {result && <Link href="/employee" className="smart-primary">Done</Link>}
        </section>}
        {!result && !alreadyComplete && <footer className="smart-scan-footer"><Link href="/employee#manual-attendance">Use manual attendance</Link></footer>}
    </div>;
}
