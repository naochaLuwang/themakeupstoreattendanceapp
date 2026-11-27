import { notificationProviders } from './config';
import { notificationObject } from './validation';
import { notificationPath } from './links';
import type { AuthorizedDelivery, DeliveryResult } from './types';

type Delivery = Extract<AuthorizedDelivery, { allowed: true }>;
type Fetcher = typeof fetch;
function retryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds : (Date.parse(value) - Date.now()) / 1000;
    return Number.isFinite(delay) ? Math.max(60, Math.min(3600, Math.ceil(delay))) : undefined;
}
export async function googleMessagingToken(): Promise<string> {
    const { GoogleAuth } = await import('google-auth-library');
    let credentials: { client_email: string; private_key: string } | undefined;
    if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
        const input = notificationObject(JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON));
        if (typeof input.client_email !== 'string' || typeof input.private_key !== 'string') throw new Error('FCM credentials are incomplete.');
        credentials = { client_email: input.client_email, private_key: input.private_key };
    }
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.messaging'], ...(credentials ? { credentials } : {}) });
    const token = await auth.getAccessToken();
    if (!token) throw new Error('FCM authorization is unavailable.');
    return token;
}
export async function sendFcm(delivery: Delivery, options: { fetcher?: Fetcher; getToken?: () => Promise<string>; projectId?: string } = {}): Promise<DeliveryResult> {
    const projectId = options.projectId || process.env.FCM_PROJECT_ID;
    if (!projectId || (!options.getToken && !notificationProviders().fcm)) return { outcome: 'blocked_configuration', errorCode: 'FCM_NOT_CONFIGURED' };
    let credential: Record<string, unknown>;
    try { credential = notificationObject(delivery.credential); } catch { return { outcome: 'permanent', errorCode: 'INVALID_REGISTRATION' }; }
    if (typeof credential.token !== 'string' || !/^[A-Za-z0-9_:.-]{20,4096}$/.test(credential.token)) return { outcome: 'invalid_device', errorCode: 'INVALID_REGISTRATION' };
    const seconds = Math.floor((Date.parse(delivery.expiresAt) - Date.now()) / 1000);
    if (!Number.isFinite(seconds) || seconds <= 0) return { outcome: 'permanent', errorCode: 'EXPIRED' };
    let accessToken: string;
    try { accessToken = await (options.getToken || googleMessagingToken)(); }
    catch { return { outcome: 'blocked_configuration', errorCode: 'FCM_AUTH_UNAVAILABLE' }; }
    const activity = delivery.category === 'operations' || delivery.category === 'attendance_event';
    try {
        const response = await (options.fetcher || fetch)(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
            method: 'POST', signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token: credential.token,
                notification: delivery.category === 'attendance_event' ? { title: 'Employee attendance update', body: 'An employee checked in or out. Open HRM to review.' } : delivery.category === 'operations' ? { title: 'Store operations update', body: 'Open HRM to review your store updates.' } : { title: 'Attendance reminder', body: 'Open HRM to review your current attendance.' },
                data: { url: notificationPath(delivery.url), notificationId: delivery.notificationId },
                android: { priority: activity ? 'high' : 'normal', ttl: `${Math.min(seconds, 7200)}s`, ...(activity ? {} : { collapse_key: 'hrm_attendance' }), notification: { channel_id: activity ? 'hrm-updates' : 'hrm-attendance', icon: 'ic_stat_hrm', color: '#704858', tag: activity ? delivery.notificationId : 'hrm-attendance' } },
            } }),
        });
        if (response.ok) return { outcome: 'sent' };
        let body: Record<string, unknown> = {};
        try { body = notificationObject(await response.json()); } catch { /* Provider body is not logged. */ }
        const error = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {};
        const details = Array.isArray(error.details) ? error.details : [];
        if (details.some(item => item && typeof item === 'object' && 'errorCode' in item && item.errorCode === 'UNREGISTERED')) return { outcome: 'invalid_device', errorCode: 'UNREGISTERED' };
        if ([401, 403, 404].includes(response.status)) return { outcome: 'blocked_configuration', errorCode: `FCM_CONFIGURATION_${response.status}` };
        if (response.status === 429 || response.status >= 500) return { outcome: 'retry', errorCode: `FCM_${response.status}`, retryAfter: retryAfter(response.headers.get('retry-after')) };
        return { outcome: 'permanent', errorCode: `FCM_${response.status}` };
    } catch { return { outcome: 'retry', errorCode: 'FCM_TRANSPORT_INTERRUPTED' }; }
}
export function createNotificationDispatcher() {
    let authorization: Promise<string> | undefined;
    const getToken = () => {
        if (!authorization) authorization = (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try { return await Promise.race([googleMessagingToken(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('FCM authorization timed out.')), 8000); })]); }
            finally { if (timer) clearTimeout(timer); }
        })();
        return authorization;
    };
    return (delivery: Delivery): Promise<DeliveryResult> => delivery.provider === 'fcm'
        ? sendFcm(delivery, notificationProviders().fcm ? { getToken } : {}) : Promise.resolve({ outcome: 'permanent', errorCode: 'BROWSER_PUSH_REMOVED' });
}
