'use client';
import { useEffect, useState } from 'react';
import { Settings2, Bell } from 'lucide-react';
import type { NotificationAdminData, NotificationReply, ProviderState, ReminderSettings, ReminderTiming } from '@/lib/notifications/types';
import { defaultReminderTiming } from '@/lib/notifications/types';
import './notifications.css';

const fields = [
    { key: 'upcoming_minutes', label: 'Upcoming shift · minutes before', min: 0, max: 120 }, { key: 'missed_in_minutes', label: 'Clock-in reminder · minutes after start', min: 0, max: 120 },
    { key: 'late_minutes', label: 'Manager review · minutes after start', min: 1, max: 240 }, { key: 'ending_minutes', label: 'Shift finish · minutes before', min: 0, max: 120 },
    { key: 'missed_out_minutes', label: 'Clock-out reminder · minutes after finish', min: 0, max: 240 }, { key: 'unresolved_minutes', label: 'Unresolved session review · minutes after finish', min: 1, max: 1440 },
    { key: 'cooldown_minutes', label: 'Reminder cooldown · minutes', min: 0, max: 120 }, { key: 'delivery_window_minutes', label: 'Reminder validity · minutes', min: 5, max: 120 },
] as const;
export default function AttendanceReminderManagement({ initial, providers }: { initial: NotificationReply<NotificationAdminData>; providers: ProviderState }) {
    const [data, setData] = useState(initial.success ? initial.data : null); const [error, setError] = useState(initial.success ? null : initial.error);
    const [selected, setSelected] = useState<string | null>(null); const [original, setOriginal] = useState<ReminderSettings | null>(null);
    const [draft, setDraft] = useState<ReminderTiming>(defaultReminderTiming); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
    const refresh = async () => {
        try { const result = await (await fetch('/api/admin/attendance-notifications', { cache: 'no-store' })).json() as NotificationReply<NotificationAdminData>; if (result.success) { setData(result.data); setError(null); } else setError(result.error); }
        catch { setError('Could not refresh branch reminder status.'); }
    };
    useEffect(() => { const timer = setInterval(() => { if (!document.hidden && !selected && !busy) void refresh(); }, 30000); return () => clearInterval(timer); }, [selected, busy]);
    const save = async () => {
        if (busy || !selected) return; setBusy(true); setError(null); setNotice(null);
        try {
            const response = await fetch('/api/admin/attendance-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', storeId: selected, expectedUpdatedAt: original?.updated_at || null, settings: draft }) });
            const result = await response.json() as NotificationReply<NotificationAdminData>;
            if (!result.success) { setError(result.error); return; }
            setData(result.data); setSelected(null); setNotice('Branch reminder settings saved.');
        } catch { setError('The change could not be confirmed. Refresh branch settings before retrying.'); }
        finally { setBusy(false); }
    };
    return <div className="attendance-notifications reminder-management">
        <div className="notification-provider-status"><span>Android FCM: {providers.fcm ? 'Credentials configured' : 'Not configured'}</span><span>Worker: {providers.worker ? 'Credentials configured' : 'Not configured'}</span></div>
        <p className="notification-note">The scheduled worker generates reminders independently of the app. “Last planning run” shows the latest recorded run; push delivery also depends on device permission and connectivity.</p>
        {error && <div role="alert" className="notification-error"><p>{error}</p><button type="button" disabled={busy} onClick={() => { setSelected(null); void refresh(); }}>{selected ? 'Discard edits and refresh' : 'Refresh status'}</button></div>}{notice && <p role="status" className="notification-notice">{notice}</p>}
        {!data?.stores.length && <section className="notification-card"><Bell size={24} /><p>No branch reminder settings are available yet.</p></section>}
        {data?.stores.map(store => <section className="notification-card" key={store.id}><div className="notification-card-heading"><Settings2 size={20} /><div><h2>{store.name || 'Branch'}</h2><p>{store.settings?.enabled ? 'Reminders enabled' : 'Reminders paused'} · Last planning run {store.settings?.last_planned_at ? new Date(store.settings.last_planned_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'not recorded'}</p></div></div>
            <dl className="notification-stats"><div><dt>Scheduled</dt><dd>{store.pending}</dd></div><div><dt>Push requests accepted</dt><dd>{store.sent}</dd></div><div><dt>Delivery issues</dt><dd>{store.blocked}</dd></div></dl>
            {selected === store.id ? <form onSubmit={event => { event.preventDefault(); void save(); }}><label className="notification-switch"><span>Enable scheduled reminders for this branch</span><input type="checkbox" checked={draft.enabled} onChange={e => setDraft(v => ({ ...v, enabled: e.target.checked }))} /></label><div className="notification-timing-grid">{fields.map(field => <label key={field.key}>{field.label}<input type="number" required min={field.min} max={field.max} value={draft[field.key]} onChange={e => setDraft(v => ({ ...v, [field.key]: Number(e.target.value) }))} /></label>)}</div><p className="notification-note">Reminder timing only. Attendance and payroll rules continue as configured.</p><div className="notification-actions"><button type="submit" disabled={busy} className="notification-primary">{busy ? 'Saving…' : 'Save branch settings'}</button><button type="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button></div></form>
            : <button type="button" disabled={busy} onClick={() => { setOriginal(store.settings); setDraft(store.settings || { ...defaultReminderTiming }); setSelected(store.id); }}>Edit reminder timing</button>}
        </section>)}
    </div>;
}
