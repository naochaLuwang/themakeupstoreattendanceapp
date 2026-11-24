import { Capacitor, registerPlugin } from '@capacitor/core';

type FeedbackKind = 'selection' | 'impact' | 'success' | 'error';
export interface NativePushConfiguration { configured: boolean; notificationsEnabled: boolean }
interface ExperiencePlugin {
    feedback(options: { kind: FeedbackKind }): Promise<void>;
    pushConfiguration(): Promise<NativePushConfiguration>;
    openNotificationSettings(): Promise<void>;
}
const Experience = registerPlugin<ExperiencePlugin>('AppExperience');

export function nativeFeedback(kind: FeedbackKind): void {
    if (!Capacitor.isNativePlatform()) return;
    // Feedback must never interrupt saving attendance or forms on older APKs.
    void Experience.feedback({ kind }).catch(() => {});
}

export function isNativeWorkspace(): boolean { return Capacitor.isNativePlatform(); }

export async function nativePushConfiguration(): Promise<NativePushConfiguration> {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return { configured: false, notificationsEnabled: false };
    try { return await Experience.pushConfiguration(); } catch { return { configured: false, notificationsEnabled: false }; }
}
export async function openNativeNotificationSettings() { await Experience.openNotificationSettings(); }
