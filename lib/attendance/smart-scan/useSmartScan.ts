'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClockInLocation } from '../location';
import { stationDeadline } from '../stations/clock';
import { nativeFeedback } from '@/lib/native/experience';
import type { SmartCommand, SmartConfig, SmartFailure, SmartOutcome, SmartReply, SmartScanPhase, SmartScanStage } from './types';

type Pending = { command: SmartCommand; operationId: string };
export function useSmartScan(initial: SmartConfig | SmartFailure) {
    const router = useRouter();
    const [config, setConfig] = useState<SmartConfig | null>(initial.success ? initial : null);
    const [stage, setStage] = useState<SmartScanStage>(initial.success ? initial.enabled ? 'scanning' : 'disabled' : 'error');
    const [phase, setPhase] = useState<SmartScanPhase>('scan');
    const [error, setError] = useState<string | null>(initial.success ? null : initial.error);
    const [label, setLabel] = useState('Checking your location…');
    const [outcome, setOutcome] = useState<SmartOutcome | null>(null);
    const [deadline, setDeadline] = useState(0);
    const [serverTime, setServerTime] = useState<{ stamp: number; received: number } | null>(null);
    const [canRetry, setCanRetry] = useState(false);
    const pending = useRef<Pending | null>(null);
    const busy = useRef(false);
    const alive = useRef(false);
    const abort = useRef<AbortController | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);

    const send = useCallback(async (request: Pending, controller: AbortController) => {
        const started = performance.now();
        const timeout = window.setTimeout(() => controller.abort(), 20000);
        try {
            setPhase('attendance'); setStage('submitting'); setLabel(request.command.action === 'confirm' ? 'Confirming clock-out…' : 'Verifying attendance…');
            const response = await fetch('/api/attendance/smart-scan', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request.command, operationId: request.operationId }) });
            const result = await response.json() as SmartReply;
            if (!alive.current) return;
            if (!result.success) { pending.current = null; setCanRetry(false); throw new Error(result.error); }
            if (result.state === 'ready') throw new Error('The scan response could not be verified. Refresh attendance.');
            pending.current = null; setCanRetry(false); setOutcome(result); setError(null);
            if (result.state === 'confirmation_required') {
                const received = performance.now(); setDeadline(stationDeadline(result.serverNow, result.expiresAt, started, received));
                setServerTime({ stamp: Date.parse(result.serverNow), received }); setStage('confirming'); nativeFeedback('selection');
            } else {
                setStage('success'); nativeFeedback('success'); window.dispatchEvent(new Event('hrm:attendance-updated')); router.refresh();
            }
        } finally { window.clearTimeout(timeout); }
    }, [router]);

    const submit = useCallback(async (intent: { action: 'scan'; token: string } | { action: 'confirm'; confirmationId: string }) => {
        if (busy.current || !config?.enabled || !config.store || typeof config.store.lat !== 'number' || typeof config.store.lng !== 'number') return;
        busy.current = true; setError(null); setCanRetry(false); setPhase('location'); setStage('locating'); setLabel('Checking your location…');
        const controller = new AbortController(); abort.current = controller;
        let locationTimedOut = false;
        const locationTimer = window.setTimeout(() => { locationTimedOut = true; controller.abort(); }, 15000);
        try {
            if (!navigator.onLine) throw new Error('You’re offline. Reconnect before recording attendance.');
            const position = await getClockInLocation({ ...config.store, lat: config.store.lat, lng: config.store.lng }, () => setLabel('Refining your location. Stay near the entrance…'), controller.signal, config.policy);
            window.clearTimeout(locationTimer);
            if (!alive.current || controller.signal.aborted) return;
            const request: Pending = { command: { ...intent, location: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() } }, operationId: crypto.randomUUID() };
            pending.current = request; await send(request, controller);
        } catch (cause: unknown) {
            if (!alive.current) return;
            setError(pending.current ? 'The response was interrupted. Attendance may have saved. Retry this request or refresh your status.' : locationTimedOut ? 'Location took too long. Turn on precise location, move closer to the entrance and retry, or ask your manager for a correction.' : cause instanceof Error ? cause.message.replace(/swipe again/g, 'try again') : 'Attendance could not be verified. Try again.');
            setCanRetry(Boolean(pending.current)); setStage('error'); nativeFeedback('error');
        } finally { window.clearTimeout(locationTimer); busy.current = false; }
    }, [config, send]);

    const retry = async () => {
        if (busy.current || !pending.current) return;
        busy.current = true; setError(null); const controller = new AbortController(); abort.current = controller;
        try { await send(pending.current, controller); }
        catch (cause: unknown) { if (alive.current) { setError(pending.current ? 'The response is still unavailable. Refresh attendance before trying a different code.' : cause instanceof Error ? cause.message : 'Could not verify attendance.'); setCanRetry(Boolean(pending.current)); setStage('error'); } }
        finally { busy.current = false; }
    };
    const refresh = async () => {
        if (busy.current) return;
        busy.current = true; setStage('refreshing'); setLabel('Refreshing attendance…');
        const controller = new AbortController(); abort.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('/api/attendance/smart-scan', { cache: 'no-store', signal: controller.signal });
            const result = await response.json() as SmartReply;
            if (!alive.current) return;
            if (!result.success || result.state !== 'ready') throw new Error(!result.success ? result.error : 'Could not load scan settings.');
            pending.current = null; setCanRetry(false); setConfig(result); setOutcome(null); setError(null); setPhase('scan'); setStage(result.enabled ? 'scanning' : 'disabled');
        } catch (cause: unknown) { if (alive.current) { setError(cause instanceof Error ? cause.message : 'Could not refresh attendance.'); setStage('error'); } }
        finally { window.clearTimeout(timeout); busy.current = false; }
    };
    return { config, stage, phase, error, label, outcome, deadline, serverTime, canRetry, submit, retry, refresh };
}
