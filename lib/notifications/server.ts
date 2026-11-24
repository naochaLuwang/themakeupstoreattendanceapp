import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import type { NotificationAdminData, NotificationCommand, NotificationError, NotificationReply, NotificationUserData, ReminderAdminCommand } from './types';

export const INSTALLATION_COOKIE = 'hrm_notification_installation';
export function notificationFailure(error: { message: string; code?: string }): NotificationError {
    const missing = error.code === 'PGRST202' || error.code === '42883';
    const known = error.message.startsWith('REMINDER_');
    return { success: false, error: missing ? 'Attendance reminders are not ready in this workspace yet.' : known ? error.message.replace(/^REMINDER_[A-Z_]+:\s*/, '') : 'Notification settings could not be confirmed. Refresh and retry.', code: missing ? 'NOT_INSTALLED' : error.code || 'UNAVAILABLE', status: missing ? 503 : error.message.includes('UNAUTHORIZED') ? 401 : error.code === '42501' ? 403 : error.code === '23514' ? 409 : known ? 400 : 503 };
}
export function notificationReply<T>(data: Json, error: { message: string; code?: string } | null): NotificationReply<T> {
    if (error) return notificationFailure(error);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.success !== 'boolean') return notificationFailure({ message: 'Invalid response' });
    if (!data.success) return notificationFailure({ message: typeof data.error === 'string' ? data.error : '', code: typeof data.code === 'string' ? data.code : undefined });
    if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) return notificationFailure({ message: 'Invalid data' });
    return { success: true, data: data.data as unknown as T };
}
export async function notificationUser(command: NotificationCommand | { action: 'config' }, installationSecret?: string, expectedUserId?: string): Promise<NotificationReply<NotificationUserData>> {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return notificationFailure({ message: 'REMINDER_UNAUTHORIZED: sign in to manage notifications', code: '42501' });
    if (expectedUserId && expectedUserId !== user.id) return notificationFailure({ message: 'REMINDER_FORBIDDEN: your account changed; refresh before changing notifications', code: '42501' });
    const { data, error } = await client.rpc('attendance_notification_user', { p_command: { ...command, ...(installationSecret ? { installationSecret } : {}) } as unknown as Json });
    return notificationReply<NotificationUserData>(data, error);
}
export async function notificationAdmin(command: ReminderAdminCommand): Promise<NotificationReply<NotificationAdminData>> {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return notificationFailure({ message: 'REMINDER_UNAUTHORIZED: sign in to manage reminders', code: '42501' });
    const { data, error } = await client.rpc('attendance_reminder_admin', { p_command: command as unknown as Json });
    return notificationReply<NotificationAdminData>(data, error);
}
