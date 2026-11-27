'use client';

import { enableNativeNotifications, postNotification } from './client';
import { saveOperationsNotificationPreference } from '@/app/actions/store-ops/notifications';

/** A single explicit opt-in registers this device and enables task/store-update delivery. */
export async function enableEmployeePush(userId: string) {
    const token = await enableNativeNotifications();
    const registration = await postNotification({ action: 'register', name: 'Android app', provider: 'fcm', credential: { token } }, userId);
    if (!registration.success) throw new Error(registration.error);
    if (registration.data.userId !== userId) throw new Error('Your account changed. Refresh notification settings.');
    let operationsEnabled = false;
    try {
        const preference = await saveOperationsNotificationPreference(true, true, userId);
        operationsEnabled = preference.success === true;
    } catch { /* Registration succeeded; offer a retry for the separate store preference. */ }
    if (operationsEnabled) window.dispatchEvent(new Event('hrm:operations-notification-preferences-updated'));
    return { data: registration.data, operationsEnabled };
}
