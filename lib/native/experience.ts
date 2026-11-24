import { Capacitor, registerPlugin } from '@capacitor/core';

type FeedbackKind = 'selection' | 'impact' | 'success' | 'error';
interface ExperiencePlugin { feedback(options: { kind: FeedbackKind }): Promise<void> }
const Experience = registerPlugin<ExperiencePlugin>('AppExperience');

export function nativeFeedback(kind: FeedbackKind): void {
    if (!Capacitor.isNativePlatform()) return;
    // Feedback must never interrupt saving attendance or forms on older APKs.
    void Experience.feedback({ kind }).catch(() => {});
}

export function isNativeWorkspace(): boolean { return Capacitor.isNativePlatform(); }
