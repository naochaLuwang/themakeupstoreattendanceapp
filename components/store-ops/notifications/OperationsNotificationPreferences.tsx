'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOperationsNotificationPreference, saveOperationsNotificationPreference } from '@/app/actions/store-ops/notifications';
import '@/components/notifications/notifications.css';

type Preferences = { enabled: boolean; push_enabled: boolean };
export default function OperationsNotificationPreferences({ userId, initial }: { userId: string; initial?: Preferences }) {
    const [value, setValue] = useState<Preferences | null>(initial ?? null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const version = useRef(0);
    const mutation = useRef(false);
    const load = useCallback(async () => {
        if (mutation.current) return;
        const current = ++version.current;
        try {
            const result = await getOperationsNotificationPreference(userId);
            if (current !== version.current) return;
            if (!result.success) throw new Error(result.error);
            setValue(result.data); setError(null);
        } catch { if (current === version.current) setError('Store notification settings could not be loaded. Try refreshing.'); }
    }, [userId]);
    useEffect(() => {
        if (!initial) void load();
        const refresh = () => void load();
        window.addEventListener('hrm:operations-notification-preferences-updated', refresh);
        return () => { version.current += 1; window.removeEventListener('hrm:operations-notification-preferences-updated', refresh); };
    }, [load, initial]);
    return <section className="notification-card"><div className="notification-card-heading"><div><h2>Tasks and store updates</h2><p>Choose in-app alerts and Android push for assigned tasks, approvals and other store updates.</p></div></div>
        {error && <div className="notification-error" role="alert"><p>{error}</p><button type="button" disabled={pending} onClick={() => void load()}>Refresh settings</button></div>}
        {!value && !error && <p role="status">Loading store notification settings…</p>}
        {value && <form onSubmit={async event => {
            event.preventDefault(); if (mutation.current) return;
            mutation.current = true; const current = ++version.current; setPending(true); setError(null); setMessage(null);
            try {
                const result = await saveOperationsNotificationPreference(value.enabled, value.push_enabled, userId);
                if (current !== version.current) return;
                if (!result.success) throw new Error(result.error);
                setMessage('Store notification preferences saved.');
            } catch { if (current === version.current) setError('Store notification preferences could not be saved. Try again.'); }
            finally { mutation.current = false; if (current === version.current) setPending(false); }
        }}>
            <fieldset disabled={pending}><legend className="sr-only">Store notification preferences</legend>
                <label className="notification-switch"><span>Receive task and store updates</span><input type="checkbox" checked={value.enabled} onChange={event => setValue({ ...value, enabled: event.target.checked })} /></label>
                <label className="notification-switch"><span>Push updates to my registered Android devices</span><input type="checkbox" checked={value.push_enabled} disabled={!value.enabled} onChange={event => setValue({ ...value, push_enabled: event.target.checked })} /></label>
            </fieldset>
            <p className="notification-note">Register each phone using Enable push notifications in the Android app and allow Android notification permission.</p>
            <button type="submit" className="notification-primary" disabled={pending}>{pending ? 'Saving…' : 'Save store notification preferences'}</button>
        </form>}
        {message && <p className="notification-notice" role="status">{message}</p>}
    </section>;
}
