'use client';
import { useState } from 'react';
import Link from 'next/link';
import NotificationPanel from './NotificationPanel';
import { saveOperationsNotificationPreference } from '@/app/actions/store-ops/notifications';

export default function OperationsNotifications({ userId, initial }: { userId: string; initial: { enabled: boolean; push_enabled: boolean } }) {
    const [value, setValue] = useState(initial);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    return <div className="space-y-6"><h1 className="text-2xl font-medium">Operations notifications</h1><form className="space-y-3 rounded-xl border p-4" onSubmit={async event => {
        event.preventDefault(); setPending(true); setMessage(null);
        try { const result = await saveOperationsNotificationPreference(value.enabled, value.push_enabled); setMessage(result.error || 'Preferences saved.'); } catch { setMessage('Preferences could not be saved.'); } finally { setPending(false); }
    }}><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value.enabled} onChange={event => setValue({ ...value, enabled: event.target.checked })} />Receive operations updates</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value.push_enabled} disabled={!value.enabled} onChange={event => setValue({ ...value, push_enabled: event.target.checked })} />Send updates to my registered Android devices</label><p className="text-sm text-slate-500">Register your device and allow notifications in <Link href="/employee/notifications" className="underline">notification device settings</Link>. Delivery also requires the server worker and Firebase configuration.</p><button disabled={pending} className="rounded-lg border px-4 py-2 text-sm">{pending ? 'Saving…' : 'Save preferences'}</button>{message && <p role="status" className="text-sm">{message}</p>}</form><NotificationPanel userId={userId} embedded operationsOnly /></div>;
}
