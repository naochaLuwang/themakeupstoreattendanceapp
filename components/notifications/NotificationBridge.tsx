'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { createClient } from '@/lib/supabase/client';
import { nativePushConfiguration, nativePushRegistrationActive, postNotification } from '@/lib/notifications/client';
import { notificationPath } from '@/lib/notifications/links';
import type { NotificationReply, NotificationUserData } from '@/lib/notifications/types';
import { isPublicInformationPath } from '@/lib/public-information-routes';

/** Silent lifecycle integration. Permission requests happen only in settings. */
export default function NotificationBridge() {
    const pathname = usePathname(); const router = useRouter();
    const state = useRef<NotificationUserData | null>(null);
    useEffect(() => {
        if (pathname === '/attendance-station' || isPublicInformationPath(pathname)) return;
        let alive = true; let generation = 0; let userId: string | null = null;
        const handles: PluginListenerHandle[] = []; const timers = new Set<ReturnType<typeof setTimeout>>();
        const client = createClient();
        const read = async () => {
            try { const result = await (await fetch('/api/notifications', { cache: 'no-store' })).json() as NotificationReply<NotificationUserData>; if (alive && result.success && result.data.userId === userId) state.current = result.data; } catch { /* In-app and manual attendance remain usable. */ }
        };
        const sync = async (id: string | null) => {
            const version = ++generation; userId = id;
            if (!id) { state.current = null; return; }
            try {
                const result = await postNotification({ action: 'sync' }, id);
                if (!alive || version !== generation || !result.success) return;
                state.current = result.data;
                const device = result.data.devices.find(value => value.id === result.data.currentDeviceId);
                if (!device?.enabled) {
                    if (device?.provider === 'fcm' && Capacitor.isNativePlatform() && !nativePushRegistrationActive() && (await nativePushConfiguration()).configured) { const { PushNotifications } = await import('@capacitor/push-notifications'); await PushNotifications.unregister(); await PushNotifications.removeAllDeliveredNotifications(); }
                    return;
                }
                if (device.provider === 'fcm' && Capacitor.isNativePlatform()) {
                    const configuration = await nativePushConfiguration();
                    if (!configuration.configured || !alive || version !== generation) return;
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    if (!configuration.notificationsEnabled) { await postNotification({ action: 'revoke', deviceId: device.id }, id); if (!nativePushRegistrationActive()) await PushNotifications.unregister(); await PushNotifications.removeAllDeliveredNotifications(); }
                    else if (!nativePushRegistrationActive()) await PushNotifications.register();
                } else if (device.provider === 'webpush') await postNotification({ action: 'revoke', deviceId: device.id }, id);
            } catch { /* A later resume or explicit settings retry reconciles registration. */ }
        };
        const later = (id: string | null) => { const timer = setTimeout(() => { timers.delete(timer); if (alive) void sync(id); }, 0); timers.add(timer); };
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => later(session?.user.id || null));
        void client.auth.getUser().then(result => { if (alive) later(result.data.user?.id || null); });
        const resume = () => { if (userId) later(userId); };
        const updated = () => { if (userId) void read(); };
        window.addEventListener('hrm:resume', resume); window.addEventListener('hrm:notifications-updated', updated);
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications')) {
            void import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
                const keep = (handle: PluginListenerHandle) => { if (!alive) void handle.remove(); else handles.push(handle); };
                keep(await PushNotifications.addListener('registration', token => {
                    const data = state.current; const device = data?.devices.find(value => value.id === data.currentDeviceId);
                    if (!alive || nativePushRegistrationActive() || !data || data.userId !== userId || !device?.enabled || device.provider !== 'fcm') return;
                    void postNotification({ action: 'register', provider: 'fcm', name: device.name, credential: { token: token.value } }, data.userId).catch(() => {});
                }));
                keep(await PushNotifications.addListener('pushNotificationReceived', () => window.dispatchEvent(new Event('hrm:notification'))));
                keep(await PushNotifications.addListener('pushNotificationActionPerformed', action => {
                    if (!alive) return;
                    router.push(notificationPath(action.notification.data?.url));
                }));
            }).catch(() => {});
        }
        return () => { alive = false; generation++; subscription.unsubscribe(); timers.forEach(clearTimeout); handles.forEach(handle => { void handle.remove(); }); window.removeEventListener('hrm:resume', resume); window.removeEventListener('hrm:notifications-updated', updated); };
    }, [pathname, router]);
    return null;
}
