'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Wifi, WifiOff, Loader2, ShieldCheck, RefreshCw, Unplug } from 'lucide-react';
import AppBrand from '@/components/AppBrand';
import ThemeToggle from '@/components/ThemeToggle';
import StationQr from './StationQr';
import { stationDeadline, stationSeconds } from '@/lib/attendance/stations/clock';
import type { StationReply, StationSnapshot } from '@/lib/attendance/stations/types';

type Action = 'start' | 'status' | 'heartbeat' | 'issue' | 'forget';
export default function AttendanceStationDisplay({ stationId }: { stationId: string | null }) {
    const [snapshot, setSnapshot] = useState<StationSnapshot | null>(null);
    const [qr, setQr] = useState<{ value: string; deadline: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [needsPairing, setNeedsPairing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [online, setOnline] = useState(true);
    const [fullScreen, setFullScreen] = useState(false);
    const [canFullScreen, setCanFullScreen] = useState(false);
    const [now, setNow] = useState(0);
    const active = useRef(false);
    const generation = useRef(0);
    const inFlight = useRef(false);
    const nextPoll = useRef(0);
    const nextIssue = useRef(Infinity);
    const issueId = useRef<string | null>(null);
    const lastSuccess = useRef<number | null>(null);
    const pairDeadline = useRef(0);
    const controller = useRef<AbortController | null>(null);
    const state = useRef<StationSnapshot | null>(null);

    const run = useCallback(async (action: Action) => {
        if (!stationId || inFlight.current || !navigator.onLine || document.hidden) return;
        inFlight.current = true; setBusy(true);
        const epoch = generation.current;
        const requestStarted = performance.now();
        const abort = new AbortController(); controller.current = abort;
        const timeout = window.setTimeout(() => abort.abort(), 10000);
        if (action === 'issue' && !issueId.current) issueId.current = crypto.randomUUID();
        try {
            const response = await fetch(`/api/attendance/station/${action}`, { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: abort.signal,
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stationId, ...(action === 'issue' ? { requestId: issueId.current } : {}) }) });
            const result = await response.json() as StationReply<StationSnapshot>;
            if (!active.current || epoch !== generation.current || document.hidden) return;
            const received = performance.now(); setNow(received);
            if (!result.success) {
                setError(result.error); nextPoll.current = received + 5000;
                if (response.status === 401 || response.status === 409) { setQr(null); setNeedsPairing(true); state.current = null; lastSuccess.current = null; nextIssue.current = Infinity; nextPoll.current = Infinity; return; }
                if (result.code === 'RATE_LIMITED') { nextIssue.current = received + (result.retryAfter || 5) * 1000; }
                else if (action === 'issue') { issueId.current = null; nextIssue.current = received + 1000; }
                return;
            }
            lastSuccess.current = received; setOnline(true); setError(null); setNeedsPairing(false);
            if (action === 'forget') { state.current = null; setSnapshot(null); setQr(null); setNeedsPairing(true); nextIssue.current = Infinity; nextPoll.current = Infinity; return; }
            const data = result.data;
            state.current = data; setSnapshot(data);
            nextPoll.current = received + (data.state === 'pending' ? 3000 : data.station.heartbeat_seconds * 1000);
            if (data.state === 'pending') {
                setQr(null); pairDeadline.current = stationDeadline(data.serverNow, data.device.pairing_expires_at, requestStarted, received); nextIssue.current = Infinity;
            } else if (data.qrValue && data.expiresAt) {
                const deadline = stationDeadline(data.serverNow, data.expiresAt, requestStarted, received);
                setQr(deadline > received ? { value: data.qrValue, deadline } : null);
                nextIssue.current = deadline - (data.station.validity_seconds - data.station.refresh_seconds) * 1000;
                issueId.current = null;
            } else { nextIssue.current = received; }
        } catch {
            if (!active.current || epoch !== generation.current) return;
            setQr(null); setError('Could not reach the station. Reconnecting…'); setOnline(false);
            nextPoll.current = performance.now() + 5000;
            nextIssue.current = performance.now() + 5000;
            // Keep the issuance ID: retrying a lost response returns the same code.
        } finally {
            window.clearTimeout(timeout);
            if (epoch === generation.current) { inFlight.current = false; if (active.current) setBusy(false); }
        }
    }, [stationId]);

    useEffect(() => {
        generation.current += 1; active.current = true; setOnline(navigator.onLine); setNow(performance.now()); setCanFullScreen(Boolean(document.fullscreenEnabled));
        void run('status');
        const interval = window.setInterval(() => {
            const current = performance.now(); setNow(current);
            if (!navigator.onLine || document.hidden || inFlight.current) return;
            if (state.current?.state === 'authorized' && current >= nextIssue.current) void run('issue');
            else if (current >= nextPoll.current) void run(state.current?.state === 'authorized' ? 'heartbeat' : 'status');
        }, 500);
        const reconnect = () => { setOnline(navigator.onLine); setQr(null); nextPoll.current = 0; if (navigator.onLine) void run('status'); };
        const visibility = () => { setNow(performance.now()); setQr(null); if (!document.hidden) { nextPoll.current = 0; void run('status'); } };
        const full = () => setFullScreen(Boolean(document.fullscreenElement));
        window.addEventListener('online', reconnect); window.addEventListener('offline', reconnect);
        document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', full);
        return () => { active.current = false; generation.current += 1; controller.current?.abort(); inFlight.current = false; window.clearInterval(interval); window.removeEventListener('online', reconnect); window.removeEventListener('offline', reconnect); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', full); };
    }, [run]);

    const connected = online && lastSuccess.current !== null && now - lastSuccess.current < (snapshot?.station.offline_seconds || 60) * 1000;
    const seconds = qr ? stationSeconds(qr.deadline, now) : 0;
    const pairSeconds = stationSeconds(pairDeadline.current, now);
    const pairing = snapshot?.state === 'pending' && !needsPairing;
    const showQr = connected && !needsPairing && seconds > 0 && qr;
    return <main className="station-shell store-ui">
        <header className="station-top"><AppBrand subtitle="Attendance station" /><div className="station-tools"><ThemeToggle />{canFullScreen && <button type="button" aria-label={fullScreen ? 'Exit full screen' : 'Enter full screen'} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => setError('Full screen is unavailable.')); else void document.documentElement.requestFullscreen().catch(() => setError('Full screen is unavailable in this browser.')); }}>{fullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}</div></header>
        <div className="station-main">
            <div className="station-copy"><div className="station-connection" data-connected={connected}>{connected ? <Wifi size={16} /> : <WifiOff size={16} />}{connected ? 'Connected' : online ? 'Connecting' : 'Offline'}</div>
                <h1>{snapshot?.station.name || 'Set up this display'}</h1>
                <p className="station-branch">{snapshot?.branchName || 'A secure attendance display for your branch'}</p>
                <div className="station-instructions"><ShieldCheck size={22} aria-hidden="true" /><p>{pairing ? 'Ask an administrator to authorize the code shown here from Attendance stations.' : snapshot?.scanEnabled ? 'Open Smart Scan in the HRM app and scan the current code.' : 'Display setup mode. Employee scanning activates with the Smart Scan module.'}</p></div>
                {snapshot?.state === 'authorized' && !needsPairing && <p className="station-device-label">{snapshot.device.name} · Authorized display</p>}
            </div>
            <section className="station-code-panel" aria-label={pairing ? 'Display authorization' : 'Attendance QR'}>
                {!stationId ? <div className="station-empty"><h2>Open a station link</h2><p>Use the display link from Administration → Attendance stations.</p></div>
                : pairing && pairSeconds > 0 ? <div className="station-pair"><span>Authorize this display</span><strong aria-label={`Pairing code ${snapshot.pairingCode}`}>{snapshot.pairingCode?.slice(0, 4)} {snapshot.pairingCode?.slice(4)}</strong><p>Code expires in {Math.floor(pairSeconds / 60)}:{String(pairSeconds % 60).padStart(2, '0')}</p></div>
                : showQr ? <><StationQr value={showQr.value} /><div className="station-expiration"><span>Refreshes automatically</span><strong>{seconds}s</strong></div><progress max={snapshot?.station.validity_seconds || 45} value={seconds} aria-label="QR validity remaining" /></>
                : <div className="station-empty">{busy ? <Loader2 className="motion-safe:animate-spin" size={28} aria-hidden="true" /> : <ShieldCheck size={32} aria-hidden="true" />}<h2>{needsPairing || pairing ? 'Authorization needed' : snapshot ? 'Getting a fresh code' : 'Pair this display'}</h2><p>{snapshot?.state === 'authorized' && !needsPairing ? 'Expired codes stay hidden while the connection recovers.' : 'An administrator approves each display once. Their account can stay signed out here.'}</p>{(!snapshot || needsPairing || pairing) && <button type="button" className="station-primary" disabled={busy || !online} onClick={() => void run('start')}>Authorize display</button>}</div>}
            </section>
        </div>
        {error && <div className="station-error" role="alert"><p>{error}</p><button type="button" disabled={busy || !online} onClick={() => { nextPoll.current = 0; void run('status'); }}><RefreshCw size={16} />Retry connection</button></div>}
        <footer className="station-footer"><p>Codes are short-lived and bound to this branch.</p>{(snapshot || needsPairing) && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Unpair this display? An administrator must authorize it again.')) void run('forget'); }}><Unplug size={15} />Unpair display</button>}</footer>
    </main>;
}
