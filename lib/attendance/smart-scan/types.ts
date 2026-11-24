import type { AttendanceRecord, AttendanceResult } from '../engine';

export type SmartLocation = { lat: number; lng: number; accuracy: number; capturedAt: string };
export type SmartCommand = { action: 'scan'; token: string; location: SmartLocation } | { action: 'confirm'; confirmationId: string; location: SmartLocation };
export type SmartFailure = { success: false; error: string; code: string; status: number };
export type SmartOutcome = {
    success: true; state: 'clocked_in' | 'completed'; data: AttendanceRecord;
    branchName: string; changed?: boolean; replayed?: boolean;
} | {
    success: true; state: 'confirmation_required'; data: AttendanceRecord;
    branchName: string; confirmationId: string; expiresAt: string; serverNow: string;
    scheduledEnd: string | null; changed: false; replayed?: boolean;
};
export type SmartConfig = {
    success: true; state: 'ready'; enabled: boolean; branchName: string | null; serverNow: string;
    store: { lat: number | null; lng: number | null; radius_meters: number | null } | null;
    policy: { maxAccuracyMeters: number; maxLocationAgeSeconds: number };
    attendance: AttendanceResult;
};
export type SmartReply = SmartOutcome | SmartConfig | SmartFailure;
