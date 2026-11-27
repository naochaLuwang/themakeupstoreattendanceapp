'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell, Smartphone, Loader2 } from 'lucide-react';
import { nativePushConfiguration, openNativeNotificationSettings, postNotification } from '@/lib/notifications/client';
import { enableEmployeePush } from '@/lib/notifications/employee-push';
import type { NotificationCommand, NotificationReply, NotificationUserData, ProviderState, ReminderPreferences } from '@/lib/notifications/types';
import { defaultPreferences } from '@/lib/notifications/types';
import NotificationPanel from '@/components/store-ops/notifications/NotificationPanel';
import OperationsNotificationPreferences from '@/components/store-ops/notifications/OperationsNotificationPreferences';
import './notifications.css';

const time = (minutes: number | null) => minutes === null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutes = (value: string) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
type Reply = NotificationReply<NotificationUserData> & { providers?: ProviderState };
export default function AttendanceNotificationPreferences({ userId }: { userId: string }) {
    const [data, setData] = useState<NotificationUserData | null>(null); const [prefs, setPrefs] = useState<ReminderPreferences>(defaultPreferences);
    const [providers, setProviders] = useState<ProviderState>({ fcm: false, worker: false });
    const [native, setNative] = useState(false); const [nativeReady, setNativeReady] = useState(false); const [osEnabled, setOsEnabled] = useState(false);
    const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
    const version = useRef(0); const mutation = useRef(false);
    const load = useCallback(async () => {
        const requestVersion = ++version.current;
        setLoading(true); setError(null);
        try {
            const result = await (await fetch('/api/notifications', { cache: 'no-store' })).json() as Reply;
            if (!result.success) throw new Error(result.error);
            if (requestVersion !== version.current) return;
            if (result.data.userId !== userId) throw new Error('Your account changed. Refresh this page before updating notifications.');
            setData(result.data); setPrefs(result.data.preferences); setProviders(result.providers || { fcm: false, worker: false });
            const platform = Capacitor.isNativePlatform(); setNative(platform);
            if (platform) { const config = await nativePushConfiguration(); if (requestVersion === version.current) { setNativeReady(config.configured); setOsEnabled(config.notificationsEnabled); } }
        } catch (cause: unknown) { if (requestVersion === version.current) setError(cause instanceof Error ? cause.message : 'Could not load notifications.'); }
        finally { if (requestVersion === version.current) setLoading(false); }
    }, [userId]);
    const invalidate = useCallback(() => { version.current += 1; }, []);
    useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
    const save = async (command: NotificationCommand, message: string) => {
        if (mutation.current || data?.userId !== userId) return;
        mutation.current = true; const requestVersion = version.current;
        setBusy(true); setError(null); setNotice(null);
        try { const result = await postNotification(command, userId); if (requestVersion === version.current && result.success && result.data.userId === userId) { setData(result.data); setPrefs(result.data.preferences); setNotice(message); } }
        catch (cause: unknown) { if (requestVersion === version.current) setError(cause instanceof Error ? cause.message : 'Could not save notifications.'); }
        finally { mutation.current = false; setBusy(false); }
    };
    const enable = async () => {
        if (mutation.current || data?.userId !== userId) return;
        mutation.current = true; const requestVersion = version.current;
        setBusy(true); setError(null); setNotice(null);
        try {
            if (!native) throw new Error('Push notifications are available in the Android app.');
            const result = await enableEmployeePush(userId);
            setOsEnabled(true);
            if (requestVersion === version.current && result.data.userId === userId) {
                setData(result.data);
                setNotice(result.operationsEnabled ? 'This device is registered for task, store update and attendance push notifications.' : 'This device is registered. Task push preferences could not be enabled; retry in Tasks and store updates below.');
            }
        } catch (cause: unknown) { if (requestVersion === version.current) setError(cause instanceof Error ? cause.message : 'Notification registration could not be confirmed.'); }
        finally { mutation.current = false; setBusy(false); }
    };
    const current = data?.devices.find(device => device.id === data.currentDeviceId);
    const configured = native && nativeReady && providers.fcm;
    if ((loading && !data) || (data && data.userId !== userId)) return <div className="attendance-notifications notification-loading" role="status"><Loader2 className="motion-safe:animate-spin" />Loading notification settings…</div>;
    return <div className="attendance-notifications">
        {error && <div className="notification-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => void load()}>Refresh settings</button></div>}
        {notice && <p className="notification-notice" role="status">{notice}</p>}
        {data && <>
            {!data.branchEnabled && data.role !== 'admin' && <p className="notification-note">Your branch’s scheduled reminders are paused. Your preferences will apply when they are enabled.</p>}
            <section className="notification-card"><div className="notification-card-heading"><Bell size={20} aria-hidden="true" /><div><h2>Attendance reminders</h2><p>Choose the reminders that help you stay on top of your shift.</p></div></div>
                <form onSubmit={event => { event.preventDefault(); void save({ action: 'preferences', ...prefs }, 'Your reminder preferences are saved.'); }}>
                    <label className="notification-switch"><span>Receive attendance reminders</span><input type="checkbox" checked={prefs.enabled} onChange={e => setPrefs(v => ({ ...v, enabled: e.target.checked }))} /></label>
                    <fieldset disabled={!prefs.enabled || busy}><legend className="sr-only">Reminder types</legend>{([{ key: 'upcoming_shift', label: 'Upcoming shift' }, { key: 'missed_clock_in', label: 'Clock-in reminders' }, { key: 'shift_ending', label: 'Shift finish reminders' }, { key: 'missed_clock_out', label: 'Clock-out reminders' }, ...(data.role !== 'employee' ? [{ key: 'manager_alerts' as const, label: 'Team attendance reviews' }] : [])] as const).map(field => <label className="notification-switch" key={field.key}><span>{field.label}</span><input type="checkbox" checked={prefs[field.key]} onChange={e => setPrefs(v => ({ ...v, [field.key]: e.target.checked }))} /></label>)}</fieldset>
                    <div className="notification-quiet"><p>Quiet hours <span>India time</span></p><div><label>From<input type="time" value={time(prefs.quiet_start)} onChange={e => setPrefs(v => ({ ...v, quiet_start: minutes(e.target.value) }))} /></label><label>Until<input type="time" value={time(prefs.quiet_end)} onChange={e => setPrefs(v => ({ ...v, quiet_end: minutes(e.target.value) }))} /></label></div><button type="button" onClick={() => setPrefs(v => ({ ...v, quiet_start: null, quiet_end: null }))}>Clear quiet hours</button></div>
                    <button type="submit" className="notification-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
                </form>
            </section>
            {native && <section className="notification-card"><div className="notification-card-heading"><Smartphone size={20} /><div><h2>Push on this device</h2><p>{current?.enabled ? 'This device is registered for push notifications.' : 'Get task updates, store alerts and reminders when the app is closed.'}</p></div></div>
                {!configured ? <p className="notification-note">Android push needs app setup. In-app notifications remain available.</p> : <button type="button" disabled={busy} className="notification-primary" onClick={() => { if (current?.enabled) void save({ action: 'revoke', deviceId: current.id }, 'Push notifications are turned off on this device.'); else void enable(); }}>{busy ? 'Updating…' : current?.enabled ? 'Turn off push on this device' : 'Enable push notifications'}</button>}
                {native && nativeReady && !osEnabled && <button type="button" disabled={busy} onClick={() => void openNativeNotificationSettings().catch(() => setError('Open Android app settings to manage notification permission.'))}>Open Android notification settings</button>}
                {data.devices.some(device => device.provider === 'fcm') && <div className="notification-devices">{data.devices.filter(device => device.provider === 'fcm').map(device => <div key={device.id}><div><strong>{device.name}{device.id === data.currentDeviceId ? ' · This device' : ''}</strong><p>{device.enabled && !device.revoked_at ? 'Registered' : 'Removed'} · Last active {new Date(device.last_seen_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p></div>{device.enabled && <button type="button" disabled={busy} onClick={() => void save({ action: 'revoke', deviceId: device.id }, 'Device removed from push notifications.')}>Remove</button>}</div>)}</div>}
            </section>}
            <OperationsNotificationPreferences key={`operations-${userId}`} userId={userId} attendanceAlerts={data.role === 'admin'} />
            <NotificationPanel key={userId} userId={userId} embedded attendanceOnly />
        </>}
    </div>;
}
