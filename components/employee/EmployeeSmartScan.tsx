'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, ScanLine, ShieldCheck } from 'lucide-react';
import { useSmartScan } from '@/lib/attendance/smart-scan/useSmartScan';
import { attendanceTime, workedDuration } from '@/lib/attendance/schedule';
import { stationSeconds } from '@/lib/attendance/stations/clock';
import type { SmartConfig, SmartFailure } from '@/lib/attendance/smart-scan/types';

const Camera = dynamic(() => import('./SmartScanCamera'), { ssr: false, loading: () => <div className="smart-scan-loading"><Loader2 size={22} className="motion-safe:animate-spin" />Preparing camera…</div> });
export default function EmployeeSmartScan({ initial }: { initial: SmartConfig | SmartFailure }) {
    const scan = useSmartScan(initial);
    const [now, setNow] = useState(0);
    useEffect(() => { setNow(performance.now()); const timer = window.setInterval(() => setNow(performance.now()), 500); return () => window.clearInterval(timer); }, []);
    const confirming = scan.outcome?.state === 'confirmation_required' ? scan.outcome : null;
    const busy = scan.stage === 'locating' || scan.stage === 'submitting';
    const seconds = stationSeconds(scan.deadline, now);
    const serverNow = scan.serverTime ? scan.serverTime.stamp + now - scan.serverTime.received : 0;
    const previous = scan.config?.attendance;
    const alreadyComplete = scan.stage === 'scanning' && previous?.success && previous.state === 'completed';
    const needsReview = scan.stage === 'scanning' && previous?.success && (previous.state === 'attendance_exception' || previous.state === 'pending_review');
    const brokenLocation = scan.config?.enabled && (!scan.config.store || typeof scan.config.store.lat !== 'number' || typeof scan.config.store.lng !== 'number');
    return <div className="smart-scan-page">
        <header className="smart-scan-heading"><Link href="/employee" aria-label="Back to home"><ArrowLeft size={20} /></Link><div><h1>Smart Scan</h1><p>{scan.config?.branchName || 'Your branch attendance'}</p></div><ScanLine size={24} aria-hidden="true" /></header>
        {scan.stage === 'disabled' ? <section className="smart-scan-message"><ShieldCheck size={32} aria-hidden="true" /><h2>Use manual attendance</h2><p>Smart Scan is not enabled for your branch yet.</p></section>
        : brokenLocation ? <section className="smart-scan-message" role="alert"><h2>Branch location unavailable</h2><p>Ask your manager to check the branch settings. Manual attendance remains available.</p></section>
        : needsReview ? <section className="smart-scan-message" role="alert"><h2>Attendance needs review</h2><p>Ask your manager to review your existing attendance before starting another session. Your recorded hours are kept.</p></section>
        : alreadyComplete ? <section className="smart-scan-message"><CheckCircle2 size={32} aria-hidden="true" /><h2>Your shift is complete</h2><p>{previous.data?.check_out ? `Clocked out at ${attendanceTime(previous.data.check_out)}.` : 'Your completed attendance is recorded.'} Use Home if you need to request re-entry.</p></section>
        : scan.stage === 'scanning' ? <><div className="smart-scan-intro"><h2>Scan the branch display</h2><p>We’ll check your location and find the right attendance action.</p></div><Camera onScan={token => void scan.submit({ action: 'scan', token })} /></>
        : scan.stage === 'success' && scan.outcome && scan.outcome.state !== 'confirmation_required' ? <section className="smart-scan-result" role="status"><div className="smart-result-mark"><CheckCircle2 size={34} aria-hidden="true" /></div><span>{scan.outcome.replayed ? 'Attendance already recorded' : 'Attendance recorded'}</span><h2>{scan.outcome.replayed ? scan.outcome.state === 'clocked_in' ? 'Clock-in already recorded' : 'Clock-out already recorded' : scan.outcome.state === 'clocked_in' ? 'You’re clocked in' : 'Your shift is complete'}</h2><strong className="smart-result-time">{attendanceTime(scan.outcome.state === 'clocked_in' ? scan.outcome.data.check_in : scan.outcome.data.check_out || scan.outcome.data.check_in)}</strong><p><MapPin size={15} aria-hidden="true" />{scan.outcome.branchName}</p><p>{scan.outcome.replayed ? 'This code has already been used. Check Home for your current attendance.' : scan.outcome.state === 'clocked_in' ? 'You can return to work. Your time is now running.' : `${workedDuration(scan.outcome.data) || 'Your working time'} recorded.`}</p><Link href="/employee" className="smart-primary">Back to home</Link></section>
        : confirming && (scan.stage === 'confirming' || busy) ? <section className="smart-scan-confirm" aria-labelledby="confirm-clock-out"><span>Finish your shift</span><h2 id="confirm-clock-out">Ready to clock out?</h2><p>Your shift stays open until you confirm.</p><dl><div><dt>Clocked in</dt><dd>{attendanceTime(confirming.data.check_in)}</dd></div><div><dt>Time on shift</dt><dd>{serverNow ? workedDuration({ ...confirming.data, check_out: new Date(serverNow).toISOString() }) : '—'}</dd></div></dl>{confirming.scheduledEnd && <p className="smart-shift-timing">{serverNow < Date.parse(confirming.scheduledEnd) ? 'Before your scheduled finish' : 'After your scheduled finish'} · {attendanceTime(confirming.scheduledEnd)}</p>}
            <button className="smart-primary" type="button" disabled={busy || seconds <= 0} onClick={() => void scan.submit({ action: 'confirm', confirmationId: confirming.confirmationId })}>{busy ? scan.label : 'Confirm clock out'}</button>{!busy && <Link href="/employee" className="smart-secondary">Keep working</Link>}<p className="smart-expiry" role="status">{seconds > 0 ? `Confirmation expires in ${seconds}s` : 'Confirmation expired. Scan a fresh code.'}</p>{seconds <= 0 && <button type="button" className="smart-secondary" disabled={busy} onClick={() => void scan.refresh()}>Scan a fresh code</button>}</section>
        : busy ? <section className="smart-scan-loading" role="status"><Loader2 size={28} className="motion-safe:animate-spin" aria-hidden="true" /><h2>{scan.label}</h2><p>Keep this screen open while we verify attendance.</p></section>
        : <section className="smart-scan-message smart-scan-error" role="alert"><h2>Attendance needs another check</h2><p>{scan.error}</p>{scan.canRetry && <button type="button" className="smart-primary" onClick={() => void scan.retry()}>Retry the same request</button>}<button type="button" className="smart-secondary" onClick={() => void scan.refresh()}>Refresh attendance</button></section>}
        <footer className="smart-scan-footer"><Link href="/employee#manual-attendance">Use manual attendance</Link><p>Camera frames stay on this device. Location is checked only when you scan or confirm.</p></footer>
    </div>;
}
