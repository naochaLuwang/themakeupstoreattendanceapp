import { AttendanceInputError, attendanceUuid } from '@/lib/attendance/engine';
import type { NotificationCommand, ReminderPreferences, ReminderTiming, ReminderAdminCommand } from './types';

export function notificationObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AttendanceInputError('Invalid notification request.');
    return value as Record<string, unknown>;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new AttendanceInputError('Choose a valid notification preference.'); return value; }
function integer(value: unknown, minimum: number, maximum: number): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new AttendanceInputError(`Choose a whole number from ${minimum} to ${maximum}.`);
    return value;
}
export function reminderPreferences(input: Record<string, unknown>): ReminderPreferences {
    const quiet_start = input.quiet_start === null ? null : integer(input.quiet_start, 0, 1439);
    const quiet_end = input.quiet_end === null ? null : integer(input.quiet_end, 0, 1439);
    if ((quiet_start === null) !== (quiet_end === null) || (quiet_start !== null && quiet_start === quiet_end)) throw new AttendanceInputError('Set both quiet-hour times, with different start and end times.');
    return { enabled: boolean(input.enabled), upcoming_shift: boolean(input.upcoming_shift), missed_clock_in: boolean(input.missed_clock_in), shift_ending: boolean(input.shift_ending), missed_clock_out: boolean(input.missed_clock_out), manager_alerts: boolean(input.manager_alerts), quiet_start, quiet_end };
}
export function reminderTiming(value: unknown): ReminderTiming {
    const input = notificationObject(value);
    const settings = { enabled: boolean(input.enabled), upcoming_minutes: integer(input.upcoming_minutes, 0, 120), missed_in_minutes: integer(input.missed_in_minutes, 0, 120), late_minutes: integer(input.late_minutes, 1, 240), ending_minutes: integer(input.ending_minutes, 0, 120), missed_out_minutes: integer(input.missed_out_minutes, 0, 240), unresolved_minutes: integer(input.unresolved_minutes, 1, 1440), cooldown_minutes: integer(input.cooldown_minutes, 0, 120), delivery_window_minutes: integer(input.delivery_window_minutes, 5, 120) };
    if (settings.late_minutes < settings.missed_in_minutes || settings.unresolved_minutes < settings.missed_out_minutes) throw new AttendanceInputError('Escalation must follow its employee reminder.');
    return settings;
}
export function notificationCommand(value: unknown): NotificationCommand {
    const input = notificationObject(value);
    if (input.action === 'sync' || input.action === 'detach') return { action: input.action };
    if (input.action === 'preferences') return { action: 'preferences', ...reminderPreferences(input) };
    if (input.action === 'revoke') return { action: 'revoke', deviceId: attendanceUuid(input.deviceId, 'device') };
    if (input.action !== 'register' || typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 80) throw new AttendanceInputError('Name this device using 2 to 80 characters.');
    if (input.provider !== 'fcm') throw new AttendanceInputError('Push notifications are available only in the Android app.');
    const credential = notificationObject(input.credential);
    if (input.provider !== 'fcm' || typeof credential.token !== 'string' || !/^[A-Za-z0-9_:.-]{20,4096}$/.test(credential.token)) throw new AttendanceInputError('The push registration could not be verified.');
    return { action: 'register', name: input.name.trim(), provider: 'fcm', credential: { token: credential.token } };
}
export function reminderAdminCommand(value: unknown): ReminderAdminCommand {
    const input = notificationObject(value);
    if (input.action === 'list') return { action: 'list' };
    if (input.action !== 'save') throw new AttendanceInputError('Invalid administrator request.');
    if (input.expectedUpdatedAt !== null && (typeof input.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) throw new AttendanceInputError('Refresh branch settings before saving.');
    return { action: 'save', storeId: attendanceUuid(input.storeId, 'branch'), expectedUpdatedAt: input.expectedUpdatedAt as string | null, settings: reminderTiming(input.settings) };
}
