'use client';
import type { NotificationCommand, NotificationReply, NotificationUserData } from './types';
import { nativePushConfiguration } from '@/lib/native/experience';
export { nativePushConfiguration, openNativeNotificationSettings } from '@/lib/native/experience';
let registrationActive = false;
export function nativePushRegistrationActive() { return registrationActive; }
export async function postNotification(command: NotificationCommand, expectedUserId: string): Promise<NotificationReply<NotificationUserData>> {
    const response = await fetch('/api/notifications', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, expectedUserId }), signal: AbortSignal.timeout(15000) });
    const result = await response.json() as NotificationReply<NotificationUserData>;
    if (!result.success) throw new Error(result.error || 'Could not save notification settings.');
    if (command.action !== 'sync') window.dispatchEvent(new Event('hrm:notifications-updated'));
    return result;
}
export async function enableNativeNotifications(): Promise<string> {
    const configuration = await nativePushConfiguration();
    if (!configuration.configured) throw new Error('Android push is not configured in this build yet. In-app reminders remain available.');
    if (registrationActive) throw new Error('Notification registration is already in progress.');
    const { PushNotifications } = await import('@capacitor/push-notifications');
    if (registrationActive) throw new Error('Notification registration is already in progress.');
    registrationActive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tokenListener: Awaited<ReturnType<typeof PushNotifications.addListener>> | undefined;
    let errorListener: Awaited<ReturnType<typeof PushNotifications.addListener>> | undefined;
    let finished = false;
    try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') throw new Error('Allow notifications in Android settings to receive attendance reminders.');
        const after = await nativePushConfiguration();
        if (!after.notificationsEnabled) throw new Error('Notifications are blocked in Android settings. You can enable them there.');
        await PushNotifications.createChannel({ id: 'hrm-attendance', name: 'Attendance reminders', description: 'Shift reminders and attendance reviews', importance: 3, visibility: 0, vibration: false });
        const token = new Promise<string>((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Push registration timed out. Check your connection and try again.')), 15000);
            void Promise.all([
                PushNotifications.addListener('registration', result => resolve(result.value)).then(listener => { if (finished) void listener.remove(); else tokenListener = listener; }),
                PushNotifications.addListener('registrationError', () => reject(new Error('Android push could not register. Check the app configuration and retry.'))).then(listener => { if (finished) void listener.remove(); else errorListener = listener; }),
            ]).then(() => { if (!finished) return PushNotifications.register(); }).catch(() => reject(new Error('Android push registration is unavailable.')));
        });
        return await token;
    } finally { finished = true; registrationActive = false; if (timer) clearTimeout(timer); await Promise.allSettled([tokenListener?.remove(), errorListener?.remove()]); }
}
