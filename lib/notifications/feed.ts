import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type NotificationScope = 'all' | 'attendance' | 'operations';
export type NotificationItem = Database['public']['Tables']['notification_log']['Row'];
export type NotificationSnapshot = { items: NotificationItem[]; unreadCount: number };

/** Count all unread items independently of the recent-items limit. RLS also enforces ownership. */
export async function loadNotificationFeed(client: SupabaseClient<Database>, userId: string, scope: NotificationScope = 'all'): Promise<NotificationSnapshot> {
    let items = client.from('notification_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    let unread = client.from('notification_log').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    if (scope === 'attendance') {
        items = items.not('attendance_reminder_id', 'is', null);
        unread = unread.not('attendance_reminder_id', 'is', null);
    } else if (scope === 'operations') {
        items = items.like('type', 'ops_%');
        unread = unread.like('type', 'ops_%');
    }
    const [recent, count] = await Promise.all([items, unread]);
    if (recent.error || count.error || count.count === null) throw new Error('Notifications could not be loaded. Try refreshing.');
    return { items: recent.data ?? [], unreadCount: count.count };
}
