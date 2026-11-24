import type { ProviderState } from './types';
export function notificationProviders(): ProviderState {
    return {
        fcm: Boolean(process.env.FCM_PROJECT_ID && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FCM_SERVICE_ACCOUNT_JSON || process.env.FCM_USE_APPLICATION_DEFAULT === 'true')),
        worker: Boolean((process.env.ATTENDANCE_REMINDER_WORKER_SECRET?.length || 0) >= 32 && process.env.SUPABASE_SERVICE_ROLE_KEY),
    };
}
