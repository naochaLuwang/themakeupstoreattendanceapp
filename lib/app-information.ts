import mobileApp from '@/mobile/app.json';

export const APP_SUPPORT_EMAIL = 'luwangtech0@gmail.com';
export const APP_PUBLIC_ORIGIN = mobileApp.serverUrl;
export const POLICY_UPDATED_DATE = '2026-11-27';
export function supportEmailHref(subject: string, body?: string): string {
    const query = new URLSearchParams({ subject, ...(body ? { body } : {}) });
    return `mailto:${APP_SUPPORT_EMAIL}?${query.toString().replace(/\+/g, '%20')}`;
}
