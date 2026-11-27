'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { markAsRead, markAllAsRead } from '@/app/actions/store-ops/notifications';
import { loadNotificationFeed, type NotificationScope, type NotificationSnapshot } from './feed';

export function useNotificationFeed(userId: string, scope: NotificationScope = 'all') {
    const [client] = useState(() => createClient());
    const [snapshot, setSnapshot] = useState<NotificationSnapshot>({ items: [], unreadCount: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const version = useRef(0);
    const alive = useRef(false);
    const mutating = useRef(false);

    const refresh = useCallback(async () => {
        if (!alive.current || mutating.current) return;
        const current = ++version.current;
        try {
            const next = await loadNotificationFeed(client, userId, scope);
            if (alive.current && current === version.current) { setSnapshot(next); setError(null); }
        } catch {
            if (alive.current && current === version.current) setError('Notifications could not be loaded. Try refreshing.');
        } finally {
            if (alive.current && current === version.current) setLoading(false);
        }
    }, [client, userId, scope]);

    useEffect(() => {
        alive.current = true;
        setSnapshot({ items: [], unreadCount: 0 }); setLoading(true); setError(null);
        const foregroundRefresh = () => { if (!document.hidden) void refresh(); };
        const channel = client.channel(`notification-feed:${userId}:${scope}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_log', filter: `user_id=eq.${userId}` }, () => void refresh())
            .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
        void refresh();
        const poll = window.setInterval(foregroundRefresh, 60000);
        window.addEventListener('hrm:notification', foregroundRefresh);
        window.addEventListener('hrm:notification-read', foregroundRefresh);
        window.addEventListener('hrm:resume', foregroundRefresh);
        window.addEventListener('online', foregroundRefresh);
        document.addEventListener('visibilitychange', foregroundRefresh);
        return () => {
            alive.current = false; version.current += 1;
            window.clearInterval(poll);
            window.removeEventListener('hrm:notification', foregroundRefresh);
            window.removeEventListener('hrm:notification-read', foregroundRefresh);
            window.removeEventListener('hrm:resume', foregroundRefresh);
            window.removeEventListener('online', foregroundRefresh);
            document.removeEventListener('visibilitychange', foregroundRefresh);
            void client.removeChannel(channel);
        };
    }, [client, userId, scope, refresh]);

    const markRead = async (id?: string) => {
        if (mutating.current || !alive.current) return false;
        mutating.current = true; setBusy(true); setError(null);
        const current = ++version.current;
        let saved = false;
        try {
            const result = id ? await markAsRead(id) : await markAllAsRead(userId, scope);
            if (!result.success) throw new Error(result.error || 'The notification could not be marked read.');
            if (!alive.current || current !== version.current) return false;
            setSnapshot(previous => ({
                items: previous.items.map(item => !id || item.id === id ? { ...item, is_read: true } : item),
                unreadCount: id ? Math.max(0, previous.unreadCount - Number(previous.items.some(item => item.id === id && !item.is_read))) : 0,
            }));
            saved = true;
            return true;
        } catch {
            if (alive.current && current === version.current) setError('The notification could not be marked read. Try again.');
            return false;
        } finally {
            mutating.current = false;
            if (alive.current && current === version.current) {
                setBusy(false); setLoading(false);
                if (saved) window.dispatchEvent(new Event('hrm:notification-read'));
            }
        }
    };
    return { userId, ...snapshot, loading, error, busy, refresh, markRead };
}
